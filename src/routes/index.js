const express = require('express');
const authRoutes = require('./auth');
const sessionRoutes = require('./sessions');
const topicRoutes = require('./topics');
const learningRoutes = require('./learning');
const materialRoutes = require('./materials');
const questionRoutes = require('./questions');
const progressRoutes = require('./progress');
const contentRequestRoutes = require('./contentRequests');
const knowledgeRoutes = require('./knowledge');
const notesRoutes = require('./notes');

const router = express.Router();

router.use('/auth', authRoutes);
router.use('/sessions', sessionRoutes);
router.use('/topics', topicRoutes);
router.use('/learning', learningRoutes);
router.use('/materials', materialRoutes);
router.use('/questions', questionRoutes);
router.use('/progress', progressRoutes);
router.use('/revision', require('./revision'));
router.use('/content-requests', contentRequestRoutes);
router.use('/knowledge', knowledgeRoutes);
router.use('/notes', notesRoutes);

module.exports = router;
