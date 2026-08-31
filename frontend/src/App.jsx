import { Routes, Route, Navigate } from 'react-router-dom';
import AppLayout from './layouts/AppLayout';
import HomePage from './pages/HomePage';
import IdeasPage from './pages/IdeasPage';
import AuthPage from './pages/AuthPage'; // Tu nueva página de login

export default function App() {
  return (
    <Routes>
      {/* Ruta pública para el Login/Registro */}
      <Route path="/" element={<AuthPage />} />

      {/* Rutas principales envueltas en tu layout existente */}
      <Route element={<AppLayout />}>
        <Route path="/home" element={<HomePage />} />
        <Route path="/ideas" element={<IdeasPage />} />
      </Route>

      {/* Si el usuario ingresa una URL que no existe, lo devuelve al login */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}