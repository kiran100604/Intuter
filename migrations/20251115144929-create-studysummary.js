"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("study_summaries", {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      sessionId: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      topicId: {
        type: Sequelize.INTEGER,
      },
      subtopicId: {
        type: Sequelize.INTEGER,
      },
      summaryText: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      keyPoints: {
        type: Sequelize.JSON,
        defaultValue: [],
      },
      createdAt: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW,
      },
      updatedAt: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW,
      },
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable("study_summaries");
  },
};
