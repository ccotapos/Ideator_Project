// Valida que los endpoints generados sean consistentes con el modelo de datos
// aprobado: cada endpoint debe referenciar entidades y atributos existentes.
function normalize(value) {
  return String(value ?? '').trim();
}

function validateSpecConsistency(spec, model) {
  const issues = [];
  const endpoints = spec?.endpoints || [];
  const entities = model?.entities || [];

  const entityMap = new Map(
    entities.map((entity) => [normalize(entity.nombre || entity.name).toLowerCase(), entity])
  );

  for (const endpoint of endpoints) {
    const metodo = endpoint.metodo || endpoint.method || null;
    const ruta = endpoint.ruta || endpoint.route || null;
    const entityName = normalize(endpoint.entidad || endpoint.entity);

    if (!entityName) {
      issues.push({
        code: 'entidad_faltante',
        metodo,
        ruta,
        referencia: null,
        message: 'El endpoint no referencia ninguna entidad del modelo.',
      });
      continue;
    }

    const entity = entityMap.get(entityName.toLowerCase());
    if (!entity) {
      issues.push({
        code: 'entidad_inexistente',
        metodo,
        ruta,
        referencia: entityName,
        message: `La entidad "${entityName}" no existe en el modelo de datos aprobado.`,
      });
      continue;
    }

    const attributeNames = new Set(
      (entity.attributes || []).map((attribute) => normalize(attribute.nombre || attribute.name).toLowerCase())
    );
    const attributes = endpoint.atributos || endpoint.attributes || [];

    for (const attribute of attributes) {
      const attributeName = normalize(attribute);
      if (!attributeName) continue;
      if (!attributeNames.has(attributeName.toLowerCase())) {
        issues.push({
          code: 'atributo_inexistente',
          metodo,
          ruta,
          referencia: attributeName,
          message: `El atributo "${attributeName}" no existe en la entidad "${entityName}".`,
        });
      }
    }
  }

  return { consistent: issues.length === 0, issues };
}

/**
 * Nueva función orquestadora: Valida la consistencia global del proyecto completo 
 * (Arquitectura, Modelo de Datos, Endpoints/Spec y Pantallas) antes de la generación final.
 */
function validateProjectConsistency(projectData) {
  const errors = [];
  const warnings = [];

  if (!projectData) {
    return { valid: false, errors: ["No se encontraron datos del proyecto."], warnings };
  }

  const { architecture, dataModel, endpoints, spec, screens } = projectData;

  // 1. Verificar selección de Arquitectura
  if (!architecture || !architecture.selectedOption) {
    errors.push({
      code: 'arquitectura_faltante',
      message: "Falta seleccionar la arquitectura base del proyecto en la etapa correspondiente."
    });
  }

  // 2. Verificar Modelo de Datos
  if (!dataModel || !Array.isArray(dataModel.entities) || dataModel.entities.length === 0) {
    errors.push({
      code: 'modelo_vacio',
      message: "El modelo de datos está vacío o no contiene entidades definidas."
    });
  }

  // 3. Integrar la validación existente de endpoints (spec vs model)
  const effectiveSpec = spec || { endpoints: endpoints || [] };
  const effectiveModel = dataModel || { entities: [] };
  
  const specValidation = validateSpecConsistency(effectiveSpec, effectiveModel);
  if (!specValidation.consistent) {
    // Convertimos los issues del validador de spec en errores para el motor global
    specValidation.issues.forEach(issue => {
      errors.push(issue);
    });
  }

  // 4. Verificar Mapa de Pantallas (Frontend)
  if (!screens || !Array.isArray(screens.views) || screens.views.length === 0) {
    warnings.push({
      code: 'pantallas_vacias',
      message: "El mapa de pantallas del frontend no ha sido definido o está vacío."
    });
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

module.exports = { 
  validateSpecConsistency, 
  validateProjectConsistency 
};