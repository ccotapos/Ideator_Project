import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { getMyProjects } from '../api/projects.js';
import { formatDate } from '../utils/date.js';

const roleLabels = { owner: 'Owner', editor: 'Colaborador', viewer: 'Lector' };

export default function HomePage() {
  const { user, token } = useAuth();
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

  const recentProjects = projects.slice(0, 3);
  const displayName = user?.name || user?.email || '';
  const firstName = displayName.split(' ')[0] || displayName.split('@')[0];

  return (
    <section className="page-section home-page">
      <div className="home-hero">
        <div>
          <p className="panel-kicker">Panel inicial</p>
          <h1 className="home-greeting">Hola{firstName ? `, ${firstName}` : ''}</h1>
          <p className="home-subtitle">
            Retoma tus proyectos, revisa lo último en lo que trabajaste o empieza una idea nueva con Ideator.
          </p>
        </div>
        <Link to="/proyectos" className="btn-primary home-cta">
          Ver mis proyectos
        </Link>
      </div>

      {!loading && !error && projects.length > 0 ? (
        <div className="home-stats">
          <div className="home-stat">
            <span className="home-stat-number">{projects.length}</span>
            <span className="home-stat-label">
              {projects.length === 1 ? 'Proyecto activo' : 'Proyectos activos'}
            </span>
          </div>
        </div>
      ) : null}

      <div className="home-section">
        <div className="home-section-header">
          <h2>Continúa donde quedaste</h2>
          {projects.length > 3 ? (
            <Link to="/proyectos" className="home-section-link">
              Ver todos →
            </Link>
          ) : null}
        </div>

        {loading ? <p className="chat-status">Cargando tus proyectos…</p> : null}
        {error ? <p className="form-error" role="alert">{error}</p> : null}

        {!loading && !error && projects.length === 0 ? (
          <article className="placeholder-panel">
            <p className="panel-kicker">Sin proyectos todavía</p>
            <h2>Crea tu primer proyecto</h2>
            <p>
              Arma un proyecto y empieza a conversar con Ideator para definir el problema, el alcance y
              las decisiones técnicas.
            </p>
            <Link to="/proyectos" className="btn-primary home-empty-cta">
              + Crear proyecto
            </Link>
          </article>
        ) : null}

        {!loading && !error && recentProjects.length > 0 ? (
          <ul className="home-recent-list">
            {recentProjects.map((project) => (
              <li key={project.id} className="home-recent-card">
                <div>
                  <h3>{project.nombre}</h3>
                  {project.descripcion ? <p>{project.descripcion}</p> : null}
                  <p className="home-recent-meta">
                    <span className="project-role">{roleLabels[project.rol] || project.rol}</span>
                    <span>Última actividad: {formatDate(project.updated_at)}</span>
                  </p>
                </div>
                <div className="home-recent-actions">
                  <Link to={`/proyectos/${project.id}`} className="btn-secondary">
                    Ver proyecto
                  </Link>
                  <Link to={`/proyectos/${project.id}?tab=chat`} className="home-recent-chat-link">
                    Continuar chat →
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </section>
  );
}