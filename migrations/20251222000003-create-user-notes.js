"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable("user_notes", {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
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
      title: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      blocks: {
        type: Sequelize.JSON,
        defaultValue: [],
      },
      tags: {
        type: Sequelize.JSON,
        defaultValue: [],
      },
      linkedConcepts: {
        type: Sequelize.JSON,
        defaultValue: [],
      },
      isStarred: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
      },
      color: {
        type: Sequelize.STRING,
        allowNull: true,
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
    await queryInterface.addIndex("user_notes", ["userId"]);
    await queryInterface.addIndex("user_notes", ["sessionId"]);
    await queryInterface.addIndex("user_notes", ["subtopicId"]);
    await queryInterface.addIndex("user_notes", ["isStarred"]);
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable("user_notes");
  },
};
