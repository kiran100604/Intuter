"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("study_materials", {
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
      title: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      file: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      fileType: {
        type: Sequelize.ENUM("pdf", "docx", "txt", "image"),
        allowNull: false,
      },
      extractedText: {
        type: Sequelize.TEXT,
      },
      uploadedAt: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW,
      },
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable("study_materials");
  },
};
