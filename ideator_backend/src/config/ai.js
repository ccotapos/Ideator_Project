const gemini = require('./gemini');
const foundry = require('./foundry');

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
  return getProvider().getIdeatorReply(conversationHistory);
}

function getAIProviderName() {
  return getProvider().name;
}

module.exports = { getIdeatorReply, getAIProviderName, getProvider };
