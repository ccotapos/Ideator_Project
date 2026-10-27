-- Recomendación de arquitectura generada con IA a partir de las etapas previas.
CREATE TABLE IF NOT EXISTS arquitecturas (
  id SERIAL PRIMARY KEY,
  proyecto_id INTEGER NOT NULL UNIQUE,
  escenario VARCHAR(50) NOT NULL,
  justificacion TEXT NOT NULL,
  tecnologias JSONB NOT NULL DEFAULT '{}'::jsonb,
  operacion JSONB NOT NULL DEFAULT '{}'::jsonb,
  alternativas JSONB NOT NULL DEFAULT '[]'::jsonb,
  estado VARCHAR(20) NOT NULL DEFAULT 'draft'
    CHECK (estado IN ('draft', 'approved')),
  generado_por INTEGER NOT NULL,
  aprobado_por INTEGER,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  approved_at TIMESTAMP,

  CONSTRAINT fk_arquitectura_proyecto
    FOREIGN KEY (proyecto_id) REFERENCES proyectos(id) ON DELETE CASCADE,
  CONSTRAINT fk_arquitectura_generado_por
    FOREIGN KEY (generado_por) REFERENCES users(id) ON DELETE RESTRICT,
  CONSTRAINT fk_arquitectura_aprobado_por
    FOREIGN KEY (aprobado_por) REFERENCES users(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_arquitecturas_proyecto
  ON arquitecturas (proyecto_id);
