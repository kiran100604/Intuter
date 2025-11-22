"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tables = [
      "study_materials",
      "concept_maps",
      "study_summaries",
      "user_questions",
      "context_cache",
    ];

    for (const table of tables) {
      // Change the column type to STRING
      await queryInterface.changeColumn(table, "sessionId", {
        type: Sequelize.STRING,
        allowNull: false,
      });

      // Add the new foreign key constraint referencing the correct column
      await queryInterface.addConstraint(table, {
        fields: ["sessionId"],
        type: "foreign key",
        name: `${table}_sessionId_fkey`,
        references: {
          table: "study_sessions",
          field: "sessionId",
        },
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      });
    }
  },

  down: async (queryInterface, Sequelize) => {
    const tables = [
      "study_materials",
      "concept_maps",
      "study_summaries",
      "user_questions",
      "context_cache",
    ];

    for (const table of tables) {
      // Change the column type back to INTEGER
      await queryInterface.changeColumn(table, "sessionId", {
        type: Sequelize.INTEGER,
        allowNull: false,
      });
    }
  },
};
