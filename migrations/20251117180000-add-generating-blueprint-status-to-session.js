'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    // Add new values to the ENUM type in PostgreSQL
    await queryInterface.sequelize.query("ALTER TYPE \"enum_study_sessions_status\" ADD VALUE 'generating_blueprint';");
    await queryInterface.sequelize.query("ALTER TYPE \"enum_study_sessions_status\" ADD VALUE 'generation_failed';");
  },

  async down (queryInterface, Sequelize) {
    // Removing ENUM values is a complex process in PostgreSQL that involves creating a new type and migrating data.
    // For this reason, this down migration is kept simple and will not remove the values.
    // A manual database intervention would be required to fully revert this change.
    await queryInterface.sequelize.query("SELECT 1;"); // Do nothing
  }
};
