import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import {
  getDefinition,
  getDefinitionQuestions,
  saveDefinitionMvp,
  saveDefinitionSections,
} from '../api/definition.js';
import { getProject } from '../api/projects.js';

const SECTION_META = [
  { key: 'problem', field: 'problem', label: 'Problema' },
  { key: 'context', field: 'context', label: 'Contexto' },
  { key: 'target_users', field: 'targetUsers', label: 'Usuarios objetivo' },
];

function toForm(definition) {
  const sections = definition?.sections || {};
  const mvp = definition?.mvp || {};
  const list = (items) => (Array.isArray(items) && items.length > 0 ? [...items] : ['']);

  return {
    problem: sections.problem?.respuesta || '',
    context: sections.context?.respuesta || '',
    targetUsers: sections.target_users?.respuesta || '',
    inScope: list(mvp.inScope),
    outOfScope: list(mvp.outOfScope),
    journey: list(mvp.journey),
  };
}

function EditableList({ label, items, onChange, placeholder, ordered = false }) {
  const update = (index, value) =>
    onChange(items.map((item, position) => (position === index ? value : item)));
  const add = () => onChange([...items, '']);
  const remove = (index) => onChange(items.filter((_, position) => position !== index));
  const move = (index, direction) => {
    const target = index + direction;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };

  return (
    <div className="definition-list">
      <div className="definition-list-header">
        <h3>{label}</h3>
        <button type="button" className="btn-secondary definition-add" onClick={add}>
          + Agregar
        </button>
      </div>

      {items.length === 0 ? <p className="definition-empty">Sin elementos.</p> : null}

      {items.map((item, index) => (
        <div className="definition-list-row" key={index}>
          {ordered ? <span className="definition-order">{index + 1}</span> : null}
          <input
            value={item}
            placeholder={placeholder}
            onChange={(event) => update(index, event.target.value)}
            aria-label={`${label} ${index + 1}`}
          />
          {ordered ? (
            <div className="definition-list-moves">
              <button type="button" onClick={() => move(index, -1)} disabled={index === 0} title="Subir">
                ↑
              </button>
              <button
                type="button"
                onClick={() => move(index, 1)}
                disabled={index === items.length - 1}
                title="Bajar"
              >
                ↓
              </button>
            </div>
          ) : null}
          <button type="button" className="danger-link" onClick={() => remove(index)}>
            Eliminar
          </button>
        </div>
      ))}
    </div>
  );
}

export default function ReviewDefinitionPage({ projectId: projectIdProp, role: roleProp }) {
  const { id } = useParams();
  const projectId = projectIdProp || id;
  const { token } = useAuth();

  const [definition, setDefinition] = useState(null);
  const [questions, setQuestions] = useState({});
  const [role, setRole] = useState(roleProp || null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState(toForm(null));
  const [fieldErrors, setFieldErrors] = useState({});
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [success, setSuccess] = useState('');

  const canEdit = ['owner', 'editor'].includes(role);

  const load = async (showLoader = true) => {
    if (showLoader) setLoading(true);
    setError('');

    try {
      const [definitionData, questionsData, projectData] = await Promise.all([
        getDefinition(projectId, token),
        getDefinitionQuestions(projectId, token),
        roleProp ? Promise.resolve({ role: roleProp }) : getProject(projectId, token),
      ]);

      setDefinition(definitionData.definition || {});
      setQuestions(questionsData.questions || {});
      setForm(toForm(definitionData.definition));
      setRole(projectData.role || null);
    } catch (err) {
      setError(err.message);
    } finally {
      if (showLoader) setLoading(false);
    }
  };

  useEffect(() => {
    if (projectId && token) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, token, roleProp]);

  const handleFieldChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setFieldErrors((prev) => ({ ...prev, [name]: undefined }));
  };

  const handleListChange = (key, items) => {
    setForm((prev) => ({ ...prev, [key]: items }));
    setFieldErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const handleEdit = () => {
    setForm(toForm(definition));
    setFieldErrors({});
    setSaveError('');
    setSuccess('');
    setIsEditing(true);
  };

  const handleCancel = () => {
    setForm(toForm(definition));
    setFieldErrors({});
    setSaveError('');
    setIsEditing(false);
  };

  const handleSave = async (event) => {
    event.preventDefault();
    setSaveError('');
    setSuccess('');

    const errors = {};
    if (!form.problem.trim()) errors.problem = 'El problema es obligatorio.';
    if (!form.context.trim()) errors.context = 'El contexto es obligatorio.';
    if (!form.targetUsers.trim()) errors.targetUsers = 'Los usuarios objetivo son obligatorios.';

    const inScope = form.inScope.map((item) => item.trim()).filter(Boolean);
    const outOfScope = form.outOfScope.map((item) => item.trim()).filter(Boolean);
    const journey = form.journey.map((item) => item.trim()).filter(Boolean);

    if (inScope.length === 0) errors.inScope = 'Agrega al menos una funcionalidad dentro del alcance.';
    if (outOfScope.length === 0) errors.outOfScope = 'Agrega al menos una funcionalidad fuera del alcance.';
    if (journey.length === 0) errors.journey = 'Agrega al menos un paso del recorrido.';

    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setIsSaving(true);
    try {
      await saveDefinitionSections(
        projectId,
        {
          problem: form.problem.trim(),
          context: form.context.trim(),
          targetUsers: form.targetUsers.trim(),
        },
        token
      );
      await saveDefinitionMvp(projectId, { inScope, outOfScope, journey }, token);
      await load(false);
      setIsEditing(false);
      setSuccess('Definición actualizada correctamente.');
    } catch (err) {
      setSaveError(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) return <p className="chat-status">Cargando revisión de la definición…</p>;
  if (error) return <p className="form-error" role="alert">{error}</p>;

  const sections = definition?.sections || {};
  const mvp = definition?.mvp || {};

  return (
    <div className="definition-page">
      <div className="definition-header">
        <div>
          <h2>Revisión de la Definición Inicial</h2>
          <p>Verifica y actualiza los datos estructurados del proyecto antes de avanzar.</p>
        </div>
        {canEdit && !isEditing ? (
          <button type="button" className="btn-primary" onClick={handleEdit}>
            Editar definición
          </button>
        ) : null}
      </div>

      {success ? <p className="form-success" role="status">{success}</p> : null}
      {saveError ? <p className="form-error" role="alert">{saveError}</p> : null}

      <form className="definition-form" onSubmit={handleSave} noValidate>
        {isEditing ? (
          <>
            {SECTION_META.map(({ key, field, label }) => (
              <div key={key} className="definition-field">
                <label htmlFor={field}>{label}</label>
                {questions[key]?.length ? (
                  <p className="definition-hint">{questions[key].join(' ')}</p>
                ) : null}
                <textarea
                  id={field}
                  name={field}
                  rows={4}
                  value={form[field]}
                  onChange={handleFieldChange}
                  placeholder={`Describe ${label.toLowerCase()}…`}
                  className={fieldErrors[field] ? 'invalid' : undefined}
                />
                {fieldErrors[field] ? (
                  <p className="field-error" role="alert">{fieldErrors[field]}</p>
                ) : null}
              </div>
            ))}

            <EditableList
              label="MVP · Dentro del alcance"
              items={form.inScope}
              onChange={(items) => handleListChange('inScope', items)}
              placeholder="Funcionalidad incluida en el MVP"
            />
            {fieldErrors.inScope ? <p className="field-error" role="alert">{fieldErrors.inScope}</p> : null}

            <EditableList
              label="MVP · Fuera del alcance"
              items={form.outOfScope}
              onChange={(items) => handleListChange('outOfScope', items)}
              placeholder="Funcionalidad fuera del MVP"
            />
            {fieldErrors.outOfScope ? <p className="field-error" role="alert">{fieldErrors.outOfScope}</p> : null}

            <EditableList
              label="Recorrido principal"
              items={form.journey}
              onChange={(items) => handleListChange('journey', items)}
              placeholder="Paso del recorrido"
              ordered
            />
            {fieldErrors.journey ? <p className="field-error" role="alert">{fieldErrors.journey}</p> : null}

            <div className="definition-actions">
              <button type="submit" className="btn-primary" disabled={isSaving}>
                {isSaving ? 'Guardando…' : 'Guardar cambios'}
              </button>
              <button type="button" className="btn-secondary" onClick={handleCancel} disabled={isSaving}>
                Cancelar
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="definition-grid">
              {SECTION_META.map(({ key, label }) => (
                <article key={key} className="definition-card">
                  <h3>{label}</h3>
                  <p className={sections[key]?.respuesta ? undefined : 'definition-empty'}>
                    {sections[key]?.respuesta || 'No definido todavía.'}
                  </p>
                </article>
              ))}
            </div>

            <div className="definition-grid">
              <article className="definition-card">
                <h3>MVP · Dentro del alcance</h3>
                {mvp.inScope?.length ? (
                  <ul>{mvp.inScope.map((item, index) => <li key={index}>{item}</li>)}</ul>
                ) : (
                  <p className="definition-empty">Sin funcionalidades registradas.</p>
                )}
              </article>
              <article className="definition-card">
                <h3>MVP · Fuera del alcance</h3>
                {mvp.outOfScope?.length ? (
                  <ul>{mvp.outOfScope.map((item, index) => <li key={index}>{item}</li>)}</ul>
                ) : (
                  <p className="definition-empty">Sin funcionalidades registradas.</p>
                )}
              </article>
            </div>

            <article className="definition-card definition-card-wide">
              <h3>Recorrido principal</h3>
              {mvp.journey?.length ? (
                <ol>{mvp.journey.map((item, index) => <li key={index}>{item}</li>)}</ol>
              ) : (
                <p className="definition-empty">Sin pasos registrados.</p>
              )}
            </article>
          </>
        )}
      </form>
    </div>
  );
}
