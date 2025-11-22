"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("concept_maps", {
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
      subtopicId: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      conceptName: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      conceptExplanation: {
        type: Sequelize.TEXT,
      },
      importance: {
        type: Sequelize.ENUM("high", "medium", "low"),
        defaultValue: "medium",
      },
      learnedAt: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW,
      },
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable("concept_maps");
  },
};
