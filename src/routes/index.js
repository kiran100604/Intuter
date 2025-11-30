const express = require('express');
const authRoutes = require('./auth');
const sessionRoutes = require('./sessions');
const topicRoutes = require('./topics');
const learningRoutes = require('./learning');
const materialRoutes = require('./materials');
const questionRoutes = require('./questions');
const progressRoutes = require('./progress');

const router = express.Router();

router.use('/auth', authRoutes);
router.use('/sessions', sessionRoutes);
router.use('/topics', topicRoutes);
router.use('/learning', learningRoutes);
router.use('/materials', materialRoutes);
router.use('/questions', questionRoutes);
router.use('/progress', progressRoutes);
router.use('/revision', require('./revision'));

module.exports = router;
