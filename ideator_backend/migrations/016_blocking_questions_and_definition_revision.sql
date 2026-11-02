ALTER TABLE proyectos
  ADD COLUMN IF NOT EXISTS definicion_revision INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS preguntas_bloqueantes (
  id SERIAL PRIMARY KEY,
  proyecto_id INTEGER NOT NULL,
  categoria VARCHAR(30) NOT NULL
    CHECK (categoria IN ('data_model', 'backend', 'interface', 'architecture')),
  pregunta TEXT NOT NULL,
  respuesta TEXT,
  resuelta BOOLEAN NOT NULL DEFAULT FALSE,
  creada_por INTEGER NOT NULL,
  resuelta_por INTEGER,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  resolved_at TIMESTAMP,
  CONSTRAINT fk_pregunta_bloqueante_proyecto FOREIGN KEY (proyecto_id) REFERENCES proyectos(id) ON DELETE CASCADE,
  CONSTRAINT fk_pregunta_bloqueante_creador FOREIGN KEY (creada_por) REFERENCES users(id) ON DELETE RESTRICT,
  CONSTRAINT fk_pregunta_bloqueante_resolutor FOREIGN KEY (resuelta_por) REFERENCES users(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_preguntas_bloqueantes_proyecto
  ON preguntas_bloqueantes (proyecto_id, resuelta, created_at);
