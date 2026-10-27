# Arquitecturas base de Ideator

Este documento describe las **cinco arquitecturas base** que Ideator usa para
recomendar una solución. Los escenarios **1 a 4** son los iniciales del curso; el
escenario **5 (orientada a eventos)** es el escenario adicional incorporado en
esta iteración. Todas se documentan con la misma plantilla: propósito, stack por
capa, operación (Docker, variables de entorno y observabilidad), cuándo usarla y
ventajas/desventajas.

El catálogo también vive en código (`ideator_backend/src/config/architectureScenarios.js`)
y es la fuente que consume la recomendación con IA.

---

## 1. Monolito en capas

**Propósito.** Una sola aplicación desplegable organizada en capas
(presentación, negocio y datos). Es la opción más directa para un MVP.

**Stack por capa.**
- Frontend: React + Vite.
- Backend: Node.js + Express.
- Base de datos: PostgreSQL.
- Infraestructura: Docker Compose.

**Operación.**
- Docker: un contenedor para la API, uno para PostgreSQL y uno para el frontend,
  con un único despliegue.
- Variables de entorno: `.env` por entorno (`DB_*`, `JWT_SECRET`, claves de IA).
- Observabilidad: logs estructurados, endpoint `/health` y trazabilidad en la
  tabla de actividad.

**Cuándo usarla.** MVP acotado y equipo pequeño, baja/media concurrencia, una sola
base de datos y un único despliegue.

**Ventajas y desventajas.** Muy simple de operar y económico; escala
verticalmente y cuesta modularizarlo al crecer.

---

## 2. API REST desacoplada + SPA

**Propósito.** Frontend SPA independiente que consume una API REST propia.

**Stack por capa.**
- Frontend: React SPA servida por Nginx/CDN.
- Backend: API REST Node.js + Express.
- Base de datos: PostgreSQL.
- Infraestructura: Docker + Nginx como proxy.

**Operación.**
- Docker: contenedores separados para API, frontend estático y base de datos.
- Variables de entorno: por servicio; la URL de la API vive en la configuración
  del frontend.
- Observabilidad: logs por servicio, `/health` y métricas de latencia de la API.

**Cuándo usarla.** Varios clientes (web, móvil) sobre la misma API, ciclos de
despliegue distintos para frontend y backend, o necesidad de escalar la API de
forma independiente.

**Ventajas y desventajas.** Desacopla y permite escalar por separado; añade CORS,
versionado de API y más despliegues.

---

## 3. Microservicios

**Propósito.** Varios servicios autónomos por dominio, coordinados por un API
Gateway.

**Stack por capa.**
- Frontend: React SPA.
- Backend: servicios Node.js por dominio + API Gateway.
- Base de datos: PostgreSQL por servicio (datos aislados).
- Infraestructura: Docker Compose o Kubernetes.

**Operación.**
- Docker: orquestación de varios contenedores con health checks y reinicio
  automático.
- Variables de entorno: configuración y secretos por servicio.
- Observabilidad: trazas distribuidas, logs centralizados y métricas por servicio.

**Cuándo usarla.** Dominios de negocio bien delimitados, equipos múltiples
trabajando en paralelo o necesidad de escalar un dominio específico.

**Ventajas y desventajas.** Alta escalabilidad y autonomía; mayor complejidad
operacional y consistencia eventual.

---

## 4. Serverless / FaaS

**Propósito.** Funciones gestionadas por la nube y servicios administrados, sin
servidores propios que mantener.

**Stack por capa.**
- Frontend: React SPA en hosting estático.
- Backend: funciones serverless (Azure Functions o AWS Lambda).
- Base de datos: PostgreSQL gestionado o base NoSQL administrada.
- Infraestructura: plataforma cloud (sin servidores que administrar).

**Operación.**
- Docker: no se empaqueta el runtime; el despliegue es por función o paquete
  gestionado.
- Variables de entorno: variables y secretos en el gestor de configuración del
  proveedor cloud.
- Observabilidad: Application Insights/CloudWatch, trazas por invocación y alertas
  de errores.

**Cuándo usarla.** Carga muy variable o intermitente, bajo interés en administrar
infraestructura, integraciones puntuales y pago por uso.

**Ventajas y desventajas.** Escala automática y bajo costo en reposo; dependencia
del proveedor, *cold starts* y límites de ejecución.

---

## 5. Orientada a eventos (escenario adicional)

**Propósito.** Servicios desacoplados que se comunican mediante **eventos
asíncronos** publicados en un broker. Añade el quinto escenario con el mismo nivel
de detalle que los cuatro iniciales.

**Stack por capa.**
- Frontend: React SPA.
- Backend: servicios Node.js + bus de eventos (Azure Service Bus, RabbitMQ o Kafka).
- Base de datos: PostgreSQL con patrón **outbox** para publicar eventos de forma
  fiable.
- Infraestructura: Docker Compose con broker + servicios, o Kubernetes.

**Operación.**
- Docker: contenedores para **servicios, broker de eventos y base de datos**, con
  health checks y reinicio automático.
- Variables de entorno: por servicio (cadena de conexión al broker, colas/tópicos,
  credenciales de BD y claves de IA).
- Observabilidad: **trazas distribuidas**, métricas por evento, **cola de mensajes
  fallidos (DLQ)** y `/health` por servicio.

**Cuándo usarla.** Procesos asíncronos (notificaciones, integraciones, tareas en
segundo plano), picos de carga que conviene absorber sin bloquear al usuario y
módulos que deben evolucionar de forma desacoplada.

**Ventajas y desventajas.** Desacopla y absorbe picos; exige **idempotencia**,
manejo de **consistencia eventual** y monitoreo de la DLQ.

---

## Comparación rápida

| Escenario | Complejidad | Escalado | Acoplamiento | Operación | Ideal para |
| --- | --- | --- | --- | --- | --- |
| Monolito en capas | Baja | Vertical | Alto | Muy simple | MVP acotado |
| API REST desacoplada | Media | API independiente | Medio | Simple | Web + móvil |
| Microservicios | Alta | Por servicio | Bajo | Compleja | Dominios y equipos múltiples |
| Serverless | Media | Automático | Medio | Delegada al cloud | Carga variable |
| Orientada a eventos | Alta | Por evento/consumidor | Muy bajo | Broker + DLQ | Procesos asíncronos y picos |

## Nota sobre el quinto escenario

El escenario **orientado a eventos** se agrega junto a las cuatro arquitecturas
iniciales y mantiene la misma estructura de documentación. Incluye explícitamente
los aspectos operacionales exigidos: **Docker** (servicios + broker + BD),
**variables de entorno** por servicio y **observabilidad** (trazas distribuidas,
métricas por evento y DLQ).
