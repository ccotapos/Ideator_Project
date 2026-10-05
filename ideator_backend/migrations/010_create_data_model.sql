CREATE TABLE IF NOT EXISTS modelos_datos (
  id SERIAL PRIMARY KEY,
  proyecto_id INTEGER NOT NULL UNIQUE REFERENCES proyectos(id) ON DELETE CASCADE,
  estado VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (estado IN ('draft', 'approved')),
  version INTEGER NOT NULL DEFAULT 1,
  generado_por INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  aprobado_por INTEGER REFERENCES users(id) ON DELETE RESTRICT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  approved_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS modelo_entidades (
  id SERIAL PRIMARY KEY,
  modelo_id INTEGER NOT NULL REFERENCES modelos_datos(id) ON DELETE CASCADE,
  nombre VARCHAR(100) NOT NULL,
  descripcion TEXT,
  posicion INTEGER NOT NULL DEFAULT 0,
  UNIQUE (modelo_id, nombre)
);

CREATE TABLE IF NOT EXISTS modelo_atributos (
  id SERIAL PRIMARY KEY,
  entidad_id INTEGER NOT NULL REFERENCES modelo_entidades(id) ON DELETE CASCADE,
  nombre VARCHAR(100) NOT NULL,
  tipo_dato VARCHAR(60) NOT NULL,
  nullable BOOLEAN NOT NULL DEFAULT TRUE,
  es_pk BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE (entidad_id, nombre)
);

CREATE TABLE IF NOT EXISTS modelo_relaciones (
  id SERIAL PRIMARY KEY,
  modelo_id INTEGER NOT NULL REFERENCES modelos_datos(id) ON DELETE CASCADE,
  entidad_origen_id INTEGER NOT NULL REFERENCES modelo_entidades(id) ON DELETE CASCADE,
  entidad_destino_id INTEGER NOT NULL REFERENCES modelo_entidades(id) ON DELETE CASCADE,
  nombre VARCHAR(100) NOT NULL,
  cardinalidad_origen VARCHAR(20) NOT NULL,
  cardinalidad_destino VARCHAR(20) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_modelo_entidades_modelo ON modelo_entidades(modelo_id);
CREATE INDEX IF NOT EXISTS idx_modelo_relaciones_modelo ON modelo_relaciones(modelo_id);
