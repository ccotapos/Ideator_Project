const BLOCKING_CATEGORIES = ['data_model', 'backend', 'interface', 'architecture'];

function evaluateQuestion(question) {
    const isBlocking = BLOCKING_CATEGORIES.includes(question.category);
    return {
        ...question,
        isBlocking
    };
}

function canCloseStage(questions) {
    const evaluatedQuestions = questions.map(evaluateQuestion);
    const hasUnresolvedBlocking = evaluatedQuestions.some(q => q.isBlocking && !q.isResolved);

    if (hasUnresolvedBlocking) {
        return {
            allowed: false,
            message: 'No es posible cerrar la etapa: existen preguntas bloqueantes sin resolver.'
        };
    }

    return {
        allowed: true,
        message: 'Etapa lista para cerrarse.'
    };
}

module.exports = {
    evaluateQuestion,
    canCloseStage,
    BLOCKING_CATEGORIES
};