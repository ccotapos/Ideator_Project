import { apiFetch } from './client';

// Obtener el historial de mensajes de un proyecto
export const getProjectMessages = async (projectId, token) => {
  const data = await apiFetch(`/api/projects/${projectId}/messages`, { token });
  return data.messages;
};

// Enviar un mensaje al chat de un proyecto y obtener la respuesta de Ideator
export const sendProjectMessage = async (projectId, content, token) => {
  return await apiFetch(`/api/projects/${projectId}/messages`, {
    method: 'POST',
    token,
    body: { content },
  });
};