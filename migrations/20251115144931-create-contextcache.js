"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("context_cache", {
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
      cacheKey: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      cachedData: {
        type: Sequelize.JSON,
        allowNull: false,
      },
      createdAt: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW,
      },
      expiresAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable("context_cache");
  },
};
