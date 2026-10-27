// Catálogo de las cinco arquitecturas base de Ideator. Los cuatro primeros son
// los escenarios iniciales; el quinto (event-driven) es el escenario adicional.
const SCENARIOS = [
  {
    id: 'monolito-capas',
    name: 'Monolito en capas',
    summary: 'Una sola aplicación desplegable organizada en capas (presentación, negocio y datos).',
    technologies: {
      frontend: 'React + Vite',
      backend: 'Node.js + Express',
      database: 'PostgreSQL',
      infrastructure: 'Docker Compose',
    },
    operational: {
      docker: 'Un contenedor para la API, uno para PostgreSQL y uno para el frontend, con un único despliegue.',
      env: 'Variables en .env por entorno (DB_*, JWT_SECRET, claves de IA).',
      observability: 'Logs estructurados, endpoint /health y trazabilidad en la tabla de actividad.',
    },
    whenToUse: [
      'MVP acotado y equipo pequeño.',
      'Baja o media concurrencia.',
      'Una sola base de datos y un único despliegue.',
    ],
    tradeoffs: 'Muy simple de operar y económico; escala verticalmente y cuesta modularizarlo al crecer.',
  },
  {
    id: 'api-rest-desacoplada',
    name: 'API REST desacoplada + SPA',
    summary: 'Frontend SPA independiente que consume una API REST propia.',
    technologies: {
      frontend: 'React SPA servida por Nginx/CDN',
      backend: 'API REST Node.js + Express',
      database: 'PostgreSQL',
      infrastructure: 'Docker + Nginx como proxy',
    },
    operational: {
      docker: 'Contenedores separados para API, frontend estático y base de datos.',
      env: 'Variables por servicio; la URL de la API vive en la configuración del frontend.',
      observability: 'Logs por servicio, /health y métricas de latencia de la API.',
    },
    whenToUse: [
      'Varios clientes (web, móvil) sobre la misma API.',
      'Ciclos de despliegue distintos para frontend y backend.',
      'Necesidad de escalar la API de forma independiente.',
    ],
    tradeoffs: 'Desacopla y permite escalar por separado; añade CORS, versionado de API y más despliegues.',
  },
  {
    id: 'microservicios',
    name: 'Microservicios',
    summary: 'Varios servicios autónomos por dominio, coordinados por un API Gateway.',
    technologies: {
      frontend: 'React SPA',
      backend: 'Servicios Node.js por dominio + API Gateway',
      database: 'PostgreSQL por servicio (datos aislados)',
      infrastructure: 'Docker Compose o Kubernetes',
    },
    operational: {
      docker: 'Orquestación de varios contenedores con health checks y reinicio automático.',
      env: 'Configuración y secretos por servicio.',
      observability: 'Trazas distribuidas, logs centralizados y métricas por servicio.',
    },
    whenToUse: [
      'Dominios de negocio bien delimitados.',
      'Equipos múltiples trabajando en paralelo.',
      'Necesidad de escalar un dominio específico.',
    ],
    tradeoffs: 'Alta escalabilidad y autonomía; mayor complejidad operacional y consistencia eventual.',
  },
  {
    id: 'serverless',
    name: 'Serverless / FaaS',
    summary: 'Funciones gestionadas por la nube y servicios administrados, sin servidores propios.',
    technologies: {
      frontend: 'React SPA en hosting estático',
      backend: 'Funciones serverless (Azure Functions o AWS Lambda)',
      database: 'PostgreSQL gestionado o base NoSQL administrada',
      infrastructure: 'Plataforma cloud (sin servidores que administrar)',
    },
    operational: {
      docker: 'No se empaqueta el runtime; el despliegue es por función o paquete gestionado.',
      env: 'Variables y secretos en el gestor de configuración del proveedor cloud.',
      observability: 'Application Insights/CloudWatch, trazas por invocación y alertas de errores.',
    },
    whenToUse: [
      'Carga muy variable o intermitente.',
      'Bajo interés en administrar infraestructura.',
      'Integraciones puntuales y pago por uso.',
    ],
    tradeoffs: 'Escala automática y bajo costo en reposo; dependencia del proveedor, cold starts y límites de ejecución.',
  },
  {
    id: 'event-driven',
    name: 'Orientada a eventos',
    summary: 'Servicios desacoplados que se comunican mediante eventos asíncronos por un broker.',
    technologies: {
      frontend: 'React SPA',
      backend: 'Servicios Node.js + bus de eventos (Azure Service Bus, RabbitMQ o Kafka)',
      database: 'PostgreSQL con patrón outbox para publicar eventos de forma fiable',
      infrastructure: 'Docker Compose con broker + servicios, o Kubernetes',
    },
    operational: {
      docker: 'Contenedores para servicios, broker de eventos y base de datos, con health checks.',
      env: 'Variables por servicio (cadena de conexión al broker, colas/tópicos, credenciales de BD).',
      observability: 'Trazas distribuidas, métricas por evento, cola de mensajes fallidos (DLQ) y /health por servicio.',
    },
    whenToUse: [
      'Procesos asíncronos: notificaciones, integraciones y tareas en segundo plano.',
      'Picos de carga que conviene absorber sin bloquear al usuario.',
      'Módulos que deben evolucionar de forma desacoplada.',
    ],
    tradeoffs: 'Desacopla y absorbe picos; exige idempotencia, consistencia eventual y monitoreo de la DLQ.',
  },
];

function getScenario(id) {
  return SCENARIOS.find((scenario) => scenario.id === id) || null;
}

function listScenarios() {
  return SCENARIOS.map(({ id, name, summary }) => ({ id, name, summary }));
}

module.exports = { SCENARIOS, getScenario, listScenarios };
