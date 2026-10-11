const { validateGeneratedSpec } = require('./endpointSpecGenerator');

describe('Generación de la especificación de endpoints', () => {
  test('acepta endpoints con método, ruta y operación y captura sus atributos', () => {
    const spec = validateGeneratedSpec({
      endpoints: [
        { method: 'get', route: '/api/proyectos', operation: 'Listar proyectos', entity: 'proyectos', attributes: ['id', 'nombre'] },
        { method: 'POST', route: '/api/proyectos', operation: 'Crear un proyecto', entity: 'proyectos', attributes: ['nombre'] },
      ],
    });

    expect(spec.endpoints).toHaveLength(2);
    expect(spec.endpoints[0].method).toBe('GET');
    expect(spec.endpoints[0].route).toBe('/api/proyectos');
    expect(spec.endpoints[0].operation).toBe('Listar proyectos');
    expect(spec.endpoints[0].attributes).toEqual(['id', 'nombre']);
  });

  test('rechaza un endpoint con datos faltantes (método, ruta u operación)', () => {
    expect(() =>
      validateGeneratedSpec({ endpoints: [{ method: 'GET', route: '/api/proyectos' }] })
    ).toThrow('método HTTP, ruta y operación');
  });

  test('la coherencia con el modelo se valida aparte: acepta cualquier entidad', () => {
    const spec = validateGeneratedSpec({
      endpoints: [{ method: 'GET', route: '/api/facturas', operation: 'Listar facturas', entity: 'facturas' }],
    });

    expect(spec.endpoints[0].entity).toBe('facturas');
    expect(spec.endpoints[0].attributes).toEqual([]);
  });
});
