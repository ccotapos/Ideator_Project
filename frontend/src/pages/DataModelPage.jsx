import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import {
  addAttribute,
  addEntity,
  addRelationship,
  approveDataModel,
  deleteAttribute,
  deleteEntity,
  deleteRelationship,
  generateDataModel,
  getDataModel,
  updateAttribute,
  updateEntity,
  updateRelationship,
} from '../api/dataModel.js';

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

  const editAttribute = (attribute) => {
    const name = window.prompt('Nombre del atributo', attribute.nombre);
    if (!name) return;
    const type = window.prompt('Tipo PostgreSQL', attribute.tipo_dato);
    if (!type) return;
    const nullable = window.confirm('¿El atributo puede quedar vacío?');
    run(() => updateAttribute(projectId, attribute.id, {
      name,
      type,
      nullable,
      primaryKey: attribute.es_pk,
    }, token), 'Atributo actualizado.');
  };

  const createRelationship = () => {
    if (model.entities.length < 2) {
      setMessage('Se necesitan al menos dos entidades para crear una relación.');
      return;
    }
    const options = model.entities.map((entity) => `${entity.id}: ${entity.nombre}`).join('\n');
    const fromEntityId = Number(window.prompt(`Entidad de origen (escribe el ID):\n${options}`));
    const toEntityId = Number(window.prompt(`Entidad de destino (escribe el ID):\n${options}`));
    if (!fromEntityId || !toEntityId) return;
    const name = window.prompt('Nombre de la relación', 'pertenece_a');
    const fromCardinality = window.prompt('Cardinalidad de origen', '1');
    const toCardinality = window.prompt('Cardinalidad de destino', 'N');
    if (name && fromCardinality && toCardinality) {
      run(() => addRelationship(projectId, { fromEntityId, toEntityId, name, fromCardinality, toCardinality }, token), 'Relación agregada.');
    }
  };

  const editRelationship = (relationship) => {
    const name = window.prompt('Nombre de la relación', relationship.nombre);
    const fromCardinality = window.prompt('Cardinalidad de origen', relationship.cardinalidad_origen);
    const toCardinality = window.prompt('Cardinalidad de destino', relationship.cardinalidad_destino);
    if (name && fromCardinality && toCardinality) {
      run(() => updateRelationship(projectId, relationship.id, { name, fromCardinality, toCardinality }, token), 'Relación actualizada.');
    }
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
          {editable ? <button className="btn-secondary" disabled={working} onClick={createRelationship}>+ Relación</button> : null}
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
                <ul>{entity.attributes.map((attribute) => <li key={attribute.id}><span>{attribute.es_pk ? 'PK' : '  '} {attribute.nombre}{attribute.nullable ? ' · opcional' : ' · obligatorio'}</span><span>{attribute.tipo_dato}{editable ? <><button title="Editar atributo" onClick={() => editAttribute(attribute)}>Editar</button><button title="Eliminar atributo" onClick={() => run(() => deleteAttribute(projectId, attribute.id, token), 'Atributo eliminado.')}>×</button></> : null}</span></li>)}</ul>
                {editable ? <footer><button onClick={() => createAttribute(entity)}>+ Atributo</button><button className="danger-link" onClick={() => window.confirm(`¿Eliminar ${entity.nombre}?`) && run(() => deleteEntity(projectId, entity.id, token), 'Entidad eliminada.')}>Eliminar</button></footer> : null}
              </article>
            ))}
          </div>
          <section className="relationship-list">
            <h4>Relaciones y cardinalidades</h4>
            {model.relationships.length ? model.relationships.map((relation) => <div className="relationship-item" key={relation.id}><p><strong>{relation.entidad_origen}</strong> ({relation.cardinalidad_origen}) → <strong>{relation.entidad_destino}</strong> ({relation.cardinalidad_destino}) · {relation.nombre}</p>{editable ? <div><button type="button" onClick={() => editRelationship(relation)}>Editar</button><button type="button" className="danger-link" onClick={() => window.confirm('¿Eliminar esta relación?') && run(() => deleteRelationship(projectId, relation.id, token), 'Relación eliminada.')}>Eliminar</button></div> : null}</div>) : <p>Sin relaciones registradas.</p>}
          </section>
        </>
      ) : null}
    </div>
  );
}
