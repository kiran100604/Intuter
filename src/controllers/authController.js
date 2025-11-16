const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { User, StudySession, Topic, Subtopic, SubtopicProgress } = require('../models');

exports.register = async (req, res, next) => {
  try {
    const { username, email, password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({ username, email, password: hashedPassword });
    res.status(201).json({ message: 'User registered', user: { id: user.id, username, email } });
  } catch (err) {
    next(err);
  }
};

exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ where: { email } });
    if (!user) return res.status(401).json({ message: 'Invalid credentials' });
    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ message: 'Invalid credentials' });
    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRE || '7d' });
    res.json({ token, user: { id: user.id, username: user.username, email: user.email } });
  } catch (err) {
    next(err);
  }
};

exports.getMe = async (req, res, next) => {
  try {
    const user = await User.findByPk(req.user.id, { attributes: ['id', 'username', 'email'] });
    if (!user) return res.status(404).json({ message: 'User not found' });
    // Get stats
    const totalSessions = await StudySession.count({ where: { userId: user.id } });
    // Completed topics: topics where all subtopics are completed
    const topics = await Topic.findAll({
      include: [{ model: Subtopic, as: 'subtopics' }],
      where: { sessionId: (await StudySession.findAll({ where: { userId: user.id }, attributes: ['id'] })).map(s => s.id) }
    });
    let completedTopics = 0;
    for (const topic of topics) {
      if (!topic.subtopics.length) continue;
      const subtopicIds = topic.subtopics.map(st => st.id);
      const progresses = await SubtopicProgress.findAll({ where: { subtopicId: subtopicIds } });
      if (progresses.length && progresses.every(p => p.currentStep === 'completed')) {
        completedTopics++;
      }
    }
    res.json({ user, stats: { totalSessions, completedTopics } });
  } catch (err) {
    next(err);
  }
};

exports.updateProfile = async (req, res, next) => {
  try {
    const { username, email } = req.body;
    if (!username && !email) return res.status(400).json({ message: 'Nothing to update' });
    // Check if email is taken
    if (email) {
      const existing = await User.findOne({ where: { email, id: { $ne: req.user.id } } });
      if (existing) return res.status(409).json({ message: 'Email already taken' });
    }
    await User.update({ username, email }, { where: { id: req.user.id } });
    const user = await User.findByPk(req.user.id, { attributes: ['id', 'username', 'email'] });
    res.json({ message: 'Profile updated', user });
  } catch (err) {
    next(err);
  }
};

exports.changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) return res.status(400).json({ message: 'Both current and new password required' });
    const user = await User.findByPk(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    const match = await bcrypt.compare(currentPassword, user.password);
    if (!match) return res.status(401).json({ message: 'Incorrect current password' });
    if (newPassword.length < 8) return res.status(400).json({ message: 'New password too short' });
    const hashed = await bcrypt.hash(newPassword, 10);
    user.password = hashed;
    await user.save();
    res.json({ message: 'Password changed' });
  } catch (err) {
    next(err);
  }
};

exports.logout = async (req, res) => {
  // For JWT, logout is handled client-side (token removal)
  res.json({ message: 'Logged out' });
};
