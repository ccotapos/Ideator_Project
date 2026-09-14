import { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import FormField from '../components/FormField.jsx';

export default function ProfilePage() {
  const { user, updateProfile } = useAuth();

  const [form, setForm] = useState({ name: user?.name || '', email: user?.email || '' });
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setFieldErrors((prev) => ({ ...prev, [name]: undefined }));
    setSuccessMessage('');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setFormError('');
    setSuccessMessage('');

    const errors = {};
    if (!form.name.trim()) errors.name = 'El nombre es obligatorio.';
    if (!form.email.trim()) errors.email = 'El correo es obligatorio.';
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setIsSaving(true);
    try {
      await updateProfile({ name: form.name.trim(), email: form.email.trim() });
      setSuccessMessage('Perfil actualizado correctamente.');
    } catch (err) {
      // Ej: "Ese correo electrónico ya está en uso por otra cuenta." (409)
      setFormError(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="page-section">
      <h2>Mi perfil</h2>

      <article className="profile-card">
        <p className="auth-subtitle">Actualiza tu nombre y correo electrónico.</p>

        <form onSubmit={handleSubmit} noValidate>
          <FormField
            id="name"
            label="Nombre completo"
            value={form.name}
            onChange={handleChange}
            error={fieldErrors.name}
            autoComplete="name"
            placeholder="Ada Lovelace"
          />

          <FormField
            id="email"
            label="Correo electrónico"
            type="email"
            value={form.email}
            onChange={handleChange}
            error={fieldErrors.email}
            autoComplete="email"
            placeholder="tu@correo.com"
          />

          {formError ? <p className="form-error" role="alert">{formError}</p> : null}
          {successMessage ? <p className="form-success" role="status">{successMessage}</p> : null}

          <button type="submit" className="btn-primary profile-save-btn" disabled={isSaving}>
            {isSaving ? 'Guardando…' : 'Guardar cambios'}
          </button>
        </form>
      </article>
    </section>
  );
}