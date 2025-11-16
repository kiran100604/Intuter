const rateLimit = require('express-rate-limit');

exports.aiRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  message: 'Too many AI requests'
});

exports.generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200
});
