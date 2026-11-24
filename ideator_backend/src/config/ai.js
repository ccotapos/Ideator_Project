const gemini = require('./gemini');
const foundry = require('./foundry');

function getLocalFallbackReply(conversationHistory) {
  const latestMessage = [...conversationHistory].reverse().find((message) => message.role === 'user')?.content || '';
  const normalized = latestMessage.toLowerCase();

  if (normalized.includes('objetivo') || normalized.includes('resum')) {
    return 'El objetivo es convertir el problema planteado por el equipo en una solución de software clara, validada y lista para implementar.';
  }
  if (normalized.includes('demostr')) {
    return 'Para la demostración, presenta el problema, la definición del MVP, el modelo de datos, los endpoints, las pantallas, la arquitectura recomendada y los documentos finales.';
  }
  if (normalized.includes('siguiente') || normalized.includes('ahora')) {
    return 'El siguiente paso es revisar que el problema, los usuarios y el alcance del MVP estén completos; después pueden validar el modelo de datos y continuar con los endpoints.';
  }

  return 'Entendí tu mensaje. Para avanzar, revisemos primero el problema, los usuarios objetivo y las funciones que deben quedar dentro del MVP. ¿Cuál de esas partes quieres definir ahora?';
}

function getProvider() {
  const requestedProvider = (process.env.AI_PROVIDER || '').toLowerCase();
  const hasFoundryKey = Boolean(process.env.FOUNDRY_API_KEY);

  if (requestedProvider === 'foundry') {
    if (!hasFoundryKey) {
      console.warn('AI_PROVIDER=foundry pero FOUNDRY_API_KEY no está configurada; se usará Gemini.');
    } else {
      return { name: 'Azure AI Foundry', getIdeatorReply: foundry.getIdeatorReply };
    }
  } else if (!requestedProvider && hasFoundryKey) {
    return { name: 'Azure AI Foundry', getIdeatorReply: foundry.getIdeatorReply };
  }

  return { name: 'Gemini', getIdeatorReply: gemini.getIdeatorReply };
}

async function getIdeatorReply(conversationHistory) {
  const provider = getProvider();

  try {
    return await provider.getIdeatorReply(conversationHistory);
  } catch (error) {
    if (provider.name !== 'Azure AI Foundry' || !process.env.GEMINI_API_KEY) throw error;

    console.warn(`Azure AI Foundry no respondió (${error.message}); se usará Gemini como respaldo.`);
    try {
      return await gemini.getIdeatorReply(conversationHistory);
    } catch (fallbackError) {
      console.warn(`Gemini tampoco respondió (${fallbackError.message}); se usará la guía local de contingencia.`);
      return getLocalFallbackReply(conversationHistory);
    }
  }
}

function getAIProviderName() {
  const provider = getProvider();
  return provider.name === 'Azure AI Foundry' && process.env.GEMINI_API_KEY
    ? 'Azure AI Foundry con respaldo Gemini'
    : provider.name;
}

module.exports = { getIdeatorReply, getAIProviderName, getProvider, getLocalFallbackReply };
