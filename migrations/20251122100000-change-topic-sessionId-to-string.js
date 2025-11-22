"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Change the column type to STRING
    await queryInterface.changeColumn("topics", "sessionId", {
      type: Sequelize.STRING,
      allowNull: false,
    });

    // Add the new foreign key constraint referencing the correct column
    await queryInterface.addConstraint("topics", {
      fields: ["sessionId"],
      type: "foreign key",
      name: "topics_sessionId_fkey", // you can choose a new name or reuse the old one
      references: {
        table: "study_sessions",
        field: "sessionId",
      },
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    });
  },

  down: async (queryInterface, Sequelize) => {
    // Remove the new foreign key constraint
    await queryInterface.removeConstraint("topics", "topics_sessionId_fkey");

    // Change the column type back to INTEGER
    // Note: This might fail if the sessionId values are not valid integers.
    await queryInterface.changeColumn("topics", "sessionId", {
      type: Sequelize.INTEGER,
      allowNull: false,
    });
  },
};
