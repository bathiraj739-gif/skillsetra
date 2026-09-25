function errorMiddleware(err, req, res, next) {
  console.error('Unhandled Error:', err);
  return res.status(500).json({
    success: false,
    message: 'Internal server error'
  });
}

module.exports = {
  errorMiddleware
};
