const { Model, DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  class StudySession extends Model {
    static associate(models) {
      StudySession.belongsTo(models.User, { foreignKey: "userId", as: "user" });
      StudySession.hasMany(models.StudyMaterial, {
        foreignKey: "sessionId",
        sourceKey: "sessionId",
        as: "materials",
      });
      StudySession.hasMany(models.Topic, {
        foreignKey: "sessionId",
        sourceKey: "sessionId",
        as: "topics",
      });
      StudySession.hasMany(models.ConceptMap, {
        foreignKey: "sessionId",
        sourceKey: "sessionId",
        as: "concepts",
      });
      StudySession.hasMany(models.StudySummary, {
        foreignKey: "sessionId",
        sourceKey: "sessionId",
        as: "summaries",
      });
      StudySession.hasMany(models.UserQuestion, {
        foreignKey: "sessionId",
        sourceKey: "sessionId",
        as: "questions",
      });
      StudySession.hasMany(models.ContextCache, {
        foreignKey: "sessionId",
        sourceKey: "sessionId",
        as: "context_cache",
      });
      StudySession.hasOne(models.ContextMemory, {
        foreignKey: "sessionId",
        sourceKey: "sessionId",
        as: "context_memory",
      });
    }
  }
  StudySession.init(
    {
      sessionId: { type: DataTypes.STRING, allowNull: false, unique: true },
      subjectName: { type: DataTypes.STRING, allowNull: false },
      goal: { type: DataTypes.TEXT, allowNull: false },
      courseOutlineFile: { type: DataTypes.STRING }, // store file path
      courseOutlineText: { type: DataTypes.TEXT },
      status: {
        type: DataTypes.ENUM(
          "setup",
          "active",
          "completed",
          "archived",
          "generating_blueprint",
          "generation_failed",
          "ready",
        ),
        defaultValue: "setup",
      },
      blueprintGenerated: { type: DataTypes.BOOLEAN, defaultValue: false },
      createdDate: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
      lastAccessed: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
      currentTopicId: { type: DataTypes.INTEGER, allowNull: true },
      currentSubtopicId: { type: DataTypes.INTEGER, allowNull: true },
      narrativeContext: { type: DataTypes.JSON, allowNull: true },
    },
    {
      sequelize,
      modelName: "StudySession",
      tableName: "study_sessions",
      timestamps: false,
      indexes: [{ fields: ["lastAccessed"] }],
      defaultScope: { order: [["lastAccessed", "DESC"]] },
    },
  );
  return StudySession;
};
