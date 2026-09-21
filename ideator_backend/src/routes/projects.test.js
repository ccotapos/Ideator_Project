const jwt = require('jsonwebtoken');
const request = require('supertest');
const express = require('express');

// Mock de la base de datos para controlar sus respuestas durante las pruebas
jest.mock('../config/db', () => ({
  connect: jest.fn(),
  query: jest.fn(),
}));

const pool = require('../config/db');
const projectRoutes = require('./projects');

const app = express();
app.use(express.json());
app.use('/api/projects', projectRoutes);

describe('Projects Endpoints', () => {
  const SECRET = process.env.JWT_SECRET || 'secret_key';
  const ownerToken = jwt.sign({ id: 7, email: 'owner@example.com' }, SECRET);
  const collaboratorToken = jwt.sign({ id: 2, email: 'collab@example.com' }, SECRET);
  const outsiderToken = jwt.sign({ id: 99, email: 'outsider@example.com' }, SECRET);

  const mockClient = {
    query: jest.fn(),
    release: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    pool.connect.mockResolvedValue(mockClient);
  });

  describe('POST /api/projects - Creación de proyectos', () => {
    test('crea un proyecto privado y asigna al creador como owner', async () => {
      const createdProject = {
        id: 15,
        nombre: 'Proyecto privado',
        descripcion: 'Definición inicial',
        is_private: true,
        created_at: new Date().toISOString(),
      };

      mockClient.query
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce({ rows: [createdProject] }) // INSERT INTO proyectos
        .mockResolvedValueOnce({}) // INSERT INTO proyecto_usuario
        .mockResolvedValueOnce({}) // INSERT INTO actividad_proyecto
        .mockResolvedValueOnce({}); // COMMIT

      const res = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          nombre: 'Proyecto privado',
          descripcion: 'Definición inicial',
        });

      expect(res.statusCode).toBe(201);
      expect(res.body.project).toMatchObject({
        id: 15,
        nombre: 'Proyecto privado',
        descripcion: 'Definición inicial',
        is_private: true,
      });
      expect(res.body.role).toBe('owner');
      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO proyectos'),
        ['Proyecto privado', 'Definición inicial']
      );
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO proyecto_usuario'),
        [7, 15]
      );
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
      expect(mockClient.release).toHaveBeenCalled();
    });

    test('retorna 401 si no hay token válido', async () => {
      const res = await request(app)
        .post('/api/projects')
        .send({ nombre: 'Sin token' });

      expect(res.statusCode).toBe(401);
      expect(pool.connect).not.toHaveBeenCalled();
    });
  });

  describe('GET /api/projects - Listado de proyectos', () => {
  test('retorna solo los proyectos del usuario, con su rol y fecha de modificación', async () => {
    const mockProjects = [
      { id: 1, nombre: 'Proyecto A', is_private: true, updated_at: new Date().toISOString(), rol: 'owner' },
      { id: 2, nombre: 'Proyecto B', is_private: false, updated_at: new Date().toISOString(), rol: 'editor' },
    ];
    pool.query.mockResolvedValueOnce({ rows: mockProjects });

    const res = await request(app)
      .get('/api/projects')
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.projects).toHaveLength(2);
    expect(res.body.projects[0].rol).toBe('owner');
  });

  test('retorna 401 si no hay token', async () => {
    const res = await request(app).get('/api/projects');
    expect(res.statusCode).toBe(401);
  });
});

  describe('GET /api/projects/:id/members - Listar Miembros', () => {
    test('debe retornar 403 si el usuario no pertenece al proyecto', async () => {
      pool.query.mockResolvedValueOnce({ rows: [] }); // memberCheck sin resultados

      const res = await request(app)
        .get('/api/projects/10/members')
        .set('Authorization', `Bearer ${outsiderToken}`);

      expect(res.statusCode).toBe(403);
      expect(res.body.message).toMatch(/Acceso denegado/i);
    });

    test('debe retornar 200 y la lista de miembros si el usuario pertenece al proyecto', async () => {
      const mockMembers = [
        { id: 1, name: 'Owner User', email: 'owner@example.com', rol: 'owner' },
        { id: 2, name: 'Collab User', email: 'collab@example.com', rol: 'editor' },
      ];

      pool.query
        .mockResolvedValueOnce({ rows: [{ rol: 'editor' }] }) // memberCheck
        .mockResolvedValueOnce({ rows: mockMembers }); // membersResult

      const res = await request(app)
        .get('/api/projects/10/members')
        .set('Authorization', `Bearer ${collaboratorToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.members).toHaveLength(2);
      expect(res.body.members[0].rol).toBe('owner');
    });
  });

  describe('Trazabilidad de cambios', () => {
    test('GET /api/projects/:id/activity devuelve el historial ordenado', async () => {
      const activity = [
        {
          id: 2,
          accion: 'project_updated',
          usuario_id: 7,
          usuario_nombre: 'Owner User',
          created_at: '2026-09-21T20:00:00.000Z',
        },
        {
          id: 1,
          accion: 'project_created',
          usuario_id: 7,
          usuario_nombre: 'Owner User',
          created_at: '2026-09-21T19:00:00.000Z',
        },
      ];

      pool.query
        .mockResolvedValueOnce({ rows: [{ rol: 'owner' }] })
        .mockResolvedValueOnce({ rows: activity });

      const res = await request(app)
        .get('/api/projects/10/activity')
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.activity).toEqual(activity);
      expect(pool.query).toHaveBeenLastCalledWith(
        expect.stringContaining('ORDER BY a.created_at DESC'),
        ['10']
      );
    });

    test('guarda como autor al usuario autenticado al editar el proyecto', async () => {
      const updatedProject = {
        id: 10,
        nombre: 'Proyecto actualizado',
        descripcion: 'Nueva descripción',
      };

      pool.query
        .mockResolvedValueOnce({ rows: [{ rol: 'owner' }] })
        .mockResolvedValueOnce({ rows: [updatedProject] })
        .mockResolvedValueOnce({});

      const res = await request(app)
        .put('/api/projects/10')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ nombre: 'Proyecto actualizado', descripcion: 'Nueva descripción' });

      expect(res.statusCode).toBe(200);
      expect(pool.query).toHaveBeenLastCalledWith(
        expect.stringContaining('INSERT INTO actividad_proyecto'),
        ['10', 7, 'project_updated', JSON.stringify({ nombre: 'Proyecto actualizado' })]
      );
    });
  });

  describe('POST /api/projects/:id/invite - Invitar Miembro', () => {
    test('debe retornar 403 si el usuario solicitante no es owner', async () => {
      pool.query.mockResolvedValueOnce({ rows: [{ rol: 'editor' }] }); // ownerCheck (es colaborador, no owner)

      const res = await request(app)
        .post('/api/projects/10/invite')
        .set('Authorization', `Bearer ${collaboratorToken}`)
        .send({ email: 'newuser@example.com' });

      expect(res.statusCode).toBe(403);
      expect(res.body.message).toMatch(/Solo el dueño/i);
    });

    test('debe retornar 404 si el usuario a invitar no existe en la BD', async () => {
      pool.query
        .mockResolvedValueOnce({ rows: [{ rol: 'owner' }] }) // ownerCheck
        .mockResolvedValueOnce({ rows: [] }); // targetUserResult no encuentra correo

      const res = await request(app)
        .post('/api/projects/10/invite')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ email: 'nonexistent@example.com' });

      expect(res.statusCode).toBe(404);
      expect(res.body.message).toMatch(/no existe/i);
    });

    test('debe retornar 409 si el usuario ya es miembro del proyecto', async () => {
      pool.query
        .mockResolvedValueOnce({ rows: [{ rol: 'owner' }] }) // ownerCheck
        .mockResolvedValueOnce({ rows: [{ id: 2, name: 'Collab User', email: 'collab@example.com' }] }) // targetUserResult
        .mockResolvedValueOnce({ rows: [{ rol: 'editor' }] }); // existingMemberCheck encuentra al miembro

      const res = await request(app)
        .post('/api/projects/10/invite')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ email: 'collab@example.com' });

      expect(res.statusCode).toBe(409);
      expect(res.body.message).toMatch(/ya pertenece/i);
    });

    test('debe retornar 201 y agregar al usuario exitosamente', async () => {
      pool.query
        .mockResolvedValueOnce({ rows: [{ rol: 'owner' }] }) // ownerCheck
        .mockResolvedValueOnce({ rows: [{ id: 3, name: 'New User', email: 'newuser@example.com' }] }) // targetUserResult
        .mockResolvedValueOnce({ rows: [] }) // existingMemberCheck no lo encuentra
        .mockResolvedValueOnce({}) // INSERT INTO proyecto_usuario
        .mockResolvedValueOnce({}); // INSERT INTO actividad_proyecto

      const res = await request(app)
        .post('/api/projects/10/invite')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ email: 'newuser@example.com', role: 'editor' });

      expect(res.statusCode).toBe(201);
      expect(res.body.member).toMatchObject({
        id: 3,
        email: 'newuser@example.com',
        role: 'editor',
      });
    });
  });
});
