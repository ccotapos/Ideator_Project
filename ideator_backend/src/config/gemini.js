const { generateContent, buildGenerationConfig } = require('./geminiClient');

// El chat prioriza velocidad: modelo "lite" (no admite thinkingConfig).
const CHAT_MODEL = process.env.GEMINI_CHAT_MODEL || process.env.GEMINI_MODEL || 'gemini-3.8-flash';
const FALLBACK_MODEL = process.env.GEMINI_STRUCTURED_FALLBACK_MODEL || 'gemini-3.5-flash-lite';

const SYSTEM_PROMPT = `Eres "Ideator", un asistente que ayuda a un equipo de producto a definir un proyecto de software.
Guías la conversación para que el equipo alinee el problema, las personas involucradas, el alcance y las decisiones
técnicas necesarias para avanzar. Haz preguntas concretas cuando falte información, resume acuerdos cuando el equipo
los alcance, y sé breve y claro en tus respuestas.`;

// Envía el historial reciente a Gemini y devuelve el texto de su respuesta.
async function getIdeatorReply(conversationHistory) {
  // Gemini usa 'model' en vez de 'assistant' para los mensajes de la IA
  const contents = conversationHistory.map((message) => ({
    role: message.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: message.content }],
  }));

  const buildBody = (model) => ({
    contents,
    systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
    generationConfig: buildGenerationConfig({
      model,
      maxOutputTokens: 1024,
      temperature: 0.6,
    }),
  });

  const data = await generateContent({
    model: CHAT_MODEL,
    timeoutMs: 10000,
    retries: 0,
    body: buildBody(CHAT_MODEL),
    fallback: {
      model: FALLBACK_MODEL,
      body: buildBody(FALLBACK_MODEL),
      timeoutMs: 10000,
      retries: 0,
    },
  });

  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

  return text || 'No se recibió una respuesta de texto.';
}

module.exports = { getIdeatorReply };
