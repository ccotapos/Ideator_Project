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

module.exports = { validateSpecConsistency };
