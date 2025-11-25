const { Model, DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  class LearningContent extends Model {
    static associate(models) {
      LearningContent.belongsTo(models.Subtopic, {
        foreignKey: "subtopicId",
        as: "subtopic",
      });
    }
  }
  LearningContent.init(
    {
      subtopicId: { type: DataTypes.INTEGER, allowNull: false },
      story: { type: DataTypes.TEXT, allowNull: true },
      theory: { type: DataTypes.TEXT, allowNull: true },
      practice: { type: DataTypes.JSON, allowNull: true },
      summary: { type: DataTypes.TEXT, allowNull: true },
      pedagogicalElements: { type: DataTypes.JSON, allowNull: true },
      contextUsed: { type: DataTypes.JSON, defaultValue: {} },
      referencedTopics: { type: DataTypes.JSON, defaultValue: [] },
      referencedSubtopics: { type: DataTypes.JSON, defaultValue: [] },
      generatedAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
      regeneratedCount: { type: DataTypes.INTEGER, defaultValue: 0 },
      generationTimeSeconds: { type: DataTypes.FLOAT },
    },
    {
      sequelize,
      modelName: "LearningContent",
      tableName: "learning_content",
      timestamps: false,
      indexes: [{ fields: ["generatedAt"] }],
      uniqueKeys: {
        unique_content: {
          fields: ["subtopicId", "step"],
        },
      },
    },
  );
  return LearningContent;
};
