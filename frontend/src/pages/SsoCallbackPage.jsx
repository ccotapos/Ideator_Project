import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function SsoCallbackPage() {
  const [searchParams] = useSearchParams();
  const { loginWithSsoToken } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const hasRun = useRef(false);

  useEffect(() => {
    if (hasRun.current) return;
    hasRun.current = true;

    const token = searchParams.get('token');

    if (!token) {
      setError('No se recibió un token válido desde el proveedor de SSO.');
      return;
    }

    loginWithSsoToken(token)
      .then(() => navigate('/', { replace: true }))
      .catch((err) => setError(err.message));
  }, [searchParams, loginWithSsoToken, navigate]);

  return (
    <section className="auth-section">
      <article className="auth-card">
        <p className="panel-kicker">Ideator</p>
        <h2>Iniciando sesión…</h2>
        {error ? (
          <p className="form-error" role="alert">{error}</p>
        ) : (
          <p className="auth-subtitle">Estamos validando tu sesión con Google.</p>
        )}
      </article>
    </section>
  );
}