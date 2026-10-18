const MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const ROLES = ['owner', 'editor', 'viewer'];
const CONTROL_TYPES = ['button', 'input', 'textarea', 'select', 'list', 'text', 'badge'];

function normalizedRoles(roles) {
  const valid = Array.isArray(roles) ? roles.filter((role) => ROLES.includes(role)) : [];
  return [...new Set(valid.length ? valid : ROLES)];
}

function validateGeneratedScreenMap(value) {
  if (!value || !Array.isArray(value.screens) || value.screens.length < 2) {
    throw new Error('La IA debe generar al menos dos pantallas.');
  }

  const keys = new Set();
  const screens = value.screens.map((screen, position) => {
    const key = String(screen.key || '').trim();
    const name = String(screen.name || '').trim();
    if (!key || !name || keys.has(key)) throw new Error('Cada pantalla debe tener una clave única y un nombre.');
    keys.add(key);
    const controls = (Array.isArray(screen.controls) ? screen.controls : []).map((control) => {
      const type = CONTROL_TYPES.includes(control.type) ? control.type : 'text';
      const label = String(control.label || '').trim();
      if (!label) throw new Error(`La pantalla ${name} contiene un control sin etiqueta.`);
      return { type, label, action: control.action ? String(control.action).trim() : null, roles: normalizedRoles(control.roles) };
    });
    return {
      key, name, description: String(screen.description || '').trim(), position,
      entry: Boolean(screen.entry), result: Boolean(screen.result),
      roles: normalizedRoles(screen.roles), controls,
    };
  });

  if (!screens.some((screen) => screen.entry) || !screens.some((screen) => screen.result)) {
    throw new Error('El mapa debe identificar una pantalla de entrada y una de resultado.');
  }

  const transitions = (Array.isArray(value.transitions) ? value.transitions : []).map((transition) => {
    const from = String(transition.from || '').trim();
    const to = String(transition.to || '').trim();
    const action = String(transition.action || '').trim();
    if (!keys.has(from) || !keys.has(to) || !action) throw new Error('El mapa contiene una transición inválida.');
    return { from, to, action, roles: normalizedRoles(transition.roles) };
  });
  if (!transitions.length) throw new Error('El mapa debe incluir navegación entre pantallas.');
  return { screens, transitions };
}

function filterScreenMapForRole(map, role) {
  const allowedScreens = map.screens
    .filter((screen) => screen.roles.includes(role))
    .map((screen) => ({ ...screen, controls: screen.controls.filter((control) => control.roles.includes(role)) }));
  const keys = new Set(allowedScreens.map((screen) => screen.key));
  return {
    ...map,
    screens: allowedScreens,
    transitions: map.transitions.filter((transition) => transition.roles.includes(role) && keys.has(transition.from) && keys.has(transition.to)),
  };
}

async function generateScreenMap(context) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY no está configurada.');
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: `Genera el mapa de pantallas y mockups de este producto. No inventes funciones fuera del alcance y no omitas funciones clave.\n${JSON.stringify(context)}` }] }],
      systemInstruction: { parts: [{ text: 'Devuelve solo JSON. Incluye pantallas, controles, acciones, navegación y visibilidad para owner, editor y viewer. Debe existir una entrada y un resultado final.' }] },
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: { type: 'OBJECT', required: ['screens', 'transitions'], properties: {
          screens: { type: 'ARRAY', items: { type: 'OBJECT', required: ['key', 'name', 'entry', 'result', 'roles', 'controls'], properties: {
            key: { type: 'STRING' }, name: { type: 'STRING' }, description: { type: 'STRING' }, entry: { type: 'BOOLEAN' }, result: { type: 'BOOLEAN' }, roles: { type: 'ARRAY', items: { type: 'STRING' } },
            controls: { type: 'ARRAY', items: { type: 'OBJECT', required: ['type', 'label', 'roles'], properties: { type: { type: 'STRING' }, label: { type: 'STRING' }, action: { type: 'STRING' }, roles: { type: 'ARRAY', items: { type: 'STRING' } } } } }
          } } },
          transitions: { type: 'ARRAY', items: { type: 'OBJECT', required: ['from', 'to', 'action', 'roles'], properties: { from: { type: 'STRING' }, to: { type: 'STRING' }, action: { type: 'STRING' }, roles: { type: 'ARRAY', items: { type: 'STRING' } } } } }
        } }
      }
    })
  });
  if (!response.ok) throw new Error('No se pudo generar el mapa de pantallas con Gemini.');
  const data = await response.json();
  return validateGeneratedScreenMap(JSON.parse(data.candidates?.[0]?.content?.parts?.[0]?.text));
}

module.exports = { generateScreenMap, validateGeneratedScreenMap, filterScreenMapForRole, ROLES };
