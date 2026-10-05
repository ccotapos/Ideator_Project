const MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

function validateGeneratedModel(model) {
  if (!model || !Array.isArray(model.entities) || model.entities.length < 2) {
    throw new Error('La IA no devolvió al menos dos entidades.');
  }
  const names = new Set();
  for (const entity of model.entities) {
    if (!entity.name?.trim() || names.has(entity.name.trim())) throw new Error('Las entidades deben tener nombres únicos.');
    names.add(entity.name.trim());
    if (!Array.isArray(entity.attributes) || !entity.attributes.some((attribute) => attribute.primaryKey)) {
      throw new Error(`La entidad ${entity.name} no tiene llave primaria.`);
    }
    for (const attribute of entity.attributes) {
      if (!attribute.name?.trim() || !attribute.type?.trim()) throw new Error('Todos los atributos requieren nombre y tipo.');
    }
  }
  for (const relation of model.relationships || []) {
    if (!names.has(relation.fromEntity) || !names.has(relation.toEntity)) {
      throw new Error('Una relación apunta a una entidad inexistente.');
    }
  }
  return { entities: model.entities, relationships: model.relationships || [] };
}

async function generateDataModel(definition) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY no está configurada.');

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: `Diseña el modelo físico PostgreSQL coherente con esta definición:\n${JSON.stringify(definition)}` }] }],
      systemInstruction: { parts: [{ text: 'Devuelve solo JSON. Usa nombres claros en snake_case, tipos PostgreSQL, llaves primarias y foráneas.' }] },
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'OBJECT',
          required: ['entities', 'relationships'],
          properties: {
            entities: { type: 'ARRAY', items: { type: 'OBJECT', required: ['name', 'attributes'], properties: {
              name: { type: 'STRING' }, description: { type: 'STRING' }, attributes: { type: 'ARRAY', items: {
                type: 'OBJECT', required: ['name', 'type', 'primaryKey', 'nullable'], properties: {
                  name: { type: 'STRING' }, type: { type: 'STRING' }, primaryKey: { type: 'BOOLEAN' }, nullable: { type: 'BOOLEAN' }
                }
              } }
            } } },
            relationships: { type: 'ARRAY', items: { type: 'OBJECT', required: ['name', 'fromEntity', 'toEntity', 'fromCardinality', 'toCardinality'], properties: {
              name: { type: 'STRING' }, fromEntity: { type: 'STRING' }, toEntity: { type: 'STRING' }, fromCardinality: { type: 'STRING' }, toCardinality: { type: 'STRING' }
            } } }
          }
        }
      }
    })
  });
  if (!response.ok) throw new Error('No se pudo generar el modelo con Gemini.');
  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  return validateGeneratedModel(JSON.parse(text));
}

module.exports = { generateDataModel, validateGeneratedModel };
