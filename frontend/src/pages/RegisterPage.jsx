import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import FormField from '../components/FormField.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { validateRegisterForm } from '../utils/validation.js';

const INITIAL_FORM = { name: '', email: '', password: '', confirmPassword: '' };

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState(INITIAL_FORM);
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setFieldErrors((prev) => ({ ...prev, [name]: undefined }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setFormError('');
    setSuccessMessage('');

    const errors = validateRegisterForm(form);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      return;
    }

    setIsSubmitting(true);
    try {
      await register({
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
      });
      setSuccessMessage('Cuenta creada correctamente. Ahora puedes iniciar sesión.');
      setForm(INITIAL_FORM);
      // Deja un instante para que la persona lea el mensaje antes de redirigir.
      setTimeout(() => {
        navigate('/login', { state: { justRegistered: true } });
      }, 1200);
    } catch (error) {
      // Mensaje típico del backend cuando el email ya existe:
      // "El correo electrónico ya está registrado." (409)
      setFormError(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="auth-section">
      <article className="auth-card">
        <p className="panel-kicker">Ideator</p>
        <h2>Crea tu cuenta</h2>
        <p className="auth-subtitle">Regístrate para empezar a organizar tus proyectos.</p>

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

          <FormField
            id="password"
            label="Contraseña"
            type="password"
            value={form.password}
            onChange={handleChange}
            error={fieldErrors.password}
            autoComplete="new-password"
            placeholder="Mínimo 6 caracteres"
          />

          <FormField
            id="confirmPassword"
            label="Confirmar contraseña"
            type="password"
            value={form.confirmPassword}
            onChange={handleChange}
            error={fieldErrors.confirmPassword}
            autoComplete="new-password"
            placeholder="Repite tu contraseña"
          />

          {formError ? (
            <p className="form-error" role="alert">
              {formError}
            </p>
          ) : null}

          {successMessage ? (
            <p className="form-success" role="status">
              {successMessage}
            </p>
          ) : null}

          <button type="submit" className="btn-primary" disabled={isSubmitting}>
            {isSubmitting ? 'Creando cuenta…' : 'Crear cuenta'}
          </button>
        </form>

        <p className="auth-switch">
          ¿Ya tienes cuenta? <Link to="/login">Inicia sesión</Link>
        </p>
      </article>
    </section>
  );
}