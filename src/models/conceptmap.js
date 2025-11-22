const { Model, DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  class ConceptMap extends Model {
    static associate(models) {
      ConceptMap.belongsTo(models.StudySession, {
        foreignKey: "sessionId",
        targetKey: "sessionId",
        as: "session",
      });
      ConceptMap.belongsTo(models.Subtopic, {
        foreignKey: "subtopicId",
        as: "subtopic",
      });
    }
  }
  ConceptMap.init(
    {
      sessionId: { type: DataTypes.STRING, allowNull: false },
      subtopicId: { type: DataTypes.INTEGER, allowNull: false },
      conceptName: { type: DataTypes.STRING, allowNull: false },
      conceptExplanation: { type: DataTypes.TEXT },
      importance: {
        type: DataTypes.ENUM("high", "medium", "low"),
        defaultValue: "medium",
      },
      learnedAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    },
    {
      sequelize,
      modelName: "ConceptMap",
      tableName: "concept_maps",
      timestamps: false,
      indexes: [{ fields: ["learnedAt"] }],
      defaultScope: { order: [["learnedAt", "DESC"]] },
    },
  );
  return ConceptMap;
};
