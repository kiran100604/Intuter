class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ValidationError';
    this.status = 400;
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
  AIGenerationError
};
