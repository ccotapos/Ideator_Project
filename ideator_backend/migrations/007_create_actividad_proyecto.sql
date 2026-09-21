-- Registra los cambios relevantes de un proyecto y el usuario que los realizó.
CREATE TABLE IF NOT EXISTS actividad_proyecto (
  id SERIAL PRIMARY KEY,
  proyecto_id INTEGER NOT NULL,
  usuario_id INTEGER,
  accion VARCHAR(50) NOT NULL,
  detalles JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_actividad_proyecto
    FOREIGN KEY (proyecto_id)
    REFERENCES proyectos(id)
    ON DELETE CASCADE,

  CONSTRAINT fk_actividad_usuario
    FOREIGN KEY (usuario_id)
    REFERENCES users(id)
    ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_actividad_proyecto_fecha
  ON actividad_proyecto (proyecto_id, created_at DESC);
