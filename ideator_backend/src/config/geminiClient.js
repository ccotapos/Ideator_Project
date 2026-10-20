const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);
const DEFAULT_TIMEOUT_MS = 20000;
const DEFAULT_RETRIES = 2;

function isLiteModel(model) {
  return /lite/i.test(String(model || ''));
}

// Configuración de generación común. Los modelos "lite" no aceptan
// thinkingConfig (devuelven 400), así que solo se añade en modelos completos.
function buildGenerationConfig({ model, maxOutputTokens, temperature, responseMimeType, responseSchema } = {}) {
  const config = {};
  if (maxOutputTokens) config.maxOutputTokens = maxOutputTokens;
  if (temperature !== undefined) config.temperature = temperature;
  if (responseMimeType) config.responseMimeType = responseMimeType;
  if (responseSchema) config.responseSchema = responseSchema;
  if (!isLiteModel(model)) config.thinkingConfig = { thinkingBudget: 0 };
  return config;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Lanza una única petición con timeout. Devuelve el JSON parseado o lanza un
// error con `status` (HTTP) o `code = 'GEMINI_TIMEOUT'` (abortado).
async function requestOnce(model, apiKey, body, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${GEMINI_API_BASE}/${model}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    const text = await response.text();

    if (!response.ok) {
      const error = new Error(`Gemini ${model} respondió ${response.status}: ${text.slice(0, 200)}`);
      error.status = response.status;
      throw error;
    }

    return JSON.parse(text);
  } catch (error) {
    if (error.name === 'AbortError') {
      const timeoutError = new Error(`Gemini ${model} no respondió en ${timeoutMs} ms.`);
      timeoutError.code = 'GEMINI_TIMEOUT';
      throw timeoutError;
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function isRetryable(error) {
  return (
    error.code === 'GEMINI_TIMEOUT' ||
    error.status === undefined ||
    RETRYABLE_STATUS.has(error.status)
  );
}

async function generateWithRetries({ model, body, apiKey, timeoutMs, retries }) {
  let lastError;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await requestOnce(model, apiKey, body, timeoutMs);
    } catch (error) {
      lastError = error;
      if (!isRetryable(error) || attempt === retries) throw error;
      await sleep(500 * (attempt + 1));
    }
  }

  throw lastError;
}

// Llama a Gemini con timeout, reintentos y, opcionalmente, un modelo de
// respaldo si el principal falla (por saturación o timeout).
async function generateContent({
  model,
  body,
  fallback,
  apiKey = process.env.GEMINI_API_KEY,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  retries = DEFAULT_RETRIES,
} = {}) {
  if (!apiKey) throw new Error('GEMINI_API_KEY no está configurada.');
  if (!model) throw new Error('No se indicó un modelo de Gemini.');

  try {
    return await generateWithRetries({ model, body, apiKey, timeoutMs, retries });
  } catch (error) {
    if (!fallback || !fallback.model || fallback.model === model) throw error;

    console.warn(`Gemini "${model}" falló (${error.message}); se intenta el fallback "${fallback.model}".`);

    return generateWithRetries({
      model: fallback.model,
      body: fallback.body,
      apiKey,
      timeoutMs: fallback.timeoutMs || timeoutMs,
      retries: fallback.retries ?? 1,
    });
  }
}

module.exports = { generateContent, buildGenerationConfig, isLiteModel };
