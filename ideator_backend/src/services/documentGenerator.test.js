jest.mock('../config/geminiClient', () => ({
  generateContent: jest.fn(),
  buildGenerationConfig: jest.fn((config) => config),
}));

const { generateContent } = require('../config/geminiClient');
const {
  generateSpecification,
  generateArchitecture,
  validateSpecification,
  validateArchitecture,
} = require('./documentGenerator');

const SPEC_DOC = `# Especificación del producto

## Problema
Los equipos de producto pierden acuerdos importantes cuando definen un proyecto en herramientas dispersas.
El resultado es retrabajo, decisiones contradictorias y un alcance que crece sin control.

## Usuarios
Equipos pequeños de producto (owner, editores y lectores) que necesitan alinear el alcance antes de implementar.

## MVP
- Crear proyectos privados e invitar colaboradores.
- Definir problema, contexto y usuarios objetivo.
- Definir el MVP (dentro/fuera) y el recorrido principal.
- Generar modelo de datos y especificación de endpoints.
- Generar documentos finales en Markdown.

## Reglas de negocio
- Cada proyecto es privado por defecto y solo acceden sus miembros.
- Solo el owner puede invitar colaboradores y aprobar el modelo y la especificación.
- Toda modificación queda registrada en el historial de actividad.

## Modelo de datos
- usuarios(id, nombre, email, password)
- proyectos(id, nombre, descripcion, is_private)
- proyecto_usuario(id, usuario_id, proyecto_id, rol)
- definicion_secciones(id, proyecto_id, seccion, respuesta)

## Servicios (endpoints)
- POST /api/auth/login
- GET /api/projects
- POST /api/projects
- GET /api/projects/:id/definition
- PUT /api/projects/:id/definition/sections
- GET /api/projects/:id/data-model
- POST /api/projects/:id/endpoint-spec/generate
`;

const ARCH_DOC = `# Arquitectura definitiva

## Tecnologías seleccionadas
La arquitectura aprobada es **Monolito en capas**.
- Frontend: React + Vite.
- Backend: Node.js + Express.
- Base de datos: PostgreSQL.
- Comunicación entre componentes: llamadas en proceso y HTTP/JSON entre frontend y API.
- Infraestructura: Docker Compose.

## Autenticación y autorización
Se usa autenticación con JWT y SSO con Google. La autorización se valida en el backend
con roles owner, editor y viewer; cada endpoint comprueba la membresía del proyecto.

## Operación
- Docker Compose con contenedores para API, frontend y PostgreSQL.
- Variables de entorno por entorno (DB_*, JWT_SECRET, claves de IA).
- Observabilidad: logs estructurados, endpoint /health y trazabilidad de actividad.
`;

const ARCHITECTURE = {
  scenarioName: 'Monolito en capas',
  technologies: {
    frontend: 'React + Vite',
    backend: 'Node.js + Express',
    database: 'PostgreSQL',
    communication: 'HTTP/JSON entre frontend y API',
    infrastructure: 'Docker Compose',
  },
};

function aiResponse(text) {
  return { candidates: [{ content: { parts: [{ text }] } }] };
}

describe('Generación de documentos finales', () => {
  beforeEach(() => jest.clearAllMocks());

  test('caso de prueba del curso: la especificación incluye todas las secciones', async () => {
    generateContent.mockResolvedValue(aiResponse(SPEC_DOC));

    const document = await generateSpecification({ definition: {}, dataModel: {}, endpoints: [] });

    ['Problema', 'Usuarios', 'MVP', 'Reglas de negocio', 'Modelo de datos', 'Servicios'].forEach((section) => {
      expect(document).toContain(`## ${section}`);
    });
    expect(document).toContain('POST /api/projects');
  });

  test('rechaza una especificación sin secciones o con información faltante', () => {
    expect(() => validateSpecification(SPEC_DOC.replace('## Reglas de negocio', '## Otro'))).toThrow('secciones requeridas');
    expect(() => validateSpecification(SPEC_DOC.replace('Los equipos de producto', 'TBD'))).toThrow('información faltante');
  });

  test('rechaza documentos que dependen de contexto externo', () => {
    expect(() =>
      validateSpecification(
        SPEC_DOC.replace('Los equipos de producto', 'Como se mencionó en la conversación, los equipos de producto')
      )
    ).toThrow('autocontenido');

    expect(() =>
      validateArchitecture(
        ARCH_DOC.replace('La arquitectura aprobada', 'Según el chat, la arquitectura aprobada'),
        ARCHITECTURE
      )
    ).toThrow('autocontenido');
  });

  test('la arquitectura generada es consistente con la arquitectura aprobada', async () => {
    generateContent.mockResolvedValue(aiResponse(ARCH_DOC));

    const document = await generateArchitecture({ architecture: ARCHITECTURE });

    expect(document).toContain('## Tecnologías seleccionadas');
    expect(document).toContain('## Autenticación y autorización');
    expect(document).toContain('## Operación');
    expect(document).toContain('Monolito en capas');
  });

  test('acepta una arquitectura que parafrasea el escenario aprobado', () => {
    const architecture = {
      scenarioName: 'API REST desacoplada + SPA',
      technologies: {
        frontend: 'React SPA',
        backend: 'API REST Node.js',
        database: 'PostgreSQL',
        communication: 'HTTP/REST',
        infrastructure: 'Docker',
      },
    };
    const doc = `# Arquitectura definitiva

## Tecnologías seleccionadas
La solución se basa en una API REST desacoplada con React SPA, backend API REST Node.js y PostgreSQL.
- Comunicación entre componentes: HTTP/REST.
- Infraestructura: Docker.

## Autenticación y autorización
Se usa JWT y SSO con Google. La autorización se valida en el backend con roles owner, editor y viewer.

## Operación
- Docker con contenedores para API, frontend y base de datos.
- Variables de entorno por entorno.
- Observabilidad con logs, métricas y endpoint /health.`;

    expect(validateArchitecture(doc, architecture)).toContain('## Tecnologías seleccionadas');
  });

  test('rechaza una arquitectura que no menciona el escenario aprobado', () => {
    expect(() =>
      validateArchitecture(ARCH_DOC.replace('Monolito en capas', 'Microservicios'), ARCHITECTURE)
    ).toThrow('no menciona el escenario aprobado');
  });

  test('rechaza una arquitectura sin referencias operacionales completas', () => {
    expect(() =>
      validateArchitecture(ARCH_DOC.replace('## Operación', '## Otro'), ARCHITECTURE)
    ).toThrow('secciones requeridas');
  });
});
