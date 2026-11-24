jest.mock('./gemini', () => ({ getIdeatorReply: jest.fn() }));
jest.mock('./foundry', () => ({ getIdeatorReply: jest.fn() }));

const gemini = require('./gemini');
const foundry = require('./foundry');
const { getIdeatorReply, getAIProviderName } = require('./ai');

describe('selección del proveedor de IA', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv, AI_PROVIDER: 'foundry', FOUNDRY_API_KEY: 'foundry-key', GEMINI_API_KEY: 'gemini-key' };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  test('usa Gemini como respaldo cuando Foundry falla', async () => {
    foundry.getIdeatorReply.mockRejectedValue(new Error('recurso no disponible'));
    gemini.getIdeatorReply.mockResolvedValue('Respuesta de respaldo');

    await expect(getIdeatorReply([{ role: 'user', content: 'Hola' }])).resolves.toBe('Respuesta de respaldo');
    expect(gemini.getIdeatorReply).toHaveBeenCalledTimes(1);
    expect(getAIProviderName()).toBe('Azure AI Foundry con respaldo Gemini');
  });

  test('mantiene la respuesta de Foundry cuando funciona', async () => {
    foundry.getIdeatorReply.mockResolvedValue('Respuesta de Azure');

    await expect(getIdeatorReply([])).resolves.toBe('Respuesta de Azure');
    expect(gemini.getIdeatorReply).not.toHaveBeenCalled();
  });

  test('entrega una guía local si ambos proveedores están temporalmente fuera de servicio', async () => {
    foundry.getIdeatorReply.mockRejectedValue(new Error('Azure no disponible'));
    gemini.getIdeatorReply.mockRejectedValue(new Error('Gemini saturado'));

    await expect(getIdeatorReply([{ role: 'user', content: '¿Qué mostramos en la demostración?' }]))
      .resolves.toContain('problema');
  });
});
