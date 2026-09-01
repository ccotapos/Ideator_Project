const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

/**
 * Error de API con el mensaje que envía el backend (cuando existe)
 * y el status HTTP original, para poder distinguir casos como
 * 401 (credenciales inválidas) o 409 (email duplicado).
 */
export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

/**
 * Llama al backend y homogeniza el manejo de errores.
 * Si el backend responde con { message: '...' }, ese mensaje
 * se usa tal cual para mostrarlo en el formulario.
 */
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
    // Respuesta sin cuerpo JSON (por ejemplo, un 204 o un error de proxy).
  }

  if (!response.ok) {
    const message = data?.message || 'Ocurrió un error inesperado. Intenta nuevamente.';
    throw new ApiError(message, response.status);
  }

  return data;
}