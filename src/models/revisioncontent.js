const { Model, DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  class RevisionContent extends Model {
    static associate(models) {
      RevisionContent.belongsTo(models.Subtopic, {
        foreignKey: "subtopicId",
        as: "subtopic",
      });
    }
  }
  RevisionContent.init(
    {
      subtopicId: { type: DataTypes.INTEGER, allowNull: false },
      content: { type: DataTypes.JSON, allowNull: false }, // Stores formulas, definitions, questions, tips
      generatedAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
      generationTimeSeconds: { type: DataTypes.FLOAT },
    },
    {
      sequelize,
      modelName: "RevisionContent",
      tableName: "revision_content",
      timestamps: false,
      indexes: [{ fields: ["subtopicId"] }],
    },
  );
  return RevisionContent;
};
