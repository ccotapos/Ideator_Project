-- Especificación de endpoints generada con IA a partir del modelo de datos aprobado.
CREATE TABLE IF NOT EXISTS especificaciones_endpoints (
  id SERIAL PRIMARY KEY,
  proyecto_id INTEGER NOT NULL UNIQUE,
  modelo_id INTEGER,
  estado VARCHAR(20) NOT NULL DEFAULT 'draft'
    CHECK (estado IN ('draft', 'approved')),
  generado_por INTEGER NOT NULL,
  aprobado_por INTEGER,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  approved_at TIMESTAMP,

  CONSTRAINT fk_especificacion_proyecto
    FOREIGN KEY (proyecto_id) REFERENCES proyectos(id) ON DELETE CASCADE,
  CONSTRAINT fk_especificacion_modelo
    FOREIGN KEY (modelo_id) REFERENCES modelos_datos(id) ON DELETE SET NULL,
  CONSTRAINT fk_especificacion_generado_por
    FOREIGN KEY (generado_por) REFERENCES users(id) ON DELETE RESTRICT,
  CONSTRAINT fk_especificacion_aprobado_por
    FOREIGN KEY (aprobado_por) REFERENCES users(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS endpoints (
  id SERIAL PRIMARY KEY,
  especificacion_id INTEGER NOT NULL,
  metodo VARCHAR(10) NOT NULL
    CHECK (metodo IN ('GET', 'POST', 'PUT', 'PATCH', 'DELETE')),
  ruta VARCHAR(255) NOT NULL,
  operacion TEXT NOT NULL,
  entidad VARCHAR(100),
  posicion INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_endpoint_especificacion
    FOREIGN KEY (especificacion_id)
    REFERENCES especificaciones_endpoints(id) ON DELETE CASCADE,
  CONSTRAINT uq_endpoint_metodo_ruta
    UNIQUE (especificacion_id, metodo, ruta)
);

CREATE INDEX IF NOT EXISTS idx_endpoints_especificacion
  ON endpoints (especificacion_id, posicion);
