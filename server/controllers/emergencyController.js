const { stmt } = require('../models/factory');
const { emergencies } = require('../models/operations');
const dispatch = require('../services/dispatch');
const missionQuery = require('../services/missionQuery');
const { runtime, nodeName } = require('../services/runtime');
const { notFound } = require('../utils/errors');
const { SEVERITIES, EMERGENCY_STATUSES } = require('../constants');

function decorate(e) {
  return { ...e, locationName: nodeName(e.nodeId) };
}

exports.list = (req, res) => {
  const where = [];
  const params = [];
  const { status, severity, q } = req.query;
  if (status && EMERGENCY_STATUSES.includes(status)) {
    where.push('status = ?');
    params.push(status);
  } else if (status === 'ACTIVE') {
    where.push("status NOT IN ('COMPLETED', 'CANCELLED')");
  }
  if (severity && SEVERITIES.includes(severity)) {
    where.push('severity = ?');
    params.push(severity);
  }
  if (q) {
    const like = `%${String(q).slice(0, 60)}%`;
    where.push('(id LIKE ? OR type LIKE ? OR description LIKE ? OR assigned_ambulance_id LIKE ?)');
    params.push(like, like, like, like);
  }
  const sql = `SELECT * FROM emergencies${where.length ? ` WHERE ${where.join(' AND ')}` : ''} ORDER BY arrival_seq DESC LIMIT 500`;
  const rows = stmt(sql).all(...params).map(emergencies.fromRow).map(decorate);
  res.json({ emergencies: rows });
};

exports.get = (req, res) => {
  const e = emergencies.get(req.params.id);
  if (!e) throw notFound(`Emergency ${req.params.id} not found`);
  const mission = e.missionId ? missionQuery.detail(e.missionId) : null;
  res.json({ emergency: decorate(e), mission, queuePosition: e.status === 'PENDING' ? dispatch.queuePosition(e.id) : null });
};

exports.create = (req, res) => {
  const { emergency, merged } = dispatch.reportEmergency(req.body || {}, req.user);
  res.status(merged ? 200 : 201).json({
    emergency: decorate(emergency),
    merged,
    queuePosition: dispatch.queuePosition(emergency.id),
    queueSize: runtime.queue.size(),
  });
};

exports.update = (req, res) => {
  res.json({ emergency: decorate(dispatch.updateEmergency(req.params.id, req.body || {})) });
};

exports.remove = (req, res) => {
  const result = dispatch.cancelEmergency(req.params.id, req.user);
  res.json(result.deleted ? result : { emergency: decorate(result) });
};
