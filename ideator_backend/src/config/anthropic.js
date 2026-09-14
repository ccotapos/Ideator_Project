const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const DEFAULT_MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-5';

const SYSTEM_PROMPT = `Eres "Ideator", un asistente que ayuda a un equipo de producto a definir un proyecto de software.
Guías la conversación para que el equipo alinee el problema, las personas involucradas, el alcance y las decisiones
técnicas necesarias para avanzar. Haz preguntas concretas cuando falte información, resume acuerdos cuando el equipo
los alcance, y sé breve y claro en tus respuestas.`;

// Envía el historial reciente a Claude y devuelve el texto de su respuesta.
async function getIdeatorReply(conversationHistory) {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY no está configurada.');
  }

  const response = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: DEFAULT_MODEL,
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: conversationHistory,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error('Error de la API de Anthropic:', response.status, errorBody);
    throw new Error('No se pudo obtener respuesta de Ideator.');
  }

  const data = await response.json();
  const textBlock = data.content?.find((block) => block.type === 'text');

  return textBlock?.text || 'No se recibió una respuesta de texto.';
}

module.exports = { getIdeatorReply };