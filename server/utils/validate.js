const { badRequest } = require('./errors');

function oneOf(value, list, name) {
  if (typeof value !== 'string' || !list.includes(value)) {
    throw badRequest(`${name} must be one of: ${list.join(', ')}`);
  }
  return value;
}

function text(value, name, { min = 1, max = 200, required = true } = {}) {
  if (value === undefined || value === null || value === '') {
    if (required) throw badRequest(`${name} is required`);
    return '';
  }
  if (typeof value !== 'string') throw badRequest(`${name} must be text`);
  const trimmed = value.trim();
  if (required && trimmed.length < min) throw badRequest(`${name} must be at least ${min} character${min === 1 ? '' : 's'}`);
  if (trimmed.length > max) throw badRequest(`${name} must be at most ${max} characters`);
  return trimmed;
}

function number(value, name, { min = -Infinity, max = Infinity, integer = false } = {}) {
  if (value === undefined || value === null || value === '' || typeof value === 'boolean') throw badRequest(`${name} is required`);
  const n = Number(value);
  if (!Number.isFinite(n)) throw badRequest(`${name} must be a number`);
  if (integer && !Number.isInteger(n)) throw badRequest(`${name} must be a whole number`);
  if (n < min) throw badRequest(`${name} must be at least ${min}`);
  if (n > max) throw badRequest(`${name} must be at most ${max}`);
  return n;
}

/** Entity ids: letters, digits, dash and underscore, 1 to 24 characters. */
function identifier(value, name) {
  const v = text(value, name, { max: 24 });
  if (!/^[A-Za-z0-9_-]+$/.test(v)) throw badRequest(`${name} may only contain letters, digits, dash and underscore`);
  return v;
}

module.exports = { oneOf, text, number, identifier };
