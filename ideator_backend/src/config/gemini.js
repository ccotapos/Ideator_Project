const { generateContent, buildGenerationConfig } = require('./geminiClient');

// El chat prioriza velocidad: modelo "lite" (no admite thinkingConfig).
const CHAT_MODEL = process.env.GEMINI_CHAT_MODEL || 'gemini-flash-lite-latest';

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

  const data = await generateContent({
    model: CHAT_MODEL,
    timeoutMs: 20000,
    retries: 2,
    body: {
      contents,
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      generationConfig: buildGenerationConfig({
        model: CHAT_MODEL,
        maxOutputTokens: 1024,
        temperature: 0.6,
      }),
    },
  });

  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

  return text || 'No se recibió una respuesta de texto.';
}

module.exports = { getIdeatorReply };