-- Agrega fecha de última modificación a los proyectos.
ALTER TABLE proyectos
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Mantiene updated_at sincronizado automáticamente en cada UPDATE.
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_proyectos_updated_at ON proyectos;
CREATE TRIGGER trg_proyectos_updated_at
BEFORE UPDATE ON proyectos
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();