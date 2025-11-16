const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  class StudySession extends Model {
    static associate(models) {
      StudySession.belongsTo(models.User, { foreignKey: 'userId', as: 'user' });
      StudySession.hasMany(models.StudyMaterial, { foreignKey: 'sessionId', as: 'materials' });
      StudySession.hasMany(models.Topic, { foreignKey: 'sessionId', as: 'topics' });
      StudySession.hasMany(models.ConceptMap, { foreignKey: 'sessionId', as: 'concepts' });
      StudySession.hasMany(models.StudySummary, { foreignKey: 'sessionId', as: 'summaries' });
      StudySession.hasMany(models.UserQuestion, { foreignKey: 'sessionId', as: 'questions' });
      StudySession.hasMany(models.ContextCache, { foreignKey: 'sessionId', as: 'context_cache' });
    }
  }
  StudySession.init({
    sessionId: { type: DataTypes.STRING, allowNull: false, unique: true },
    subjectName: { type: DataTypes.STRING, allowNull: false },
    goal: { type: DataTypes.TEXT, allowNull: false },
    courseOutlineFile: { type: DataTypes.STRING }, // store file path
    courseOutlineText: { type: DataTypes.TEXT },
    status: { type: DataTypes.ENUM('setup', 'active', 'completed', 'archived'), defaultValue: 'setup' },
    blueprintGenerated: { type: DataTypes.BOOLEAN, defaultValue: false },
    createdDate: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    lastAccessed: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    currentTopicId: { type: DataTypes.INTEGER, allowNull: true },
    currentSubtopicId: { type: DataTypes.INTEGER, allowNull: true }
  }, {
    sequelize,
    modelName: 'StudySession',
    tableName: 'study_sessions',
    timestamps: false,
    indexes: [{ fields: ['lastAccessed'] }],
    defaultScope: { order: [['lastAccessed', 'DESC']] }
  });
  return StudySession;
};
