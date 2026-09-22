-- Definición guiada del problema y alcance inicial de cada proyecto.
CREATE TABLE IF NOT EXISTS definicion_secciones (
  id SERIAL PRIMARY KEY,
  proyecto_id INTEGER NOT NULL,
  seccion VARCHAR(30) NOT NULL
    CHECK (seccion IN ('problem', 'context', 'target_users')),
  respuesta TEXT NOT NULL,
  respondido_por INTEGER NOT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_definicion_proyecto
    FOREIGN KEY (proyecto_id) REFERENCES proyectos(id) ON DELETE CASCADE,
  CONSTRAINT fk_definicion_usuario
    FOREIGN KEY (respondido_por) REFERENCES users(id) ON DELETE RESTRICT,
  CONSTRAINT uq_definicion_seccion
    UNIQUE (proyecto_id, seccion)
);

CREATE TABLE IF NOT EXISTS mvp_funcionalidades (
  id SERIAL PRIMARY KEY,
  proyecto_id INTEGER NOT NULL,
  alcance VARCHAR(10) NOT NULL CHECK (alcance IN ('in', 'out')),
  descripcion TEXT NOT NULL,
  posicion INTEGER NOT NULL CHECK (posicion >= 0),
  creado_por INTEGER NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_mvp_funcionalidad_proyecto
    FOREIGN KEY (proyecto_id) REFERENCES proyectos(id) ON DELETE CASCADE,
  CONSTRAINT fk_mvp_funcionalidad_usuario
    FOREIGN KEY (creado_por) REFERENCES users(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS recorrido_principal (
  id SERIAL PRIMARY KEY,
  proyecto_id INTEGER NOT NULL,
  posicion INTEGER NOT NULL CHECK (posicion >= 0),
  descripcion TEXT NOT NULL,
  creado_por INTEGER NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_recorrido_proyecto
    FOREIGN KEY (proyecto_id) REFERENCES proyectos(id) ON DELETE CASCADE,
  CONSTRAINT fk_recorrido_usuario
    FOREIGN KEY (creado_por) REFERENCES users(id) ON DELETE RESTRICT,
  CONSTRAINT uq_recorrido_posicion
    UNIQUE (proyecto_id, posicion)
);

CREATE INDEX IF NOT EXISTS idx_definicion_secciones_proyecto
  ON definicion_secciones (proyecto_id);

CREATE INDEX IF NOT EXISTS idx_mvp_funcionalidades_proyecto
  ON mvp_funcionalidades (proyecto_id, alcance, posicion);

CREATE INDEX IF NOT EXISTS idx_recorrido_principal_proyecto
  ON recorrido_principal (proyecto_id, posicion);
