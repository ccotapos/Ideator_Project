import { apiFetch } from './client';

const path = (projectId, suffix = '') => `/api/projects/${projectId}/architecture${suffix}`;

export const getArchitecture = (projectId, token) => apiFetch(path(projectId), { token });
export const recommendArchitecture = (projectId, token) => apiFetch(path(projectId, '/recommend'), { method: 'POST', token });
export const approveArchitecture = (projectId, token) => apiFetch(path(projectId, '/approve'), { method: 'POST', token });
