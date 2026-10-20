const gemini = require('./gemini');
const foundry = require('./foundry');

function getProvider() {
  const requestedProvider = (process.env.AI_PROVIDER || '').toLowerCase();
  if (requestedProvider === 'foundry' || (!requestedProvider && process.env.FOUNDRY_API_KEY)) {
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
