jest.mock('../config/geminiClient', () => ({
  generateContent: jest.fn(),
  buildGenerationConfig: jest.fn((config) => config),
}));

const { generateContent } = require('../config/geminiClient');
const { recommendArchitecture, validateRecommendation } = require('./architectureRecommender');

function aiResponse(recommendation) {
  return { candidates: [{ content: { parts: [{ text: JSON.stringify(recommendation) }] } }] };
}

const baseTechnologies = {
  frontend: 'React',
  backend: 'Node.js + Express',
  database: 'PostgreSQL',
  communication: 'HTTP/JSON entre la SPA y la API',
  infrastructure: 'Docker Compose',
};

const smallMvpContext = {
  definition: {
    sections: [{ seccion: 'problem', respuesta: 'Registrar reservas de salas' }],
    features: [{ alcance: 'in', descripcion: 'Crear reserva' }],
    journey: ['Reservar una sala'],
  },
  dataModel: { estado: 'approved', entities: [{ nombre: 'reservas' }, { nombre: 'usuarios' }], relationships: [] },
  endpoints: [{ metodo: 'GET', ruta: '/api/reservas' }, { metodo: 'POST', ruta: '/api/reservas' }],
  screens: [{ clave: 'inicio', nombre: 'Inicio', roles: ['owner'] }],
  roles: ['owner', 'editor'],
};

const asyncHeavyContext = {
  definition: {
    sections: [{ seccion: 'problem', respuesta: 'Procesar pagos y notificar a miles de usuarios' }],
    features: [{ alcance: 'in', descripcion: 'Procesar pagos y enviar notificaciones' }],
    journey: ['Pagar', 'Notificar'],
  },
  dataModel: {
    estado: 'approved',
    entities: Array.from({ length: 12 }, (_, index) => ({ nombre: `entidad_${index}` })),
    relationships: [],
  },
  endpoints: Array.from({ length: 30 }, (_, index) => ({ metodo: 'POST', ruta: `/api/recurso/${index}` })),
  screens: [{ clave: 'panel', nombre: 'Panel', roles: ['owner'] }],
  roles: ['owner', 'editor', 'viewer'],
};

describe('Recomendación de arquitectura con IA', () => {
  beforeEach(() => jest.clearAllMocks());

  test('caso 1: MVP pequeño recomienda monolito en capas y explica por qué', async () => {
    generateContent.mockResolvedValue(aiResponse({
      scenario: 'monolito-capas',
      rationale:
        'Para un MVP pequeño con solo dos entidades y pocos endpoints, un monolito en capas permite entregar rápido con un único despliegue y una sola base de datos, reduciendo la complejidad operacional mientras el producto valida su alcance.',
      technologies: baseTechnologies,
      operational: { docker: 'Docker Compose', env: '.env por entorno', observability: 'Logs y /health' },
      alternatives: [{ scenario: 'api-rest-desacoplada', reason: 'Si más adelante se agrega un cliente móvil.' }],
    }));

    const recommendation = await recommendArchitecture(smallMvpContext);

    expect(recommendation.scenario).toBe('monolito-capas');
    expect(recommendation.rationale).toContain('MVP');
    expect(generateContent).toHaveBeenCalledWith(
      expect.objectContaining({
        model: expect.any(String),
        body: expect.objectContaining({ contents: expect.any(Array) }),
      })
    );
  });

  test('caso 2: alto volumen y procesos asíncronos recomienda arquitectura orientada a eventos', async () => {
    generateContent.mockResolvedValue(aiResponse({
      scenario: 'event-driven',
      rationale:
        'El producto tiene doce entidades, decenas de endpoints y procesos de pago y notificación; una arquitectura orientada a eventos permite absorber picos, desacoplar dominios y procesar tareas en segundo plano sin bloquear al usuario, a costa de idempotencia y consistencia eventual.',
      technologies: {
        frontend: 'React',
        backend: 'Servicios + Azure Service Bus',
        database: 'PostgreSQL con outbox',
        communication: 'Eventos asíncronos por broker + REST para consultas',
        infrastructure: 'Docker Compose + broker',
      },
      operational: {
        docker: 'Servicios, broker y base de datos en contenedores',
        env: 'Cadena de conexión del broker por servicio',
        observability: 'Trazas distribuidas, métricas por evento y DLQ',
      },
    }));

    const recommendation = await recommendArchitecture(asyncHeavyContext);

    expect(recommendation.scenario).toBe('event-driven');
    expect(recommendation.technologies.infrastructure).toContain('broker');
    expect(recommendation.operational.observability).toContain('DLQ');
  });

  test('rechaza una justificación que solo nombra tecnologías', () => {
    expect(() => validateRecommendation({
      scenario: 'microservicios',
      rationale: 'Node, React, PostgreSQL, Docker.',
      technologies: { frontend: 'React', backend: 'Node', database: 'PostgreSQL', communication: 'REST' },
      operational: { docker: 'Docker' },
    })).toThrow('explicar por qué');
  });
});
