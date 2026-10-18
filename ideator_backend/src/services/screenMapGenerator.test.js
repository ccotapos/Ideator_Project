const { validateGeneratedScreenMap, filterScreenMapForRole } = require('./screenMapGenerator');

const proposal = {
  screens: [
    {
      key: 'inicio', name: 'Proyectos', description: 'Punto de entrada', entry: true, result: false,
      roles: ['owner', 'editor', 'viewer'],
      controls: [
        { type: 'list', label: 'Proyectos actuales', roles: ['owner', 'editor', 'viewer'] },
        { type: 'button', label: 'Crear proyecto', action: 'crear', roles: ['owner'] },
      ],
    },
    {
      key: 'resultado', name: 'Definición aprobada', description: 'Resultado principal', entry: false, result: true,
      roles: ['owner', 'editor', 'viewer'], controls: [{ type: 'text', label: 'Resumen aprobado', roles: ['owner', 'editor', 'viewer'] }],
    },
  ],
  transitions: [{ from: 'inicio', to: 'resultado', action: 'abrir definición', roles: ['owner', 'editor', 'viewer'] }],
};

describe('Mapa de pantallas y permisos', () => {
  test('valida un recorrido completo desde la entrada al resultado', () => {
    const map = validateGeneratedScreenMap(proposal);
    expect(map.screens.find((screen) => screen.entry).key).toBe('inicio');
    expect(map.screens.find((screen) => screen.result).key).toBe('resultado');
    expect(map.transitions).toContainEqual(expect.objectContaining({ from: 'inicio', to: 'resultado' }));
  });

  test('muestra acciones diferentes para owner y viewer', () => {
    const map = validateGeneratedScreenMap(proposal);
    const owner = filterScreenMapForRole(map, 'owner');
    const viewer = filterScreenMapForRole(map, 'viewer');
    expect(owner.screens[0].controls.map((control) => control.label)).toContain('Crear proyecto');
    expect(viewer.screens[0].controls.map((control) => control.label)).not.toContain('Crear proyecto');
    expect(viewer.screens[0].controls.map((control) => control.label)).toContain('Proyectos actuales');
  });

  test('rechaza navegación hacia una pantalla inexistente', () => {
    expect(() => validateGeneratedScreenMap({ ...proposal, transitions: [{ from: 'inicio', to: 'fantasma', action: 'seguir' }] })).toThrow('transición inválida');
  });
});
