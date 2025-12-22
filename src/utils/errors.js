class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ValidationError';
    this.status = 400;
  }
}

class NotFoundError extends Error {
  constructor(message) {
    super(message);
    this.name = 'NotFoundError';
    this.status = 404;
  }
}

class AIGenerationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'AIGenerationError';
    this.status = 500;
  }
}

module.exports = {
  ValidationError,
  NotFoundError,
  AIGenerationError
};
