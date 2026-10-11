const jwt = require('jsonwebtoken');
const request = require('supertest');
const express = require('express');

jest.mock('../config/db', () => ({ query: jest.fn(), connect: jest.fn() }));
jest.mock('../services/endpointSpecGenerator', () => ({
  generateEndpointSpec: jest.fn().mockResolvedValue({
    endpoints: [
      { method: 'GET', route: '/api/proyectos', operation: 'Listar proyectos', entity: 'proyectos', attributes: ['id', 'nombre'] },
      { method: 'POST', route: '/api/proyectos', operation: 'Crear proyecto', entity: 'proyectos', attributes: ['nombre'] },
    ],
  }),
}));

const pool = require('../config/db');
const { generateEndpointSpec } = require('../services/endpointSpecGenerator');
const routes = require('./endpointSpec');

const app = express();
app.use(express.json());
app.use('/api/projects', routes);

describe('Especificación de endpoints con IA', () => {
  const token = jwt.sign({ id: 7, email: 'owner@example.com' }, process.env.JWT_SECRET || 'secret_key');

  beforeEach(() => jest.clearAllMocks());

  test('genera la especificación sin datos faltantes para el caso de prueba', async () => {
    const client = { query: jest.fn(), release: jest.fn() };
    pool.connect.mockResolvedValue(client);

    pool.query
      .mockResolvedValueOnce({ rows: [{ rol: 'owner' }] }) // authorize
      .mockResolvedValueOnce({ rows: [{ id: 40, proyecto_id: 10, modelo_id: 20, estado: 'draft' }] }) // loadSpec cabecera
      .mockResolvedValueOnce({ rows: [ // loadSpec endpoints
        { id: 1, metodo: 'GET', ruta: '/api/proyectos', operacion: 'Listar proyectos', entidad: 'proyectos', atributos: ['id', 'nombre'] },
        { id: 2, metodo: 'POST', ruta: '/api/proyectos', operacion: 'Crear proyecto', entidad: 'proyectos', atributos: ['nombre'] },
      ] });

    client.query
      .mockResolvedValueOnce({ rows: [] }) // estado de la especificación
      .mockResolvedValueOnce({ rows: [{ id: 20, estado: 'approved' }] }) // modelo de datos aprobado
      .mockResolvedValueOnce({ rows: [{ id: 31, nombre: 'proyectos' }] }) // entidades
      .mockResolvedValueOnce({ rows: [{ id: 41, entidad_id: 31, nombre: 'id', tipo_dato: 'SERIAL', es_pk: true }] }) // atributos
      .mockResolvedValueOnce({ rows: [] }) // relaciones
      .mockResolvedValueOnce({ rows: [{ seccion: 'problem', respuesta: 'Falta coordinación' }] }) // secciones
      .mockResolvedValueOnce({ rows: [{ descripcion: 'Crear proyecto' }] }) // funcionalidades MVP
      .mockResolvedValueOnce({ rows: [{ descripcion: 'Definir problema' }] }) // recorrido
      .mockResolvedValueOnce({}) // BEGIN
      .mockResolvedValueOnce({}) // DELETE
      .mockResolvedValueOnce({ rows: [{ id: 40 }] }) // INSERT cabecera
      .mockResolvedValueOnce({}) // INSERT endpoint 1
      .mockResolvedValueOnce({}) // INSERT endpoint 2
      .mockResolvedValueOnce({}) // recordActivity
      .mockResolvedValueOnce({}); // COMMIT

    const response = await request(app)
      .post('/api/projects/10/endpoint-spec/generate')
      .set('Authorization', `Bearer ${token}`);

    expect(response.statusCode).toBe(201);

    // DoD: cada endpoint indica método HTTP, ruta y operación (sin datos faltantes)
    expect(response.body.spec.endpoints).toHaveLength(2);
    for (const endpoint of response.body.spec.endpoints) {
      expect(endpoint.metodo).toBeTruthy();
      expect(endpoint.ruta).toBeTruthy();
      expect(endpoint.operacion).toBeTruthy();
    }

    // DoD: la especificación es coherente con el modelo de datos aprobado
    expect(generateEndpointSpec).toHaveBeenCalledWith(
      expect.objectContaining({
        model: expect.objectContaining({
          entities: expect.arrayContaining([expect.objectContaining({ nombre: 'proyectos' })]),
        }),
      })
    );
    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO endpoints'),
      [40, 'GET', '/api/proyectos', 'Listar proyectos', 'proyectos', JSON.stringify(['id', 'nombre']), 0]
    );
    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO endpoints'),
      [40, 'POST', '/api/proyectos', 'Crear proyecto', 'proyectos', JSON.stringify(['nombre']), 1]
    );
    expect(client.query).toHaveBeenCalledWith('COMMIT');
    expect(client.release).toHaveBeenCalled();
  });

  test('devuelve 403 si el usuario no pertenece al proyecto', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });
    const response = await request(app)
      .get('/api/projects/10/endpoint-spec')
      .set('Authorization', `Bearer ${token}`);
    expect(response.statusCode).toBe(403);
  });

  test('devuelve 409 si el modelo de datos no está aprobado', async () => {
    const client = { query: jest.fn(), release: jest.fn() };
    pool.connect.mockResolvedValue(client);
    pool.query.mockResolvedValueOnce({ rows: [{ rol: 'owner' }] });
    client.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: 20, estado: 'draft' }] });

    const response = await request(app)
      .post('/api/projects/10/endpoint-spec/generate')
      .set('Authorization', `Bearer ${token}`);

    expect(response.statusCode).toBe(409);
    expect(response.body.message).toMatch(/modelo de datos/i);
  });

  test('un viewer no puede generar la especificación', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ rol: 'viewer' }] });
    const response = await request(app)
      .post('/api/projects/10/endpoint-spec/generate')
      .set('Authorization', `Bearer ${token}`);
    expect(response.statusCode).toBe(403);
  });

  test('bloquea la regeneración después de aprobar', async () => {
    const client = { query: jest.fn(), release: jest.fn() };
    pool.connect.mockResolvedValue(client);
    pool.query.mockResolvedValueOnce({ rows: [{ rol: 'owner' }] });
    client.query.mockResolvedValueOnce({ rows: [{ estado: 'approved' }] });

    const response = await request(app)
      .post('/api/projects/10/endpoint-spec/generate')
      .set('Authorization', `Bearer ${token}`);

    expect(response.statusCode).toBe(409);
    expect(response.body.message).toMatch(/bloqueada/);
  });

  test('reporta la consistencia de la especificación con el modelo', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ rol: 'editor' }] }) // membership
      .mockResolvedValueOnce({ rows: [{ id: 40, estado: 'draft' }] }) // loadSpec cabecera
      .mockResolvedValueOnce({ rows: [{ metodo: 'GET', ruta: '/api/proyectos', entidad: 'proyectos', atributos: ['id'] }] }) // loadSpec endpoints
      .mockResolvedValueOnce({ rows: [{ id: 20, estado: 'approved' }] }) // modelos_datos
      .mockResolvedValueOnce({ rows: [{ id: 31, nombre: 'proyectos' }] }) // modelo_entidades
      .mockResolvedValueOnce({ rows: [{ id: 41, entidad_id: 31, nombre: 'id' }] }); // modelo_atributos

    const response = await request(app)
      .get('/api/projects/10/endpoint-spec/validation')
      .set('Authorization', `Bearer ${token}`);

    expect(response.statusCode).toBe(200);
    expect(response.body.validation.consistent).toBe(true);
    expect(response.body.validation.issues).toEqual([]);
  });

  test('bloquea la aprobación si hay inconsistencias con el modelo', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ rol: 'owner' }] }) // authorize
      .mockResolvedValueOnce({ rows: [{ id: 40, estado: 'draft' }] }) // loadSpec cabecera
      .mockResolvedValueOnce({ rows: [{ metodo: 'GET', ruta: '/api/facturas', entidad: 'facturas', atributos: [] }] }) // loadSpec endpoints
      .mockResolvedValueOnce({ rows: [{ id: 20, estado: 'approved' }] }) // modelos_datos
      .mockResolvedValueOnce({ rows: [{ id: 31, nombre: 'proyectos' }] }) // modelo_entidades
      .mockResolvedValueOnce({ rows: [] }); // modelo_atributos

    const response = await request(app)
      .post('/api/projects/10/endpoint-spec/approve')
      .set('Authorization', `Bearer ${token}`);

    expect(response.statusCode).toBe(409);
    expect(response.body.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'entidad_inexistente', referencia: 'facturas' }),
      ])
    );
  });

  test('un owner puede aprobar una especificación consistente', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ rol: 'owner' }] }) // authorize
      .mockResolvedValueOnce({ rows: [{ id: 40, estado: 'draft' }] }) // loadSpec cabecera
      .mockResolvedValueOnce({ rows: [{ metodo: 'GET', ruta: '/api/proyectos', entidad: 'proyectos', atributos: ['id'] }] }) // loadSpec endpoints
      .mockResolvedValueOnce({ rows: [{ id: 20, estado: 'approved' }] }) // modelos_datos
      .mockResolvedValueOnce({ rows: [{ id: 31, nombre: 'proyectos' }] }) // modelo_entidades
      .mockResolvedValueOnce({ rows: [{ id: 41, entidad_id: 31, nombre: 'id' }] }) // modelo_atributos
      .mockResolvedValueOnce({ rows: [{ id: 40, estado: 'approved' }] }) // UPDATE
      .mockResolvedValueOnce({}) // recordActivity
      .mockResolvedValueOnce({ rows: [{ id: 40, estado: 'approved' }] }) // loadSpec cabecera final
      .mockResolvedValueOnce({ rows: [] }); // loadSpec endpoints final

    const response = await request(app)
      .post('/api/projects/10/endpoint-spec/approve')
      .set('Authorization', `Bearer ${token}`);

    expect(response.statusCode).toBe(200);
    expect(response.body.spec.estado).toBe('approved');
  });
});
