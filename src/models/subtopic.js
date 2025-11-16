const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  class Subtopic extends Model {
    static associate(models) {
      Subtopic.belongsTo(models.Topic, { foreignKey: 'topicId', as: 'topic' });
      Subtopic.hasOne(models.SubtopicProgress, { foreignKey: 'subtopicId', as: 'progress' });
      Subtopic.hasMany(models.StudySummary, { foreignKey: 'subtopicId', as: 'summary' });
      Subtopic.hasMany(models.ConceptMap, { foreignKey: 'subtopicId', as: 'concepts' });
      Subtopic.hasMany(models.LearningContent, { foreignKey: 'subtopicId', as: 'content' });
      Subtopic.hasMany(models.UserQuestion, { foreignKey: 'subtopicId', as: 'questions' });
    }
  }
  Subtopic.init({
    topicId: { type: DataTypes.INTEGER, allowNull: false },
    name: { type: DataTypes.STRING, allowNull: false },
    order: { type: DataTypes.INTEGER, defaultValue: 0 },
    description: { type: DataTypes.TEXT },
    estimatedDuration: { type: DataTypes.INTEGER, defaultValue: 30 },
    createdAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
  }, {
    sequelize,
    modelName: 'Subtopic',
    tableName: 'subtopics',
    timestamps: false,
    indexes: [{ fields: ['order'] }],
    uniqueKeys: {
      unique_subtopic: {
        fields: ['topicId', 'name']
      }
    }
  });
  return Subtopic;
};
