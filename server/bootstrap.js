const db = require('./db');
const { ensureSeeded } = require('../database/seed');
const { load, persistClock } = require('./services/runtime');

/** Opens the database, seeds missing demo data and builds the in-memory structures. */
function bootstrap() {
  ensureSeeded(db);
  load();
}

module.exports = { bootstrap, persistClock };
