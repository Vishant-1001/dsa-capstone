const { runtime, saveMission } = require('./runtime');

const round2 = (n) => Math.round(n * 100) / 100;

/** Creates the in-memory movement state for an ambulance following a route. */
function createMovement({ ambulanceId, missionId = null, kind, path, roadIds, hold = 0 }) {
  return {
    ambulanceId,
    missionId,
    kind, // SCENE, HOSPITAL or RETURN
    path: path.slice(),
    roadIds: roadIds.slice(),
    oldPaths: [],
    segIndex: 0,
    frac: 0,
    hold,
    elapsed: 0,
    km: 0,
    blocked: false,
    awaitHospital: false,
  };
}

/** Simulation minutes left, using current traffic on every remaining segment. */
function eta(m) {
  let t = m.hold || 0;
  for (let i = m.segIndex; i < m.roadIds.length; i += 1) {
    const edge = runtime.graph.getEdge(m.roadIds[i]);
    if (!edge) continue;
    t += (i === m.segIndex ? 1 - m.frac : 1) * edge.currentTravelTime;
  }
  return round2(t);
}

function remainingDistance(m) {
  let d = 0;
  for (let i = m.segIndex; i < m.roadIds.length; i += 1) {
    const edge = runtime.graph.getEdge(m.roadIds[i]);
    if (!edge) continue;
    d += (i === m.segIndex ? 1 - m.frac : 1) * edge.distance;
  }
  return round2(d);
}

function destinationNode(m) {
  return m.path[m.path.length - 1];
}

/** Map position, interpolated along the current road. */
function position(m) {
  const g = runtime.graph;
  const from = g.getNode(m.path[m.segIndex]);
  if (!from) return null;
  if (m.segIndex >= m.roadIds.length || m.frac <= 0) return { x: from.x, y: from.y };
  const to = g.getNode(m.path[m.segIndex + 1]);
  if (!to) return { x: from.x, y: from.y };
  return { x: from.x + (to.x - from.x) * m.frac, y: from.y + (to.y - from.y) * m.frac };
}

/** Plain snapshot for the API. */
function describe(m) {
  return {
    ambulanceId: m.ambulanceId,
    missionId: m.missionId,
    kind: m.kind,
    path: m.path,
    roadIds: m.roadIds,
    oldPaths: m.oldPaths,
    segIndex: m.segIndex,
    frac: round2(m.frac),
    currentNodeId: m.path[m.segIndex] || null,
    nextNodeId: m.path[m.segIndex + 1] || null,
    currentRoadId: m.roadIds[m.segIndex] || null,
    destinationNodeId: destinationNode(m),
    etaMinutes: eta(m),
    remainingDistance: remainingDistance(m),
    elapsed: round2(m.elapsed),
    blocked: m.blocked,
    awaitingHospital: m.awaitHospital,
  };
}

/** Writes mission-bound movement progress to the database. */
function persist(m) {
  if (!m.missionId) return;
  const patch = {
    segIndex: m.segIndex,
    segFrac: m.frac,
    holdRemaining: m.hold,
    legElapsed: m.elapsed,
    blocked: m.blocked,
    activeRoute: { path: m.path, roadIds: m.roadIds, oldPaths: m.oldPaths },
  };
  if (m.kind === 'SCENE') patch.sceneDistance = round2(m.km);
  else patch.hospitalDistance = round2(m.km);
  saveMission(m.missionId, patch);
}

module.exports = { createMovement, eta, remainingDistance, destinationNode, position, describe, persist };
