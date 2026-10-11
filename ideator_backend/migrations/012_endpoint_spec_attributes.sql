-- Cada endpoint referencia los atributos del modelo de datos que utiliza,
-- para poder validar la consistencia entre la API y el modelo aprobado.
ALTER TABLE endpoints
  ADD COLUMN IF NOT EXISTS atributos JSONB NOT NULL DEFAULT '[]'::jsonb;
