import { apiFetch } from './client.js';

/**
 * POST /api/auth/register
 * Devuelve { message, user } en éxito.
 * El backend responde 409 si el email ya está registrado.
 */
export function registerRequest({ name, email, password }) {
  return apiFetch('/api/auth/register', {
    method: 'POST',
    body: { name, email, password },
  });
}

/**
 * POST /api/auth/login
 * Devuelve { message, token, user } en éxito.
 * El backend responde 401 si las credenciales son inválidas.
 */
export function loginRequest({ email, password }) {
  return apiFetch('/api/auth/login', {
    method: 'POST',
    body: { email, password },
  });
}

/**
 * GET /api/auth/me
 * Devuelve { user } a partir de un token válido.
 * Se usa tras el callback de SSO, donde solo recibimos el token por URL.
 */
export function meRequest(token) {
  return apiFetch('/api/auth/me', { token });
}