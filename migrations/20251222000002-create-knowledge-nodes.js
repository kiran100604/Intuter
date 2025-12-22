"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable("knowledge_nodes", {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      sessionId: {
        type: Sequelize.STRING,
        allowNull: false,
        references: {
          model: "study_sessions",
          key: "sessionId",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      tagId: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      nodeType: {
        type: Sequelize.ENUM("concept", "formula", "definition", "example", "tip"),
        allowNull: false,
      },
      name: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      explanation: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      formalDefinition: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      expression: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      sources: {
        type: Sequelize.JSON,
        defaultValue: [],
      },
      relatedNodes: {
        type: Sequelize.JSON,
        defaultValue: [],
      },
      prerequisites: {
        type: Sequelize.JSON,
        defaultValue: [],
      },
      usedIn: {
        type: Sequelize.JSON,
        defaultValue: [],
      },
      difficulty: {
        type: Sequelize.INTEGER,
        defaultValue: 1,
      },
      importance: {
        type: Sequelize.ENUM("core", "supporting", "advanced"),
        defaultValue: "supporting",
      },
      sourceSubtopicId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: "subtopics",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      masteryLevel: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
      },
      timesReferenced: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
      },
      createdAt: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
      updatedAt: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
    });

    // Add indexes
    await queryInterface.addIndex("knowledge_nodes", ["sessionId"]);
    await queryInterface.addIndex("knowledge_nodes", ["tagId"]);
    await queryInterface.addIndex("knowledge_nodes", ["nodeType"]);
    await queryInterface.addIndex("knowledge_nodes", ["sessionId", "tagId"], {
      unique: true,
    });
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable("knowledge_nodes");
  },
};
