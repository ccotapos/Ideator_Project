const { detectContradictions } = require('./contradictionDetector');

function baseContext() {
  return {
    definition: {
      sections: [{ seccion: 'problem', respuesta: 'Problema' }],
      features: [{ alcance: 'in', descripcion: 'Crear proyecto' }],
      journey: [{ descripcion: 'Abrir proyecto' }],
    },
    dataModel: { id: 20, estado: 'approved', approvedAt: '2026-01-02T00:00:00Z' },
    endpointSpec: { id: 40, estado: 'approved', modeloId: 20, updatedAt: '2026-01-03T00:00:00Z' },
    screenMap: { id: 60, updatedAt: '2026-01-04T00:00:00Z' },
    architecture: { id: 70, estado: 'approved', createdAt: '2026-01-05T00:00:00Z' },
    consistency: { issues: [] },
  };
}

describe('Detección de contradicciones entre etapas', () => {
  test('no reporta contradicciones cuando todas las etapas están completas y coherentes', () => {
    const result = detectContradictions(baseContext());

    expect(result.hasContradictions).toBe(false);
    expect(result.contradictions).toEqual([]);
  });

  test('reporta etapas faltantes con referencia a la etapa y pestaña a corregir', () => {
    const result = detectContradictions({
      definition: { sections: [], features: [], journey: [] },
      dataModel: null,
      endpointSpec: null,
      screenMap: null,
      architecture: null,
      consistency: { issues: [] },
    });

    expect(result.hasContradictions).toBe(true);
    const byCode = Object.fromEntries(result.contradictions.map((item) => [item.code, item]));

    expect(byCode.definicion_incompleta.tab).toBe('revision');
    expect(byCode.modelo_faltante.stages).toEqual(['modelo']);
    expect(byCode.endpoints_faltantes.tab).toBe('endpoints');
    expect(byCode.mockups_faltantes.tab).toBe('mockups');
    expect(byCode.arquitectura_faltante.tab).toBe('arquitectura');
  });

  test('detecta endpoints generados contra un modelo anterior', () => {
    const context = baseContext();
    context.endpointSpec.modeloId = 99;

    const contradiction = detectContradictions(context).contradictions.find(
      (item) => item.code === 'endpoints_desactualizados'
    );

    expect(contradiction).toBeTruthy();
    expect(contradiction.stages).toEqual(['endpoints', 'modelo']);
    expect(contradiction.tab).toBe('endpoints');
  });

  test('reporta las inconsistencias endpoint ↔ modelo con su referencia', () => {
    const context = baseContext();
    context.consistency = {
      issues: [{
        code: 'atributo_inexistente',
        metodo: 'POST',
        ruta: '/api/proyectos',
        message: 'El atributo "owner_email" no existe en la entidad "proyectos".',
        referencia: 'owner_email',
      }],
    };

    const contradiction = detectContradictions(context).contradictions.find(
      (item) => item.code === 'consistencia_atributo_inexistente'
    );

    expect(contradiction).toBeTruthy();
    expect(contradiction.reference).toBe('owner_email');
    expect(contradiction.stages).toEqual(['endpoints', 'modelo']);
    expect(contradiction.message).toContain('POST /api/proyectos');
  });

  test('detecta una arquitectura anterior a la aprobación del modelo', () => {
    const context = baseContext();
    context.architecture.createdAt = '2026-01-01T00:00:00Z';

    const contradiction = detectContradictions(context).contradictions.find(
      (item) => item.code === 'arquitectura_desactualizada_modelo'
    );

    expect(contradiction).toBeTruthy();
    expect(contradiction.stages).toEqual(['arquitectura', 'modelo']);
    expect(contradiction.tab).toBe('arquitectura');
  });
});
