# Backend

## Modelo Proyecto_Usuario

La migracion `migrations/001_create_proyecto_usuario.sql` crea una tabla intermedia para relacionar usuarios y proyectos con un rol de acceso.

### Tabla

`Proyecto_Usuario`

| Campo | Tipo | Descripcion |
| --- | --- | --- |
| `id` | `INTEGER` | Identificador unico de la relacion. |
| `usuario_id` | `INTEGER` | Usuario asociado al proyecto. |
| `proyecto_id` | `INTEGER` | Proyecto asociado al usuario. |
| `rol` | `TEXT` | Rol del usuario en el proyecto: `owner`, `editor` o `viewer`. |
| `created_at` | `DATETIME` | Fecha de creacion del registro. |
| `updated_at` | `DATETIME` | Fecha de ultima actualizacion del registro. |

### Restricciones

- `UNIQUE (usuario_id, proyecto_id)` impide duplicar la misma relacion usuario-proyecto.
- `rol` solo permite los valores `owner`, `editor` o `viewer`.
- Las llaves foraneas eliminan la relacion si se elimina el usuario o el proyecto.

### Ejecucion de la migracion

La migracion asume que ya existen las tablas `usuarios` y `proyectos`.

Ejemplo con SQLite:

```bash
sqlite3 database.sqlite < backend/migrations/001_create_proyecto_usuario.sql
```
