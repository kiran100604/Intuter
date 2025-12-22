const { Model, DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  class UserNote extends Model {
    static associate(models) {
      UserNote.belongsTo(models.User, {
        foreignKey: "userId",
        as: "user",
      });
      UserNote.belongsTo(models.StudySession, {
        foreignKey: "sessionId",
        targetKey: "sessionId",
        as: "session",
      });
      UserNote.belongsTo(models.Subtopic, {
        foreignKey: "subtopicId",
        as: "subtopic",
      });
    }
  }

  UserNote.init(
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      userId: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      sessionId: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      subtopicId: {
        type: DataTypes.INTEGER,
        allowNull: true, // null for session-level notes
      },
      title: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      blocks: {
        type: DataTypes.JSON,
        defaultValue: [],
        /*
         * Block structure:
         * {
         *   id: "uuid",
         *   type: "text" | "image" | "video" | "latex" | "code" | "diagram" | "link" | "highlight",
         *   content: "...",
         *   metadata: {
         *     caption: "",
         *     source: "",
         *     language: "", // for code blocks
         *     originalSource: { type: "learning", subtopicId: 1, section: "theory" } // where this was copied from
         *   },
         *   order: 0
         * }
         */
      },
      tags: {
        type: DataTypes.JSON,
        defaultValue: [],
        // Custom tags for organization: ["important", "review-later", "exam-topic"]
      },
      linkedConcepts: {
        type: DataTypes.JSON,
        defaultValue: [],
        // ["#concept-x", "#formula-y"] - knowledge nodes referenced in this note
      },
      isStarred: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
      color: {
        type: DataTypes.STRING,
        allowNull: true, // For visual organization
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
      modelName: "UserNote",
      tableName: "user_notes",
      timestamps: true,
      indexes: [
        { fields: ["userId"] },
        { fields: ["sessionId"] },
        { fields: ["subtopicId"] },
        { fields: ["isStarred"] },
      ],
    }
  );

  return UserNote;
};
