const { extractOutputText, getFoundryConfig } = require('./foundry');

describe('Azure AI Foundry', () => {
  test('extrae el texto desde la respuesta del agente', () => {
    const text = extractOutputText({
      output: [
        {
          content: [
            { type: 'output_text', text: 'Primera parte' },
            { type: 'output_text', text: 'Segunda parte' },
          ],
        },
      ],
    });

    expect(text).toBe('Primera parte\nSegunda parte');
  });

  test('usa el agente y endpoint de Ideator por defecto', () => {
    const previousEndpoint = process.env.FOUNDRY_PROJECT_ENDPOINT;
    const previousAgent = process.env.FOUNDRY_AGENT_NAME;
    delete process.env.FOUNDRY_PROJECT_ENDPOINT;
    delete process.env.FOUNDRY_AGENT_NAME;

    const config = getFoundryConfig();
    expect(config.endpoint).toContain('/api/projects/ideator-galaz');
    expect(config.agentName).toBe('ideator-deepseek-agent');

    process.env.FOUNDRY_PROJECT_ENDPOINT = previousEndpoint;
    process.env.FOUNDRY_AGENT_NAME = previousAgent;
  });
});
