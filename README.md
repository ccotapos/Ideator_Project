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

## Ejecución de Migraciones

La base de datos se ejecuta sobre PostgreSQL en Docker.

### Opción A: Desde pgAdmin 4 (Recomendado)
1. Conéctate al servidor de PostgreSQL en la base de datos `ideator_db`.
2. Abre la **Query Tool** en `ideator_db`.
3. Copia y ejecuta el contenido de `migrations/001_create_proyecto_usuario.sql`.

### Opción B: Desde CLI (Docker container)
```bash`
docker exec -i <nombre_contenedor_postgres> psql -U postgres -d ideator_db < migrations/001_create_proyecto_usuario.sql

para correr la suite de pruebas automatizadas con jest y supertest
npm test

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
- `backend/migrations`: migraciones de base de datos.

