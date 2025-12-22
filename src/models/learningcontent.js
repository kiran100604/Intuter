const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  class LearningContent extends Model {
    static associate(models) {
      LearningContent.belongsTo(models.Subtopic, { foreignKey: 'subtopicId', as: 'subtopic' });
    }
  }
  LearningContent.init({
    subtopicId: { type: DataTypes.INTEGER, allowNull: false },
    step: { type: DataTypes.ENUM('introduction', 'understanding', 'mastering'), allowNull: false },
    content: { type: DataTypes.TEXT, allowNull: false },
    contextUsed: { type: DataTypes.JSON, defaultValue: {} },
    referencedTopics: { type: DataTypes.JSON, defaultValue: [] },
    referencedSubtopics: { type: DataTypes.JSON, defaultValue: [] },
    generatedAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    regeneratedCount: { type: DataTypes.INTEGER, defaultValue: 0 },
    generationTimeSeconds: { type: DataTypes.FLOAT },
    // Track teaching style used for this content
    teachingStyle: {
      type: DataTypes.ENUM('first_principles', 'practical', 'academic', 'intuitive'),
      defaultValue: 'first_principles'
    },
    // History of user feedback that led to regenerations
    feedbackHistory: {
      type: DataTypes.JSON,
      defaultValue: [],
      comment: 'Array of {feedback: string, timestamp: Date}'
    },
    // Topics that were added by user request
    addedTopics: {
      type: DataTypes.JSON,
      defaultValue: [],
      comment: 'Array of {topic: string, timestamp: Date}'
    },
    // Diagram placeholders identified in content
    diagramPlaceholders: {
      type: DataTypes.JSON,
      defaultValue: [],
      comment: 'Array of {id: string, description: string, type: "graph"|"flowchart"|"diagram"}'
    }
  }, {
    sequelize,
    modelName: 'LearningContent',
    tableName: 'learning_content',
    timestamps: false,
    indexes: [{ fields: ['generatedAt'] }],
    uniqueKeys: {
      unique_content: {
        fields: ['subtopicId', 'step']
      }
    }
  });
  return LearningContent;
};
