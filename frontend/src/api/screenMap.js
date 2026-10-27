import { apiFetch } from './client';

export const getScreenMap = (projectId, token) => apiFetch(`/api/projects/${projectId}/screen-map`, { token });
export const generateScreenMap = (projectId, token) =>
  apiFetch(`/api/projects/${projectId}/screen-map/generate`, { method: 'POST', token, timeoutMs: 90000 });
