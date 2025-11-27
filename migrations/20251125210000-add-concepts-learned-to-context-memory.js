'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.addColumn('context_memories', 'conceptsLearned', {
      type: Sequelize.JSON,
      defaultValue: [],
    });
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.removeColumn('context_memories', 'conceptsLearned');
  }
};
