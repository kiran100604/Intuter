const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  class StudySummary extends Model {
    static associate(models) {
      StudySummary.belongsTo(models.StudySession, { foreignKey: 'sessionId', as: 'session' });
      StudySummary.belongsTo(models.Topic, { foreignKey: 'topicId', as: 'topic' });
      StudySummary.belongsTo(models.Subtopic, { foreignKey: 'subtopicId', as: 'subtopic' });
    }
  }
  StudySummary.init({
    sessionId: { type: DataTypes.INTEGER, allowNull: false },
    topicId: { type: DataTypes.INTEGER },
    subtopicId: { type: DataTypes.INTEGER },
    summaryText: { type: DataTypes.TEXT },
    keyPoints: { type: DataTypes.JSON, defaultValue: [] },
    // User's custom notes and additions
    userNotes: { type: DataTypes.TEXT },
    // Rich content resources (images, videos, links)
    userResources: {
      type: DataTypes.JSON,
      defaultValue: [],
      comment: 'Array of {type: "image"|"video"|"link", url: string, title: string, description: string}'
    },
    // Summary type for different use cases
    summaryType: {
      type: DataTypes.ENUM('topic', 'subtopic', 'conversation', 'custom'),
      defaultValue: 'subtopic'
    },
    // For conversation summaries
    originalCount: { type: DataTypes.INTEGER },
    createdAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    updatedAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
  }, {
    sequelize,
    modelName: 'StudySummary',
    tableName: 'study_summaries',
    timestamps: false,
    indexes: [{ fields: ['updatedAt'] }],
    defaultScope: { order: [['updatedAt', 'DESC']] }
  });
  return StudySummary;
};
