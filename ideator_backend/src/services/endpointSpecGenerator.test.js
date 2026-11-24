const { validateGeneratedSpec } = require('./endpointSpecGenerator');

describe('Generación de la especificación de endpoints', () => {
  test('acepta endpoints con método, ruta y operación y captura sus atributos', () => {
    const spec = validateGeneratedSpec({
      endpoints: [
        { method: 'get', route: '/api/proyectos', operation: 'Listar proyectos', entity: 'proyectos', attributes: ['id', 'nombre'], responses: [{ status: 200, description: 'Lista obtenida' }, { status: 401, description: 'Sin autenticación' }] },
        { method: 'POST', route: '/api/proyectos', operation: 'Crear un proyecto', entity: 'proyectos', attributes: ['nombre'], requestBody: { required: true, fields: [{ name: 'nombre', type: 'string', required: true }] }, responses: [{ status: 201, description: 'Proyecto creado' }, { status: 400, description: 'Datos inválidos' }] },
      ],
    });

    expect(spec.endpoints).toHaveLength(2);
    expect(spec.endpoints[0].method).toBe('GET');
    expect(spec.endpoints[0].route).toBe('/api/proyectos');
    expect(spec.endpoints[0].operation).toBe('Listar proyectos');
    expect(spec.endpoints[0].attributes).toEqual(['id', 'nombre']);
    expect(spec.endpoints[1].requestBody.required).toBe(true);
    expect(spec.endpoints[1].responses).toEqual(expect.arrayContaining([expect.objectContaining({ status: 201 })]));
  });

  test('rechaza un endpoint con datos faltantes (método, ruta u operación)', () => {
    expect(() =>
      validateGeneratedSpec({ endpoints: [{ method: 'GET', route: '/api/proyectos' }] })
    ).toThrow('método HTTP, ruta y operación');
  });

  test('la coherencia con el modelo se valida aparte: acepta cualquier entidad', () => {
    const spec = validateGeneratedSpec({
      endpoints: [{ method: 'GET', route: '/api/facturas', operation: 'Listar facturas', entity: 'facturas', responses: [{ status: 200, description: 'Lista obtenida' }, { status: 403, description: 'Sin permisos' }] }],
    });

    expect(spec.endpoints[0].entity).toBe('facturas');
    expect(spec.endpoints[0].attributes).toEqual([]);
  });

  test('rechaza endpoints que no documenten éxito y error', () => {
    expect(() => validateGeneratedSpec({
      endpoints: [{ method: 'GET', route: '/api/proyectos', operation: 'Listar', responses: [{ status: 200, description: 'OK' }] }],
    })).toThrow('respuesta de error');
  });
});
