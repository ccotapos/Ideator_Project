-- Vincula usuarios de la app con sus identidades en proveedores externos de SSO.
CREATE TABLE IF NOT EXISTS identidades_externas (
  id SERIAL PRIMARY KEY,
  usuario_id INTEGER NOT NULL,
  proveedor VARCHAR(50) NOT NULL,
  proveedor_usuario_id VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_identidad_usuario
    FOREIGN KEY (usuario_id)
    REFERENCES users(id)
    ON DELETE CASCADE,

  CONSTRAINT uq_identidad_proveedor
    UNIQUE (proveedor, proveedor_usuario_id)
);

CREATE INDEX IF NOT EXISTS idx_identidades_externas_usuario_id
  ON identidades_externas (usuario_id);