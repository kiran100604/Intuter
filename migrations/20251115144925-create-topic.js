'use strict';

module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.createTable('topics', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      sessionId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'study_sessions',
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
      prerequisites: {
        type: Sequelize.JSON,
        defaultValue: []
      },
      coreIntuition: {
        type: Sequelize.TEXT
      },
      intuitionGenerated: {
        type: Sequelize.BOOLEAN,
        defaultValue: false
      },
      difficultyLevel: {
        type: Sequelize.ENUM('beginner', 'intermediate', 'advanced'),
        defaultValue: 'intermediate'
      },
      createdAt: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW
      }
    });

    await queryInterface.addIndex('topics', ['order']);
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.dropTable('topics');
  }
};
