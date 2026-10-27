const { SCENARIOS, getScenario, listScenarios } = require('./architectureScenarios');

const BASE_IDS = ['monolito-capas', 'api-rest-desacoplada', 'microservicios', 'serverless'];

describe('Arquitecturas base predefinidas', () => {
  test('existen las cuatro arquitecturas base (más el quinto escenario)', () => {
    expect(SCENARIOS.length).toBeGreaterThanOrEqual(5);
    BASE_IDS.forEach((id) => expect(getScenario(id)).not.toBeNull());
    expect(getScenario('event-driven')).not.toBeNull();
  });

  test.each(BASE_IDS)('%s define BD, backend, frontend y comunicación entre componentes', (id) => {
    const scenario = getScenario(id);

    expect(scenario.technologies.database).toBeTruthy();
    expect(scenario.technologies.backend).toBeTruthy();
    expect(scenario.technologies.frontend).toBeTruthy();
    expect(scenario.technologies.communication).toBeTruthy();
  });

  test.each(BASE_IDS)('%s incluye una justificación de cuándo es apropiada', (id) => {
    const scenario = getScenario(id);

    expect(typeof scenario.justification).toBe('string');
    expect(scenario.justification.length).toBeGreaterThan(40);
    expect(scenario.whenToUse.length).toBeGreaterThan(0);
  });

  test('el catálogo expone el stack completo y la justificación', () => {
    const scenario = listScenarios().find((item) => item.id === 'microservicios');

    expect(scenario.technologies.communication).toBeTruthy();
    expect(scenario.technologies.database).toBeTruthy();
    expect(scenario.justification).toBeTruthy();
  });

  test('el quinto escenario mantiene el mismo nivel de detalle operacional', () => {
    const scenario = getScenario('event-driven');

    expect(scenario.technologies.communication).toBeTruthy();
    expect(scenario.operational.docker).toBeTruthy();
    expect(scenario.operational.env).toBeTruthy();
    expect(scenario.operational.observability).toBeTruthy();
    expect(scenario.justification).toBeTruthy();
  });
});
