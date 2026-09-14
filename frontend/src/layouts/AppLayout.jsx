import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

const navItems = [
  { to: '/', label: 'Inicio', end: true },
  { to: '/proyectos', label: 'Proyectos' },
  { to: '/ideas', label: 'Ideas' },
];

export default function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">Ideator</p>
          <h1>Ideator</h1>
        </div>

        <nav className="nav" aria-label="Navegación principal">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        {user ? (
          <div className="session-info">
            <Link to="/perfil" className="session-user">
              {user.name || user.email}
            </Link>
            <button type="button" className="btn-secondary" onClick={handleLogout}>
              Salir
            </button>
          </div>
        ) : null}
      </header>

      <main className="page-content">
        <Outlet />
      </main>
    </div>
  );
}