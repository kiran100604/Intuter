const { Model, DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  class SubtopicProgress extends Model {
    static associate(models) {
      SubtopicProgress.belongsTo(models.Subtopic, {
        foreignKey: "subtopicId",
        as: "subtopic",
      });
    }
  }
  SubtopicProgress.init(
    {
      subtopicId: { type: DataTypes.INTEGER, allowNull: false, unique: true },
      currentStep: {
        type: DataTypes.ENUM(
          "not_started",
          "generating",
          "generating_introduction",
          "generating_understanding",
          "generating_mastering",
          "introduction",
          "understanding",
          "mastering",
          "completed",
          "error",
        ),
        defaultValue: "not_started",
      },
      introCompleted: { type: DataTypes.BOOLEAN, defaultValue: false },
      understandingCompleted: { type: DataTypes.BOOLEAN, defaultValue: false },
      masteringCompleted: { type: DataTypes.BOOLEAN, defaultValue: false },
      startedAt: { type: DataTypes.DATE },
      introCompletedAt: { type: DataTypes.DATE },
      understandingCompletedAt: { type: DataTypes.DATE },
      masteringCompletedAt: { type: DataTypes.DATE },
      lastAccessed: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
      learningSummary: { type: DataTypes.TEXT },
      keyConcepts: { type: DataTypes.JSON, defaultValue: [] },
      error: { type: DataTypes.TEXT },
    },
    {
      sequelize,
      modelName: "SubtopicProgress",
      tableName: "subtopic_progress",
      timestamps: false,
    },
  );
  return SubtopicProgress;
};
