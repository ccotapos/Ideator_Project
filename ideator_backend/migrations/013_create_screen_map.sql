CREATE TABLE IF NOT EXISTS mapas_pantallas (
  id SERIAL PRIMARY KEY,
  proyecto_id INTEGER NOT NULL UNIQUE REFERENCES proyectos(id) ON DELETE CASCADE,
  generado_por INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS pantallas (
  id SERIAL PRIMARY KEY,
  mapa_id INTEGER NOT NULL REFERENCES mapas_pantallas(id) ON DELETE CASCADE,
  clave VARCHAR(80) NOT NULL,
  nombre VARCHAR(120) NOT NULL,
  descripcion TEXT,
  es_entrada BOOLEAN NOT NULL DEFAULT FALSE,
  es_resultado BOOLEAN NOT NULL DEFAULT FALSE,
  roles JSONB NOT NULL DEFAULT '["owner", "editor", "viewer"]'::jsonb,
  controles JSONB NOT NULL DEFAULT '[]'::jsonb,
  posicion INTEGER NOT NULL DEFAULT 0,
  UNIQUE (mapa_id, clave)
);

CREATE TABLE IF NOT EXISTS transiciones_pantallas (
  id SERIAL PRIMARY KEY,
  mapa_id INTEGER NOT NULL REFERENCES mapas_pantallas(id) ON DELETE CASCADE,
  pantalla_origen_id INTEGER NOT NULL REFERENCES pantallas(id) ON DELETE CASCADE,
  pantalla_destino_id INTEGER NOT NULL REFERENCES pantallas(id) ON DELETE CASCADE,
  accion VARCHAR(160) NOT NULL,
  roles JSONB NOT NULL DEFAULT '["owner", "editor", "viewer"]'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_pantallas_mapa ON pantallas(mapa_id, posicion);
CREATE INDEX IF NOT EXISTS idx_transiciones_mapa ON transiciones_pantallas(mapa_id);
