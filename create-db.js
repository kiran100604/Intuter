const { Client } = require('pg');

const client = new Client({
  user: 'postgres',
  password: 'postgres',
  host: 'localhost',
  port: 5432,
  database: 'postgres', // connect to the default 'postgres' database
});

(async () => {
  try {
    await client.connect();
    await client.query('CREATE DATABASE anime_dev');
    console.log('Database "anime_dev" created successfully.');
    await client.end();
    process.exit(0);
  } catch (err) {
    if (err.code === '42P04') {
      console.log('Database "anime_dev" already exists.');
      await client.end();
      process.exit(0);
    }
    console.error('Error creating database:', err);
    process.exit(1);
  }
})();
