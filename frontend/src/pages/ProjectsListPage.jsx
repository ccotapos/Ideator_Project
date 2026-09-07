import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { getMyProjects } from '../api/projects.js';

const dateFormatter = new Intl.DateTimeFormat('es-CL', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

const roleLabels = {
  owner: 'Owner',
  editor: 'Colaborador',
  viewer: 'Lector',
};

export default function ProjectsListPage() {
  const { token } = useAuth();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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

  return (
    <section className="page-section">
      <h2>Mis proyectos</h2>

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
                <h3>{project.nombre}</h3>
                {project.descripcion ? <p>{project.descripcion}</p> : null}
              </div>
              <div className="project-meta">
                <span className="project-role">{roleLabels[project.rol] || project.rol}</span>
                <span className="project-updated">
                  Actualizado el {dateFormatter.format(new Date(project.updated_at))}
                </span>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}