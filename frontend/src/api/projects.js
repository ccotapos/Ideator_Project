import { apiFetch } from './client';

// Obtener los proyectos donde el usuario autenticado es owner o colaborador
export const getMyProjects = async (token) => {
  const data = await apiFetch('/api/projects', { token });
  return data.projects;
};

// Crear un nuevo proyecto (el usuario autenticado queda como owner)
export const createProject = async (projectData, token) => {
  const data = await apiFetch('/api/projects', {
    method: 'POST',
    token,
    body: projectData,
  });
  return data.project;
};

// Obtener el detalle de un proyecto (incluye el rol del usuario autenticado)
export const getProject = async (projectId, token) => {
  return await apiFetch(`/api/projects/${projectId}`, { token });
};

// Editar nombre/descripción de un proyecto (solo el owner)
export const updateProject = async (projectId, projectData, token) => {
  const data = await apiFetch(`/api/projects/${projectId}`, {
    method: 'PUT',
    token,
    body: projectData,
  });
  return data.project;
};

// Obtener miembros del proyecto
export const getProjectMembers = async (projectId, token) => {
  const data = await apiFetch(`/api/projects/${projectId}/members`, { token });
  return data.members;
};

// Invitar a un usuario por correo
export const inviteMember = async (projectId, email, role = 'editor', token) => {
  return await apiFetch(`/api/projects/${projectId}/invite`, {
    method: 'POST',
    token,
    body: { email, role },
  });
};