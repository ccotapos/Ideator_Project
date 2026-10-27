const { validateSpecConsistency, validateProjectConsistency } = require('./consistencyValidator');

const model = {
  entities: [
    { nombre: 'proyectos', attributes: [{ nombre: 'id' }, { nombre: 'nombre' }] },
    { nombre: 'usuarios', attributes: [{ nombre: 'id' }, { nombre: 'email' }] },
  ],
};

describe('Validación de consistencia API ↔ modelo de datos', () => {
  test('caso consistente: los endpoints usan entidades y atributos existentes', () => {
    const spec = {
      endpoints: [
        { metodo: 'GET', ruta: '/api/proyectos', operacion: 'Listar proyectos', entidad: 'proyectos', atributos: ['id', 'nombre'] },
        { metodo: 'POST', ruta: '/api/usuarios', operacion: 'Crear usuario', entidad: 'usuarios', atributos: ['email'] },
      ],
    };

    const result = validateSpecConsistency(spec, model);

    expect(result.consistent).toBe(true);
    expect(result.issues).toEqual([]);
  });

  test('caso inconsistente: detecta entidades y atributos inexistentes en el modelo', () => {
    const spec = {
      endpoints: [
        { metodo: 'GET', ruta: '/api/facturas', operacion: 'Listar facturas', entidad: 'facturas', atributos: ['total'] },
        { metodo: 'POST', ruta: '/api/proyectos', operacion: 'Crear proyecto', entidad: 'proyectos', atributos: ['nombre', 'owner_email'] },
        { metodo: 'GET', ruta: '/api/salud', operacion: 'Estado del servicio', entidad: null, atributos: [] },
      ],
    };

    const result = validateSpecConsistency(spec, model);

    expect(result.consistent).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'entidad_inexistente', referencia: 'facturas', ruta: '/api/facturas' }),
        expect.objectContaining({ code: 'atributo_inexistente', referencia: 'owner_email', ruta: '/api/proyectos' }),
        expect.objectContaining({ code: 'entidad_faltante', ruta: '/api/salud' }),
      ])
    );
  });
});

describe('Motor de Validación Global del Proyecto (validateProjectConsistency)', () => {
  test('debe bloquear si falta la arquitectura o el modelo de datos', () => {
    const incompleteProject = {
      architecture: null,
      dataModel: null,
      screens: { views: [] }
    };

    const result = validateProjectConsistency(incompleteProject);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  test('debe aprobar un proyecto completo y consistente', () => {
    const validProject = {
      architecture: { selectedOption: 'Node.js + React + PostgreSQL' },
      dataModel: model,
      spec: {
        endpoints: [
          { metodo: 'GET', ruta: '/api/proyectos', entidad: 'proyectos', atributos: ['id'] }
        ]
      },
      screens: {
        views: [{ name: 'ProjectDashboard' }]
      }
    };

    const result = validateProjectConsistency(validProject);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });
});