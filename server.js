const app = require("./src/app");
const db = require("./src/models");

const PORT = process.env.PORT || 5000;

(async () => {
  try {
    await db.sequelize.authenticate();
    console.log("Database connected!");
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (err) {
    console.error("Unable to connect to the a database:", err);
    process.exit(1);
  }
})();
