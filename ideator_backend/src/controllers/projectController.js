const { validateProjectConsistency } = require('../services/consistencyValidator');

/**
 * Controlador de Proyectos
 * Maneja las peticiones HTTP relacionadas con las etapas y generación final del proyecto.
 */

/**
 * Endpoint para procesar la generación final del proyecto
 * Bloquea la ejecución si existen inconsistencias entre etapas.
 */
async function handleFinalGeneration(req, res) {
  try {
    const projectData = req.body;

    // 1. Ejecutar el motor de validación de consistencia entre etapas
    const validation = validateProjectConsistency(projectData);

    // 2. Bloquear la generación si la validación falla (errores críticos o campos faltantes)
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        message: 'La generación final ha sido bloqueada debido a inconsistencias o faltantes en las etapas anteriores.',
        errors: validation.errors,
        warnings: validation.warnings,
      });
    }

    // 3. Si es consistente, continuar con el proceso de generación
    return res.status(200).json({
      success: true,
      message: 'Validación de consistencia exitosa. Iniciando la generación del proyecto...',
      warnings: validation.warnings,
      data: {
        projectId: projectData.id || 'gen-' + Date.now(),
        status: 'GENERATING'
      }
    });

  } catch (error) {
    console.error('Error durante la generación del proyecto:', error);
    return res.status(500).json({
      success: false,
      message: 'Error interno del servidor al procesar la generación.',
    });
  }
}

module.exports = {
  handleFinalGeneration,
};