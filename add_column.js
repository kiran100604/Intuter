const db = require("./src/models");

(async () => {
    try {
        await db.sequelize.getQueryInterface().addColumn('revision_content', 'practiceQuestions', {
            type: db.Sequelize.JSON,
            defaultValue: []
        });
        console.log("Column added successfully");
    } catch (error) {
        console.error("Error adding column:", error);
    } finally {
        await db.sequelize.close();
    }
})();
