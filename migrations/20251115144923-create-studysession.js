'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    /**
     * Add altering commands here.
     *
     * Example:
     * await queryInterface.createTable('users', { id: Sequelize.INTEGER });
     */
    await queryInterface.createTable('study_sessions', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      userId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE'
      },
      sessionId: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true
      },
      subjectName: {
        type: Sequelize.STRING,
        allowNull: false
      },
      goal: {
        type: Sequelize.TEXT,
        allowNull: false
      },
      courseOutlineFile: {
        type: Sequelize.STRING
      },
      courseOutlineText: {
        type: Sequelize.TEXT
      },
      status: {
        type: Sequelize.ENUM('setup', 'active', 'completed', 'archived'),
        defaultValue: 'setup'
      },
      blueprintGenerated: {
        type: Sequelize.BOOLEAN,
        defaultValue: false
      },
      createdDate: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW
      },
      lastAccessed: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW
      },
      currentTopicId: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      currentSubtopicId: {
        type: Sequelize.INTEGER,
        allowNull: true
      }
    });
  },

  async down (queryInterface, Sequelize) {
    /**
     * Add reverting commands here.
     *
     * Example:
     * await queryInterface.dropTable('users');
     */
    await queryInterface.dropTable('study_sessions');
  }
};
