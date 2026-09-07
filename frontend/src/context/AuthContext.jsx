import { createContext, useContext, useMemo, useState } from 'react';
import { loginRequest, registerRequest, meRequest } from '../api/auth.js';

const STORAGE_KEY = 'ideator.auth';

const AuthContext = createContext(null);

function readStoredSession() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeStoredSession(session) {
  if (session) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } else {
    localStorage.removeItem(STORAGE_KEY);
  }
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(() => readStoredSession());

  const login = async ({ email, password }) => {
    const data = await loginRequest({ email, password });
    const nextSession = { user: data.user, token: data.token };
    setSession(nextSession);
    writeStoredSession(nextSession);
    return data;
  };

  const register = async ({ name, email, password }) => {
    // El registro no inicia sesión automáticamente: el backend solo
    // devuelve el usuario creado, sin token. El usuario inicia sesión
    // después, en la pantalla de login.
    return registerRequest({ name, email, password });
  };

  const loginWithSsoToken = async (token) => {
    const data = await meRequest(token);
    const nextSession = { user: data.user, token };
    setSession(nextSession);
    writeStoredSession(nextSession);
    return data;
  };

  const logout = () => {
    setSession(null);
    writeStoredSession(null);
  };

  const value = useMemo(
    () => ({
      user: session?.user ?? null,
      token: session?.token ?? null,
      isAuthenticated: Boolean(session?.token),
      login,
      register,
      logout,
      loginWithSsoToken,
    }),
    [session]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe usarse dentro de un <AuthProvider>.');
  }
  return context;
}
