import { beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('./client', () => ({ apiFetch: vi.fn() }));

import { apiFetch } from './client';
import {
  createBlockingQuestion,
  getBlockingQuestions,
  resolveBlockingQuestion,
} from './blockingQuestions';
import { getProjectActivity } from './projects';

describe('API de trazabilidad y preguntas bloqueantes', () => {
  beforeEach(() => vi.clearAllMocks());

  test('consulta el historial del proyecto', async () => {
    apiFetch.mockResolvedValue({ activity: [{ id: 1 }] });

    await expect(getProjectActivity(8, 'token')).resolves.toEqual([{ id: 1 }]);
    expect(apiFetch).toHaveBeenCalledWith('/api/projects/8/activity', { token: 'token' });
  });

  test('crea y resuelve preguntas bloqueantes con las rutas correctas', async () => {
    apiFetch.mockResolvedValue({ question: { id: 4 } });

    await createBlockingQuestion(8, { category: 'backend', question: '¿Qué proveedor?' }, 'token');
    await resolveBlockingQuestion(8, 4, 'Azure', 'token');

    expect(apiFetch).toHaveBeenNthCalledWith(1, '/api/projects/8/blocking-questions', {
      method: 'POST',
      body: { category: 'backend', question: '¿Qué proveedor?' },
      token: 'token',
    });
    expect(apiFetch).toHaveBeenNthCalledWith(2, '/api/projects/8/blocking-questions/4/resolve', {
      method: 'PATCH',
      body: { answer: 'Azure' },
      token: 'token',
    });
  });

  test('propaga errores al consultar preguntas', async () => {
    apiFetch.mockRejectedValue(new Error('Acceso denegado'));

    await expect(getBlockingQuestions(8, 'token')).rejects.toThrow('Acceso denegado');
  });
});
