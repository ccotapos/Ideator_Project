import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import {
  createBlockingQuestion,
  getBlockingQuestions,
  resolveBlockingQuestion,
} from '../api/blockingQuestions.js';

const CATEGORY_LABELS = {
  data_model: 'Modelo de datos',
  backend: 'Backend',
  interface: 'Interfaz',
  architecture: 'Arquitectura',
};

export default function BlockingQuestionsPanel({ projectId, role }) {
  const { token } = useAuth();
  const [questions, setQuestions] = useState([]);
  const [category, setCategory] = useState('data_model');
  const [question, setQuestion] = useState('');
  const [message, setMessage] = useState('');
  const [working, setWorking] = useState(false);
  const canEdit = ['owner', 'editor'].includes(role);

  const load = async () => {
    const data = await getBlockingQuestions(projectId, token);
    setQuestions(data.questions || []);
  };

  useEffect(() => {
    load().catch((error) => setMessage(error.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, token]);

  const addQuestion = async (event) => {
    event.preventDefault();
    if (!question.trim()) return;
    setWorking(true);
    setMessage('');
    try {
      await createBlockingQuestion(projectId, { category, question: question.trim() }, token);
      setQuestion('');
      await load();
    } catch (error) {
      setMessage(error.message);
    } finally {
      setWorking(false);
    }
  };

  const resolveQuestion = async (item) => {
    const answer = window.prompt('Respuesta que resuelve esta decisión', item.respuesta || '');
    if (!answer?.trim()) return;
    setWorking(true);
    setMessage('');
    try {
      await resolveBlockingQuestion(projectId, item.id, answer.trim(), token);
      await load();
    } catch (error) {
      setMessage(error.message);
    } finally {
      setWorking(false);
    }
  };

  const unresolved = questions.filter((item) => !item.resuelta);

  return (
    <section className="blocking-questions-panel">
      <div className="blocking-questions-header">
        <div>
          <h3>Preguntas bloqueantes</h3>
          <p>{unresolved.length ? `${unresolved.length} decisión(es) impiden finalizar el proyecto.` : 'No hay decisiones críticas pendientes.'}</p>
        </div>
      </div>

      {canEdit ? (
        <form className="blocking-question-form" onSubmit={addQuestion}>
          <select value={category} onChange={(event) => setCategory(event.target.value)} aria-label="Categoría">
            {Object.entries(CATEGORY_LABELS).map(([value, label]) => <option value={value} key={value}>{label}</option>)}
          </select>
          <input value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="Decisión que debe resolverse" />
          <button type="submit" className="btn-secondary" disabled={working || !question.trim()}>Agregar</button>
        </form>
      ) : null}

      {message ? <p className="form-error" role="alert">{message}</p> : null}
      <ul className="blocking-question-list">
        {questions.map((item) => (
          <li key={item.id} className={item.resuelta ? 'resolved' : undefined}>
            <div>
              <span>{CATEGORY_LABELS[item.categoria] || item.categoria}</span>
              <strong>{item.pregunta}</strong>
              {item.respuesta ? <p>Respuesta: {item.respuesta}</p> : null}
            </div>
            {!item.resuelta && canEdit ? <button type="button" className="btn-approve" disabled={working} onClick={() => resolveQuestion(item)}>Resolver</button> : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
