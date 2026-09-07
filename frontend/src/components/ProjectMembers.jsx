import { useState, useEffect } from 'react';
import { getProjectMembers, inviteMember } from '../api/projects';

const roleLabels = {
  owner: 'Owner',
  editor: 'Editor',
  viewer: 'Lector',
};

export const ProjectMembers = ({ projectId }) => {
  const [members, setMembers] = useState([]);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('editor');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const loadMembers = async () => {
    try {
      setLoading(true);
      const data = await getProjectMembers(projectId);
      setMembers(data || []);
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (projectId) {
      loadMembers();
    }
  }, [projectId]);

  const handleInvite = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    try {
      setSubmitting(true);
      await inviteMember(projectId, email, role);
      setSuccess('Invitación enviada y colaborador agregado al proyecto.');
      setEmail('');
      await loadMembers();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="members-panel">
      <form className="invite-form" onSubmit={handleInvite}>
        <div className="form-field invite-email">
          <label htmlFor="invite-email">Email del invitado</label>
          <input
            id="invite-email"
            type="email"
            placeholder="colaborador@ejemplo.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>

        <div className="form-field invite-role">
          <label htmlFor="invite-role">Rol</label>
          <select id="invite-role" value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="editor">Editor</option>
            <option value="viewer">Lector</option>
          </select>
        </div>

        <button className="btn-primary invite-submit" type="submit" disabled={submitting}>
          {submitting ? 'Invitando...' : 'Invitar'}
        </button>
      </form>

      {error && <p className="form-error" role="alert">{error}</p>}
      {success && <p className="form-success" role="status">{success}</p>}

      <div className="members-header">
        <h3>Colaboradores actuales</h3>
        <span>{members.length} integrante{members.length === 1 ? '' : 's'}</span>
      </div>
      {loading ? (
        <p className="muted-text">Cargando colaboradores...</p>
      ) : members.length === 0 ? (
        <p className="muted-text">Aún no hay colaboradores en este proyecto.</p>
      ) : (
        <ul className="members-list">
          {members.map((member) => (
            <li key={member.id} className="member-row">
              <div>
                <strong>{member.name}</strong>
                <span>{member.email}</span>
              </div>
              <span className="project-role">
                {roleLabels[member.rol] || member.rol}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
