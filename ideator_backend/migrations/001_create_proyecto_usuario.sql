-- Tablas para usuarios, proyectos y relacion de permisos en PostgreSQL

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(150) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS proyectos (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(150) NOT NULL,
  descripcion TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS proyecto_usuario (
  id SERIAL PRIMARY KEY,
  usuario_id INTEGER NOT NULL,
  proyecto_id INTEGER NOT NULL,
  rol VARCHAR(20) NOT NULL CHECK (rol IN ('owner', 'editor', 'viewer')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_proyecto_usuario_usuario
    FOREIGN KEY (usuario_id)
    REFERENCES users(id)
    ON DELETE CASCADE,

  CONSTRAINT fk_proyecto_usuario_proyecto
    FOREIGN KEY (proyecto_id)
    REFERENCES proyectos(id)
    ON DELETE CASCADE,

  CONSTRAINT uq_proyecto_usuario
    UNIQUE (usuario_id, proyecto_id)
);

CREATE INDEX IF NOT EXISTS idx_proyecto_usuario_usuario_id
  ON proyecto_usuario (usuario_id);

CREATE INDEX IF NOT EXISTS idx_proyecto_usuario_proyecto_id
  ON proyecto_usuario (proyecto_id);