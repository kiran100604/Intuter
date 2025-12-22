const { Model, DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  class KnowledgeNode extends Model {
    static associate(models) {
      KnowledgeNode.belongsTo(models.StudySession, {
        foreignKey: "sessionId",
        targetKey: "sessionId",
        as: "session",
      });
      KnowledgeNode.belongsTo(models.Subtopic, {
        foreignKey: "sourceSubtopicId",
        as: "sourceSubtopic",
      });
    }
  }

  KnowledgeNode.init(
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      sessionId: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      tagId: {
        type: DataTypes.STRING,
        allowNull: false, // e.g., "#concept-markov-property"
      },
      nodeType: {
        type: DataTypes.ENUM("concept", "formula", "definition", "example", "tip"),
        allowNull: false,
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      explanation: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      formalDefinition: {
        type: DataTypes.TEXT,
        allowNull: true, // For formulas/definitions
      },
      expression: {
        type: DataTypes.TEXT,
        allowNull: true, // LaTeX for formulas
      },
      sources: {
        type: DataTypes.JSON,
        defaultValue: [],
        // [{type: 'learning', subtopicId: 1}, {type: 'revision', subtopicId: 1}, {type: 'reading', materialId: 1, page: 5}]
      },
      relatedNodes: {
        type: DataTypes.JSON,
        defaultValue: [],
        // ["#concept-x", "#formula-y"]
      },
      prerequisites: {
        type: DataTypes.JSON,
        defaultValue: [],
        // ["#concept-a", "#concept-b"] - concepts needed to understand this
      },
      usedIn: {
        type: DataTypes.JSON,
        defaultValue: [],
        // ["#formula-x", "#example-y"] - where this concept is applied
      },
      difficulty: {
        type: DataTypes.INTEGER,
        defaultValue: 1, // 1-5 scale
      },
      importance: {
        type: DataTypes.ENUM("core", "supporting", "advanced"),
        defaultValue: "supporting",
      },
      sourceSubtopicId: {
        type: DataTypes.INTEGER,
        allowNull: true, // First subtopic where this was introduced
      },
      masteryLevel: {
        type: DataTypes.INTEGER,
        defaultValue: 0, // 0-100, tracks user's understanding
      },
      timesReferenced: {
        type: DataTypes.INTEGER,
        defaultValue: 0, // How often user clicks/views this
      },
      createdAt: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
      },
      updatedAt: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
      },
    },
    {
      sequelize,
      modelName: "KnowledgeNode",
      tableName: "knowledge_nodes",
      timestamps: true,
      indexes: [
        { fields: ["sessionId"] },
        { fields: ["tagId"] },
        { fields: ["nodeType"] },
        { unique: true, fields: ["sessionId", "tagId"] },
      ],
    }
  );

  return KnowledgeNode;
};
