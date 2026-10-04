const crypto = require('crypto');
const { db, stmt, makeModel } = require('./factory');

const users = makeModel({
  table: 'users',
  columns: {
    id: 'id',
    username: 'username',
    fullName: 'full_name',
    passwordHash: 'password_hash',
    role: 'role',
    isActive: 'is_active',
    createdAt: 'created_at',
    lastLoginAt: 'last_login_at',
  },
  bool: ['isActive'],
});

users.findByUsername = (username) => users.fromRow(stmt('SELECT * FROM users WHERE username = ?').get(String(username)));

const settings = {
  get(key, fallback = null) {
    const row = stmt('SELECT value FROM settings WHERE key = ?').get(key);
    return row ? row.value : fallback;
  },
  set(key, value) {
    stmt('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, String(value));
  },
  /** Increments and returns a counter; used for emergency, mission and arrival numbers. */
  nextSeq(key) {
    const run = db.transaction(() => {
      const next = Number(settings.get(key, '0')) + 1;
      settings.set(key, next);
      return next;
    });
    return run();
  },
  /** Signing secret for session tokens: environment first, otherwise generated once and stored. */
  jwtSecret() {
    if (process.env.JWT_SECRET) return process.env.JWT_SECRET;
    let secret = settings.get('jwt_secret');
    if (!secret) {
      secret = crypto.randomBytes(48).toString('hex');
      settings.set('jwt_secret', secret);
    }
    return secret;
  },
};

const contacts = makeModel({
  table: 'contacts',
  columns: {
    id: 'id',
    kind: 'kind',
    name: 'name',
    phone: 'phone',
    altPhone: 'alt_phone',
    hospitalId: 'hospital_id',
    address: 'address',
    website: 'website',
    notes: 'notes',
    source: 'source',
    updatedAt: 'updated_at',
  },
});

const revokedTokens = {
  revoke(jti, expiresAtSeconds) {
    stmt('INSERT OR REPLACE INTO revoked_tokens (jti, expires_at) VALUES (?, ?)').run(jti, expiresAtSeconds);
    stmt('DELETE FROM revoked_tokens WHERE expires_at < ?').run(Math.floor(Date.now() / 1000));
  },
  isRevoked(jti) {
    return Boolean(stmt('SELECT 1 FROM revoked_tokens WHERE jti = ?').get(jti));
  },
};

module.exports = { users, settings, revokedTokens, contacts };
