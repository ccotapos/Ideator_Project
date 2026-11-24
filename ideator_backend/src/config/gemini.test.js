jest.mock('./geminiClient', () => ({
  generateContent: jest.fn(),
  buildGenerationConfig: jest.fn((config) => config),
}));

const { generateContent } = require('./geminiClient');
const { getIdeatorReply } = require('./gemini');

describe('chat con Gemini', () => {
  beforeEach(() => jest.clearAllMocks());

  test('une todos los fragmentos de texto de la respuesta', async () => {
    generateContent.mockResolvedValue({
      candidates: [{
        content: {
          parts: [
            { thought: true, text: 'razonamiento interno' },
            { text: 'Primera parte ' },
            { text: 'y final de la respuesta.' },
          ],
        },
      }],
    });

    await expect(getIdeatorReply([{ role: 'user', content: 'Hola' }]))
      .resolves.toBe('Primera parte y final de la respuesta.');
  });
});
