const { HttpError } = require('../utils/errors');

function notFoundHandler(req, res) {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: `No route for ${req.method} ${req.originalUrl.split('?')[0]}` } });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: { code: err.code, message: err.message, details: err.details } });
  }
  if (err && err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: { code: 'INVALID_JSON', message: 'Request body is not valid JSON' } });
  }
  if (err && err.type === 'entity.too.large') {
    return res.status(413).json({ error: { code: 'TOO_LARGE', message: 'Request body is too large' } });
  }
  const isDb = err && typeof err.code === 'string' && err.code.startsWith('SQLITE');
  // eslint-disable-next-line no-console
  console.error(`[error] ${req.method} ${req.originalUrl}:`, err && err.stack ? err.stack : err);
  return res.status(500).json({
    error: {
      code: isDb ? 'DATABASE_ERROR' : 'INTERNAL_ERROR',
      message: isDb ? 'The database could not complete the request. Please try again.' : 'Something went wrong on the server.',
    },
  });
}

module.exports = { notFoundHandler, errorHandler };
