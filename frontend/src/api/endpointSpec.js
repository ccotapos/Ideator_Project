import { apiFetch } from './client';

const path = (projectId, suffix = '') => `/api/projects/${projectId}/endpoint-spec${suffix}`;

export const getEndpointSpec = (projectId, token) => apiFetch(path(projectId), { token });
export const generateEndpointSpec = (projectId, token) => apiFetch(path(projectId, '/generate'), { method: 'POST', token });
export const approveEndpointSpec = (projectId, token) => apiFetch(path(projectId, '/approve'), { method: 'POST', token });
export const validateEndpointSpec = (projectId, token) => apiFetch(path(projectId, '/validation'), { token });
