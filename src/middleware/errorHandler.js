exports.errorHandler = (err, req, res, next) => {
  console.error(err);
  const status = err && err.status ? err.status : 500;
  const message = err && err.message ? err.message : "Internal Server Error";
  res.status(status).json({ message });
};

exports.asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};
