import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import FormField from '../components/FormField.jsx';
import { ProjectMembers } from '../components/ProjectMembers.jsx';
import ProjectChatPanel from '../components/ProjectChatPanel.jsx';
import ReviewDefinitionPage from './ReviewDefinitionPage.jsx';
import DataModelPage from './DataModelPage.jsx';
import EndpointSpecPage from './EndpointSpecPage.jsx';
import { getProject, updateProject } from '../api/projects.js';
import { formatDate } from '../utils/date.js';

const roleLabels = { owner: 'Owner', editor: 'Colaborador', viewer: 'Lector' };

export default function ProjectDetail() {
  const { id: projectId } = useParams();
  const { token } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [project, setProject] = useState(null);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [activeTab, setActiveTab] = useState(() => {
    const tab = searchParams.get('tab');
    if (tab === 'chat') return 'chat';
    if (tab === 'revision') return 'revision';
    if (tab === 'modelo') return 'modelo';
    if (tab === 'endpoints') return 'endpoints';
    return 'resumen';
  });

  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState({ nombre: '', descripcion: '' });
  const [fieldErrors, setFieldErrors] = useState({});
  const [saveError, setSaveError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadProject() {
      try {
        setLoading(true);
        const data = await getProject(projectId, token);
        if (active) {
          setProject(data.project);
          setRole(data.role);
          setForm({ nombre: data.project.nombre, descripcion: data.project.descripcion || '' });
        }
      } catch (err) {
        if (active) setError(err.message);
      } finally {
        if (active) setLoading(false);
      }
    }

    loadProject();
    return () => {
      active = false;
    };
  }, [projectId, token]);

  const handleFormChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setFieldErrors((prev) => ({ ...prev, [name]: undefined }));
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setFieldErrors({});
    setSaveError('');
    if (project) setForm({ nombre: project.nombre, descripcion: project.descripcion || '' });
  };

  const handleSave = async (event) => {
    event.preventDefault();
    setSaveError('');

    if (!form.nombre.trim()) {
      setFieldErrors({ nombre: 'El nombre del proyecto es obligatorio.' });
      return;
    }

    setIsSaving(true);
    try {
      const updated = await updateProject(
        projectId,
        { nombre: form.nombre.trim(), descripcion: form.descripcion.trim() || null },
        token
      );
      setProject(updated);
      setIsEditing(false);
    } catch (err) {
      setSaveError(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return (
      <section className="page-section">
        <p>Cargando proyecto…</p>
      </section>
    );
  }

  if (error) {
    return (
      <section className="page-section">
        <p className="form-error" role="alert">{error}</p>
        <button type="button" className="btn-secondary" onClick={() => navigate('/proyectos')}>
          Volver a mis proyectos
        </button>
      </section>
    );
  }

  return (
    <section className="page-section project-detail">
      <button type="button" className="project-detail-back" onClick={() => navigate('/proyectos')}>
        ← Mis proyectos
      </button>

      <div className="project-detail-header">
        {isEditing ? (
          <form className="create-project-form" onSubmit={handleSave} noValidate>
            <FormField
              id="nombre"
              label="Nombre del proyecto"
              value={form.nombre}
              onChange={handleFormChange}
              error={fieldErrors.nombre}
            />
            <FormField
              id="descripcion"
              label="Descripción"
              value={form.descripcion}
              onChange={handleFormChange}
              error={fieldErrors.descripcion}
            />
            {saveError ? <p className="form-error" role="alert">{saveError}</p> : null}
            <div className="project-detail-edit-actions">
              <button type="submit" className="btn-primary" disabled={isSaving}>
                {isSaving ? 'Guardando…' : 'Guardar cambios'}
              </button>
              <button type="button" className="btn-secondary" onClick={handleCancelEdit} disabled={isSaving}>
                Cancelar
              </button>
            </div>
          </form>
        ) : (
          <>
            <div>
              <h2>{project.nombre}</h2>
              {project.descripcion ? <p className="project-detail-desc">{project.descripcion}</p> : null}
              <p className="project-detail-meta">
                <span className="project-role">{roleLabels[role] || role}</span>
                <span>Actualizado el {formatDate(project.updated_at)}</span>
              </p>
            </div>
            {role === 'owner' ? (
              <button type="button" className="btn-secondary" onClick={() => setIsEditing(true)}>
                Editar proyecto
              </button>
            ) : null}
          </>
        )}
      </div>

      <div className="project-detail-tabs">
        <button
          type="button"
          className={`project-detail-tab ${activeTab === 'resumen' ? 'active' : ''}`}
          onClick={() => setActiveTab('resumen')}
        >
          Resumen
        </button>
        <button
          type="button"
          className={`project-detail-tab ${activeTab === 'chat' ? 'active' : ''}`}
          onClick={() => setActiveTab('chat')}
        >
          Chat con Ideator
        </button>
        <button
          type="button"
          className={`project-detail-tab ${activeTab === 'revision' ? 'active' : ''}`}
          onClick={() => setActiveTab('revision')}
        >
          Revisión Inicial
        </button>
        <button
          type="button"
          className={`project-detail-tab ${activeTab === 'modelo' ? 'active' : ''}`}
          onClick={() => setActiveTab('modelo')}
        >
          Modelo de datos
        </button>
        <button
          type="button"
          className={`project-detail-tab ${activeTab === 'endpoints' ? 'active' : ''}`}
          onClick={() => setActiveTab('endpoints')}
        >
          Endpoints (API)
        </button>
      </div>

      {activeTab === 'resumen' && <ProjectMembers projectId={projectId} />}
      {activeTab === 'chat' && <ProjectChatPanel projectId={projectId} />}
      {activeTab === 'revision' && <ReviewDefinitionPage projectId={projectId} />}
      {activeTab === 'modelo' && <DataModelPage projectId={projectId} role={role} />}
      {activeTab === 'endpoints' && <EndpointSpecPage projectId={projectId} role={role} />}
    </section>
  );
}
