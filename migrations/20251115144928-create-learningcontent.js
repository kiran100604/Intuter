"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("learning_content", {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      subtopicId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "subtopics",
          key: "id",
        },
      },
      step: {
        type: Sequelize.ENUM("introduction", "understanding", "mastering"),
        allowNull: false,
      },
      content: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      contextUsed: {
        type: Sequelize.JSON,
        defaultValue: {},
      },
      referencedTopics: {
        type: Sequelize.JSON,
        defaultValue: [],
      },
      referencedSubtopics: {
        type: Sequelize.JSON,
        defaultValue: [],
      },
      generatedAt: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW,
      },
      regeneratedCount: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
      },
      generationTimeSeconds: {
        type: Sequelize.FLOAT,
      },
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable("learning_content");
  },
};
