import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { getProjectMembers, inviteMember } from '../api/projects.js';

const roleLabels = { owner: 'Owner', editor: 'Colaborador', viewer: 'Lector' };

export const ProjectMembers = ({ projectId }) => {
  const { token } = useAuth();
  const [members, setMembers] = useState([]);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('editor');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isInviting, setIsInviting] = useState(false);

  const loadMembers = async () => {
    try {
      setLoading(true);
      const data = await getProjectMembers(projectId, token);
      setMembers(data);
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (projectId) loadMembers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, token]);

  const handleInvite = async (event) => {
    event.preventDefault();
    setError('');
    setSuccess('');
    setIsInviting(true);

    try {
      await inviteMember(projectId, email, role, token);
      setSuccess('¡Usuario añadido exitosamente al proyecto!');
      setEmail('');
      loadMembers();
    } catch (err) {
      setError(err.message);
    } finally {
      setIsInviting(false);
    }
  };

  return (
    <div className="project-members">
      <h3>Equipo del proyecto</h3>

      <form className="invite-form" onSubmit={handleInvite}>
        <input
          type="email"
          placeholder="Correo del colaborador"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <select value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="editor">Editor</option>
          <option value="viewer">Lector</option>
        </select>
        <button type="submit" className="btn-primary invite-btn" disabled={isInviting}>
          {isInviting ? 'Invitando…' : 'Invitar'}
        </button>
      </form>

      {error ? <p className="form-error" role="alert">{error}</p> : null}
      {success ? <p className="form-success" role="status">{success}</p> : null}

      <h4>Integrantes actuales</h4>
      {loading ? (
        <p className="chat-status">Cargando miembros…</p>
      ) : (
        <ul className="members-list">
          {members.map((member) => (
            <li key={member.id} className="members-list-item">
              <span><strong>{member.name}</strong> ({member.email})</span>
              <span className="project-role">{roleLabels[member.rol] || member.rol}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};