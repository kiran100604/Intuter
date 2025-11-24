"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.changeColumn("topics", "sessionId", {
      type: Sequelize.STRING,
      allowNull: false,
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.changeColumn("topics", "sessionId", {
      type: Sequelize.INTEGER,
      allowNull: false,
    });
  },
};
