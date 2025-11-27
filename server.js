const app = require("./src/app");
const db = require("./src/models");

const PORT = process.env.PORT || 5000;

// Add global error handlers BEFORE starting server
process.on("uncaughtException", (error) => {
  console.error("=== UNCAUGHT EXCEPTION ===");
  console.error("Error:", error.message);
  console.error("Stack:", error.stack);
  // Don't exit - keep server running
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("=== UNHANDLED REJECTION ===");
  console.error("Reason:", reason);
  if (reason && reason.stack) {
    console.error("Stack:", reason.stack);
  }
  // Don't exit - keep server running
});

(async () => {
  try {
    await db.sequelize.authenticate();
    console.log("Database connected!");

    const server = app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });

    // Handle server errors
    server.on("error", (error) => {
      console.error("Server error:", error);
    });
  } catch (err) {
    console.error("Unable to connect to the database:", err);
    process.exit(1);
  }
})();
