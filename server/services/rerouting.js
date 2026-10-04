const { runtime, saveMission, nodeName, emit, now } = require('./runtime');
const { isReachable } = require('../algorithms/bfs');
const { dijkstra } = require('../algorithms/dijkstra');
const { trafficEvents } = require('../models/operations');
const mv = require('./movement');

const round2 = (n) => Math.round(n * 100) / 100;

const sameList = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);

/** ETA of every moving ambulance, taken before a road change is applied. */
function snapshotEtas() {
  const out = {};
  runtime.movements.values().forEach((m) => {
    out[m.ambulanceId] = m.blocked ? null : mv.eta(m);
  });
  return out;
}

/**
 * Re-checks one moving ambulance after a road change.
 *
 * 1. Is the changed road on the remaining route? (or did a road get cheaper or reopen)
 * 2. BFS: can the destination still be reached over open roads?
 * 3. Dijkstra from the ambulance's current node to the destination.
 * 4. Swap in the new route and record the ETA change.
 *
 * An ambulance in the middle of a road finishes that road first, so the new route
 * starts at the far end of the current segment.
 */
function rerouteMovement(m, trigger, etaBefore) {
  if (m.awaitHospital) return null;
  const graph = runtime.graph;
  const remainingRoads = m.roadIds.slice(m.segIndex);
  const affected = Boolean(trigger.roadId) && remainingRoads.includes(trigger.roadId);
  if (!affected && !trigger.improving && !m.blocked) return null;

  const midRoad = m.segIndex < m.roadIds.length && m.frac > 0;
  const startNode = midRoad ? m.path[m.segIndex + 1] : m.path[m.segIndex];
  const target = mv.destinationNode(m);
  const wasBlocked = m.blocked;
  const base = { ambulanceId: m.ambulanceId, missionId: m.missionId, etaBefore: etaBefore === undefined ? null : etaBefore };

  if (!isReachable(graph, startNode, target)) {
    if (m.blocked) return null;
    m.blocked = true;
    mv.persist(m);
    trafficEvents.insert({
      eventType: 'UNREACHABLE',
      roadId: trigger.roadId || null,
      missionId: m.missionId,
      etaBefore: base.etaBefore,
      details: `${m.ambulanceId} cannot reach ${nodeName(target)}`,
      createdBy: trigger.by || 'system',
      createdAt: now(),
    });
    emit(
      'DESTINATION_UNREACHABLE',
      'critical',
      'DESTINATION CURRENTLY UNREACHABLE',
      `${m.ambulanceId} cannot reach ${nodeName(target)} with the current road closures. It holds position until a route opens.`,
      { missionId: m.missionId, ambulanceId: m.ambulanceId },
    );
    return { ...base, status: 'UNREACHABLE', etaAfter: null };
  }

  const route = dijkstra(graph, startNode, target);
  if (!route.found) return null;
  const prefixPath = midRoad ? [m.path[m.segIndex]] : [];
  const prefixRoads = midRoad ? [m.roadIds[m.segIndex]] : [];
  const newPath = prefixPath.concat(route.path);
  const newRoads = prefixRoads.concat(route.roadIds);
  const unchanged = !wasBlocked && sameList(newRoads, remainingRoads);

  if (unchanged) {
    return affected ? { ...base, status: 'ETA_UPDATED', etaAfter: mv.eta(m) } : null;
  }

  if (!affected && !wasBlocked) {
    // Only a cheaper road appeared: switch when the saving is worth a detour.
    let candidate = (m.hold || 0) + route.estimatedTime;
    if (midRoad) candidate += (1 - m.frac) * graph.getEdge(m.roadIds[m.segIndex]).currentTravelTime;
    if (candidate >= mv.eta(m) - 0.5) return null;
  }

  const oldPath = m.path.slice(m.segIndex);
  m.oldPaths = [oldPath];
  m.path = newPath;
  m.roadIds = newRoads;
  m.segIndex = 0;
  m.blocked = false;
  const etaAfter = mv.eta(m);

  if (m.missionId) {
    const mission = runtime.missions.get(m.missionId);
    const reroutes = (mission.reroutes || []).concat([
      { at: now(), atSim: round2(runtime.simClock), trigger: trigger.label, leg: m.kind, etaBefore: base.etaBefore, etaAfter, oldPath, newPath },
    ]);
    saveMission(m.missionId, { reroutes, rerouteCount: reroutes.length });
  }
  mv.persist(m);

  trafficEvents.insert({
    eventType: 'REROUTE',
    roadId: trigger.roadId || null,
    missionId: m.missionId,
    etaBefore: base.etaBefore,
    etaAfter,
    details: `${m.ambulanceId} ${wasBlocked ? 'resumed' : 'rerouted'}: ${trigger.label}`,
    createdBy: trigger.by || 'system',
    createdAt: now(),
  });

  const status = wasBlocked ? 'RESTORED' : 'REROUTED';
  emit(
    wasBlocked ? 'ROUTE_RESTORED' : 'ROUTE_RECALCULATED',
    wasBlocked ? 'info' : 'warning',
    wasBlocked ? 'Route restored' : 'Route recalculated',
    wasBlocked
      ? `${m.ambulanceId} has a route again to ${nodeName(target)}, ETA ${etaAfter} min.`
      : `${m.ambulanceId} rerouted to ${nodeName(target)}. ETA ${base.etaBefore} to ${etaAfter} min. ${trigger.label}.`,
    { missionId: m.missionId, ambulanceId: m.ambulanceId },
  );
  return { ...base, status, etaAfter, oldPath, newPath };
}

/** Runs the reroute check for every moving ambulance. Returns one entry per affected unit. */
function reevaluateAll(trigger, etaBefore = {}) {
  const results = [];
  runtime.movements.values().forEach((m) => {
    const r = rerouteMovement(m, trigger, etaBefore[m.ambulanceId]);
    if (r) results.push(r);
  });
  return results;
}

module.exports = { snapshotEtas, rerouteMovement, reevaluateAll };
