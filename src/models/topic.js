const { Model, DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  class Topic extends Model {
    static associate(models) {
      Topic.belongsTo(models.StudySession, {
        foreignKey: "sessionId",
        targetKey: "sessionId",
        as: "session",
      });
      Topic.hasMany(models.Subtopic, {
        foreignKey: "topicId",
        as: "subtopics",
      });
      Topic.hasMany(models.StudySummary, {
        foreignKey: "topicId",
        as: "summaries",
      });
    }
  }
  Topic.init(
    {
      sessionId: { type: DataTypes.STRING, allowNull: false },
      name: { type: DataTypes.STRING, allowNull: false },
      order: { type: DataTypes.INTEGER, defaultValue: 0 },
      description: { type: DataTypes.TEXT },
      prerequisites: { type: DataTypes.JSON, defaultValue: [] },
      coreIntuition: { type: DataTypes.TEXT },
      intuitionGenerated: { type: DataTypes.BOOLEAN, defaultValue: false },
      difficultyLevel: {
        type: DataTypes.ENUM("beginner", "intermediate", "advanced"),
        defaultValue: "intermediate",
      },
      createdAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    },
    {
      sequelize,
      modelName: "Topic",
      tableName: "topics",
      timestamps: false,
      indexes: [{ fields: ["order"] }],
      defaultScope: { order: [["order", "ASC"]] },
      uniqueKeys: {
        unique_topic: {
          fields: ["sessionId", "name"],
        },
      },
    },
  );
  return Topic;
};
