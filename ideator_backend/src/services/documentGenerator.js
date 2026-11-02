const { generateContent, buildGenerationConfig } = require('../config/geminiClient');

const MODEL = process.env.GEMINI_STRUCTURED_MODEL || process.env.GEMINI_MODEL || 'gemini-3.8-flash';
const FALLBACK_MODEL = process.env.GEMINI_STRUCTURED_FALLBACK_MODEL || 'gemini-flash-lite-latest';

const SPEC_SECTIONS = ['Problema', 'Usuarios', 'MVP', 'Reglas de negocio', 'Modelo de datos', 'Servicios'];
const ARCH_SECTIONS = ['Tecnologías', 'Autenticación', 'Operación'];

const CODE_PLACEHOLDER_PATTERN = /\bTBD\b|\bTODO\b|\[\.\.\.\]|\{\{/;
const TEXT_PLACEHOLDER_PATTERN = /\bpendiente\b|por definir/i;
// El documento debe poder entregarse a una IA externa sin depender de contexto
// de Ideator (conversaciones, etapas, archivos o documentos previos).
const EXTERNAL_REFERENCE_PATTERN = /\b(?:en|seg[uú]n)\s+(?:la\s+|el\s+)?(?:conversaci[oó]n|chat|charla)\b|\bcomo\s+se\s+(?:mencion[oó]|discuti[oó]|indic[oó])\b|\bver\s+(?:la\s+|el\s+)?(?:etapa|conversaci[oó]n|chat)\b|\barchivo\s+adjunto\b|\bdocumento\s+anterior\b|\betapa\s+(?:anterior|previa)\b/i;

function normalize(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

const SCENARIO_STOPWORDS = new Set(['con', 'de', 'la', 'el', 'en', 'y', 'para', 'por', 'los', 'las', 'del', 'al', 'plus']);

function scenarioTokens(scenarioName) {
  return normalize(scenarioName)
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 1 && !SCENARIO_STOPWORDS.has(token));
}

function hasSection(text, section) {
  const target = normalize(section);
  return text
    .split('\n')
    .some((line) => /^#{1,6}\s/.test(line) && normalize(line).includes(target));
}

function validateSections(markdown, requiredSections) {
  const text = String(markdown || '').trim();
  if (text.length < 400) {
    throw new Error('El documento generado es demasiado corto para ser autocontenido.');
  }

  const missing = requiredSections.filter((section) => !hasSection(text, section));
  if (missing.length > 0) {
    throw new Error(`El documento no contiene las secciones requeridas: ${missing.join(', ')}.`);
  }

  if (CODE_PLACEHOLDER_PATTERN.test(text) || TEXT_PLACEHOLDER_PATTERN.test(text)) {
    throw new Error('El documento contiene información faltante (TBD/pendiente/por definir).');
  }

  if (EXTERNAL_REFERENCE_PATTERN.test(text)) {
    throw new Error('El documento referencia contexto externo; debe ser autocontenido.');
  }

  return text;
}

function validateSpecification(markdown) {
  return validateSections(markdown, SPEC_SECTIONS);
}

function technologyMentions(text, technologies) {
  const normalized = normalize(text);
  return technologies.filter((value) => {
    const token = String(value).split(/[\s,+/]+/).find((part) => part.length > 2) || String(value);
    return normalized.includes(normalize(token));
  }).length;
}

function validateArchitecture(markdown, architecture) {
  const text = validateSections(markdown, ARCH_SECTIONS);
  const normalized = normalize(text);
  const scenarioName = architecture?.scenarioName || architecture?.scenario || '';
  const tokens = scenarioTokens(scenarioName);
  const scenarioMentions = tokens.filter((token) => normalized.includes(token)).length;

  if (scenarioName && tokens.length > 0 && scenarioMentions === 0) {
    throw new Error(`El documento de arquitectura no menciona el escenario aprobado (${scenarioName}).`);
  }

  const technologies = Object.values(architecture?.technologies || {}).filter(Boolean);
  if (technologies.length > 0 && technologyMentions(text, technologies) < 2) {
    throw new Error('El documento de arquitectura no es consistente con las tecnologías aprobadas.');
  }

  return text;
}

function buildSpecificationPrompt(context) {
  return [
    'Genera un documento Markdown autocontenido con la ESPECIFICACIÓN COMPLETA del producto descrito.',
    'Debe incluir, como mínimo, estas secciones con encabezados Markdown: Problema, Usuarios, MVP, Reglas de negocio, Modelo de datos y Servicios (endpoints).',
    'No hagas referencia a conversaciones, archivos externos, etapas de Ideator ni información que no esté en el contexto. No uses TBD, "pendiente" ni "por definir": describe de forma coherente todo lo necesario a partir de los datos disponibles.',
    'El documento debe poder entregarse tal cual a otra IA para implementar el producto.',
    `Contexto del proyecto:\n${JSON.stringify(context)}`,
  ].join('\n\n');
}

function buildArchitecturePrompt(context) {
  const scenarioName = context?.architecture?.scenarioName || context?.architecture?.scenario || '';

  return [
    'Genera un documento Markdown autocontenido con la ARQUITECTURA DEFINITIVA del producto.',
    'Debe incluir, como mínimo, estas secciones con encabezados Markdown: Tecnologías seleccionadas, Autenticación y autorización, y Operación (Docker, variables de entorno y observabilidad).',
    `Debe ser consistente con la arquitectura aprobada "${scenarioName}" que se entrega en el contexto; no propongas otra arquitectura ni otras tecnologías principales. Menciona explícitamente el escenario aprobado y sus tecnologías (frontend, backend, base de datos, comunicación e infraestructura).`,
    'No hagas referencia a conversaciones, archivos externos, etapas de Ideator ni información que no esté en el contexto. No uses TBD, "pendiente" ni "por definir".',
    `Contexto del proyecto:\n${JSON.stringify(context)}`,
  ].join('\n\n');
}

async function generateMarkdown(prompt) {
  const buildBody = (model) => ({
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    systemInstruction: {
      parts: [{ text: 'Responde únicamente con un documento Markdown completo y autocontenido.' }],
    },
    generationConfig: buildGenerationConfig({ model, maxOutputTokens: 4096, temperature: 0.4 }),
  });

  const data = await generateContent({
    model: MODEL,
    body: buildBody(MODEL),
    fallback: { model: FALLBACK_MODEL, body: buildBody(FALLBACK_MODEL), timeoutMs: 45000, retries: 1 },
    timeoutMs: 30000,
    retries: 1,
  });

  return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

async function generateSpecification(context) {
  return validateSpecification(await generateMarkdown(buildSpecificationPrompt(context)));
}

async function generateArchitecture(context) {
  return validateArchitecture(await generateMarkdown(buildArchitecturePrompt(context)), context.architecture);
}

module.exports = {
  generateSpecification,
  generateArchitecture,
  validateSpecification,
  validateArchitecture,
  buildSpecificationPrompt,
  buildArchitecturePrompt,
  scenarioTokens,
  SPEC_SECTIONS,
  ARCH_SECTIONS,
};
