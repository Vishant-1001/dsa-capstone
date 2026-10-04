const { stmt } = require('../models/factory');
const { missions, emergencies } = require('../models/operations');
const { runtime } = require('./runtime');
const mv = require('./movement');
const { notFound } = require('../utils/errors');

const SORTS = {
  id: 'm.id',
  severity: 'e.priority',
  ambulance: 'm.ambulance_id',
  hospital: 'h.name',
  responseTime: 'm.response_time',
  travelTime: 'm.travel_time',
  distance: 'm.total_distance',
  completedAt: 'm.completed_at',
  dispatchedAt: 'm.dispatched_at',
};

const SELECT = `SELECT m.*, e.type AS e_type, e.node_id AS e_node, e.required_equipment AS e_equipment,
  e.required_specialty AS e_specialty, n.name AS e_node_name, h.name AS h_name
  FROM missions m
  JOIN emergencies e ON e.id = m.emergency_id
  LEFT JOIN nodes n ON n.id = e.node_id
  LEFT JOIN hospitals h ON h.id = m.hospital_id`;

function shape(row) {
  return {
    ...missions.fromRow(row),
    emergencyType: row.e_type,
    locationNodeId: row.e_node,
    locationName: row.e_node_name,
    requiredEquipment: row.e_equipment,
    requiredSpecialty: row.e_specialty,
    hospitalName: row.h_name,
  };
}

function list({ search, severity, status, ambulanceId, hospitalId, sort, dir, limit } = {}) {
  const where = [];
  const params = [];
  if (status) {
    where.push('m.status = ?');
    params.push(status);
  }
  if (severity) {
    where.push('m.severity = ?');
    params.push(severity);
  }
  if (ambulanceId) {
    where.push('m.ambulance_id = ?');
    params.push(ambulanceId);
  }
  if (hospitalId) {
    where.push('m.hospital_id = ?');
    params.push(hospitalId);
  }
  if (search) {
    const like = `%${String(search).slice(0, 60)}%`;
    where.push('(m.id LIKE ? OR m.emergency_id LIKE ? OR m.ambulance_id LIKE ? OR h.name LIKE ? OR n.name LIKE ? OR e.type LIKE ?)');
    params.push(like, like, like, like, like, like);
  }
  const column = SORTS[sort] || SORTS.dispatchedAt;
  const direction = String(dir).toLowerCase() === 'asc' ? 'ASC' : 'DESC';
  const max = Math.min(Math.max(Number(limit) || 500, 1), 1000);
  const sql = `${SELECT}${where.length ? ` WHERE ${where.join(' AND ')}` : ''} ORDER BY ${column} ${direction}, m.id DESC LIMIT ${max}`;
  return stmt(sql).all(...params).map((row) => {
    const m = shape(row);
    delete m.selectionLog;
    delete m.hospitalLog;
    delete m.activeRoute;
    return m;
  });
}

function detail(id) {
  const row = stmt(`${SELECT} WHERE m.id = ?`).get(id);
  if (!row) throw notFound(`Mission ${id} not found`);
  const mission = shape(row);
  const movement = runtime.movements.get(mission.ambulanceId);
  return {
    ...mission,
    emergency: emergencies.get(mission.emergencyId),
    movement: movement && movement.missionId === id ? mv.describe(movement) : null,
  };
}

module.exports = { list, detail };
