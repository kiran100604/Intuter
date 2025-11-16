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
    summaryText: { type: DataTypes.TEXT, allowNull: false },
    keyPoints: { type: DataTypes.JSON, defaultValue: [] },
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
