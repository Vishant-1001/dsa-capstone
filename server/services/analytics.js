const { stmt } = require('../models/factory');
const { emergencies, missions } = require('../models/operations');
const { runtime } = require('./runtime');
const { SEVERITIES, EMERGENCY_TYPES, TURNOUT_MINUTES } = require('../constants');

const round2 = (n) => (n === null || n === undefined ? null : Math.round(n * 100) / 100);

/** Headline numbers for the dashboard, all read from the database or live state. */
function kpis() {
  const ambulances = runtime.ambulances.values();
  const hospitals = runtime.hospitals.values();
  const openHospitals = hospitals.filter((h) => h.status === 'OPEN');
  const avg = stmt("SELECT AVG(response_time) AS a FROM missions WHERE status = 'COMPLETED' AND response_time IS NOT NULL").get().a;
  return {
    totalEmergencies: emergencies.count(),
    criticalActive: runtime.emergencies.values().filter((e) => e.severity === 'CRITICAL').length,
    criticalTotal: emergencies.count("severity = 'CRITICAL'"),
    pendingEmergencies: runtime.queue.size(),
    activeEmergencies: runtime.emergencies.size(),
    availableAmbulances: ambulances.filter((a) => a.status === 'AVAILABLE').length,
    busyAmbulances: ambulances.filter((a) => a.status !== 'AVAILABLE' && a.status !== 'OFFLINE').length,
    offlineAmbulances: ambulances.filter((a) => a.status === 'OFFLINE').length,
    totalAmbulances: ambulances.length,
    availableBeds: openHospitals.reduce((s, h) => s + h.availableBeds, 0),
    totalBeds: hospitals.reduce((s, h) => s + h.totalBeds, 0),
    openHospitals: openHospitals.length,
    totalHospitals: hospitals.length,
    activeMissions: runtime.missions.size(),
    completedMissions: missions.count("status = 'COMPLETED'"),
    avgResponseTime: round2(avg),
    closedRoads: runtime.graph.allEdges().filter((e) => e.isClosed).length,
    totalRoads: runtime.graph.edgeCount(),
  };
}

/** Warnings derived from the current state, not stored. */
function alerts() {
  const out = [];
  const { selectAmbulance } = require('../algorithms/ambulanceSelection');
  const ambulances = runtime.ambulances.values();

  runtime.movements.values().filter((m) => m.blocked).forEach((m) => {
    out.push({ level: 'critical', title: 'Destination unreachable', message: `${m.ambulanceId} cannot reach its destination and is holding position.` });
  });
  runtime.movements.values().filter((m) => m.awaitHospital).forEach((m) => {
    out.push({ level: 'critical', title: 'No hospital available', message: `${m.ambulanceId} is waiting for a hospital that can accept the patient.` });
  });

  runtime.queue.toSortedArray().slice(0, 8).forEach((e) => {
    const sel = selectAmbulance(runtime.graph, ambulances, e);
    if (!sel.selected) out.push({ level: 'warning', title: `${e.id} cannot be dispatched`, message: sel.explanation });
  });

  runtime.hospitals.values().sort((a, b) => (a.id < b.id ? -1 : 1)).forEach((h) => {
    if (h.status === 'CLOSED') out.push({ level: 'warning', title: `${h.name} is closed`, message: 'Closed hospitals are excluded from hospital selection.' });
    else if (h.availableBeds === 0) out.push({ level: 'warning', title: `${h.name} is full`, message: 'No available beds.' });
    else if (h.availableBeds <= 2) out.push({ level: 'info', title: `${h.name} is nearly full`, message: `${h.availableBeds} bed${h.availableBeds === 1 ? '' : 's'} left.` });
  });

  const offline = ambulances.filter((a) => a.status === 'OFFLINE');
  if (offline.length) out.push({ level: 'info', title: 'Ambulances offline', message: offline.map((a) => a.id).sort().join(', ') });

  const closed = runtime.graph.allEdges().filter((e) => e.isClosed);
  if (closed.length) out.push({ level: 'warning', title: `${closed.length} road${closed.length === 1 ? '' : 's'} closed`, message: closed.map((e) => e.id).sort().join(', ') });

  const severe = runtime.graph.allEdges().filter((e) => !e.isClosed && (e.trafficLevel === 'SEVERE' || e.trafficLevel === 'HIGH'));
  if (severe.length) out.push({ level: 'info', title: 'Heavy traffic', message: `${severe.length} road${severe.length === 1 ? '' : 's'} at HIGH or SEVERE traffic.` });

  return out;
}

function fullAnalytics() {
  const sevCounts = {};
  stmt('SELECT severity, COUNT(*) AS c FROM emergencies GROUP BY severity').all().forEach((r) => { sevCounts[r.severity] = r.c; });
  const typeCounts = {};
  stmt('SELECT type, COUNT(*) AS c FROM emergencies GROUP BY type').all().forEach((r) => { typeCounts[r.type] = r.c; });

  const responseBySeverity = SEVERITIES.map((severity) => {
    const row = stmt("SELECT AVG(response_time) AS a, COUNT(*) AS c FROM missions WHERE status = 'COMPLETED' AND severity = ? AND response_time IS NOT NULL").get(severity);
    return { severity, avgResponse: round2(row.a), missions: row.c };
  });

  const trend = stmt(`SELECT id, response_time, travel_time FROM missions WHERE status = 'COMPLETED'
    ORDER BY completed_at DESC LIMIT 20`).all().reverse().map((r) => ({
    mission: r.id,
    responseTime: round2(r.response_time),
    travelTime: round2(r.travel_time),
  }));

  const clock = Math.max(runtime.simClock, 0.0001);
  const utilization = runtime.ambulances.values().sort((a, b) => (a.id < b.id ? -1 : 1)).map((a) => {
    const row = stmt("SELECT COUNT(*) AS c, COALESCE(SUM(travel_time), 0) AS t, COALESCE(SUM(total_distance), 0) AS d FROM missions WHERE ambulance_id = ? AND status = 'COMPLETED'").get(a.id);
    return {
      id: a.id,
      equipment: a.equipment,
      missions: row.c,
      busyMinutes: round2(row.t),
      distance: round2(row.d),
      utilization: Math.min(100, round2((row.t / clock) * 100)),
    };
  });

  const hospitalUsage = runtime.hospitals.values().sort((a, b) => (a.id < b.id ? -1 : 1)).map((h) => {
    const row = stmt("SELECT COUNT(*) AS c FROM missions WHERE hospital_id = ? AND status = 'COMPLETED'").get(h.id);
    return {
      id: h.id,
      name: h.name,
      patients: row.c,
      totalBeds: h.totalBeds,
      availableBeds: h.availableBeds,
      occupancy: h.totalBeds > 0 ? round2(((h.totalBeds - h.availableBeds) / h.totalBeds) * 100) : 0,
    };
  });

  const missionsOverTime = stmt(`SELECT substr(completed_at, 1, 15) || '0' AS bucket, COUNT(*) AS c FROM missions
    WHERE status = 'COMPLETED' GROUP BY bucket ORDER BY bucket`).all().map((r) => ({ bucket: r.bucket, count: r.c }));

  const eventCounts = {};
  stmt('SELECT event_type, COUNT(*) AS c FROM traffic_events GROUP BY event_type').all().forEach((r) => { eventCounts[r.event_type] = r.c; });
  const impactRows = stmt(`SELECT id, scene_planned_time + hospital_planned_time AS planned, travel_time, traffic_delay, reroute_count
    FROM missions WHERE status = 'COMPLETED' ORDER BY completed_at DESC LIMIT 15`).all().reverse();
  const delayAgg = stmt("SELECT COALESCE(SUM(traffic_delay), 0) AS total, AVG(traffic_delay) AS avg, COALESCE(SUM(reroute_count), 0) AS reroutes, SUM(CASE WHEN traffic_delay > 0 THEN 1 ELSE 0 END) AS delayed FROM missions WHERE status = 'COMPLETED'").get();
  const roadHits = stmt(`SELECT road_id, COUNT(*) AS c FROM traffic_events WHERE road_id IS NOT NULL AND event_type IN ('TRAFFIC_CHANGE', 'ROAD_CLOSED')
    GROUP BY road_id ORDER BY c DESC, road_id LIMIT 5`).all().map((r) => ({ roadId: r.road_id, changes: r.c }));

  const totals = {
    emergencies: emergencies.count(),
    completedMissions: missions.count("status = 'COMPLETED'"),
    cancelledMissions: missions.count("status = 'CANCELLED'"),
    totalDistance: round2(stmt("SELECT COALESCE(SUM(total_distance), 0) AS d FROM missions WHERE status = 'COMPLETED'").get().d),
    avgTravelTime: round2(stmt("SELECT AVG(travel_time) AS a FROM missions WHERE status = 'COMPLETED'").get().a),
    avgResponseTime: round2(stmt("SELECT AVG(response_time) AS a FROM missions WHERE status = 'COMPLETED' AND response_time IS NOT NULL").get().a),
  };

  return {
    totals,
    severityDistribution: SEVERITIES.map((s) => ({ severity: s, count: sevCounts[s] || 0 })),
    typeDistribution: EMERGENCY_TYPES.map((t) => ({ type: t, count: typeCounts[t] || 0 })),
    responseBySeverity,
    responseTrend: trend,
    ambulanceUtilization: utilization,
    hospitalUsage,
    missionsOverTime,
    trafficImpact: {
      events: eventCounts,
      reroutes: delayAgg.reroutes,
      delayedMissions: delayAgg.delayed || 0,
      totalDelay: round2(delayAgg.total),
      avgDelay: round2(delayAgg.avg),
      missions: impactRows.map((r) => ({
        mission: r.id,
        planned: round2(r.planned),
        actual: round2(Math.max(0, r.travel_time - TURNOUT_MINUTES)),
        delay: round2(r.traffic_delay),
        reroutes: r.reroute_count,
      })),
      mostChangedRoads: roadHits,
    },
    simClock: round2(runtime.simClock),
  };
}

module.exports = { kpis, alerts, fullAnalytics };
