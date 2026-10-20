const { generateContent, buildGenerationConfig } = require('../config/geminiClient');

// La generación estructurada prioriza calidad: modelo completo con thinking
// apagado y un modelo "lite" como respaldo si el principal se satura.
const MODEL = process.env.GEMINI_STRUCTURED_MODEL || process.env.GEMINI_MODEL || 'gemini-3.8-flash';
const FALLBACK_MODEL = process.env.GEMINI_STRUCTURED_FALLBACK_MODEL || 'gemini-flash-lite-latest';

const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];

// Valida estructuralmente que cada endpoint indique método, ruta y operación.
// La coherencia con el modelo de datos se valida aparte (consistencyValidator).
function validateGeneratedSpec(spec) {
  if (!spec || !Array.isArray(spec.endpoints) || spec.endpoints.length === 0) {
    throw new Error('La IA no devolvió al menos un endpoint.');
  }

  const seen = new Set();
  const endpoints = [];

  for (const endpoint of spec.endpoints) {
    const method = String(endpoint.method || '').trim().toUpperCase();
    const route = String(endpoint.route || '').trim();
    const operation = String(endpoint.operation || '').trim();

    if (!method || !route || !operation) {
      throw new Error('Cada endpoint debe indicar método HTTP, ruta y operación.');
    }
    if (!HTTP_METHODS.includes(method)) {
      throw new Error(`El método HTTP ${method} no es válido.`);
    }
    if (!route.startsWith('/')) {
      throw new Error(`La ruta ${route} debe comenzar con "/".`);
    }

    const key = `${method} ${route}`;
    if (seen.has(key)) {
      throw new Error(`El endpoint ${key} está duplicado.`);
    }
    seen.add(key);

    const entity = endpoint.entity ? String(endpoint.entity).trim() : null;
    const attributes = Array.isArray(endpoint.attributes)
      ? endpoint.attributes.map((attribute) => String(attribute).trim()).filter(Boolean)
      : [];

    endpoints.push({ method, route, operation, entity, attributes });
  }

  return { endpoints };
}

// Envía el modelo aprobado y la definición del producto a Gemini y devuelve la
// especificación de endpoints validada.
async function generateEndpointSpec({ model, definition }) {
  const buildBody = (targetModel) => ({
    contents: [{
      role: 'user',
      parts: [{
        text: `Diseña la especificación de endpoints REST necesarios para implementar el producto, coherente con el modelo de datos aprobado.\nModelo de datos aprobado: ${JSON.stringify(model)}\nDefinición del producto: ${JSON.stringify(definition)}`,
      }],
    }],
    systemInstruction: {
      parts: [{
        text: 'Devuelve solo JSON. Cada endpoint debe incluir method (GET/POST/PUT/PATCH/DELETE), route (comenzando con "/"), operation (descripción breve de la acción), entity (nombre de la entidad del modelo aprobado sobre la que opera) y attributes (lista de nombres de atributos de esa entidad que el endpoint utiliza).',
      }],
    },
    generationConfig: buildGenerationConfig({
      model: targetModel,
      maxOutputTokens: 2048,
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'OBJECT',
        required: ['endpoints'],
        properties: {
          endpoints: {
            type: 'ARRAY',
            items: {
              type: 'OBJECT',
              required: ['method', 'route', 'operation'],
              properties: {
                method: { type: 'STRING' },
                route: { type: 'STRING' },
                operation: { type: 'STRING' },
                entity: { type: 'STRING' },
                attributes: { type: 'ARRAY', items: { type: 'STRING' } },
              },
            },
          },
        },
      },
    }),
  });

  const data = await generateContent({
    model: MODEL,
    body: buildBody(MODEL),
    fallback: { model: FALLBACK_MODEL, body: buildBody(FALLBACK_MODEL), timeoutMs: 30000, retries: 1 },
    timeoutMs: 20000,
    retries: 1,
  });

  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  return validateGeneratedSpec(JSON.parse(text));
}

module.exports = { generateEndpointSpec, validateGeneratedSpec, HTTP_METHODS };
