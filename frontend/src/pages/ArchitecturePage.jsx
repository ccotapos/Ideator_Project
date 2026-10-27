import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { approveArchitecture, getArchitecture, recommendArchitecture } from '../api/architecture.js';

const TECH_LABELS = {
  frontend: 'Frontend',
  backend: 'Backend',
  database: 'Base de datos',
  infrastructure: 'Infraestructura',
};

const OPS_LABELS = {
  docker: 'Docker',
  env: 'Variables de entorno',
  observability: 'Observabilidad',
};

export default function ArchitecturePage({ projectId, role }) {
  const { token } = useAuth();
  const [architecture, setArchitecture] = useState(null);
  const [scenarios, setScenarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState('');

  const canEdit = ['owner', 'editor'].includes(role);
  const isDraft = !architecture || architecture.estado === 'draft';

  const load = async () => {
    const data = await getArchitecture(projectId, token);
    setArchitecture(data.architecture);
    setScenarios(data.scenarios || []);
  };

  useEffect(() => {
    load().catch((error) => setMessage(error.message)).finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, token]);

  const run = async (action, success) => {
    setWorking(true);
    setMessage('');
    try {
      await action();
      await load();
      setMessage(success);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setWorking(false);
    }
  };

  if (loading) return <p className="chat-status">Cargando arquitectura…</p>;

  const scenarioName = scenarios.find((item) => item.id === architecture?.scenario)?.name || architecture?.scenario;

  return (
    <div className="architecture-page">
      <div className="architecture-header">
        <div>
          <h3>Arquitectura recomendada</h3>
          <p>
            La IA selecciona un escenario a partir de la definición, el modelo de datos aprobado, los
            endpoints y las pantallas del proyecto.
          </p>
        </div>
        <div className="architecture-actions">
          {canEdit && isDraft ? (
            <button
              type="button"
              className="btn-primary"
              disabled={working}
              onClick={() => run(() => recommendArchitecture(projectId, token), 'Arquitectura recomendada con IA.')}
            >
              {architecture ? 'Regenerar con IA' : 'Recomendar con IA'}
            </button>
          ) : null}
          {role === 'owner' && architecture?.estado === 'draft' ? (
            <button
              type="button"
              className="btn-approve"
              disabled={working}
              onClick={() => run(() => approveArchitecture(projectId, token), 'Arquitectura aprobada.')}
            >
              Aprobar arquitectura
            </button>
          ) : null}
        </div>
      </div>

      {message ? <p className="data-model-message" role="status">{message}</p> : null}

      {!architecture ? (
        <div className="data-model-empty">
          <strong>Aún no hay una arquitectura recomendada</strong>
          <p>
            Completa la definición, el modelo de datos aprobado, la especificación de endpoints y el mapa
            de pantallas; luego genera la recomendación con IA.
          </p>
        </div>
      ) : (
        <>
          <div className="architecture-summary">
            <span className={architecture.estado === 'approved' ? 'architecture-badge approved' : 'architecture-badge'}>
              {architecture.estado === 'approved' ? 'Aprobada' : 'Borrador'}
            </span>
            <h4>{scenarioName}</h4>
          </div>

          <section className="architecture-card architecture-rationale">
            <h4>¿Por qué esta arquitectura?</h4>
            <p>{architecture.rationale}</p>
          </section>

          <div className="architecture-grid">
            {Object.entries(TECH_LABELS).map(([key, label]) =>
              architecture.technologies?.[key] ? (
                <article className="architecture-card" key={key}>
                  <span className="architecture-label">{label}</span>
                  <p>{architecture.technologies[key]}</p>
                </article>
              ) : null
            )}
          </div>

          <section className="architecture-card">
            <h4>Operación</h4>
            <dl className="architecture-ops">
              {Object.entries(OPS_LABELS).map(([key, label]) =>
                architecture.operational?.[key] ? (
                  <div key={key}>
                    <dt>{label}</dt>
                    <dd>{architecture.operational[key]}</dd>
                  </div>
                ) : null
              )}
            </dl>
          </section>

          {architecture.alternatives?.length ? (
            <section className="architecture-card">
              <h4>Alternativas consideradas</h4>
              <ul>
                {architecture.alternatives.map((alternative, index) => (
                  <li key={index}>
                    <strong>{scenarios.find((item) => item.id === alternative.scenario)?.name || alternative.scenario}:</strong>{' '}
                    {alternative.reason}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </>
      )}

      {scenarios.length ? (
        <section className="architecture-catalog">
          <h4>Escenarios de arquitectura disponibles</h4>
          <ul>
            {scenarios.map((scenario) => (
              <li key={scenario.id} className={scenario.id === architecture?.scenario ? 'active' : undefined}>
                <strong>{scenario.name}</strong>
                <span>{scenario.summary}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
