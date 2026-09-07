import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import FormField from '../components/FormField.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { validateLoginForm } from '../utils/validation.js';

const INITIAL_FORM = { email: '', password: '' };

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [form, setForm] = useState(INITIAL_FORM);
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const redirectTo = location.state?.from?.pathname || '/';

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    // Limpia el error del campo apenas el usuario vuelve a escribir en él.
    setFieldErrors((prev) => ({ ...prev, [name]: undefined }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setFormError('');

    const errors = validateLoginForm(form);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      return;
    }

    setIsSubmitting(true);
    try {
      await login({ email: form.email.trim(), password: form.password });
      navigate(redirectTo, { replace: true });
    } catch (error) {
      // Mensajes típicos del backend: "Credenciales inválidas.",
      // "Email y contraseña son obligatorios.", etc.
      setFormError(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="auth-section">
      <article className="auth-card">
        <p className="panel-kicker">Ideator</p>
        <h2>Inicia sesión</h2>
        <p className="auth-subtitle">Accede a tu cuenta para ver y crear proyectos.</p>

        <form onSubmit={handleSubmit} noValidate>
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
            autoComplete="current-password"
            placeholder="••••••••"
          />

          {formError ? (
            <p className="form-error" role="alert">
              {formError}
            </p>
          ) : null}

          <button type="submit" className="btn-primary" disabled={isSubmitting}>
            {isSubmitting ? 'Ingresando…' : 'Ingresar'}
          </button>
        </form>

        <div className="auth-divider"><span>o</span></div>

        <a href="/api/auth/sso/login" className="btn-google">
          Continuar con Google
        </a>

        <p className="auth-switch">
          ¿No tienes cuenta? <Link to="/register">Crea una aquí</Link>
        </p>
      </article>
    </section>
  );
}