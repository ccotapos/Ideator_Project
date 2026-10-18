import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { generateScreenMap, getScreenMap } from '../api/screenMap.js';

const roleNames = { owner: 'Owner', editor: 'Colaborador', viewer: 'Lector' };

function MockControl({ control, onAction }) {
  if (control.type === 'input') return <label className="mock-field"><span>{control.label}</span><input disabled placeholder={control.label} /></label>;
  if (control.type === 'textarea') return <label className="mock-field"><span>{control.label}</span><textarea disabled rows="3" placeholder={control.label} /></label>;
  if (control.type === 'select') return <label className="mock-field"><span>{control.label}</span><select disabled><option>Seleccionar</option></select></label>;
  if (control.type === 'list') return <div className="mock-list"><strong>{control.label}</strong><span /><span /><span /></div>;
  if (control.type === 'badge') return <span className="mock-badge">{control.label}</span>;
  if (control.type === 'button') return <button type="button" className="mock-action" onClick={() => onAction(control.action)}>{control.label}</button>;
  return <p className="mock-text">{control.label}</p>;
}

export default function ScreenMapPage({ projectId, role }) {
  const { token } = useAuth();
  const [map, setMap] = useState(null);
  const [activeKey, setActiveKey] = useState(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState('');

  const chooseStart = (nextMap) => nextMap?.screens.find((screen) => screen.entry)?.key || nextMap?.screens[0]?.key || null;
  const load = async () => {
    const data = await getScreenMap(projectId, token);
    setMap(data.map);
    setActiveKey((current) => data.map?.screens.some((screen) => screen.key === current) ? current : chooseStart(data.map));
  };

  useEffect(() => { load().catch((error) => setMessage(error.message)).finally(() => setLoading(false)); }, [projectId, token]);

  const activeScreen = useMemo(() => map?.screens.find((screen) => screen.key === activeKey), [map, activeKey]);
  const outgoing = useMemo(() => map?.transitions.filter((transition) => transition.from === activeKey) || [], [map, activeKey]);

  const generate = async () => {
    setWorking(true); setMessage('');
    try {
      const data = await generateScreenMap(projectId, token);
      setMap(data.map); setActiveKey(chooseStart(data.map)); setMessage('Mapa y mockups generados correctamente.');
    } catch (error) { setMessage(error.message); }
    finally { setWorking(false); }
  };

  const followAction = (action) => {
    const transition = outgoing.find((item) => item.action === action) || (outgoing.length === 1 ? outgoing[0] : null);
    if (transition) setActiveKey(transition.to);
  };

  if (loading) return <p>Cargando mockups...</p>;

  return (
    <div className="screen-map-page">
      <header className="screen-map-header">
        <div><h3>Mapa de pantallas</h3><p>Vista disponible para el rol <strong>{roleNames[role] || role}</strong></p></div>
        {['owner', 'editor'].includes(role) ? <button type="button" className="btn-primary" disabled={working} onClick={generate}>{working ? 'Generando...' : map ? 'Regenerar con IA' : 'Generar con IA'}</button> : null}
      </header>
      {message ? <p className="data-model-message" role="status">{message}</p> : null}
      {!map ? <div className="screen-map-empty"><strong>Aún no hay mockups</strong><p>La IA usará el alcance, el recorrido, los endpoints y los roles del proyecto.</p></div> : null}
      {map && activeScreen ? (
        <div className="screen-map-workspace">
          <nav className="screen-map-nav" aria-label="Pantallas del mockup">
            {map.screens.map((screen, index) => <button type="button" className={screen.key === activeKey ? 'active' : ''} key={screen.key} onClick={() => setActiveKey(screen.key)}><span>{index + 1}</span><span>{screen.name}<small>{screen.entry ? 'Entrada' : screen.result ? 'Resultado final' : 'Pantalla'}</small></span></button>)}
          </nav>
          <main className="mock-device">
            <div className="mock-device-bar"><span /><span /><span /><strong>Ideator</strong><em>{roleNames[role] || role}</em></div>
            <section className="mock-screen">
              <div className="mock-screen-heading"><div><span className="panel-kicker">{activeScreen.entry ? 'Punto de entrada' : activeScreen.result ? 'Resultado final' : 'Flujo principal'}</span><h4>{activeScreen.name}</h4></div><span className="mock-step">{map.screens.findIndex((screen) => screen.key === activeKey) + 1}/{map.screens.length}</span></div>
              {activeScreen.description ? <p className="mock-description">{activeScreen.description}</p> : null}
              <div className="mock-controls">{activeScreen.controls.map((control, index) => <MockControl key={`${control.label}-${index}`} control={control} onAction={followAction} />)}</div>
              {outgoing.length ? <div className="mock-navigation"><span>Siguiente paso</span>{outgoing.map((transition) => <button type="button" key={transition.id || `${transition.from}-${transition.to}-${transition.action}`} onClick={() => setActiveKey(transition.to)}>{transition.action} →</button>)}</div> : null}
            </section>
          </main>
        </div>
      ) : null}
      {map ? <section className="screen-flow"><h4>Recorrido generado</h4><div>{map.transitions.map((transition) => <button type="button" key={transition.id || `${transition.from}-${transition.to}-${transition.action}`} onClick={() => setActiveKey(transition.from)}><strong>{map.screens.find((screen) => screen.key === transition.from)?.name}</strong><span>{transition.action}</span><strong>{map.screens.find((screen) => screen.key === transition.to)?.name}</strong></button>)}</div></section> : null}
    </div>
  );
}
