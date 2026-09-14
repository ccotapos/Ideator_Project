import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import FormField from '../components/FormField.jsx';
import { getMyProjects, createProject } from '../api/projects.js';
import { formatDate } from '../utils/date.js';

const roleLabels = {
  owner: 'Owner',
  editor: 'Colaborador',
  viewer: 'Lector',
};

const INITIAL_FORM = { nombre: '', descripcion: '' };

export default function ProjectsListPage() {
  const { token } = useAuth();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(INITIAL_FORM);
  const [fieldErrors, setFieldErrors] = useState({});
  const [createError, setCreateError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadProjects() {
      try {
        setLoading(true);
        const data = await getMyProjects(token);
        if (active) setProjects(data);
      } catch (err) {
        if (active) setError(err.message);
      } finally {
        if (active) setLoading(false);
      }
    }

    loadProjects();
    return () => {
      active = false;
    };
  }, [token]);

  const handleFormChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setFieldErrors((prev) => ({ ...prev, [name]: undefined }));
  };

  const handleToggleForm = () => {
    setCreateError('');
    setFieldErrors({});
    setForm(INITIAL_FORM);
    setShowForm((prev) => !prev);
  };

  const handleCreateSubmit = async (event) => {
    event.preventDefault();
    setCreateError('');

    const errors = {};
    if (!form.nombre.trim()) {
      errors.nombre = 'El nombre del proyecto es obligatorio.';
    }
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setIsSubmitting(true);
    try {
      const newProject = await createProject(
        { nombre: form.nombre.trim(), descripcion: form.descripcion.trim() || undefined },
        token
      );
      setProjects((prev) => [
        { ...newProject, updated_at: newProject.updated_at || newProject.created_at, rol: 'owner' },
        ...prev,
      ]);
      setForm(INITIAL_FORM);
      setShowForm(false);
    } catch (err) {
      setCreateError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="page-section">
      <div className="projects-header">
        <h2>Mis proyectos</h2>
        <button type="button" className="btn-primary btn-new-project" onClick={handleToggleForm}>
          {showForm ? 'Cancelar' : '+ Nuevo proyecto'}
        </button>
      </div>

      {showForm ? (
        <form className="create-project-form" onSubmit={handleCreateSubmit} noValidate>
          <FormField
            id="nombre"
            label="Nombre del proyecto"
            value={form.nombre}
            onChange={handleFormChange}
            error={fieldErrors.nombre}
            placeholder="Ej. App de reservas"
          />

          <FormField
            id="descripcion"
            label="Descripción (opcional)"
            value={form.descripcion}
            onChange={handleFormChange}
            error={fieldErrors.descripcion}
            placeholder="Breve resumen del proyecto"
          />

          {createError ? (
            <p className="form-error" role="alert">
              {createError}
            </p>
          ) : null}

          <button type="submit" className="btn-primary" disabled={isSubmitting}>
            {isSubmitting ? 'Creando…' : 'Crear proyecto'}
          </button>
        </form>
      ) : null}

      {loading ? <p>Cargando proyectos…</p> : null}
      {error ? <p className="form-error" role="alert">{error}</p> : null}

      {!loading && !error && projects.length === 0 ? (
        <article className="placeholder-panel">
          <p className="panel-kicker">Sin proyectos</p>
          <h2>Aún no participas en ningún proyecto</h2>
          <p>Crea un proyecto nuevo o pide que te inviten a uno existente para verlo aquí.</p>
        </article>
      ) : null}

      {!loading && !error && projects.length > 0 ? (
        <ul className="project-list">
          {projects.map((project) => (
            <li key={project.id} className="project-card">
              <div>
                <Link to={`/proyectos/${project.id}`} className="project-card-title">
                  <h3>{project.nombre}</h3>
                </Link>
                {project.descripcion ? <p>{project.descripcion}</p> : null}
              </div>
              <div className="project-meta">
                <span className="project-role">{roleLabels[project.rol] || project.rol}</span>
                <span className="project-updated">Actualizado el {formatDate(project.updated_at)}</span>
                <Link to={`/proyectos/${project.id}?tab=chat`} className="project-chat-link">
                  Abrir chat →
                </Link>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}