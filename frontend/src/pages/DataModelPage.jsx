import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { addAttribute, addEntity, approveDataModel, deleteAttribute, deleteEntity, generateDataModel, getDataModel, updateEntity } from '../api/dataModel.js';

export default function DataModelPage({ projectId, role }) {
  const { token } = useAuth();
  const [model, setModel] = useState(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState('');
  const editable = model?.estado !== 'approved' && ['owner', 'editor'].includes(role);

  const refresh = async () => {
    const data = await getDataModel(projectId, token);
    setModel(data.model);
  };

  useEffect(() => {
    refresh().catch((error) => setMessage(error.message)).finally(() => setLoading(false));
  }, [projectId, token]);

  const run = async (action, success) => {
    setWorking(true); setMessage('');
    try { await action(); await refresh(); setMessage(success); }
    catch (error) { setMessage(error.message); }
    finally { setWorking(false); }
  };

  const createEntity = () => {
    const name = window.prompt('Nombre de la nueva entidad');
    if (name) run(() => addEntity(projectId, { name }, token), 'Entidad agregada.');
  };

  const renameEntity = (entity) => {
    const name = window.prompt('Nuevo nombre de la entidad', entity.nombre);
    if (name && name !== entity.nombre) run(() => updateEntity(projectId, entity.id, { name }, token), 'Entidad actualizada.');
  };

  const createAttribute = (entity) => {
    const name = window.prompt('Nombre del atributo');
    if (!name) return;
    const type = window.prompt('Tipo PostgreSQL', 'VARCHAR(255)');
    if (type) run(() => addAttribute(projectId, entity.id, { name, type }, token), 'Atributo agregado.');
  };

  if (loading) return <p>Cargando modelo de datos...</p>;

  return (
    <div className="data-model-page">
      <div className="data-model-toolbar">
        <div>
          <h3>Modelo físico</h3>
          <p>{model ? `Versión ${model.version} · ${model.estado === 'approved' ? 'Aprobado' : 'Borrador'}` : 'Aún no se ha generado'}</p>
        </div>
        <div className="data-model-actions">
          {editable || !model ? <button className="btn-primary" disabled={working} onClick={() => run(() => generateDataModel(projectId, token), 'Modelo generado con IA.')}>{model ? 'Regenerar con IA' : 'Generar con IA'}</button> : null}
          {editable ? <button className="btn-secondary" disabled={working} onClick={createEntity}>+ Entidad</button> : null}
          {role === 'owner' && model?.estado === 'draft' ? <button className="btn-approve" disabled={working} onClick={() => run(() => approveDataModel(projectId, token), 'Modelo aprobado y bloqueado.')}>Aprobar modelo</button> : null}
        </div>
      </div>

      {message ? <p className="data-model-message" role="status">{message}</p> : null}
      {!model ? <div className="data-model-empty"><strong>Genera la primera propuesta</strong><p>La IA usará el problema, el MVP y el recorrido definidos por el equipo.</p></div> : null}

      {model ? (
        <>
          <div className="er-diagram" aria-label="Diagrama entidad relación">
            {model.entities.map((entity) => (
              <article className="er-entity" key={entity.id}>
                <header><strong>{entity.nombre}</strong>{editable ? <button title="Renombrar entidad" onClick={() => renameEntity(entity)}>✎</button> : null}</header>
                <ul>{entity.attributes.map((attribute) => <li key={attribute.id}><span>{attribute.es_pk ? 'PK' : '  '} {attribute.nombre}</span><span>{attribute.tipo_dato}{editable ? <button title="Eliminar atributo" onClick={() => run(() => deleteAttribute(projectId, attribute.id, token), 'Atributo eliminado.')}>×</button> : null}</span></li>)}</ul>
                {editable ? <footer><button onClick={() => createAttribute(entity)}>+ Atributo</button><button className="danger-link" onClick={() => window.confirm(`¿Eliminar ${entity.nombre}?`) && run(() => deleteEntity(projectId, entity.id, token), 'Entidad eliminada.')}>Eliminar</button></footer> : null}
              </article>
            ))}
          </div>
          <section className="relationship-list">
            <h4>Relaciones y cardinalidades</h4>
            {model.relationships.length ? model.relationships.map((relation) => <p key={relation.id}><strong>{relation.entidad_origen}</strong> ({relation.cardinalidad_origen}) → <strong>{relation.entidad_destino}</strong> ({relation.cardinalidad_destino})</p>) : <p>Sin relaciones registradas.</p>}
          </section>
        </>
      ) : null}
    </div>
  );
}
