const { validateGeneratedModel } = require('./dataModelGenerator');

describe('Generación del modelo físico', () => {
  test('acepta entidades con tipos, PK, FK y relaciones coherentes', () => {
    const model = validateGeneratedModel({
      entities: [
        { name: 'usuarios', attributes: [{ name: 'id', type: 'SERIAL', primaryKey: true, nullable: false }] },
        { name: 'proyectos', attributes: [
          { name: 'id', type: 'SERIAL', primaryKey: true, nullable: false },
          { name: 'owner_id', type: 'INTEGER REFERENCES usuarios(id)', primaryKey: false, nullable: false },
        ] },
      ],
      relationships: [{ name: 'crea', fromEntity: 'usuarios', toEntity: 'proyectos', fromCardinality: '1', toCardinality: 'N' }],
    });

    expect(model.entities).toHaveLength(2);
    expect(model.relationships[0].toEntity).toBe('proyectos');
  });

  test('rechaza un modelo sin llave primaria', () => {
    expect(() => validateGeneratedModel({
      entities: [
        { name: 'usuarios', attributes: [{ name: 'email', type: 'TEXT', primaryKey: false }] },
        { name: 'proyectos', attributes: [{ name: 'id', type: 'SERIAL', primaryKey: true }] },
      ],
      relationships: [],
    })).toThrow('no tiene llave primaria');
  });
});
