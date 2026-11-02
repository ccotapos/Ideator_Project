-- Documentos finales en Markdown (especificación del producto y arquitectura).
CREATE TABLE IF NOT EXISTS documentos_finales (
  id SERIAL PRIMARY KEY,
  proyecto_id INTEGER NOT NULL,
  tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('especificacion', 'arquitectura')),
  contenido_md TEXT NOT NULL,
  generado_por INTEGER NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_documento_proyecto
    FOREIGN KEY (proyecto_id) REFERENCES proyectos(id) ON DELETE CASCADE,
  CONSTRAINT fk_documento_usuario
    FOREIGN KEY (generado_por) REFERENCES users(id) ON DELETE RESTRICT,
  CONSTRAINT uq_documento_tipo
    UNIQUE (proyecto_id, tipo)
);

CREATE INDEX IF NOT EXISTS idx_documentos_finales_proyecto
  ON documentos_finales (proyecto_id);
