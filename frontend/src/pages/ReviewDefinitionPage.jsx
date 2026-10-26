import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import {
  getDefinition,
  getDefinitionQuestions,
  saveDefinitionMvp,
  saveDefinitionSections,
} from '../api/definition.js';
import { getProject } from '../api/projects.js';

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

const SECTION_META = [
  { key: 'problem', field: 'problem', label: 'Problema' },
  { key: 'context', field: 'context', label: 'Contexto' },
  { key: 'target_users', field: 'targetUsers', label: 'Usuarios objetivo' },
];

function toForm(definition, architecture) {
  const sections = definition?.sections || {};
  const mvp = definition?.mvp || {};
  const list = (items) => (Array.isArray(items) && items.length > 0 ? [...items] : ['']);

  return {
    problem: sections.problem?.respuesta || '',
    context: sections.context?.respuesta || '',
    targetUsers: sections.target_users?.respuesta || '',
    inScope: list(mvp.inScope),
    outOfScope: list(mvp.outOfScope),
    journey: list(mvp.journey),
    selectedArchitecture: architecture?.selectedOption || '',
  };
}

function EditableList({ label, items, onChange, placeholder, ordered = false }) {
  const update = (index, value) =>
    onChange(items.map((item, position) => (position === index ? value : item)));
  const add = () => onChange([...items, '']);
  const remove = (index) => onChange(items.filter((_, position) => position !== index));
  const move = (index, direction) => {
    const target = index + direction;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };

  return (
    <div className="definition-list">
      <div className="definition-list-header">
        <h3>{label}</h3>
        <button type="button" className="btn-secondary definition-add" onClick={add}>
          + Agregar
        </button>
      </div>

      {items.length === 0 ? <p className="definition-empty">Sin elementos.</p> : null}

      {items.map((item, index) => (
        <div className="definition-list-row" key={index}>
          {ordered ? <span className="definition-order">{index + 1}</span> : null}
          <input
            value={item}
            placeholder={placeholder}
            onChange={(event) => update(index, event.target.value)}
            aria-label={`${label} ${index + 1}`}
          />
          {ordered ? (
            <div className="definition-list-moves">
              <button type="button" onClick={() => move(index, -1)} disabled={index === 0} title="Subir">
                ↑
              </button>
              <button
                type="button"
                onClick={() => move(index, 1)}
                disabled={index === items.length - 1}
                title="Bajar"
              >
                ↓
              </button>
            </div>
          ) : null}
          <button type="button" className="danger-link" onClick={() => remove(index)}>
            Eliminar
          </button>
        </div>
      ))}
    </div>
  );
}

export default function ReviewDefinitionPage({ projectId: projectIdProp, role: roleProp }) {
  const { id } = useParams();
  const projectId = projectIdProp || id;
  const { token } = useAuth();

  const [definition, setDefinition] = useState(null);
  const [architecture, setArchitecture] = useState(null);
  const [questions, setQuestions] = useState({});
  const [role, setRole] = useState(roleProp || null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState(toForm(null, null));
  const [fieldErrors, setFieldErrors] = useState({});
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [success, setSuccess] = useState('');

  const canEdit = ['owner', 'editor'].includes(role);

  const load = async (showLoader = true) => {
    if (showLoader) setLoading(true);
    setError('');

    try {
      const [definitionData, questionsData, projectData, archRes] = await Promise.all([
        getDefinition(projectId, token),
        getDefinitionQuestions(projectId, token),
        roleProp ? Promise.resolve({ role: roleProp }) : getProject(projectId, token),
        fetch(`/api/projects/${projectId}/architecture`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }).then(res => res.ok ? res.json() : { architecture: null }).catch(() => ({ architecture: null }))
      ]);

      setDefinition(definitionData.definition || {});
      setArchitecture(archRes.architecture || null);
      setQuestions(questionsData.questions || {});
      setForm(toForm(definitionData.definition, archRes.architecture));
      setRole(projectData.role || null);
    } catch (err) {
      setError(err.message);
    } finally {
      if (showLoader) setLoading(false);
    }
  };

  useEffect(() => {
    if (projectId && token) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, token, roleProp]);

  const handleFieldChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setFieldErrors((prev) => ({ ...prev, [name]: undefined }));
  };

  const handleListChange = (key, items) => {
    setForm((prev) => ({ ...prev, [key]: items }));
    setFieldErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const handleEdit = () => {
    setForm(toForm(definition, architecture));
    setFieldErrors({});
    setSaveError('');
    setSuccess('');
    setIsEditing(true);
  };

  const handleCancel = () => {
    setForm(toForm(definition, architecture));
    setFieldErrors({});
    setSaveError('');
    setIsEditing(false);
  };

  const handleSave = async (event) => {
    event.preventDefault();
    setSaveError('');
    setSuccess('');

    const errors = {};
    if (!form.problem.trim()) errors.problem = 'El problema es obligatorio.';
    if (!form.context.trim()) errors.context = 'El contexto es obligatorio.';
    if (!form.targetUsers.trim()) errors.targetUsers = 'Los usuarios objetivo son obligatorios.';
    if (!form.selectedArchitecture) errors.architecture = 'Debes seleccionar una arquitectura.';

    const inScope = form.inScope.map((item) => item.trim()).filter(Boolean);
    const outOfScope = form.outOfScope.map((item) => item.trim()).filter(Boolean);
    const journey = form.journey.map((item) => item.trim()).filter(Boolean);

    if (inScope.length === 0) errors.inScope = 'Agrega al menos una funcionalidad dentro del alcance.';
    if (outOfScope.length === 0) errors.outOfScope = 'Agrega al menos una funcionalidad fuera del alcance.';
    if (journey.length === 0) errors.journey = 'Agrega al menos un paso del recorrido.';

    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setIsSaving(true);
    try {
      // 1. Guardar secciones y MVP
      await saveDefinitionSections(
        projectId,
        {
          problem: form.problem.trim(),
          context: form.context.trim(),
          targetUsers: form.targetUsers.trim(),
        },
        token
      );
      await saveDefinitionMvp(projectId, { inScope, outOfScope, journey }, token);

      // 2. Guardar la arquitectura seleccionada
      const chosenArch = ARCHITECTURES.find(a => a.id === form.selectedArchitecture);
      await fetch(`/api/projects/${projectId}/architecture`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
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

      await load(false);
      setIsEditing(false);
      setSuccess('Definición y arquitectura actualizadas correctamente.');
    } catch (err) {
      setSaveError(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) return <p className="chat-status">Cargando revisión de la definición…</p>;
  if (error) return <p className="form-error" role="alert">{error}</p>;

  const sections = definition?.sections || {};
  const mvp = definition?.mvp || {};

  return (
    <div className="definition-page">
      <div className="definition-header">
        <div>
          <h2>Revisión de la Definición Inicial y Arquitectura</h2>
          <p>Verifica y actualiza los datos estructurados y la arquitectura de tu proyecto antes de avanzar.</p>
        </div>
        {canEdit && !isEditing ? (
          <button type="button" className="btn-primary" onClick={handleEdit}>
            Editar definición
          </button>
        ) : null}
      </div>

      {success ? <p className="form-success" role="status">{success}</p> : null}
      {saveError ? <p className="form-error" role="alert">{saveError}</p> : null}

      <form className="definition-form" onSubmit={handleSave} noValidate>
        {isEditing ? (
          <>
            {SECTION_META.map(({ key, field, label }) => (
              <div key={key} className="definition-field">
                <label htmlFor={field}>{label}</label>
                {questions[key]?.length ? (
                  <p className="definition-hint">{questions[key].join(' ')}</p>
                ) : null}
                <textarea
                  id={field}
                  name={field}
                  rows={4}
                  value={form[field]}
                  onChange={handleFieldChange}
                  placeholder={`Describe ${label.toLowerCase()}…`}
                  className={fieldErrors[field] ? 'invalid' : undefined}
                />
                {fieldErrors[field] ? (
                  <p className="field-error" role="alert">{fieldErrors[field]}</p>
                ) : null}
              </div>
            ))}

            {/* Selector de Arquitectura en Modo Edición */}
            <div className="definition-field mt-6">
              <label className="block font-semibold mb-2">Selección de Arquitectura del Proyecto</label>
              <p className="text-sm text-gray-600 mb-4">Compara las 5 opciones estándar y selecciona una:</p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {ARCHITECTURES.map((arch) => {
                  const isSelected = form.selectedArchitecture === arch.id;
                  return (
                    <div
                      key={arch.id}
                      onClick={() => setForm(prev => ({ ...prev, selectedArchitecture: arch.id }))}
                      className={`cursor-pointer rounded-lg p-4 border-2 transition-all flex flex-col justify-between ${
                        isSelected ? 'border-blue-600 bg-blue-50/40 shadow-md' : 'border-gray-200 bg-white'
                      }`}
                    >
                      <div>
                        <div className="flex justify-between items-start mb-2">
                          <h4 className="font-semibold text-gray-900">{arch.name}</h4>
                          <input
                            type="radio"
                            name="selectedArchitecture"
                            checked={isSelected}
                            onChange={() => setForm(prev => ({ ...prev, selectedArchitecture: arch.id }))}
                            className="h-4 w-4 text-blue-600"
                          />
                        </div>
                        <p className="text-xs text-gray-600 mb-3">{arch.description}</p>
                      </div>
                      <div className="space-y-1 text-xs text-gray-700 bg-gray-50 p-2 rounded border">
                        <div><strong>FE:</strong> {arch.frontend}</div>
                        <div><strong>BE:</strong> {arch.backend}</div>
                        <div><strong>BD:</strong> {arch.database}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
              {fieldErrors.architecture ? <p className="field-error mt-2" role="alert">{fieldErrors.architecture}</p> : null}
            </div>

            <EditableList
              label="MVP · Dentro del alcance"
              items={form.inScope}
              onChange={(items) => handleListChange('inScope', items)}
              placeholder="Funcionalidad incluida en el MVP"
            />
            {fieldErrors.inScope ? <p className="field-error" role="alert">{fieldErrors.inScope}</p> : null}

            <EditableList
              label="MVP · Fuera del alcance"
              items={form.outOfScope}
              onChange={(items) => handleListChange('outOfScope', items)}
              placeholder="Funcionalidad fuera del MVP"
            />
            {fieldErrors.outOfScope ? <p className="field-error" role="alert">{fieldErrors.outOfScope}</p> : null}

            <EditableList
              label="Recorrido principal"
              items={form.journey}
              onChange={(items) => handleListChange('journey', items)}
              placeholder="Paso del recorrido"
              ordered
            />
            {fieldErrors.journey ? <p className="field-error" role="alert">{fieldErrors.journey}</p> : null}

            <div className="definition-actions">
              <button type="submit" className="btn-primary" disabled={isSaving}>
                {isSaving ? 'Guardando…' : 'Guardar cambios'}
              </button>
              <button type="button" className="btn-secondary" onClick={handleCancel} disabled={isSaving}>
                Cancelar
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="definition-grid">
              {SECTION_META.map(({ key, label }) => (
                <article key={key} className="definition-card">
                  <h3>{label}</h3>
                  <p className={sections[key]?.respuesta ? undefined : 'definition-empty'}>
                    {sections[key]?.respuesta || 'No definido todavía.'}
                  </p>
                </article>
              ))}
            </div>

            {/* Vista de Arquitectura Seleccionada */}
            <article className="definition-card definition-card-wide mt-4">
              <h3>Arquitectura Seleccionada</h3>
              {architecture ? (
                <div className="text-sm text-gray-700 space-y-1 mt-2">
                  <p><strong>Stack:</strong> {architecture.name}</p>
                  <p><strong>Frontend:</strong> {architecture.frontend}</p>
                  <p><strong>Backend:</strong> {architecture.backend}</p>
                  <p><strong>Base de Datos:</strong> {architecture.database}</p>
                  <p><strong>Infraestructura:</strong> {architecture.infrastructure}</p>
                </div>
              ) : (
                <p className="definition-empty">⚠️ Arquitectura pendiente de seleccionar.</p>
              )}
            </article>

            <div className="definition-grid mt-4">
              <article className="definition-card">
                <h3>MVP · Dentro del alcance</h3>
                {mvp.inScope?.length ? (
                  <ul>{mvp.inScope.map((item, index) => <li key={index}>{item}</li>)}</ul>
                ) : (
                  <p className="definition-empty">Sin funcionalidades registradas.</p>
                )}
              </article>
              <article className="definition-card">
                <h3>MVP · Fuera del alcance</h3>
                {mvp.outOfScope?.length ? (
                  <ul>{mvp.outOfScope.map((item, index) => <li key={index}>{item}</li>)}</ul>
                ) : (
                  <p className="definition-empty">Sin funcionalidades registradas.</p>
                )}
              </article>
            </div>

            <article className="definition-card definition-card-wide mt-4">
              <h3>Recorrido principal</h3>
              {mvp.journey?.length ? (
                <ol>{mvp.journey.map((item, index) => <li key={index}>{item}</li>)}</ol>
              ) : (
                <p className="definition-empty">Sin pasos registrados.</p>
              )}
            </article>
          </>
        )}
      </form>
    </div>
  );
}