const { Model, DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  class UserQuestion extends Model {
    static associate(models) {
      UserQuestion.belongsTo(models.StudySession, {
        foreignKey: "sessionId",
        targetKey: "sessionId",
        as: "session",
      });
      UserQuestion.belongsTo(models.Subtopic, {
        foreignKey: "subtopicId",
        as: "subtopic",
      });
    }
  }
  UserQuestion.init(
    {
      sessionId: { type: DataTypes.STRING, allowNull: false },
      subtopicId: { type: DataTypes.INTEGER },
      question: { type: DataTypes.TEXT, allowNull: false },
      answer: { type: DataTypes.TEXT },
      contextTopics: { type: DataTypes.JSON, defaultValue: [] },
      askedAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
      helpful: { type: DataTypes.BOOLEAN },
    },
    {
      sequelize,
      modelName: "UserQuestion",
      tableName: "user_questions",
      timestamps: false,
      indexes: [{ fields: ["askedAt"] }],
      defaultScope: { order: [["askedAt", "DESC"]] },
    },
  );
  return UserQuestion;
};
