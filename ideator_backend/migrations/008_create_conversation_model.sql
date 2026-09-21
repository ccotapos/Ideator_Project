-- Modelo conversacional: sesiones, mensajes y decisiones de cada proyecto.
CREATE TABLE IF NOT EXISTS sesiones (
  id SERIAL PRIMARY KEY,
  proyecto_id INTEGER NOT NULL,
  created_by INTEGER,
  estado VARCHAR(20) NOT NULL DEFAULT 'active'
    CHECK (estado IN ('active', 'closed')),
  started_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ended_at TIMESTAMP,

  CONSTRAINT fk_sesion_proyecto
    FOREIGN KEY (proyecto_id)
    REFERENCES proyectos(id)
    ON DELETE CASCADE,

  CONSTRAINT fk_sesion_creador
    FOREIGN KEY (created_by)
    REFERENCES users(id)
    ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_sesion_activa_proyecto
  ON sesiones (proyecto_id)
  WHERE estado = 'active';

ALTER TABLE mensajes
  ADD COLUMN IF NOT EXISTS sesion_id INTEGER;

-- Conserva mensajes creados antes de que existiera el concepto de sesión.
INSERT INTO sesiones (proyecto_id, created_by, estado, started_at)
SELECT proyecto_id, MIN(usuario_id), 'active', MIN(created_at)
FROM mensajes
WHERE sesion_id IS NULL
GROUP BY proyecto_id
ON CONFLICT DO NOTHING;

UPDATE mensajes m
SET sesion_id = (
  SELECT s.id
  FROM sesiones s
  WHERE s.proyecto_id = m.proyecto_id
  ORDER BY s.started_at ASC, s.id ASC
  LIMIT 1
)
WHERE m.sesion_id IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_mensaje_sesion'
  ) THEN
    ALTER TABLE mensajes
      ADD CONSTRAINT fk_mensaje_sesion
      FOREIGN KEY (sesion_id)
      REFERENCES sesiones(id)
      ON DELETE CASCADE;
  END IF;
END $$;

ALTER TABLE mensajes
  ALTER COLUMN sesion_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_mensajes_sesion_created
  ON mensajes (sesion_id, created_at);

CREATE TABLE IF NOT EXISTS decisiones (
  id SERIAL PRIMARY KEY,
  sesion_id INTEGER NOT NULL,
  usuario_id INTEGER NOT NULL,
  titulo VARCHAR(150),
  contenido TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_decision_sesion
    FOREIGN KEY (sesion_id)
    REFERENCES sesiones(id)
    ON DELETE CASCADE,

  CONSTRAINT fk_decision_usuario
    FOREIGN KEY (usuario_id)
    REFERENCES users(id)
    ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_decisiones_sesion_created
  ON decisiones (sesion_id, created_at);

CREATE INDEX IF NOT EXISTS idx_decisiones_usuario_id
  ON decisiones (usuario_id);
