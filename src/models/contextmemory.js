const { Model, DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  class ContextMemory extends Model {
    static associate(models) {
      ContextMemory.belongsTo(models.StudySession, {
        foreignKey: "sessionId",
        targetKey: "sessionId",
        as: "session",
      });
    }
  }
  ContextMemory.init(
    {
      sessionId: {
        type: DataTypes.STRING,
        allowNull: false,
        primaryKey: true,
        references: {
          model: "study_sessions",
          key: "sessionId",
        },
      },
      narrativeTimeline: {
        type: DataTypes.JSON,
        defaultValue: [],
        comment: "Chronological log of narrative beats and story elements.",
      },
      terminologyMap: {
        type: DataTypes.JSON,
        defaultValue: {},
        comment: "Glossary of terms and their specific definitions for this session.",
      },
      notationMap: {
        type: DataTypes.JSON,
        defaultValue: {},
        comment: "Map of mathematical or technical symbols to ensure consistency.",
      },
      runningExamples: {
        type: DataTypes.JSON,
        defaultValue: [],
        comment: "List of examples that can be evolved across multiple topics.",
      },
      lastUpdatedAt: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
      },
    },
    {
      sequelize,
      modelName: "ContextMemory",
      tableName: "context_memories",
      timestamps: false,
    },
  );

  // Hook to update the timestamp on every save
  ContextMemory.beforeUpdate((memory) => {
    memory.lastUpdatedAt = new Date();
  });

  ContextMemory.beforeCreate((memory) => {
    memory.lastUpdatedAt = new Date();
  });

  return ContextMemory;
};
