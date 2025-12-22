"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable("content_requests", {
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
      subtopicId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: "subtopics",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      userId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "users",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      requestType: {
        type: Sequelize.ENUM(
          "missing_concept",
          "need_example",
          "too_complex",
          "too_simple",
          "add_subtopic",
          "different_style",
          "add_diagram",
          "incorrect_content"
        ),
        allowNull: false,
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      preferredStyle: {
        type: Sequelize.ENUM(
          "first_principles",
          "example_driven",
          "step_by_step",
          "visual",
          "analogy_based"
        ),
        allowNull: true,
      },
      status: {
        type: Sequelize.ENUM(
          "pending",
          "processing",
          "integrated",
          "rejected"
        ),
        defaultValue: "pending",
      },
      aiGeneratedContent: {
        type: Sequelize.JSON,
        allowNull: true,
      },
      integratedIntoContentId: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      processingNotes: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      createdAt: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
      processedAt: {
        type: Sequelize.DATE,
        allowNull: true,
      },
    });

    // Add indexes
    await queryInterface.addIndex("content_requests", ["sessionId"]);
    await queryInterface.addIndex("content_requests", ["subtopicId"]);
    await queryInterface.addIndex("content_requests", ["userId"]);
    await queryInterface.addIndex("content_requests", ["status"]);
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable("content_requests");
  },
};
