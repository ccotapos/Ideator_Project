import React, { useState } from 'react';

// Estructura de la especificación de la API agrupada por categorías
const apiEndpoints = [
  {
    category: 'Proyectos',
    endpoints: [
      {
        method: 'POST',
        path: '/api/projects',
        summary: 'Crear un proyecto nuevo',
        description: 'Crea un proyecto privado y asigna al usuario autenticado como owner.',
        auth: 'Bearer Token (Obligatorio)',
        parameters: [],
        requestBody: {
          nombre: 'string (Obligatorio)',
          descripcion: 'string (Opcional)'
        },
        responses: [
          { status: 201, description: 'Proyecto creado exitosamente (devuelve objeto del proyecto y rol owner).' },
          { status: 400, description: 'El nombre del proyecto es obligatorio.' },
          { status: 401, description: 'No autorizado / Token no proporcionado o inválido.' },
          { status: 500, description: 'Error interno del servidor.' }
        ]
      },
      {
        method: 'GET',
        path: '/api/projects',
        summary: 'Listar proyectos',
        description: 'Lista todos los proyectos donde el usuario autenticado es owner o colaborador.',
        auth: 'Bearer Token (Obligatorio)',
        parameters: [],
        responses: [
          { status: 200, description: 'Lista de proyectos obtenida correctamente.' },
          { status: 401, description: 'No autorizado.' },
          { status: 500, description: 'Error interno del servidor.' }
        ]
      },
      {
        method: 'GET',
        path: '/api/projects/:id',
        summary: 'Obtener detalle de un proyecto',
        description: 'Retorna la información detallada de un proyecto específico si el usuario pertenece a él.',
        auth: 'Bearer Token (Obligatorio)',
        parameters: [
          { name: 'id', type: 'path (integer)', description: 'ID único del proyecto.' }
        ],
        responses: [
          { status: 200, description: 'Detalle del proyecto y rol del usuario.' },
          { status: 401, description: 'No autorizado.' },
          { status: 403, description: 'Acceso denegado. No perteneces a este proyecto.' },
          { status: 404, description: 'Proyecto no encontrado.' },
          { status: 500, description: 'Error interno del servidor.' }
        ]
      },
      {
        method: 'PUT',
        path: '/api/projects/:id',
        summary: 'Actualizar un proyecto',
        description: 'Modifica el nombre o descripción del proyecto. Exclusivo para miembros con rol owner.',
        auth: 'Bearer Token (Obligatorio)',
        parameters: [
          { name: 'id', type: 'path (integer)', description: 'ID del proyecto a editar.' }
        ],
        requestBody: {
          nombre: 'string (Obligatorio)',
          descripcion: 'string (Opcional)'
        },
        responses: [
          { status: 200, description: 'Proyecto actualizado correctamente.' },
          { status: 400, description: 'El nombre del proyecto es obligatorio.' },
          { status: 401, description: 'No autorizado.' },
          { status: 403, description: 'Acceso denegado. Solo el dueño del proyecto puede editarlo.' },
          { status: 500, description: 'Error interno del servidor.' }
        ]
      }
    ]
  },
  {
    category: 'Colaboradores y Actividad',
    endpoints: [
      {
        method: 'GET',
        path: '/api/projects/:id/members',
        summary: 'Listar miembros del proyecto',
        description: 'Devuelve la lista de participantes y sus respectivos roles dentro del proyecto.',
        auth: 'Bearer Token (Obligatorio)',
        parameters: [
          { name: 'id', type: 'path (integer)', description: 'ID del proyecto.' }
        ],
        responses: [
          { status: 200, description: 'Lista de miembros obtenida con éxito.' },
          { status: 401, description: 'No autorizado.' },
          { status: 403, description: 'Acceso denegado. No perteneces a este proyecto.' },
          { status: 500, description: 'Error interno del servidor.' }
        ]
      },
      {
        method: 'POST',
        path: '/api/projects/:id/invite',
        summary: 'Invitar colaborador',
        description: 'Añade un usuario al proyecto mediante su correo electrónico con rol editor o viewer.',
        auth: 'Bearer Token (Owner)',
        parameters: [
          { name: 'id', type: 'path (integer)', description: 'ID del proyecto.' }
        ],
        requestBody: {
          email: 'string (Obligatorio)',
          role: 'string ("editor" o "viewer", por defecto "editor")'
        },
        responses: [
          { status: 201, description: 'Usuario añadido al proyecto exitosamente.' },
          { status: 400, description: 'Correo obligatorio o rol inválido.' },
          { status: 401, description: 'No autorizado.' },
          { status: 403, description: 'Acceso denegado. Solo el dueño puede invitar.' },
          { status: 404, description: 'El usuario con ese correo no existe.' },
          { status: 409, description: 'El usuario ya pertenece a este proyecto.' },
          { status: 500, description: 'Error interno del servidor.' }
        ]
      },
      {
        method: 'GET',
        path: '/api/projects/:id/activity',
        summary: 'Historial de actividad',
        description: 'Obtiene el registro cronológico de cambios y acciones del proyecto del más reciente al más antiguo.',
        auth: 'Bearer Token (Obligatorio)',
        parameters: [
          { name: 'id', type: 'path (integer)', description: 'ID del proyecto.' }
        ],
        responses: [
          { status: 200, description: 'Historial de actividad obtenido correctamente.' },
          { status: 401, description: 'No autorizado.' },
          { status: 403, description: 'Acceso denegado.' },
          { status: 500, description: 'Error interno del servidor.' }
        ]
      }
    ]
  }
];

export default function ApiSpecification() {
  const [copied, setCopied] = useState(false);

  // Función para exportar / copiar la especificación completa en formato JSON formateado
  const handleCopySpec = () => {
    const specString = JSON.stringify(apiEndpoints, null, 2);
    navigator.clipboard.writeText(specString).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };

  const getMethodBadge = (method) => {
    const colors = {
      GET: 'bg-blue-100 text-blue-700 border-blue-300',
      POST: 'bg-green-100 text-green-700 border-green-300',
      PUT: 'bg-amber-100 text-amber-700 border-amber-300',
      DELETE: 'bg-red-100 text-red-700 border-red-300',
    };
    return (
      <span className={`px-2.5 py-1 text-xs font-bold rounded border ${colors[method] || 'bg-gray-100 text-gray-700'}`}>
        {method}
      </span>
    );
  };

  const getStatusBadge = (status) => {
    if (status >= 200 && status < 300) return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    if (status >= 400 && status < 500) return 'bg-amber-50 text-amber-700 border-amber-200';
    return 'bg-rose-50 text-rose-700 border-rose-200';
  };

  return (
    <div className="max-w-5xl mx-auto p-6 bg-slate-50 min-h-screen">
      {/* Cabecera de la vista */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8 bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Documentación de la API</h1>
          <p className="text-sm text-slate-600 mt-1">
            Especificación oficial de endpoints, parámetros, esquemas y códigos de respuesta del backend.
          </p>
        </div>
        <button
          onClick={handleCopySpec}
          className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm rounded-lg transition-colors shadow-sm cursor-pointer"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
          </svg>
          {copied ? '¡Especificación Copiada!' : 'Copiar Especificación JSON'}
        </button>
      </div>

      {/* Listado agrupado de endpoints */}
      <div className="space-y-8">
        {apiEndpoints.map((group, groupIdx) => (
          <div key={groupIdx} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="bg-slate-100 px-6 py-4 border-b border-slate-200">
              <h2 className="text-lg font-semibold text-slate-800">{group.category}</h2>
            </div>

            <div className="divide-y divide-slate-200">
              {group.endpoints.map((ep, epIdx) => (
                <div key={epIdx} className="p-6 hover:bg-slate-50/50 transition-colors">
                  {/* Ruta y Método */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-3">
                      {getMethodBadge(ep.method)}
                      <code className="text-sm font-mono font-semibold text-slate-900 bg-slate-100 px-2 py-1 rounded">
                        {ep.path}
                      </code>
                    </div>
                    <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">
                      🔒 {ep.auth}
                    </span>
                  </div>

                  <h3 className="text-md font-medium text-slate-900 mb-1">{ep.summary}</h3>
                  <p className="text-sm text-slate-600 mb-4">{ep.description}</p>

                  {/* Parámetros de Ruta o Query */}
                  {ep.parameters && ep.parameters.length > 0 && (
                    <div className="mb-4">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Parámetros:</h4>
                      <div className="bg-slate-50 rounded-lg p-3 border border-slate-200 text-xs space-y-1">
                        {ep.parameters.map((param, pIdx) => (
                          <div key={pIdx} className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                            <span className="font-mono font-semibold text-indigo-600">{param.name}</span>
                            <span className="text-slate-500 italic">({param.type})</span>
                            <span className="text-slate-700">{param.description}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Cuerpo de Petición (Request Body) */}
                  {ep.requestBody && (
                    <div className="mb-4">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Cuerpo de la Petición (JSON):</h4>
                      <div className="bg-slate-900 text-slate-200 font-mono text-xs p-3 rounded-lg overflow-x-auto">
                        <pre>{JSON.stringify(ep.requestBody, null, 2)}</pre>
                      </div>
                    </div>
                  )}

                  {/* Respuestas posibles */}
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Respuestas Posibles:</h4>
                    <div className="space-y-2">
                      {ep.responses.map((res, rIdx) => (
                        <div key={rIdx} className={`flex items-start gap-3 p-2.5 rounded-lg border text-xs ${getStatusBadge(res.status)}`}>
                          <span className="font-bold font-mono px-1.5 py-0.5 bg-white/80 rounded border border-current shadow-xs">
                            {res.status}
                          </span>
                          <span className="text-slate-700 mt-0.5">{res.description}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}