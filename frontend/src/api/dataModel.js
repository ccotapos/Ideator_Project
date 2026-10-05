import { apiFetch } from './client';

const path = (projectId, suffix = '') => `/api/projects/${projectId}/data-model${suffix}`;

export const getDataModel = (projectId, token) => apiFetch(path(projectId), { token });
export const generateDataModel = (projectId, token) => apiFetch(path(projectId, '/generate'), { method: 'POST', token });
export const approveDataModel = (projectId, token) => apiFetch(path(projectId, '/approve'), { method: 'POST', token });
export const addEntity = (projectId, body, token) => apiFetch(path(projectId, '/entities'), { method: 'POST', body, token });
export const updateEntity = (projectId, entityId, body, token) => apiFetch(path(projectId, `/entities/${entityId}`), { method: 'PUT', body, token });
export const deleteEntity = (projectId, entityId, token) => apiFetch(path(projectId, `/entities/${entityId}`), { method: 'DELETE', token });
export const addAttribute = (projectId, entityId, body, token) => apiFetch(path(projectId, `/entities/${entityId}/attributes`), { method: 'POST', body, token });
export const deleteAttribute = (projectId, attributeId, token) => apiFetch(path(projectId, `/attributes/${attributeId}`), { method: 'DELETE', token });
