// Al dejarlo como cadena vacía, las peticiones serán relativas (ej: /api/auth/login)
const API_URL = import.meta.env.VITE_API_URL ?? '';

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export async function apiFetch(path, { method = 'GET', body, token } = {}) {
  let response;

  try {
    response = await fetch(`${API_URL}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (networkError) {
    throw new ApiError(
      'No se pudo contactar al servidor. Verifica tu conexión o que el backend esté disponible.',
      0
    );
  }

  let data = null;
  try {
    data = await response.json();
  } catch {
    // Respuesta sin cuerpo JSON
  }

  if (!response.ok) {
    const message = data?.message || 'Ocurrió un error inesperado. Intenta nuevamente.';
    throw new ApiError(message, response.status);
  }

  return data;
}