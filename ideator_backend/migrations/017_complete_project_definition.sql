ALTER TABLE definicion_secciones
  DROP CONSTRAINT IF EXISTS definicion_secciones_seccion_check;

ALTER TABLE definicion_secciones
  ADD CONSTRAINT definicion_secciones_seccion_check
  CHECK (seccion IN (
    'problem',
    'context',
    'target_users',
    'expected_outcomes',
    'functional_requirements',
    'technical_constraints',
    'business_rules',
    'external_integrations',
    'security_conditions',
    'error_cases'
  ));

ALTER TABLE endpoints
  ADD COLUMN IF NOT EXISTS parametros_ruta JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS parametros_consulta JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS cabeceras JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS cuerpo JSONB,
  ADD COLUMN IF NOT EXISTS validaciones JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS respuestas JSONB NOT NULL DEFAULT '[]'::jsonb;
