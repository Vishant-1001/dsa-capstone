const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { users, settings, revokedTokens } = require('../models/system');
const { hashPassword, verifyPassword } = require('../utils/passwords');
const { unauthorized, badRequest } = require('../utils/errors');

const TOKEN_TTL = '8h';
// Compared against when the username is unknown so response time does not reveal valid usernames.
const DUMMY_HASH = hashPassword('not-a-real-password');

function publicUser(u) {
  return { id: u.id, username: u.username, fullName: u.fullName, role: u.role };
}

function login(username, password) {
  if (typeof username !== 'string' || typeof password !== 'string' || !username.trim() || !password) {
    throw badRequest('Username and password are required');
  }
  if (username.length > 64 || password.length > 128) throw unauthorized('Invalid username or password');

  const user = users.findByUsername(username.trim());
  const ok = verifyPassword(password, user ? user.passwordHash : DUMMY_HASH);
  if (!user || !ok || !user.isActive) throw unauthorized('Invalid username or password');

  const token = jwt.sign(
    { role: user.role, username: user.username },
    settings.jwtSecret(),
    { subject: String(user.id), expiresIn: TOKEN_TTL, jwtid: crypto.randomBytes(16).toString('hex') },
  );
  users.update(user.id, { lastLoginAt: new Date().toISOString() });
  return { token, user: publicUser(user) };
}

/** Returns { user, claims } for a valid, unrevoked token. */
function verify(token) {
  let claims;
  try {
    claims = jwt.verify(token, settings.jwtSecret(), { algorithms: ['HS256'] });
  } catch (err) {
    throw unauthorized('Session expired or invalid. Please sign in again.');
  }
  if (revokedTokens.isRevoked(claims.jti)) throw unauthorized('Session ended. Please sign in again.');
  const user = users.get(Number(claims.sub));
  if (!user || !user.isActive) throw unauthorized('Account is not available');
  return { user: publicUser(user), claims };
}

function logout(claims) {
  if (claims && claims.jti) revokedTokens.revoke(claims.jti, claims.exp);
}

function changePassword(userId, currentPassword, newPassword) {
  const user = users.get(userId);
  if (!user || typeof currentPassword !== 'string' || !verifyPassword(currentPassword, user.passwordHash)) {
    throw unauthorized('Current password is incorrect');
  }
  if (typeof newPassword !== 'string' || newPassword.length < 8 || newPassword.length > 128) {
    throw badRequest('New password must be 8 to 128 characters');
  }
  if (!/[A-Za-z]/.test(newPassword) || !/\d/.test(newPassword)) {
    throw badRequest('New password must contain at least one letter and one digit');
  }
  users.update(userId, { passwordHash: hashPassword(newPassword) });
}

module.exports = { login, verify, logout, changePassword, publicUser };
