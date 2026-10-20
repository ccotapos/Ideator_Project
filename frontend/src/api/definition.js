import { apiFetch } from './client';

const path = (projectId, suffix = '') => `/api/projects/${projectId}/definition${suffix}`;

export const getDefinition = (projectId, token) => apiFetch(path(projectId), { token });

export const getDefinitionQuestions = (projectId, token) =>
  apiFetch(path(projectId, '/questions'), { token });

export const saveDefinitionSections = (projectId, sections, token) =>
  apiFetch(path(projectId, '/sections'), { method: 'PUT', body: sections, token });

export const saveDefinitionMvp = (projectId, mvp, token) =>
  apiFetch(path(projectId, '/mvp'), { method: 'PUT', body: mvp, token });
