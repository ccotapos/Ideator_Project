const { generateContent, buildGenerationConfig } = require('../config/geminiClient');

// La generación estructurada prioriza calidad: modelo completo con thinking
// apagado y un modelo "lite" como respaldo si el principal se satura.
const MODEL = process.env.GEMINI_STRUCTURED_MODEL || 'gemini-3.8-flash';
const FALLBACK_MODEL = process.env.GEMINI_STRUCTURED_FALLBACK_MODEL || 'gemini-3.5-flash-lite';

const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];

function normalizeItems(items) {
  return Array.isArray(items) ? items.filter((item) => item && typeof item === 'object') : [];
}

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

    const pathParameters = normalizeItems(endpoint.pathParameters);
    const queryParameters = normalizeItems(endpoint.queryParameters);
    const headers = normalizeItems(endpoint.headers);
    const validations = Array.isArray(endpoint.validations)
      ? endpoint.validations.map((item) => String(item).trim()).filter(Boolean)
      : [];
    const responses = normalizeItems(endpoint.responses).map((response) => ({
      status: Number.parseInt(String(response.status ?? response.statusCode ?? response.code), 10),
      description: String(response.description || '').trim(),
      schema: response.schema || null,
    })).filter((response) => Number.isInteger(response.status) && response.description);

    if (!responses.some((response) => response.status >= 200 && response.status < 300)) {
      throw new Error(`El endpoint ${key} debe documentar al menos una respuesta exitosa. Respuestas recibidas: ${JSON.stringify(endpoint.responses || [])}`);
    }
    if (!responses.some((response) => response.status >= 400)) {
      throw new Error(`El endpoint ${key} debe documentar al menos una respuesta de error.`);
    }

    endpoints.push({
      method,
      route,
      operation,
      entity,
      attributes,
      pathParameters,
      queryParameters,
      headers,
      requestBody: endpoint.requestBody || null,
      validations,
      responses,
    });
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
        text: 'Devuelve solo JSON. Diseña la API REST completa, no una muestra: incluye autenticación y todas las operaciones CRUD y de flujo necesarias; normalmente serán entre 8 y 20 endpoints y nunca debes resumir el sistema en una sola operación. Cada endpoint debe incluir method, route, operation, entity, attributes, pathParameters, queryParameters, headers, requestBody, validations y responses. Cada parámetro debe indicar name, type, required y description. requestBody debe indicar required, description y fields. Cada respuesta debe incluir status, description y schema. Incluye al menos una respuesta exitosa y una de error, distinguiendo 401 de 403 cuando corresponda.',
      }],
    },
    generationConfig: buildGenerationConfig({
      model: targetModel,
      maxOutputTokens: 8192,
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'OBJECT',
        required: ['endpoints'],
        properties: {
          endpoints: {
            type: 'ARRAY',
            minItems: 5,
            items: {
              type: 'OBJECT',
              required: ['method', 'route', 'operation', 'pathParameters', 'queryParameters', 'headers', 'validations', 'responses'],
              properties: {
                method: { type: 'STRING' },
                route: { type: 'STRING' },
                operation: { type: 'STRING' },
                entity: { type: 'STRING' },
                attributes: { type: 'ARRAY', items: { type: 'STRING' } },
                pathParameters: { type: 'ARRAY', items: { type: 'OBJECT', properties: { name: { type: 'STRING' }, type: { type: 'STRING' }, required: { type: 'BOOLEAN' }, description: { type: 'STRING' } } } },
                queryParameters: { type: 'ARRAY', items: { type: 'OBJECT', properties: { name: { type: 'STRING' }, type: { type: 'STRING' }, required: { type: 'BOOLEAN' }, description: { type: 'STRING' } } } },
                headers: { type: 'ARRAY', items: { type: 'OBJECT', properties: { name: { type: 'STRING' }, type: { type: 'STRING' }, required: { type: 'BOOLEAN' }, description: { type: 'STRING' } } } },
                requestBody: { type: 'OBJECT', properties: { required: { type: 'BOOLEAN' }, description: { type: 'STRING' }, fields: { type: 'ARRAY', items: { type: 'OBJECT', properties: { name: { type: 'STRING' }, type: { type: 'STRING' }, required: { type: 'BOOLEAN' }, description: { type: 'STRING' } } } } } },
                validations: { type: 'ARRAY', items: { type: 'STRING' } },
                responses: { type: 'ARRAY', items: { type: 'OBJECT', required: ['status', 'description'], properties: { status: { type: 'INTEGER' }, description: { type: 'STRING' }, schema: { type: 'STRING' } } } },
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
    fallback: { model: FALLBACK_MODEL, body: buildBody(FALLBACK_MODEL), timeoutMs: 60000, retries: 2 },
    timeoutMs: 45000,
    retries: 2,
  });

  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  return validateGeneratedSpec(JSON.parse(text));
}

module.exports = { generateEndpointSpec, validateGeneratedSpec, HTTP_METHODS };
