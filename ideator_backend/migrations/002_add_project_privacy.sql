-- Agrega privacidad a los proyectos.
-- Por defecto, cada proyecto nuevo es privado.

ALTER TABLE proyectos
  ADD COLUMN IF NOT EXISTS is_private BOOLEAN NOT NULL DEFAULT TRUE;
