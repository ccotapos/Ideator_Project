async function recordActivity(queryable, { projectId, userId, action, details = {} }) {
  await queryable.query(
    `INSERT INTO actividad_proyecto (proyecto_id, usuario_id, accion, detalles)
     VALUES ($1, $2, $3, $4::jsonb);`,
    [projectId, userId, action, JSON.stringify(details)]
  );
}

module.exports = { recordActivity };
