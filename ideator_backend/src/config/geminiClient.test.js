const { generateContent, buildGenerationConfig, isLiteModel } = require('./geminiClient');

function response(status, body) {
  return { ok: status >= 200 && status < 300, status, text: async () => body };
}

describe('Cliente de Gemini (timeout y reintentos)', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.clearAllMocks();
  });

  test('reintenta ante un 503 y devuelve la respuesta exitosa', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(response(503, 'high demand'))
      .mockResolvedValueOnce(
        response(200, JSON.stringify({ candidates: [{ content: { parts: [{ text: 'OK' }] } }] }))
      );

    const data = await generateContent({
      model: 'gemini-flash-lite-latest',
      body: { contents: [] },
      apiKey: 'test-key',
      timeoutMs: 1000,
      retries: 2,
    });

    expect(data.candidates[0].content.parts[0].text).toBe('OK');
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  test('lanza error tras agotar los reintentos', async () => {
    global.fetch = jest.fn().mockResolvedValue(response(503, 'high demand'));

    await expect(
      generateContent({ model: 'gemini-flash-lite-latest', body: {}, apiKey: 'test-key', timeoutMs: 1000, retries: 1 })
    ).rejects.toThrow('503');
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  test('no reintenta errores no transitorios (400)', async () => {
    global.fetch = jest.fn().mockResolvedValue(response(400, 'bad request'));

    await expect(
      generateContent({ model: 'gemini-flash-lite-latest', body: {}, apiKey: 'test-key', timeoutMs: 1000, retries: 2 })
    ).rejects.toThrow('400');
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  test('usa el modelo de fallback si el principal falla', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(response(503, 'high demand'))
      .mockResolvedValueOnce(
        response(200, JSON.stringify({ candidates: [{ content: { parts: [{ text: 'fallback-ok' }] } }] }))
      );

    const data = await generateContent({
      model: 'gemini-3.8-flash',
      body: { contents: [] },
      apiKey: 'test-key',
      timeoutMs: 1000,
      retries: 0,
      fallback: {
        model: 'gemini-flash-lite-latest',
        body: { contents: [] },
        timeoutMs: 1000,
        retries: 0,
      },
    });

    expect(data.candidates[0].content.parts[0].text).toBe('fallback-ok');
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  test('buildGenerationConfig no añade thinkingConfig en modelos lite', () => {
    const config = buildGenerationConfig({ model: 'gemini-flash-lite-latest', maxOutputTokens: 512 });

    expect(config.thinkingConfig).toBeUndefined();
    expect(config.maxOutputTokens).toBe(512);
    expect(isLiteModel('gemini-flash-lite-latest')).toBe(true);
  });

  test('buildGenerationConfig desactiva el thinking en modelos completos', () => {
    const config = buildGenerationConfig({
      model: 'gemini-3.8-flash',
      maxOutputTokens: 2048,
      responseMimeType: 'application/json',
    });

    expect(config.thinkingConfig).toEqual({ thinkingBudget: 0 });
    expect(config.responseMimeType).toBe('application/json');
    expect(isLiteModel('gemini-3.8-flash')).toBe(false);
  });
});
