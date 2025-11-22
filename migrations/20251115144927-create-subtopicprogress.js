"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("subtopic_progress", {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      subtopicId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        unique: true,
        references: {
          model: "subtopics",
          key: "id",
        },
      },
      currentStep: {
        type: Sequelize.ENUM(
          "not_started",
          "generating",
          "generating_introduction",
          "generating_understanding",
          "generating_mastering",
          "introduction",
          "understanding",
          "mastering",
          "completed",
          "error",
        ),
        defaultValue: "not_started",
      },
      introCompleted: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
      },
      understandingCompleted: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
      },
      masteringCompleted: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
      },
      startedAt: {
        type: Sequelize.DATE,
      },
      introCompletedAt: {
        type: Sequelize.DATE,
      },
      understandingCompletedAt: {
        type: Sequelize.DATE,
      },
      masteringCompletedAt: {
        type: Sequelize.DATE,
      },
      lastAccessed: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW,
      },
      learningSummary: {
        type: Sequelize.TEXT,
      },
      keyConcepts: {
        type: Sequelize.JSON,
        defaultValue: [],
      },
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable("subtopic_progress");
  },
};
