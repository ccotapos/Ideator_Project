import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useAuth } from '../context/AuthContext.jsx';
import { generateFinalDocuments, getContradictions, getFinalDocuments } from '../api/finalDocuments.js';

const STAGE_LABELS = {
  definicion: 'Definición',
  modelo: 'Modelo de datos',
  endpoints: 'Endpoints',
  mockups: 'Mockups',
  arquitectura: 'Arquitectura',
};

function downloadMarkdown(filename, content) {
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export default function FinalDocumentsPage({ projectId, role, onNavigateStage }) {
  const { token } = useAuth();
  const [contradictions, setContradictions] = useState([]);
  const [documents, setDocuments] = useState({ especificacion: null, arquitectura: null });
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState('');

  const canEdit = ['owner', 'editor'].includes(role);
  const hasContradictions = contradictions.length > 0;

  const load = async () => {
    const [contradictionData, documentData] = await Promise.all([
      getContradictions(projectId, token),
      getFinalDocuments(projectId, token),
    ]);
    setContradictions(contradictionData.contradictions || []);
    setDocuments(documentData.documents || { especificacion: null, arquitectura: null });
  };

  useEffect(() => {
    load().catch((error) => setMessage(error.message)).finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, token]);

  const generate = async (tipo) => {
    setWorking(true);
    setMessage('');
    try {
      const data = await generateFinalDocuments(projectId, tipo, token);
      setDocuments(data.documents);
      setMessage('Documento generado correctamente.');
    } catch (error) {
      setMessage(error.message);
      await load().catch(() => {});
    } finally {
      setWorking(false);
    }
  };

  const goToStage = (tab) => {
    if (onNavigateStage) onNavigateStage(tab);
  };

  if (loading) return <p className="chat-status">Cargando documentos finales…</p>;

  return (
    <div className="final-docs-page">
      <div className="final-docs-header">
        <div>
          <h3>Documentos finales</h3>
          <p>
            Especificación del producto y arquitectura definitiva en Markdown, listas para entregar a otra IA.
          </p>
        </div>
        {canEdit ? (
          <div className="final-docs-actions">
            <button
              type="button"
              className="btn-primary"
              disabled={working || hasContradictions}
              onClick={() => generate('especificacion')}
            >
              Generar especificación
            </button>
            <button
              type="button"
              className="btn-primary"
              disabled={working || hasContradictions}
              onClick={() => generate('arquitectura')}
            >
              Generar arquitectura
            </button>
          </div>
        ) : null}
      </div>

      {message ? <p className="data-model-message" role="status">{message}</p> : null}

      {hasContradictions ? (
        <section className="contradiction-report" role="alert">
          <h4>Contradicciones detectadas ({contradictions.length})</h4>
          <p>Resuelve estas contradicciones antes de generar la documentación final.</p>
          <ul>
            {contradictions.map((item, index) => (
              <li key={`${item.code}-${index}`}>
                <div>
                  <strong>{item.message}</strong>
                  <span className="contradiction-stages">
                    Etapas: {item.stages.map((stage) => STAGE_LABELS[stage] || stage).join(' ↔ ')}
                  </span>
                  {item.reference ? (
                    <span className="contradiction-reference">Referencia: {item.reference}</span>
                  ) : null}
                </div>
                <button type="button" className="btn-secondary" onClick={() => goToStage(item.tab)}>
                  Ir a {STAGE_LABELS[item.stage] || item.stage}
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <p className="contradiction-ok">✓ No hay contradicciones entre etapas. Puedes generar la documentación final.</p>
      )}

      <div className="final-docs-grid">
        {[
          ['especificacion', 'Especificación del producto'],
          ['arquitectura', 'Arquitectura definitiva'],
        ].map(([tipo, title]) => (
          <article key={tipo} className="final-doc-card">
            <header>
              <h4>{title}</h4>
              {documents[tipo] ? (
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => downloadMarkdown(`${tipo}.md`, documents[tipo].contenido)}
                >
                  Descargar .md
                </button>
              ) : null}
            </header>
            {documents[tipo] ? (
              <div className="final-doc-preview">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{documents[tipo].contenido}</ReactMarkdown>
              </div>
            ) : (
              <p className="definition-empty">Aún no se ha generado este documento.</p>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}
