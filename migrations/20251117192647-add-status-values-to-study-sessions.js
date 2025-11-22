'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // For PostgreSQL, we need to add new values to the existing enum
    await queryInterface.sequelize.query(`
      ALTER TYPE "enum_study_sessions_status" 
      ADD VALUE IF NOT EXISTS 'generating_blueprint';
    `);
    
    await queryInterface.sequelize.query(`
      ALTER TYPE "enum_study_sessions_status" 
      ADD VALUE IF NOT EXISTS 'generation_failed';
    `);
    
    await queryInterface.sequelize.query(`
      ALTER TYPE "enum_study_sessions_status" 
      ADD VALUE IF NOT EXISTS 'ready';
    `);
  },

  async down(queryInterface, Sequelize) {
    // Note: PostgreSQL doesn't support removing enum values directly
    console.log('Cannot remove enum values in PostgreSQL without recreating the type');
  }
};