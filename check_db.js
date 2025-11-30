const db = require("./src/models");

async function check() {
    try {
        await db.sequelize.authenticate();
        const content = await db.RevisionContent.findOne({ where: { subtopicId: 272 } });
        if (content) {
            console.log("FOUND: Revision content exists for 272.");
            console.log(JSON.stringify(content.toJSON(), null, 2));
        } else {
            console.log("NOT FOUND: No revision content for 272.");
        }
    } catch (error) {
        console.error("Error:", error);
    } finally {
        await db.sequelize.close();
    }
}

check();
