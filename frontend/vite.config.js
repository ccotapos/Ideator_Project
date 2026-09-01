import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// En desarrollo local (fuera de Docker) el backend vive en localhost:3000.
// Dentro de docker-compose, los contenedores no se ven entre sí por
// "localhost": el frontend debe apuntar al nombre del servicio del backend
// (ver docker-compose.yml -> VITE_PROXY_TARGET=http://backend:3000).
const backendTarget = process.env.VITE_PROXY_TARGET || 'http://localhost:3000';

export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // necesario para que el servidor sea accesible desde fuera del contenedor
    port: 5173,
    proxy: {
      '/api': {
        target: backendTarget,
        changeOrigin: true,
      },
    },
  },
});