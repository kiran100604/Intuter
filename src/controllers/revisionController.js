const { RevisionContent, Subtopic } = require("../models");
const { success, error } = require("../utils/response");
const { generateRevision } = require("../services/ai/revisionGenerator");

exports.generateRevision = async (req, res, next) => {
    try {
        const { subtopicId } = req.body;
        if (!subtopicId) return error(res, "subtopicId is required", 400);

        // Check if subtopic exists
        const subtopic = await Subtopic.findByPk(subtopicId);
        if (!subtopic) return error(res, "Subtopic not found", 404);

        // Trigger generation
        // Note: For simplicity, we're doing this inline for now. 
        // If it takes too long, we might need a background job similar to learning content.
        // Given revision is shorter, it might be fast enough.
        const content = await generateRevision({ subtopicId });

        return success(res, { content }, "Revision content generated successfully");
    } catch (err) {
        next(err);
    }
};

exports.getRevision = async (req, res, next) => {
    try {
        const { subtopicId } = req.params;
        if (!subtopicId) return error(res, "subtopicId is required", 400);

        const content = await RevisionContent.findOne({ where: { subtopicId } });

        if (!content) return error(res, "Revision content not found", 404);

        return success(res, { content }, "Revision content fetched successfully");
    } catch (err) {
        next(err);
    }
};
