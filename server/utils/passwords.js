const bcrypt = require('bcryptjs');

const ROUNDS = 10;

function hashPassword(plain) {
  return bcrypt.hashSync(String(plain), ROUNDS);
}

function verifyPassword(plain, hash) {
  try {
    return bcrypt.compareSync(String(plain), hash);
  } catch (err) {
    return false;
  }
}

module.exports = { hashPassword, verifyPassword };
