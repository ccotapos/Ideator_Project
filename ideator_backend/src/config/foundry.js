const DEFAULT_ENDPOINT =
  'https://ideator-galaz-resource.services.ai.azure.com/api/projects/ideator-galaz';
const DEFAULT_AGENT = 'ideator-deepseek-agent';

const IDEATOR_CONTEXT = `Eres el agente de IA de Ideator, una aplicacion colaborativa que transforma una idea inicial
en una especificacion de software clara, completa y consistente. Responde siempre en espanol.

Conduce un proceso progresivo y proactivo:
- comprende el problema, contexto, usuarios objetivo y resultados esperados;
- delimita el MVP, lo que queda fuera y el recorrido principal;
- identifica requisitos, reglas de negocio, integraciones, seguridad y casos de error;
- detecta ambiguedades, contradicciones y preguntas bloqueantes sin esperar a que el usuario las mencione;
- conecta las decisiones con el modelo de datos, API, pantallas y arquitectura;
- no inventes decisiones criticas: pregunta una cosa concreta a la vez cuando falte informacion;
- resume acuerdos y propone el siguiente paso util con respuestas breves y claras.

La meta final es producir una especificacion de producto y una especificacion de arquitectura en Markdown que otra IA
pueda implementar sin depender de la conversacion previa. No ejecutes publicaciones, gastos, eliminaciones ni cambios
externos sin aprobacion humana.`;

function getFoundryConfig() {
  return {
    endpoint: (process.env.FOUNDRY_PROJECT_ENDPOINT || DEFAULT_ENDPOINT).replace(/\/$/, ''),
    apiKey: process.env.FOUNDRY_API_KEY,
    agentName: process.env.FOUNDRY_AGENT_NAME || DEFAULT_AGENT,
  };
}

function extractOutputText(response) {
  if (response.output_text?.trim()) return response.output_text.trim();

  return (response.output || [])
    .flatMap((item) => item.content || [])
    .filter((item) => item.type === 'output_text' && item.text)
    .map((item) => item.text)
    .join('\n')
    .trim();
}

async function foundryRequest(path, body, config) {
  const response = await fetch(`${config.endpoint}/openai/v1/${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': config.apiKey,
    },
    body: JSON.stringify(body),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = data.error?.message || `HTTP ${response.status}`;
    throw new Error(`Azure Foundry rechazo la solicitud: ${detail}`);
  }

  return data;
}

async function getIdeatorReply(conversationHistory) {
  const config = getFoundryConfig();
  if (!config.apiKey) {
    throw new Error('FOUNDRY_API_KEY no esta configurada.');
  }

  const conversation = await foundryRequest('conversations', {}, config);
  const contextualHistory = conversationHistory.map((message, index) => {
    const isLatestUserMessage =
      message.role === 'user' &&
      !conversationHistory.slice(index + 1).some((next) => next.role === 'user');

    return {
      role: message.role,
      content: isLatestUserMessage
        ? `${IDEATOR_CONTEXT}\n\nMensaje actual del equipo:\n${message.content}`
        : message.content,
    };
  });

  const response = await foundryRequest(
    'responses',
    {
      conversation: conversation.id,
      input: contextualHistory,
      agent_reference: {
        name: config.agentName,
        type: 'agent_reference',
      },
    },
    config
  );

  const text = extractOutputText(response);
  if (!text) throw new Error('Azure Foundry no devolvio una respuesta de texto.');
  return text;
}

module.exports = { getIdeatorReply, getFoundryConfig, extractOutputText, IDEATOR_CONTEXT };
