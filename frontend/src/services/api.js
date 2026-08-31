// Usamos /api para que Vite aplique el proxy hacia http://localhost:3000
const API_URL = import.meta.env.VITE_API_URL || '/api';

export const loginUser = async (credentials) => {
    // La ruta es exactamente la que armaste en tu backend: /api/auth/login
    const response = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials)
    });
    
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Error al iniciar sesión');
    }
    return response.json();
};

export const registerUser = async (userData) => {
    // La ruta es exactamente la que armaste en tu backend: /api/auth/register
    const response = await fetch(`${API_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData)
    });
    
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Error al registrar usuario');
    }
    return response.json();
};