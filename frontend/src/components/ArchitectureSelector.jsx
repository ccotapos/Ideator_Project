import React, { useState, useEffect } from 'react';

// Las 5 arquitecturas estándar disponibles para comparar y seleccionar
const ARCHITECTURES = [
  {
    id: 'node-react-pg',
    name: 'Monolito Modular (Node.js + React + PostgreSQL)',
    frontend: 'React (Vite) + Tailwind CSS',
    backend: 'Node.js con Express',
    database: 'PostgreSQL Relacional',
    infrastructure: 'Render / Railway / Vercel',
    description: 'Ideal para aplicaciones web estándar con alta escalabilidad y un ecosistema de JavaScript unificado.',
  },
  {
    id: 'fastapi-react-pg',
    name: 'API First (Python FastAPI + React + PostgreSQL)',
    frontend: 'React (Vite)',
    backend: 'Python con FastAPI (Alto rendimiento asíncrono)',
    database: 'PostgreSQL Relacional',
    infrastructure: 'Render / AWS / Docker',
    description: 'Excelente para proyectos con procesamiento de datos intensivo, IA o APIs de alta velocidad.',
  },
  {
    id: 'nextjs-fullstack',
    name: 'Fullstack Jamstack (Next.js + Vercel + PostgreSQL)',
    frontend: 'Next.js (React Server Components)',
    backend: 'Next.js API Routes / Server Actions',
    database: 'PostgreSQL (Supabase o Neon)',
    infrastructure: 'Vercel / Netlify',
    description: 'Desarrollo rápido, excelente SEO y despliegue unificado en una sola plataforma.',
  },
  {
    id: 'python-flask-sqlite',
    name: 'Ligero / Prototipo (Python Flask + HTML/JS + SQLite)',
    frontend: 'HTML5, CSS y Vanilla JavaScript',
    backend: 'Python con Flask',
    database: 'SQLite (Archivo local)',
    infrastructure: 'PythonAnywhere / VPS básico',
    description: 'Perfecto para MVPs rápidos, prototipos académicos o despliegues con recursos muy limitados.',
  },
  {
    id: 'docker-microservices',
    name: 'Contenedorizado (Node/Python + Docker + PostgreSQL)',
    frontend: 'React (Vite)',
    backend: 'Node.js / Express o FastAPI',
    database: 'PostgreSQL en Contenedor Docker',
    infrastructure: 'Docker Desktop / AWS ECS / DigitalOcean',
    description: 'Enfocado en aislamiento de servicios, entornos idénticos de desarrollo y producción mediante Docker y WSL2.',
  },
];

export default function ArchitectureSelector({ projectId, onArchitectureSelected }) {
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  // Cargar arquitectura actual si ya fue seleccionada previamente
  useEffect(() => {
    async function fetchCurrentArchitecture() {
      try {
        setLoading(true);
        const response = await fetch(`/api/projects/${projectId}/architecture`, {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        if (response.ok) {
          const data = await response.json();
          if (data.architecture?.selectedOption) {
            setSelectedId(data.architecture.selectedOption);
          }
        }
      } catch (err) {
        console.error('Error al cargar arquitectura:', err);
      } finally {
        setLoading(false);
      }
    }
    if (projectId) fetchCurrentArchitecture();
  }, [projectId]);

  // Manejar la confirmación y guardado
  const handleConfirm = async () => {
    if (!selectedId) return;

    const chosenArch = ARCHITECTURES.find(a => a.id === selectedId);

    try {
      setSaving(true);
      setMessage(null);

      const response = await fetch(`/api/projects/${projectId}/architecture`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          selectedOption: chosenArch.id,
          name: chosenArch.name,
          frontend: chosenArch.frontend,
          backend: chosenArch.backend,
          database: chosenArch.database,
          infrastructure: chosenArch.infrastructure
        })
      });

      const data = await response.json();

      if (response.ok) {
        setMessage({ type: 'success', text: '¡Arquitectura guardada y confirmada exitosamente!' });
        if (onArchitectureSelected) onArchitectureSelected(chosenArch);
      } else {
        setMessage({ type: 'error', text: data.message || 'Error al guardar la arquitectura.' });
      }
    } catch (err) {
      console.error('Error de red:', err);
      setMessage({ type: 'error', text: 'Error de conexión con el servidor.' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-6 text-center text-gray-600">Cargando opciones de arquitectura...</div>;
  }

  return (
    <div className="max-w-6xl mx-auto p-6 bg-white rounded-lg shadow-md">
      <h2 className="text-2xl font-bold text-gray-800 mb-2">Selección de Arquitectura del Proyecto</h2>
      <p className="text-gray-600 mb-6">
        Compara las 5 opciones estándar disponibles y selecciona la que mejor se adapte a los requerimientos técnicos de tu proyecto.
      </p>

      {message && (
        <div className={`p-4 mb-6 rounded-md ${message.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
          {message.text}
        </div>
      )}

      {/* Grid de Tarjetas de Comparación */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {ARCHITECTURES.map((arch) => {
          const isSelected = selectedId === arch.id;
          return (
            <div
              key={arch.id}
              onClick={() => setSelectedId(arch.id)}
              className={`cursor-pointer rounded-xl p-5 border-2 transition-all flex flex-col justify-between ${
                isSelected ? 'border-blue-600 bg-blue-50/40 shadow-lg' : 'border-gray-200 hover:border-gray-300 bg-white'
              }`}
            >
              <div>
                <div className="flex justify-between items-start mb-3">
                  <h3 className="font-semibold text-lg text-gray-900">{arch.name}</h3>
                  <input
                    type="radio"
                    name="architecture"
                    checked={isSelected}
                    onChange={() => setSelectedId(arch.id)}
                    className="mt-1 text-blue-600 focus:ring-blue-500 h-4 w-4"
                  />
                </div>
                <p className="text-sm text-gray-600 mb-4">{arch.description}</p>
              </div>

              <div className="space-y-2 text-xs text-gray-700 bg-gray-50 p-3 rounded-md border border-gray-100">
                <div><strong>Frontend:</strong> {arch.frontend}</div>
                <div><strong>Backend:</strong> {arch.backend}</div>
                <div><strong>Base de Datos:</strong> {arch.database}</div>
                <div><strong>Infraestructura:</strong> {arch.infrastructure}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Botón de Confirmación */}
      <div className="flex justify-end items-center gap-4 border-t pt-4">
        <button
          onClick={handleConfirm}
          disabled={!selectedId || saving}
          className={`px-6 py-2.5 rounded-lg font-medium text-white shadow transition-all ${
            !selectedId || saving ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
          }`}
        >
          {saving ? 'Guardando...' : 'Confirmar Arquitectura Seleccionada'}
        </button>
      </div>
    </div>
  );
}