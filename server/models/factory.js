const db = require('../db');

const cache = new Map();

/** Prepared statements are cached by SQL text. */
function stmt(sql) {
  let s = cache.get(sql);
  if (!s) {
    s = db.prepare(sql);
    cache.set(sql, s);
  }
  return s;
}

/**
 * Small table gateway. `columns` maps camelCase property names to column names.
 * Properties listed in `json` are stored as JSON text, those in `bool` as 0/1.
 */
function makeModel({ table, columns, json = [], bool = [] }) {
  const keys = Object.keys(columns);

  function fromRow(row) {
    if (!row) return null;
    const out = {};
    keys.forEach((k) => {
      let v = row[columns[k]];
      if (json.includes(k)) v = v === null || v === undefined ? null : JSON.parse(v);
      else if (bool.includes(k)) v = Boolean(v);
      out[k] = v;
    });
    return out;
  }

  function toDb(k, v) {
    if (v === undefined || v === null) return null;
    if (json.includes(k)) return JSON.stringify(v);
    if (bool.includes(k)) return v ? 1 : 0;
    return v;
  }

  function assertKnown(obj) {
    Object.keys(obj).forEach((k) => {
      if (!columns[k]) throw new Error(`Unknown column "${k}" for ${table}`);
    });
  }

  return {
    table,
    fromRow,
    all(orderBy = 'rowid') {
      return stmt(`SELECT * FROM ${table} ORDER BY ${orderBy}`).all().map(fromRow);
    },
    get(id) {
      return fromRow(stmt(`SELECT * FROM ${table} WHERE ${columns.id} = ?`).get(id));
    },
    where(clause, params = []) {
      return stmt(`SELECT * FROM ${table} WHERE ${clause}`).all(...params).map(fromRow);
    },
    count(clause = '1=1', params = []) {
      return stmt(`SELECT COUNT(*) AS c FROM ${table} WHERE ${clause}`).get(...params).c;
    },
    insert(obj) {
      assertKnown(obj);
      const used = Object.keys(obj).filter((k) => obj[k] !== undefined);
      const sql = `INSERT INTO ${table} (${used.map((k) => columns[k]).join(', ')}) VALUES (${used.map(() => '?').join(', ')})`;
      const info = stmt(sql).run(...used.map((k) => toDb(k, obj[k])));
      return info.lastInsertRowid;
    },
    update(id, patch) {
      assertKnown(patch);
      const used = Object.keys(patch).filter((k) => patch[k] !== undefined && k !== 'id');
      if (used.length === 0) return;
      const sql = `UPDATE ${table} SET ${used.map((k) => `${columns[k]} = ?`).join(', ')} WHERE ${columns.id} = ?`;
      stmt(sql).run(...used.map((k) => toDb(k, patch[k])), id);
    },
    remove(id) {
      return stmt(`DELETE FROM ${table} WHERE ${columns.id} = ?`).run(id).changes;
    },
  };
}

module.exports = { db, stmt, makeModel };
