const { RevisionContent, Subtopic } = require("../models");
const { success, error } = require("../utils/response");
const { generateRevision, generatePracticeQuestion } = require("../services/ai/revisionGenerator");

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

exports.generatePracticeQuestion = async (req, res, next) => {
    try {
        const { subtopicId, revisionContent, userQuestion, userImage } = req.body;

        let contentToUse = revisionContent;
        let revisionRecord = null;

        if (subtopicId) {
            revisionRecord = await RevisionContent.findOne({ where: { subtopicId } });
            if (revisionRecord) {
                contentToUse = revisionRecord.content;
            }
        }

        if (!contentToUse) {
            // Fallback if provided in body but not in DB (edge case)
            contentToUse = revisionContent;
        }

        if (!contentToUse) {
            return error(res, "Revision content is required to generate practice questions", 400);
        }

        const questionData = await generatePracticeQuestion({
            revisionContent: contentToUse,
            userQuestion,
            userImage
        });

        // Save to DB if we have a record
        if (revisionRecord) {
            const currentQuestions = revisionRecord.practiceQuestions || [];
            // Add timestamp and ID to question if not present
            const questionWithMeta = {
                ...questionData,
                id: `pq-${Date.now()}`,
                createdAt: new Date()
            };

            // Append new question
            const updatedQuestions = [...currentQuestions, questionWithMeta];

            // Update record
            revisionRecord.practiceQuestions = updatedQuestions;
            // Explicitly mark as changed for JSON arrays in some Sequelize versions/dialects
            revisionRecord.changed('practiceQuestions', true);
            await revisionRecord.save();

            // Return the question with metadata
            return success(res, questionWithMeta, "Practice question generated and saved successfully");
        }

        return success(res, questionData, "Practice question generated successfully (not saved)");
    } catch (err) {
        next(err);
    }
};
