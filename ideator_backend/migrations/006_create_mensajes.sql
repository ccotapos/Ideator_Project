-- Almacena el historial de conversación de cada proyecto con Ideator.
CREATE TABLE IF NOT EXISTS mensajes (
  id SERIAL PRIMARY KEY,
  proyecto_id INTEGER NOT NULL,
  usuario_id INTEGER,
  remitente VARCHAR(20) NOT NULL CHECK (remitente IN ('usuario', 'ideator')),
  contenido TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_mensaje_proyecto
    FOREIGN KEY (proyecto_id)
    REFERENCES proyectos(id)
    ON DELETE CASCADE,

  CONSTRAINT fk_mensaje_usuario
    FOREIGN KEY (usuario_id)
    REFERENCES users(id)
    ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_mensajes_proyecto_created
  ON mensajes (proyecto_id, created_at);