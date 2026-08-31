import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { loginUser, registerUser } from '../services/api';

export default function AuthPage() {
    const [isLogin, setIsLogin] = useState(true);
    // Agregamos el campo "name" al estado inicial
    const [formData, setFormData] = useState({ name: '', email: '', password: '' });
    const [error, setError] = useState(null);
    const navigate = useNavigate();

    const validateEmail = (email) => {
        const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return regex.test(email);
    };

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
        setError(null);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        // 1. Validaciones
        if (!isLogin && !formData.name) {
            setError('El nombre es obligatorio para registrarse.');
            return;
        }
        if (!formData.email || !formData.password) {
            setError('El email y la contraseña son obligatorios.');
            return;
        }
        if (!validateEmail(formData.email)) {
            setError('El formato del correo electrónico es inválido.');
            return;
        }

        try {
            // 2. Petición al backend
            let data;
            if (isLogin) {
                // Para login solo mandamos email y password
                data = await loginUser({ email: formData.email, password: formData.password });
            } else {
                // Para registro mandamos todo
                data = await registerUser(formData);
            }

            // 3. Éxito: Guardamos el token y redirigimos
            localStorage.setItem('token', data.token);
            navigate('/home');

        } catch (err) {
            setError(err.message);
        }
    };

    return (
        <div style={{ maxWidth: '400px', margin: '50px auto', fontFamily: 'Arial' }}>
            <h2>{isLogin ? 'Iniciar Sesión' : 'Crear Cuenta'}</h2>
            
            {error && (
                <div style={{ color: 'red', marginBottom: '15px', padding: '10px', border: '1px solid red', borderRadius: '5px' }}>
                    {error}
                </div>
            )}

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                
                {/* El campo Nombre solo se muestra si NO estamos en Login */}
                {!isLogin && (
                    <div>
                        <label style={{ display: 'block', marginBottom: '5px' }}>Nombre Completo:</label>
                        <input
                            type="text"
                            name="name"
                            value={formData.name}
                            onChange={handleChange}
                            placeholder="Tu nombre completo"
                            style={{ width: '100%', padding: '8px' }}
                        />
                    </div>
                )}

                <div>
                    <label style={{ display: 'block', marginBottom: '5px' }}>Email:</label>
                    <input
                        type="text"
                        name="email"
                        value={formData.email}
                        onChange={handleChange}
                        placeholder="tu@email.com"
                        style={{ width: '100%', padding: '8px' }}
                    />
                </div>
                <div>
                    <label style={{ display: 'block', marginBottom: '5px' }}>Contraseña:</label>
                    <input
                        type="password"
                        name="password"
                        value={formData.password}
                        onChange={handleChange}
                        style={{ width: '100%', padding: '8px' }}
                    />
                </div>
                <button type="submit" style={{ padding: '10px', background: '#007bff', color: 'white', border: 'none', cursor: 'pointer' }}>
                    {isLogin ? 'Ingresar' : 'Registrarse'}
                </button>
            </form>

            <button 
                type="button"
                onClick={() => { setIsLogin(!isLogin); setError(null); }} 
                style={{ marginTop: '20px', background: 'none', border: 'none', color: '#007bff', cursor: 'pointer', textDecoration: 'underline' }}
            >
                {isLogin ? '¿No tienes cuenta? Regístrate aquí' : '¿Ya tienes cuenta? Inicia sesión'}
            </button>
        </div>
    );
}