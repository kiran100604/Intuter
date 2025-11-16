const db = require('./src/models');

(async () => {
  try {
    await db.sequelize.sync({ alter: true });
    console.log('All tables created or updated!');
    process.exit(0);
  } catch (err) {
    console.error('Error syncing database:', err);
    process.exit(1);
  }
})();
