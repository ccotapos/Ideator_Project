import React, { useState, useEffect } from 'react';
import { getProjectMembers, inviteMember } from '../api/projects';

export const ProjectMembers = ({ projectId }) => {
  const [members, setMembers] = useState([]);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('editor');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Cargar miembros al montar el componente
  const loadMembers = async () => {
    try {
      setLoading(true);
      const data = await getProjectMembers(projectId);
      setMembers(data);
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

  // Manejar el envío de invitación
  const handleInvite = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    try {
      await inviteMember(projectId, email, role);
      setSuccess('¡Usuario añadido exitosamente al proyecto!');
      setEmail('');
      loadMembers(); // Recargar lista de miembros
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div style={{ maxWidth: '600px', margin: '20px auto', padding: '20px', border: '1px solid #ccc', borderRadius: '8px' }}>
      <h2>Equipo del Proyecto</h2>

      {/* Formulario de Invitación */}
      <form onSubmit={handleInvite} style={{ marginBottom: '20px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        <input
          type="email"
          placeholder="Correo del colaborador"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          style={{ flex: 1, padding: '8px' }}
        />
        <select value={role} onChange={(e) => setRole(e.target.value)} style={{ padding: '8px' }}>
          <option value="editor">Editor</option>
          <option value="viewer">Lector</option>
        </select>
        <button type="submit" style={{ padding: '8px 16px', cursor: 'pointer' }}>
          Invitar
        </button>
      </form>

      {/* Mensajes de Feedback */}
      {error && <p style={{ color: 'red' }}>{error}</p>}
      {success && <p style={{ color: 'green' }}>{success}</p>}

      {/* Lista de Miembros */}
      <h3>Integrantes Actuales</h3>
      {loading ? (
        <p>Cargando miembros...</p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {members.map((member) => (
            <li key={member.id} style={{ padding: '8px 0', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between' }}>
              <span><strong>{member.name}</strong> ({member.email})</span>
              <span style={{ textTransform: 'capitalize', backgroundColor: '#e0e0e0', padding: '2px 8px', borderRadius: '4px' }}>
                {member.rol}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};