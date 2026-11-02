import { apiFetch } from './client';

const path = (projectId, suffix = '') => `/api/projects/${projectId}/blocking-questions${suffix}`;

export const getBlockingQuestions = (projectId, token) => apiFetch(path(projectId), { token });
export const createBlockingQuestion = (projectId, body, token) =>
  apiFetch(path(projectId), { method: 'POST', body, token });
export const resolveBlockingQuestion = (projectId, questionId, answer, token) =>
  apiFetch(path(projectId, `/${questionId}/resolve`), { method: 'PATCH', body: { answer }, token });
