import { apiFetch } from './client';

const path = (projectId, suffix = '') => `/api/projects/${projectId}${suffix}`;

export const getContradictions = (projectId, token) => apiFetch(path(projectId, '/contradictions'), { token });

export const getFinalDocuments = (projectId, token) => apiFetch(path(projectId, '/final-documents'), { token });

export const generateFinalDocuments = (projectId, tipo, token) =>
  apiFetch(path(projectId, '/final-documents/generate'), {
    method: 'POST',
    token,
    body: { tipo },
    timeoutMs: 120000,
  });
