import { apiFetch } from './client'; // Ajusta la ruta a client.js si están en la misma carpeta

// Obtener miembros del proyecto
export const getProjectMembers = async (projectId) => {
  const token = localStorage.getItem('token');
  const data = await apiFetch(`/api/projects/${projectId}/members`, { token });
  return data.members;
};

// Invitar a un usuario por correo
export const inviteMember = async (projectId, email, role = 'editor') => {
  const token = localStorage.getItem('token');
  return await apiFetch(`/api/projects/${projectId}/invite`, {
    method: 'POST',
    token,
    body: { email, role },
  });
};

// Obtener los proyectos donde el usuario autenticado es owner o colaborador
export const getMyProjects = async (token) => {
  const data = await apiFetch('/api/projects', { token });
  return data.projects;
};