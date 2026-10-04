const { stmt } = require('../models/factory');
const missionQuery = require('./missionQuery');

/** Spreadsheet programs run cells that start with these characters as formulas. */
function cell(value) {
  if (value === null || value === undefined) return '';
  let s = String(value);
  if (/^[=+\-@\t\r]/.test(s) && Number.isNaN(Number(s))) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsv(header, rows) {
  return [header.join(',')].concat(rows.map((r) => r.map(cell).join(','))).join('\r\n') + '\r\n';
}

function missionsCsv() {
  const rows = missionQuery.list({ sort: 'dispatchedAt', dir: 'desc', limit: 1000 }).map((m) => [
    m.id, m.emergencyId, m.emergencyType, m.locationName, m.ambulanceId, m.hospitalName, m.severity, m.status,
    m.responseTime, m.travelTime, m.totalDistance, m.trafficDelay, m.rerouteCount, m.dispatchedAt, m.completedAt,
  ]);
  return toCsv(
    ['mission', 'emergency', 'type', 'location', 'ambulance', 'hospital', 'severity', 'status', 'response_min', 'travel_min', 'distance_km', 'traffic_delay_min', 'reroutes', 'dispatched_at', 'completed_at'],
    rows,
  );
}

function trafficEventsCsv() {
  const rows = stmt('SELECT * FROM traffic_events ORDER BY id').all().map((r) => [
    r.id, r.event_type, r.road_id, r.old_level, r.new_level, r.mission_id, r.eta_before, r.eta_after, r.details, r.created_by, r.created_at,
  ]);
  return toCsv(['id', 'type', 'road', 'old_level', 'new_level', 'mission', 'eta_before', 'eta_after', 'details', 'by', 'at'], rows);
}

module.exports = { missionsCsv, trafficEventsCsv, cell };
