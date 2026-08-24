-- Migration: create Proyecto_Usuario relation table
-- Purpose: connect users and projects with an access role.
-- Assumes existing tables:
--   - usuarios(id)
--   - proyectos(id)

CREATE TABLE IF NOT EXISTS Proyecto_Usuario (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario_id INTEGER NOT NULL,
  proyecto_id INTEGER NOT NULL,
  rol TEXT NOT NULL CHECK (rol IN ('owner', 'editor', 'viewer')),
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_proyecto_usuario_usuario
    FOREIGN KEY (usuario_id)
    REFERENCES usuarios(id)
    ON DELETE CASCADE,

  CONSTRAINT fk_proyecto_usuario_proyecto
    FOREIGN KEY (proyecto_id)
    REFERENCES proyectos(id)
    ON DELETE CASCADE,

  CONSTRAINT uq_proyecto_usuario
    UNIQUE (usuario_id, proyecto_id)
);

CREATE INDEX IF NOT EXISTS idx_proyecto_usuario_usuario_id
  ON Proyecto_Usuario (usuario_id);

CREATE INDEX IF NOT EXISTS idx_proyecto_usuario_proyecto_id
  ON Proyecto_Usuario (proyecto_id);
