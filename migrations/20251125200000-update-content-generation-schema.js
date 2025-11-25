'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      // 1. Add narrativeContext to study_sessions
      await queryInterface.addColumn('study_sessions', 'narrativeContext', {
        type: Sequelize.JSON,
        allowNull: true,
      }, { transaction });

      // 2. Add narrativeRole and leadsTo to topics
      await queryInterface.addColumn('topics', 'narrativeRole', {
        type: Sequelize.TEXT,
        allowNull: true,
      }, { transaction });
      await queryInterface.addColumn('topics', 'leadsTo', {
        type: Sequelize.JSON,
        defaultValue: [],
      }, { transaction });

      // 3. Modify learning_content table
      // First, add the new columns
      await queryInterface.addColumn('learning_content', 'story', { type: Sequelize.TEXT, allowNull: true }, { transaction });
      await queryInterface.addColumn('learning_content', 'theory', { type: Sequelize.TEXT, allowNull: true }, { transaction });
      await queryInterface.addColumn('learning_content', 'summary', { type: Sequelize.TEXT, allowNull: true }, { transaction });
      await queryInterface.addColumn('learning_content', 'practice', { type: Sequelize.JSON, allowNull: true }, { transaction });
      await queryInterface.addColumn('learning_content', 'pedagogicalElements', { type: Sequelize.JSON, allowNull: true }, { transaction });

      // Copy data from 'content' to 'theory' where possible, assuming old structure
      await queryInterface.sequelize.query('UPDATE "learning_content" SET "theory" = "content"', { transaction });

      // Now, remove the old columns
      await queryInterface.removeColumn('learning_content', 'content', { transaction });
      await queryInterface.removeColumn('learning_content', 'step', { transaction });

      // 4. Create context_memories table
      await queryInterface.createTable('context_memories', {
        sessionId: {
          type: Sequelize.STRING,
          allowNull: false,
          primaryKey: true,
          references: { model: 'study_sessions', key: 'sessionId' },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE',
        },
        narrativeTimeline: { type: Sequelize.JSON, defaultValue: [] },
        terminologyMap: { type: Sequelize.JSON, defaultValue: {} },
        notationMap: { type: Sequelize.JSON, defaultValue: {} },
        runningExamples: { type: Sequelize.JSON, defaultValue: [] },
        lastUpdatedAt: { type: Sequelize.DATE, defaultValue: Sequelize.fn('now') },
      }, { transaction });

      await transaction.commit();
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  },

  async down (queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      // 1. Revert study_sessions
      await queryInterface.removeColumn('study_sessions', 'narrativeContext', { transaction });

      // 2. Revert topics
      await queryInterface.removeColumn('topics', 'narrativeRole', { transaction });
      await queryInterface.removeColumn('topics', 'leadsTo', { transaction });

      // 3. Revert learning_content table
      await queryInterface.addColumn('learning_content', 'step', { type: Sequelize.STRING, allowNull: false, defaultValue: 'understanding' }, { transaction });
      await queryInterface.addColumn('learning_content', 'content', { type: Sequelize.TEXT, allowNull: true }, { transaction });

      // Copy data back from 'theory' to 'content'
      await queryInterface.sequelize.query('UPDATE "learning_content" SET "content" = "theory"', { transaction });

      await queryInterface.removeColumn('learning_content', 'story', { transaction });
      await queryInterface.removeColumn('learning_content', 'theory', { transaction });
      await queryInterface.removeColumn('learning_content', 'summary', { transaction });
      await queryInterface.removeColumn('learning_content', 'practice', { transaction });
      await queryInterface.removeColumn('learning_content', 'pedagogicalElements', { transaction });

      // 4. Drop context_memories table
      await queryInterface.dropTable('context_memories', { transaction });

      await transaction.commit();
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  }
};
