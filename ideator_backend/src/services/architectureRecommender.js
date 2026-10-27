const { generateContent, buildGenerationConfig } = require('../config/geminiClient');
const { SCENARIOS, getScenario, listScenarios } = require('../config/architectureScenarios');

const MODEL = process.env.GEMINI_STRUCTURED_MODEL || process.env.GEMINI_MODEL || 'gemini-3.8-flash';
const FALLBACK_MODEL = process.env.GEMINI_STRUCTURED_FALLBACK_MODEL || 'gemini-flash-lite-latest';

// Valida que la recomendación use un escenario del catálogo y que explique el
// porqué con argumentos (no solo nombres de tecnologías).
function validateRecommendation(value) {
  if (!value || typeof value !== 'object') {
    throw new Error('La IA no devolvió una recomendación de arquitectura.');
  }

  const scenario = getScenario(value.scenario);
  if (!scenario) {
    throw new Error(`El escenario "${value.scenario}" no pertenece al catálogo de arquitecturas.`);
  }

  const rationale = String(value.rationale || '').trim();
  const words = rationale.split(/\s+/).filter(Boolean);
  if (rationale.length < 80 || words.length < 15) {
    throw new Error('La recomendación debe explicar por qué la arquitectura es apropiada, no solo nombrar tecnologías.');
  }

  const technologies = value.technologies && typeof value.technologies === 'object' ? value.technologies : {};
  if (Object.keys(technologies).length < 4) {
    throw new Error('La recomendación debe detallar tecnologías de al menos cuatro capas.');
  }
  if (!String(technologies.communication || '').trim()) {
    throw new Error('La recomendación debe indicar la comunicación entre componentes.');
  }

  const operational = value.operational && typeof value.operational === 'object' ? value.operational : {};
  if (Object.keys(operational).length === 0) {
    throw new Error('La recomendación debe incluir aspectos operacionales.');
  }

  const alternatives = Array.isArray(value.alternatives)
    ? value.alternatives
        .filter((item) => item && getScenario(item.scenario))
        .map((item) => ({ scenario: item.scenario, reason: String(item.reason || '').trim() }))
        .slice(0, 4)
    : [];

  return {
    scenario: scenario.id,
    scenarioName: scenario.name,
    rationale,
    technologies,
    operational,
    alternatives,
  };
}

function buildRecommendationPrompt(context) {
  const catalog = SCENARIOS.map(
    (scenario) =>
      `- ${scenario.id} (${scenario.name}): ${scenario.summary} Cuándo usar: ${scenario.whenToUse.join('; ')}.`
  ).join('\n');

  return [
    'Eres un arquitecto de software senior. Debes recomendar UNA de las cinco arquitecturas base del catálogo para el producto descrito.',
    'La justificación debe explicar POR QUÉ esa arquitectura es apropiada, relacionándola explícitamente con las funcionalidades/MVP, el modelo de datos, los endpoints y las pantallas ya definidos. No te limites a enumerar tecnologías e indica también la comunicación entre componentes.',
    `Catálogo de arquitecturas:\n${catalog}`,
    `Contexto del proyecto:\n${JSON.stringify(context)}`,
  ].join('\n\n');
}

async function recommendArchitecture(context) {
  const buildBody = (model) => ({
    contents: [{ role: 'user', parts: [{ text: buildRecommendationPrompt(context) }] }],
    systemInstruction: {
      parts: [{
        text: 'Devuelve solo JSON con scenario, rationale, technologies, operational y alternatives.',
      }],
    },
    generationConfig: buildGenerationConfig({
      model,
      maxOutputTokens: 2048,
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'OBJECT',
        required: ['scenario', 'rationale', 'technologies', 'operational'],
        properties: {
          scenario: { type: 'STRING' },
          rationale: { type: 'STRING' },
          technologies: {
            type: 'OBJECT',
            properties: {
              frontend: { type: 'STRING' },
              backend: { type: 'STRING' },
              database: { type: 'STRING' },
              communication: { type: 'STRING' },
              infrastructure: { type: 'STRING' },
            },
          },
          operational: {
            type: 'OBJECT',
            properties: {
              docker: { type: 'STRING' },
              env: { type: 'STRING' },
              observability: { type: 'STRING' },
            },
          },
          alternatives: {
            type: 'ARRAY',
            items: {
              type: 'OBJECT',
              properties: {
                scenario: { type: 'STRING' },
                reason: { type: 'STRING' },
              },
            },
          },
        },
      },
    }),
  });

  const data = await generateContent({
    model: MODEL,
    body: buildBody(MODEL),
    fallback: { model: FALLBACK_MODEL, body: buildBody(FALLBACK_MODEL), timeoutMs: 30000, retries: 1 },
    timeoutMs: 20000,
    retries: 1,
  });

  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  return validateRecommendation(JSON.parse(text));
}

module.exports = {
  recommendArchitecture,
  validateRecommendation,
  buildRecommendationPrompt,
  SCENARIOS,
  listScenarios,
};
