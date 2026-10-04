const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const defaultPath = path.join(__dirname, '..', 'database', 'rapidresq.db');
const dbPath = process.env.RAPIDRESQ_DB || defaultPath;

const db = new Database(dbPath);
if (dbPath !== ':memory:') db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.exec(fs.readFileSync(path.join(__dirname, '..', 'database', 'schema.sql'), 'utf8'));

module.exports = db;
