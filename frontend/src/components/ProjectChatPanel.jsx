import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { getProjectMessages, sendProjectMessage } from '../api/chat.js';
import { formatTime } from '../utils/date.js';

export default function ProjectChatPanel({ projectId }) {
  const { token } = useAuth();

  const [messages, setMessages] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [draft, setDraft] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState('');

  const scrollRef = useRef(null);

  useEffect(() => {
    let active = true;

    async function loadHistory() {
      try {
        setLoadingHistory(true);
        const data = await getProjectMessages(projectId, token);
        if (active) setMessages(data);
      } catch (err) {
        if (active) setLoadError(err.message);
      } finally {
        if (active) setLoadingHistory(false);
      }
    }

    loadHistory();
    return () => {
      active = false;
    };
  }, [projectId, token]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, isSending]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    const content = draft.trim();
    if (!content || isSending) return;

    setSendError('');
    setDraft('');

    const tempId = `temp-${Date.now()}`;
    const tempMessage = {
      id: tempId,
      remitente: 'usuario',
      contenido: content,
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, tempMessage]);
    setIsSending(true);

    try {
      const { userMessage, ideatorMessage } = await sendProjectMessage(projectId, content, token);
      setMessages((prev) => [...prev.filter((m) => m.id !== tempId), userMessage, ideatorMessage]);
    } catch (err) {
      setSendError(err.message);
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setDraft(content);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="chat-page">
      <div className="chat-window" ref={scrollRef}>
        {loadingHistory ? <p className="chat-status">Cargando conversación…</p> : null}
        {loadError ? <p className="form-error" role="alert">{loadError}</p> : null}

        {!loadingHistory && !loadError && messages.length === 0 ? (
          <p className="chat-status">
            Aún no hay mensajes. Cuéntale a Ideator en qué están trabajando para empezar.
          </p>
        ) : null}

        {messages.map((message) => (
          <div
            key={message.id}
            className={`chat-bubble ${message.remitente === 'usuario' ? 'chat-bubble-user' : 'chat-bubble-ideator'}`}
          >
            <p className="chat-bubble-text">{message.contenido}</p>
            <span className="chat-bubble-time">{formatTime(message.created_at)}</span>
          </div>
        ))}

        {isSending ? (
          <div className="chat-bubble chat-bubble-ideator chat-bubble-loading" aria-label="Ideator está escribiendo">
            <span className="chat-typing-dot" />
            <span className="chat-typing-dot" />
            <span className="chat-typing-dot" />
          </div>
        ) : null}
      </div>

      {sendError ? <p className="form-error" role="alert">{sendError}</p> : null}

      <form className="chat-input-row" onSubmit={handleSubmit}>
        <input
          type="text"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Escribe un mensaje para Ideator…"
          disabled={isSending}
          aria-label="Mensaje para Ideator"
        />
        <button type="submit" className="btn-primary chat-send-btn" disabled={isSending || !draft.trim()}>
          Enviar
        </button>
      </form>
    </div>
  );
}