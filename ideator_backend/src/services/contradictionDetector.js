// Detecta contradicciones entre las etapas del proyecto antes de generar los
// documentos finales. Cada contradicción indica la etapa a corregir y la pestaña
// de la UI donde hacerlo.
function detectContradictions({
  definition,
  dataModel,
  endpointSpec,
  screenMap,
  architecture,
  blockingQuestions,
  consistency,
} = {}) {
  const contradictions = [];
  const push = (item) => contradictions.push({ severity: 'blocking', ...item });

  const sections = definition?.sections || [];
  const features = definition?.features || [];
  const journey = definition?.journey || [];

  (blockingQuestions || []).forEach((question) => {
    push({
      code: `pregunta_bloqueante_${question.id}`,
      stage: 'definicion',
      tab: 'revision',
      stages: ['definicion'],
      message: `Pregunta bloqueante sin resolver: ${question.pregunta}`,
      reference: question.categoria,
    });
  });

  if (sections.length === 0) {
    push({
      code: 'definicion_incompleta',
      stage: 'definicion',
      tab: 'revision',
      stages: ['definicion'],
      message: 'Falta la definición inicial (problema, contexto y usuarios objetivo).',
    });
  }
  if (features.length === 0) {
    push({
      code: 'mvp_faltante',
      stage: 'definicion',
      tab: 'revision',
      stages: ['definicion'],
      message: 'No hay funcionalidades del MVP definidas.',
    });
  }
  if (journey.length === 0) {
    push({
      code: 'recorrido_faltante',
      stage: 'definicion',
      tab: 'revision',
      stages: ['definicion'],
      message: 'No hay recorrido principal definido.',
    });
  }

  if (!dataModel) {
    push({
      code: 'modelo_faltante',
      stage: 'modelo',
      tab: 'modelo',
      stages: ['modelo'],
      message: 'No existe un modelo de datos generado.',
    });
  } else if (dataModel.estado !== 'approved') {
    push({
      code: 'modelo_no_aprobado',
      stage: 'modelo',
      tab: 'modelo',
      stages: ['modelo'],
      message: 'El modelo de datos no está aprobado.',
    });
  }

  if (!endpointSpec) {
    push({
      code: 'endpoints_faltantes',
      stage: 'endpoints',
      tab: 'endpoints',
      stages: ['endpoints'],
      message: 'No existe una especificación de endpoints.',
    });
  } else {
    if (endpointSpec.estado !== 'approved') {
      push({
        code: 'endpoints_no_aprobados',
        stage: 'endpoints',
        tab: 'endpoints',
        stages: ['endpoints'],
        message: 'La especificación de endpoints no está aprobada.',
      });
    }
    if (dataModel && endpointSpec.modeloId !== dataModel.id) {
      push({
        code: 'endpoints_desactualizados',
        stage: 'endpoints',
        tab: 'endpoints',
        stages: ['endpoints', 'modelo'],
        message: 'La especificación de endpoints no corresponde al modelo de datos aprobado actual; regenérala.',
      });
    }
    (consistency?.issues || []).forEach((issue) => {
      push({
        code: `consistencia_${issue.code}`,
        stage: 'endpoints',
        tab: 'endpoints',
        stages: ['endpoints', 'modelo'],
        message: `${issue.metodo || ''} ${issue.ruta || ''}: ${issue.message}`.trim(),
        reference: issue.referencia || null,
      });
    });
  }

  if (!screenMap) {
    push({
      code: 'mockups_faltantes',
      stage: 'mockups',
      tab: 'mockups',
      stages: ['mockups'],
      message: 'No existe un mapa de pantallas/mockups.',
    });
  } else if (
    endpointSpec?.updatedAt &&
    screenMap.updatedAt &&
    new Date(screenMap.updatedAt) < new Date(endpointSpec.updatedAt)
  ) {
    push({
      code: 'mockups_desactualizados',
      stage: 'mockups',
      tab: 'mockups',
      stages: ['mockups', 'endpoints'],
      message: 'Los mockups son anteriores a la última especificación de endpoints; regenéralos.',
    });
  }

  if (!architecture) {
    push({
      code: 'arquitectura_faltante',
      stage: 'arquitectura',
      tab: 'arquitectura',
      stages: ['arquitectura'],
      message: 'No existe una arquitectura recomendada.',
    });
  } else {
    if (architecture.estado !== 'approved') {
      push({
        code: 'arquitectura_no_aprobada',
        stage: 'arquitectura',
        tab: 'arquitectura',
        stages: ['arquitectura'],
        message: 'La arquitectura recomendada no está aprobada.',
      });
    }
    if (
      dataModel?.approvedAt &&
      architecture.createdAt &&
      new Date(architecture.createdAt) < new Date(dataModel.approvedAt)
    ) {
      push({
        code: 'arquitectura_desactualizada_modelo',
        stage: 'arquitectura',
        tab: 'arquitectura',
        stages: ['arquitectura', 'modelo'],
        message: 'La arquitectura es anterior a la aprobación del modelo de datos; vuelve a recomendarla.',
      });
    }
    if (
      endpointSpec?.updatedAt &&
      architecture.createdAt &&
      new Date(architecture.createdAt) < new Date(endpointSpec.updatedAt)
    ) {
      push({
        code: 'arquitectura_desactualizada_endpoints',
        stage: 'arquitectura',
        tab: 'arquitectura',
        stages: ['arquitectura', 'endpoints'],
        message: 'La arquitectura es anterior a la última especificación de endpoints; vuelve a recomendarla.',
      });
    }
  }

  return { hasContradictions: contradictions.length > 0, contradictions };
}

module.exports = { detectContradictions };
