const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  class ConceptMap extends Model {
    static associate(models) {
      ConceptMap.belongsTo(models.StudySession, { foreignKey: 'sessionId', as: 'session' });
      ConceptMap.belongsTo(models.Subtopic, { foreignKey: 'subtopicId', as: 'subtopic' });
    }
  }
  ConceptMap.init({
    sessionId: { type: DataTypes.INTEGER, allowNull: false },
    subtopicId: { type: DataTypes.INTEGER, allowNull: false },
    conceptName: { type: DataTypes.STRING, allowNull: false },
    conceptExplanation: { type: DataTypes.TEXT },
    importance: { type: DataTypes.ENUM('high', 'medium', 'low'), defaultValue: 'medium' },
    learnedAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    // Source tracking for cross-mode connections
    sources: {
      type: DataTypes.JSON,
      defaultValue: [],
      comment: 'Array of {mode: "reading"|"learning"|"revision", reference: string, timestamp: Date}'
    },
    // Related concepts (knowledge graph edges)
    relatedConcepts: {
      type: DataTypes.JSON,
      defaultValue: [],
      comment: 'Array of concept names that are related'
    },
    // Tags for categorization in revision mode
    tags: {
      type: DataTypes.JSON,
      defaultValue: [],
      comment: 'Array of string tags'
    },
    // User's own explanation or mnemonic
    userExplanation: { type: DataTypes.TEXT },
    // Whether this concept has been mastered
    mastered: { type: DataTypes.BOOLEAN, defaultValue: false },
    // Last reviewed timestamp
    lastReviewed: { type: DataTypes.DATE },
    // Review count for spaced repetition
    reviewCount: { type: DataTypes.INTEGER, defaultValue: 0 }
  }, {
    sequelize,
    modelName: 'ConceptMap',
    tableName: 'concept_maps',
    timestamps: false,
    indexes: [
      { fields: ['learnedAt'] },
      { fields: ['importance'] },
      { fields: ['mastered'] }
    ],
    defaultScope: { order: [['learnedAt', 'DESC']] }
  });
  return ConceptMap;
};
