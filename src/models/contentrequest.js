const { Model, DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  class ContentRequest extends Model {
    static associate(models) {
      ContentRequest.belongsTo(models.StudySession, {
        foreignKey: "sessionId",
        targetKey: "sessionId",
        as: "session",
      });
      ContentRequest.belongsTo(models.Subtopic, {
        foreignKey: "subtopicId",
        as: "subtopic",
      });
      ContentRequest.belongsTo(models.User, {
        foreignKey: "userId",
        as: "user",
      });
    }
  }

  ContentRequest.init(
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
      subtopicId: {
        type: DataTypes.INTEGER,
        allowNull: true, // null for new topic/subtopic requests
      },
      userId: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      requestType: {
        type: DataTypes.ENUM(
          "missing_concept",    // Something is not covered
          "need_example",       // Need more examples
          "too_complex",        // Needs simpler explanation
          "too_simple",         // Needs more depth
          "add_subtopic",       // Request new subtopic
          "different_style",    // Explain in different teaching style
          "add_diagram",        // Need visual explanation
          "incorrect_content"   // Something is wrong
        ),
        allowNull: false,
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      preferredStyle: {
        type: DataTypes.ENUM(
          "first_principles",   // Build from fundamentals
          "example_driven",     // Learn through examples
          "step_by_step",       // Procedural approach
          "visual",             // Diagram/visual focus
          "analogy_based"       // Use real-world analogies
        ),
        allowNull: true,
      },
      status: {
        type: DataTypes.ENUM(
          "pending",
          "processing",
          "integrated",
          "rejected"
        ),
        defaultValue: "pending",
      },
      aiGeneratedContent: {
        type: DataTypes.JSON,
        allowNull: true, // AI response when processed
      },
      integratedIntoContentId: {
        type: DataTypes.INTEGER,
        allowNull: true, // Reference to updated LearningContent
      },
      processingNotes: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      createdAt: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
      },
      processedAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: "ContentRequest",
      tableName: "content_requests",
      timestamps: false,
      indexes: [
        { fields: ["sessionId"] },
        { fields: ["subtopicId"] },
        { fields: ["userId"] },
        { fields: ["status"] },
      ],
    }
  );

  return ContentRequest;
};
