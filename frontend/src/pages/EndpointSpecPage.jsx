import { Fragment, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { approveEndpointSpec, generateEndpointSpec, getEndpointSpec, validateEndpointSpec } from '../api/endpointSpec.js';

export default function EndpointSpecPage({ projectId, role }) {
  const { token } = useAuth();
  const [spec, setSpec] = useState(null);
  const [validation, setValidation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState('');
  const [expandedEndpoint, setExpandedEndpoint] = useState(null);

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
        <div className="endpoint-spec-list">
        <table className="endpoint-table">
          <thead>
            <tr>
              <th>Método</th>
              <th>Ruta</th>
              <th>Operación</th>
              <th>Entidad</th>
              <th>Atributos</th>
              <th>Detalle</th>
            </tr>
          </thead>
          <tbody>
            {spec.endpoints.map((endpoint) => (
              <Fragment key={endpoint.id}>
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
                <td><button type="button" className="btn-secondary" onClick={() => setExpandedEndpoint(expandedEndpoint === endpoint.id ? null : endpoint.id)}>{expandedEndpoint === endpoint.id ? 'Ocultar' : 'Ver detalle'}</button></td>
              </tr>
              {expandedEndpoint === endpoint.id ? (
                <tr className="endpoint-detail-row">
                  <td colSpan="6">
                    <div className="endpoint-detail-grid">
                      <EndpointItems title="Parámetros de ruta" items={endpoint.parametros_ruta} />
                      <EndpointItems title="Parámetros de consulta" items={endpoint.parametros_consulta} />
                      <EndpointItems title="Cabeceras" items={endpoint.cabeceras} />
                      <EndpointBody body={endpoint.cuerpo} />
                      <EndpointTextList title="Validaciones" items={endpoint.validaciones} />
                      <EndpointResponses items={endpoint.respuestas} />
                    </div>
                  </td>
                </tr>
              ) : null}
              </Fragment>
            ))}
          </tbody>
        </table>
        </div>
      ) : null}
    </div>
  );
}

function EndpointItems({ title, items = [] }) {
  return <section><h4>{title}</h4>{items.length ? <ul>{items.map((item, index) => <li key={`${item.name}-${index}`}><code>{item.name}</code> · {item.type}{item.required ? ' · obligatorio' : ' · opcional'}<span>{item.description}</span></li>)}</ul> : <p>No aplica.</p>}</section>;
}

function EndpointBody({ body }) {
  return <section><h4>Cuerpo de la solicitud</h4>{body ? <><p>{body.description || (body.required ? 'Obligatorio' : 'Opcional')}</p><ul>{(body.fields || []).map((field, index) => <li key={`${field.name}-${index}`}><code>{field.name}</code> · {field.type}{field.required ? ' · obligatorio' : ' · opcional'}<span>{field.description}</span></li>)}</ul></> : <p>No aplica.</p>}</section>;
}

function EndpointTextList({ title, items = [] }) {
  return <section><h4>{title}</h4>{items.length ? <ul>{items.map((item, index) => <li key={index}>{item}</li>)}</ul> : <p>Sin validaciones adicionales.</p>}</section>;
}

function EndpointResponses({ items = [] }) {
  return <section><h4>Respuestas</h4>{items.length ? <ul>{items.map((item, index) => <li key={`${item.status}-${index}`}><strong>{item.status}</strong> · {item.description}{item.schema ? <pre>{JSON.stringify(item.schema, null, 2)}</pre> : null}</li>)}</ul> : <p>Sin respuestas documentadas.</p>}</section>;
}
