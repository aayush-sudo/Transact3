const errorHandler = (err, req, res, next) => {
  console.error('[Error Handler]', err);

  const statusCode = res.statusCode === 200 ? 500 : res.statusCode;

  res.status(statusCode).json({
    success: false,
    message: err.message || 'Server error during payment orchestration',
    requestId: req.requestId
  });
};

module.exports = { errorHandler };
