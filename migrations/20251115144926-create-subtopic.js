'use strict';

module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.createTable('subtopics', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      topicId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'topics',
          key: 'id'
        }
      },
      name: {
        type: Sequelize.STRING,
        allowNull: false
      },
      'order': {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      description: {
        type: Sequelize.TEXT
      },
      estimatedDuration: {
        type: Sequelize.INTEGER,
        defaultValue: 30
      },
      createdAt: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW
      }
    });

    await queryInterface.addIndex('subtopics', ['order']);
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.dropTable('subtopics');
  }
};
