import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { createProjectDecision, getProjectDecisions } from '../api/chat.js';
import { getProjectActivity } from '../api/projects.js';
import { formatDate } from '../utils/date.js';

const ACTION_LABELS = {
  project_created: 'Creó el proyecto',
  project_updated: 'Actualizó el proyecto',
  member_invited: 'Invitó a un integrante',
  decision_created: 'Registró una decisión',
  definition_sections_updated: 'Actualizó la definición',
  mvp_definition_updated: 'Actualizó el MVP',
  data_model_generated: 'Generó el modelo de datos',
  data_model_approved: 'Aprobó el modelo de datos',
  endpoint_spec_approved: 'Aprobó la especificación de endpoints',
  screen_map_generated: 'Generó el mapa de pantallas',
  architecture_recommended: 'Generó una arquitectura',
  architecture_approved: 'Aprobó la arquitectura',
  blocking_question_created: 'Registró una pregunta bloqueante',
  blocking_question_resolved: 'Resolvió una pregunta bloqueante',
  final_documents_generated: 'Generó documentos finales',
};

export default function ProjectActivity({ projectId, role }) {
  const { token } = useAuth();
  const [activity, setActivity] = useState([]);
  const [decisions, setDecisions] = useState([]);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [message, setMessage] = useState('');
  const canEdit = ['owner', 'editor'].includes(role);

  const load = async () => {
    const [activityData, decisionData] = await Promise.all([
      getProjectActivity(projectId, token),
      getProjectDecisions(projectId, token),
    ]);
    setActivity(activityData || []);
    setDecisions(decisionData || []);
  };

  useEffect(() => {
    load().catch((error) => setMessage(error.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, token]);

  const submitDecision = async (event) => {
    event.preventDefault();
    if (!content.trim()) return;
    setMessage('');
    try {
      await createProjectDecision(projectId, { title: title.trim() || null, content: content.trim() }, token);
      setTitle('');
      setContent('');
      await load();
    } catch (error) {
      setMessage(error.message);
    }
  };

  return (
    <div className="project-traceability">
      <section>
        <h3>Decisiones del proyecto</h3>
        {canEdit ? (
          <form className="decision-form" onSubmit={submitDecision}>
            <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Título opcional" />
            <input value={content} onChange={(event) => setContent(event.target.value)} placeholder="Decisión tomada" required />
            <button type="submit" className="btn-secondary">Registrar</button>
          </form>
        ) : null}
        <ul className="traceability-list">
          {decisions.map((item) => <li key={item.id}><strong>{item.titulo || 'Decisión'}</strong><p>{item.contenido}</p><span>{item.usuario_nombre} · {formatDate(item.created_at)}</span></li>)}
          {!decisions.length ? <li className="empty">Sin decisiones registradas.</li> : null}
        </ul>
      </section>
      <section>
        <h3>Historial de actividad</h3>
        <ul className="traceability-list">
          {activity.map((item) => <li key={item.id}><strong>{ACTION_LABELS[item.accion] || item.accion}</strong><span>{item.usuario_nombre || 'Sistema'} · {formatDate(item.created_at)}</span></li>)}
          {!activity.length ? <li className="empty">Sin actividad registrada.</li> : null}
        </ul>
      </section>
      {message ? <p className="form-error" role="alert">{message}</p> : null}
    </div>
  );
}
