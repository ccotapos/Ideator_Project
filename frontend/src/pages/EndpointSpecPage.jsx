import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { approveEndpointSpec, generateEndpointSpec, getEndpointSpec, validateEndpointSpec } from '../api/endpointSpec.js';

export default function EndpointSpecPage({ projectId, role }) {
  const { token } = useAuth();
  const [spec, setSpec] = useState(null);
  const [validation, setValidation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState('');

  const canEdit = ['owner', 'editor'].includes(role);
  const isDraft = !spec || spec.estado === 'draft';
  const hasIssues = Boolean(validation && !validation.consistent);

  const refresh = async () => {
    const data = await getEndpointSpec(projectId, token);
    setSpec(data.spec);
    if (data.spec) {
      const validationData = await validateEndpointSpec(projectId, token);
      setValidation(validationData.validation);
    } else {
      setValidation(null);
    }
  };

  useEffect(() => {
    refresh().catch((error) => setMessage(error.message)).finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, token]);

  const run = async (action, success) => {
    setWorking(true);
    setMessage('');
    try {
      await action();
      await refresh();
      setMessage(success);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setWorking(false);
    }
  };

  if (loading) return <p>Cargando especificación de endpoints...</p>;

  return (
    <div className="endpoint-spec-page">
      <div className="endpoint-spec-toolbar">
        <div>
          <h3>Especificación de endpoints</h3>
          <p>
            {spec
              ? `${spec.endpoints.length} endpoints · ${spec.estado === 'approved' ? 'Aprobada' : 'Borrador'}`
              : 'Aún no se ha generado'}
          </p>
        </div>
        <div className="endpoint-spec-actions">
          {canEdit && isDraft ? (
            <button
              type="button"
              className="btn-primary"
              disabled={working}
              onClick={() => run(() => generateEndpointSpec(projectId, token), 'Especificación generada con IA.')}
            >
              {spec ? 'Regenerar con IA' : 'Generar con IA'}
            </button>
          ) : null}
          {spec ? (
            <button
              type="button"
              className="btn-secondary"
              disabled={working}
              onClick={() => run(() => validateEndpointSpec(projectId, token), 'Consistencia validada.')}
            >
              Validar consistencia
            </button>
          ) : null}
          {role === 'owner' && spec?.estado === 'draft' ? (
            <button
              type="button"
              className="btn-approve"
              disabled={working || hasIssues}
              title={hasIssues ? 'Resuelve las inconsistencias antes de aprobar.' : undefined}
              onClick={() => run(() => approveEndpointSpec(projectId, token), 'Especificación aprobada y bloqueada.')}
            >
              Aprobar especificación
            </button>
          ) : null}
        </div>
      </div>

      {message ? <p className="endpoint-spec-message" role="status">{message}</p> : null}

      {spec && validation ? (
        validation.consistent ? (
          <p className="endpoint-validation endpoint-validation-ok" role="status">
            ✓ La especificación es consistente con el modelo de datos aprobado.
          </p>
        ) : (
          <div className="endpoint-validation endpoint-validation-error" role="alert">
            <strong>Inconsistencias con el modelo de datos ({validation.issues.length})</strong>
            <ul>
              {validation.issues.map((issue, index) => (
                <li key={index}>
                  <code>{issue.metodo} {issue.ruta}</code> — {issue.message}
                </li>
              ))}
            </ul>
            <p>Regenera la especificación con IA o corrige el modelo antes de aprobarla.</p>
          </div>
        )
      ) : null}

      {!spec ? (
        <div className="endpoint-spec-empty">
          <strong>Genera la especificación de endpoints</strong>
          <p>
            La IA usará el modelo de datos aprobado y la definición del producto para proponer los
            endpoints (método, ruta y operación) necesarios para implementarlo.
          </p>
        </div>
      ) : null}

      {spec ? (
        <table className="endpoint-table">
          <thead>
            <tr>
              <th>Método</th>
              <th>Ruta</th>
              <th>Operación</th>
              <th>Entidad</th>
              <th>Atributos</th>
            </tr>
          </thead>
          <tbody>
            {spec.endpoints.map((endpoint) => (
              <tr key={endpoint.id}>
                <td>
                  <span className={`endpoint-method endpoint-method-${endpoint.metodo.toLowerCase()}`}>
                    {endpoint.metodo}
                  </span>
                </td>
                <td><code>{endpoint.ruta}</code></td>
                <td>{endpoint.operacion}</td>
                <td>{endpoint.entidad || '—'}</td>
                <td>{(endpoint.atributos || []).join(', ') || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </div>
  );
}
