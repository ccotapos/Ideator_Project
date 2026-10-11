## Para ejecución

cd ideator_backend
docker compose up

abrir http://localhost:5173/

## Integrantes

- Diego Galaz
- Emilio Fernandez
- Camila Cotapos

# Ideator - Backend Service

Servicio Backend construido con Node.js, Express y PostgreSQL para la gestión de usuarios, proyectos y autenticación JWT.

---

## Modelo de Datos Base

La migración `migrations/001_create_proyecto_usuario.sql` define la estructura inicial de la base de datos en PostgreSQL.

### 1. Tabla `users`
Almacena la información de los usuarios registrados.

| Campo | Tipo | Restricciones | Descripción |
| --- | --- | --- | --- |
| `id` | `SERIAL` | `PRIMARY KEY` | Identificador único del usuario. |
| `name` | `VARCHAR(100)` | `NOT NULL` | Nombre completo. |
| `email` | `VARCHAR(150)` | `UNIQUE`, `NOT NULL` | Correo electrónico para login. |
| `password` | `VARCHAR(255)` | `NOT NULL` | Contraseña encriptada (`bcrypt`). |
| `created_at` | `TIMESTAMP` | `DEFAULT CURRENT_TIMESTAMP` | Fecha de registro. |

### 2. Tabla `proyectos`
Almacena los proyectos creados en la plataforma.

| Campo | Tipo | Restricciones | Descripción |
| --- | --- | --- | --- |
| `id` | `SERIAL` | `PRIMARY KEY` | Identificador único del proyecto. |
| `nombre` | `VARCHAR(150)` | `NOT NULL` | Nombre del proyecto. |
| `descripcion` | `TEXT` | Opcional | Descripción del proyecto. |
| `is_private` | `BOOLEAN` | `NOT NULL`, `DEFAULT TRUE` | Indica si el proyecto es privado. |
| `created_at` | `TIMESTAMP` | `DEFAULT CURRENT_TIMESTAMP` | Fecha de creación. |

### 3. Tabla `proyecto_usuario`
Tabla intermedia que relaciona usuarios y proyectos asignando un nivel de acceso.

| Campo | Tipo | Restricciones | Descripción |
| --- | --- | --- | --- |
| `id` | `SERIAL` | `PRIMARY KEY` | Identificador único de la relación. |
| `usuario_id` | `INTEGER` | `FK -> users(id) ON DELETE CASCADE` | ID del usuario. |
| `proyecto_id` | `INTEGER` | `FK -> proyectos(id) ON DELETE CASCADE` | ID del proyecto. |
| `rol` | `VARCHAR(20)` | `CHECK ('owner', 'editor', 'viewer')` | Rol del usuario en el proyecto. |
| `created_at` | `TIMESTAMP` | `DEFAULT CURRENT_TIMESTAMP` | Fecha de asignación. |
| `updated_at` | `TIMESTAMP` | `DEFAULT CURRENT_TIMESTAMP` | Última modificación. |

#### Restricciones destacadas
- **Unicidad:** `UNIQUE (usuario_id, proyecto_id)` impide duplicar una relación entre el mismo usuario y proyecto.
- **Validación de rol:** El campo `rol` solo permite los valores `'owner'`, `'editor'` o `'viewer'`.
- **Integridad referencial:** Las llaves foráneas incluyen `ON DELETE CASCADE`, eliminando la relación automáticamente si se borra el usuario o el proyecto.

---

## Endpoint de proyectos

`POST /projects` crea un proyecto privado y asigna automaticamente al usuario autenticado como `owner`.

Headers:

```http
Authorization: Bearer <token>
Content-Type: application/json
```

Body:

```json
{
  "nombre": "Mi proyecto",
  "descripcion": "Descripcion opcional"
}
```

Respuestas principales:

- `201`: proyecto creado y relacion `owner` registrada en `proyecto_usuario`.
- `400`: falta el nombre del proyecto.
- `401`: no hay token valido.

## Ejecución de Migraciones

La base de datos se ejecuta sobre PostgreSQL en Docker. Las migraciones viven en
`migrations/` y las aplica un **runner** que registra cada archivo aplicado en la
tabla `schema_migrations`, por lo que solo ejecuta las pendientes y es seguro
reiniciar.

### Opción A: Automática (Recomendada)

El backend aplica las migraciones pendientes **al arrancar**. Basta con levantar
los servicios:

```bash
cd ideator_backend
docker compose up
```

También se pueden forzar manualmente con:

```bash
docker exec ideator_backend_container npm run migrate
```

### Opción B: Desde pgAdmin 4

1. Conéctate al servidor de PostgreSQL en la base de datos `ideator_db`.
2. Abre la **Query Tool** en `ideator_db`.
3. Ejecuta los archivos de `migrations/` en orden (001, 002, 003…).

### Opción C: Desde CLI (Docker container)

```bash
docker exec ideator_db_container psql -U postgres -d ideator_db -f /docker-entrypoint-initdb.d/006_create_mensajes.sql
```

> Nota: el montaje `./migrations:/docker-entrypoint-initdb.d` solo se ejecuta la
> **primera vez** que se crea el volumen de Postgres. Para bases ya existentes,
> usa la Opción A (runner) o la Opción B/C para aplicar las migraciones nuevas.

Para correr la suite de pruebas automatizadas con Jest y Supertest:

```bash
cd ideator_backend
npm test
```

# Ideator - FrontEnd Service

Frontend inicializado con React, Vite y React Router.

## Requisitos

- Node.js
- pnpm

## Scripts

```bash
pnpm install
pnpm dev
```

## Estructura

- `src/components`: componentes reutilizables.
- `src/layouts`: estructura general de la aplicacion.
- `src/pages`: pantallas conectadas al ruteo.

## Historial de actividad

La migración `007_create_actividad_proyecto.sql` crea la tabla
`actividad_proyecto`, que conserva el proyecto, el autor, la fecha, el tipo de
acción y sus detalles. Actualmente se registran la creación y edición de
proyectos y las invitaciones de colaboradores.

Un miembro del proyecto puede consultar el historial, ordenado desde el cambio
más reciente, mediante:

```http
GET /api/projects/{id}/activity
Authorization: Bearer <token>
```

## Modelo conversacional

La migración `008_create_conversation_model.sql` completa el modelo de datos
del proceso guiado:

- `sesiones`: agrupa una conversación de un proyecto y registra quién la creó,
  su estado y sus fechas de inicio y cierre.
- `mensajes`: cada mensaje pertenece a una sesión y conserva su remitente y,
  cuando corresponde, el usuario que lo escribió.
- `decisiones`: pertenece a una sesión y exige un `usuario_id`, por lo que cada
  acuerdo mantiene la trazabilidad de la persona que lo tomó.

Endpoints disponibles para miembros del proyecto:

```http
GET  /api/projects/{id}/sessions
GET  /api/projects/{id}/messages
POST /api/projects/{id}/messages
GET  /api/projects/{id}/decisions
POST /api/projects/{id}/decisions
```

Ejemplo para registrar una decisión:

```json
{
  "title": "Base de datos",
  "content": "Usaremos PostgreSQL"
}
```

## Definición inicial y MVP

La migración `009_create_project_definition.sql` agrega tres estructuras:

- `definicion_secciones`: respuestas separadas para problema, contexto y
  usuarios objetivo.
- `mvp_funcionalidades`: funcionalidades marcadas explícitamente dentro o
  fuera del MVP.
- `recorrido_principal`: secuencia ordenada de pasos del producto.

El flujo está disponible para miembros del proyecto. Los roles `owner` y
`editor` pueden modificarlo; `viewer` solo puede consultarlo.

```http
GET /api/projects/{id}/definition/questions
PUT /api/projects/{id}/definition/sections
PUT /api/projects/{id}/definition/mvp
GET /api/projects/{id}/definition
```

## Especificación de endpoints vía IA

La migración `011_create_endpoint_spec.sql` agrega la especificación de endpoints
del producto:

- `especificaciones_endpoints`: cabecera por proyecto con su estado
  (`draft` / `approved`) y la referencia al modelo de datos usado como base.
- `endpoints`: cada endpoint con su método HTTP, ruta, operación y la entidad
  del modelo de datos sobre la que opera.

La especificación **solo puede generarse a partir de un modelo de datos
aprobado**, por lo que es coherente con el modelo vigente. Los roles `owner` y
`editor` pueden generarla y regenerarla mientras esté en borrador; solo el
`owner` puede aprobarla, tras lo cual queda bloqueada.

La migración `012_endpoint_spec_attributes.sql` agrega a cada endpoint los
**atributos** del modelo de datos que utiliza, lo que permite validar la
consistencia entre la API y el modelo.

```http
GET  /api/projects/{id}/endpoint-spec
POST /api/projects/{id}/endpoint-spec/generate
GET  /api/projects/{id}/endpoint-spec/validation
POST /api/projects/{id}/endpoint-spec/approve
```

Cada endpoint generado indica siempre **método HTTP**, **ruta** y **operación**.

## Validación de consistencia API ↔ modelo de datos

El validador (`services/consistencyValidator.js`) compara cada endpoint con el
modelo aprobado y reporta inconsistencias:

- `entidad_faltante`: endpoint que no referencia ninguna entidad.
- `entidad_inexistente`: entidad que no existe en el modelo aprobado.
- `atributo_inexistente`: atributo que no pertenece a esa entidad.

`GET /api/projects/{id}/endpoint-spec/validation` devuelve
`{ validation: { consistent, issues } }`. La aprobación queda **bloqueada**
(respuesta `409` con la lista de `issues`) mientras existan inconsistencias, y la
pantalla "Endpoints (API)" las muestra al usuario antes de continuar.
