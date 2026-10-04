class HttpError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

const badRequest = (message, details) => new HttpError(400, 'VALIDATION_ERROR', message, details);
const unauthorized = (message = 'Authentication required') => new HttpError(401, 'UNAUTHORIZED', message);
const forbidden = (message = 'You do not have permission to do that') => new HttpError(403, 'FORBIDDEN', message);
const notFound = (message = 'Not found') => new HttpError(404, 'NOT_FOUND', message);
const conflict = (code, message, details) => new HttpError(409, code, message, details);

module.exports = { HttpError, badRequest, unauthorized, forbidden, notFound, conflict };
