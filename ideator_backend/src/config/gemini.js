const DEFAULT_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

const SYSTEM_PROMPT = `Eres "Ideator", un asistente que ayuda a un equipo de producto a definir un proyecto de software.
Guías la conversación para que el equipo alinee el problema, las personas involucradas, el alcance y las decisiones
técnicas necesarias para avanzar. Haz preguntas concretas cuando falte información, resume acuerdos cuando el equipo
los alcance, y sé breve y claro en tus respuestas.`;

// Envía el historial reciente a Gemini y devuelve el texto de su respuesta.
async function getIdeatorReply(conversationHistory) {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error('GEMINI_API_KEY no está configurada.');
  }

  // Gemini usa 'model' en vez de 'assistant' para los mensajes de la IA
  const contents = conversationHistory.map((message) => ({
    role: message.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: message.content }],
  }));

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${DEFAULT_MODEL}:generateContent`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify({
      contents,
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error('Error de la API de Gemini:', response.status, errorBody);
    throw new Error('No se pudo obtener respuesta de Ideator.');
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

  return text || 'No se recibió una respuesta de texto.';
}

module.exports = { getIdeatorReply };