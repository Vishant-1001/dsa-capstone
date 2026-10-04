const auth = require('../services/auth');
const { unauthorized, forbidden } = require('../utils/errors');

/** Reads the Bearer token, verifies it and attaches req.user and req.claims. */
function authenticate(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const match = /^Bearer (.+)$/.exec(header);
    if (!match) throw unauthorized();
    const { user, claims } = auth.verify(match[1]);
    req.user = user;
    req.claims = claims;
    next();
  } catch (err) {
    next(err);
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return next(unauthorized());
    if (!roles.includes(req.user.role)) return next(forbidden(`This action needs the ${roles.join(' or ')} role`));
    return next();
  };
}

module.exports = { authenticate, requireRole };
