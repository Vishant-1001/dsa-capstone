const { runtime, nodeName, processEvents } = require('./runtime');
const mv = require('./movement');
const flow = require('./missionFlow');
const analytics = require('./analytics');

const byId = (a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

function emergencyBrief(e) {
  return {
    id: e.id,
    type: e.type,
    severity: e.severity,
    priority: e.priority,
    nodeId: e.nodeId,
    locationName: nodeName(e.nodeId),
    requiredEquipment: e.requiredEquipment,
    requiredSpecialty: e.requiredSpecialty,
    description: e.description,
    status: e.status,
    arrivalSeq: e.arrivalSeq,
    assignedAmbulanceId: e.assignedAmbulanceId,
    missionId: e.missionId,
    createdAt: e.createdAt,
  };
}

function routeSummary(r) {
  if (!r) return null;
  return { path: r.path, roadIds: r.roadIds, distance: r.distance, time: r.time, visitedCount: r.visitedNodes ? r.visitedNodes.length : 0 };
}

function missionBrief(m) {
  const movement = runtime.movements.get(m.ambulanceId);
  return {
    id: m.id,
    emergencyId: m.emergencyId,
    ambulanceId: m.ambulanceId,
    hospitalId: m.hospitalId,
    status: m.status,
    leg: m.leg,
    severity: m.severity,
    blocked: Boolean(movement && movement.blocked),
    rerouteCount: m.rerouteCount,
    reroutes: (m.reroutes || []).slice(-5),
    scenePlannedTime: m.scenePlannedTime,
    hospitalPlannedTime: m.hospitalPlannedTime,
    sceneRoute: routeSummary(m.sceneRoute),
    hospitalRoute: routeSummary(m.hospitalRoute),
    responseTime: m.responseTime,
    dispatchedAt: m.dispatchedAt,
    arrivedSceneAt: m.arrivedSceneAt,
    pickupAt: m.pickupAt,
    movement: movement ? mv.describe(movement) : null,
  };
}

/** Everything the UI needs for a live refresh, in one response. */
function snapshot() {
  processEvents();
  const g = runtime.graph;

  const ambulances = runtime.ambulances.values().sort(byId).map((a) => {
    const movement = runtime.movements.get(a.id);
    const node = g.getNode(a.nodeId);
    const position = movement ? mv.position(movement) : node ? { x: node.x, y: node.y } : null;
    return {
      id: a.id,
      name: a.name,
      nodeId: a.nodeId,
      homeStationId: a.homeStationId,
      status: a.status,
      equipment: a.equipment,
      currentMissionId: a.currentMissionId,
      distanceTravelled: a.distanceTravelled,
      position,
      movement: movement ? mv.describe(movement) : null,
    };
  });

  const ordered = runtime.queue.toSortedArray();
  const queue = {
    size: runtime.queue.size(),
    head: ordered.length ? ordered[0].id : null,
    ordered: ordered.map(emergencyBrief),
    heap: runtime.queue.heapArray(),
    comparisons: runtime.queue.heap.comparisons,
    swaps: runtime.queue.heap.swaps,
  };

  const inbound = flow.inboundCounts(null);

  return {
    serverTime: new Date().toISOString(),
    simClock: Math.round(runtime.simClock * 100) / 100,
    speed: runtime.speed,
    paused: runtime.paused,
    autoDispatch: runtime.autoDispatch,
    autoReturn: runtime.autoReturn,
    graphVersion: runtime.graphVersion,
    ambulances,
    emergencies: runtime.emergencies.values().sort((a, b) => a.arrivalSeq - b.arrivalSeq).map(emergencyBrief),
    queue,
    missions: runtime.missions.values().sort(byId).map(missionBrief),
    roads: g.allEdges().sort(byId).map((e) => ({
      id: e.id,
      trafficLevel: e.trafficLevel,
      currentTravelTime: e.currentTravelTime,
      isClosed: e.isClosed,
    })),
    hospitals: flow.hospitalList().map((h) => ({
      id: h.id,
      name: h.name,
      nodeId: h.nodeId,
      totalBeds: h.totalBeds,
      availableBeds: h.availableBeds,
      status: h.status,
      specialties: h.specialties,
      inbound: inbound[h.id] || 0,
    })),
    kpis: analytics.kpis(),
    alerts: analytics.alerts(),
    notifications: runtime.notifications.slice(-40),
    demo: runtime.demo ? require('./demo').status() : null,
  };
}

module.exports = { snapshot, emergencyBrief, missionBrief };
