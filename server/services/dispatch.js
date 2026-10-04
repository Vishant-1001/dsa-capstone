const { db } = require('../models/factory');
const { emergencies, missions } = require('../models/operations');
const { settings } = require('../models/system');
const { runtime, saveAmbulance, saveEmergency, saveMission, nodeName, emit, now } = require('./runtime');
const { selectAmbulance } = require('../algorithms/ambulanceSelection');
const { selectHospital } = require('../algorithms/hospitalSelection');
const { dijkstra } = require('../algorithms/dijkstra');
const { SEVERITY_PRIORITY } = require('../datastructures/PriorityQueue');
const { EMERGENCY_TYPES, SEVERITIES, EQUIPMENT, SPECIALTIES, TURNOUT_MINUTES } = require('../constants');
const { oneOf, text } = require('../utils/validate');
const { badRequest, notFound, conflict } = require('../utils/errors');
const mv = require('./movement');
const flow = require('./missionFlow');

const round2 = (n) => Math.round(n * 100) / 100;
const pad = (n) => String(n).padStart(4, '0');

function ambulanceList() {
  return runtime.ambulances.values().sort((a, b) => (a.id < b.id ? -1 : 1));
}

function requireEmergency(id) {
  const open = runtime.emergencies.get(id);
  if (open) return open;
  const row = emergencies.get(id);
  if (!row) throw notFound(`Emergency ${id} not found`);
  throw conflict('EMERGENCY_CLOSED', `Emergency ${id} is already ${row.status}`);
}

function requireMission(id) {
  const m = runtime.missions.get(id);
  if (m) return m;
  const row = missions.get(id);
  if (!row) throw notFound(`Mission ${id} not found`);
  throw conflict('MISSION_CLOSED', `Mission ${id} is already ${row.status}`);
}

/* ------------------------------ emergencies ------------------------------ */

function createEmergency(input, user) {
  const type = oneOf(input.type, EMERGENCY_TYPES, 'Emergency type');
  const severity = oneOf(input.severity, SEVERITIES, 'Severity');
  const nodeId = text(input.nodeId, 'Location', { max: 24 });
  const requiredEquipment = oneOf(input.requiredEquipment, EQUIPMENT, 'Required equipment');
  const requiredSpecialty = oneOf(input.requiredSpecialty, SPECIALTIES, 'Required hospital specialty');
  const description = text(input.description, 'Description', { required: false, max: 300 });

  const node = runtime.graph.getNode(nodeId);
  if (!node) throw badRequest(`Location ${nodeId} is not on the map`);
  if (node.type !== 'JUNCTION' && node.type !== 'BUILDING') {
    throw badRequest('Emergencies can only be reported at junctions and buildings');
  }

  const seq = settings.nextSeq('emergency_seq');
  const id = `E-${pad(seq)}`;
  const stamp = now();
  const row = {
    id,
    type,
    severity,
    priority: SEVERITY_PRIORITY[severity],
    nodeId,
    requiredEquipment,
    requiredSpecialty,
    description,
    status: 'PENDING',
    arrivalSeq: seq,
    createdSim: round2(runtime.simClock),
    reportedBy: user ? user.username : 'system',
    createdAt: stamp,
    updatedAt: stamp,
  };
  emergencies.insert(row);
  const saved = emergencies.get(id);
  runtime.emergencies.set(id, saved);
  runtime.queue.enqueue(saved);

  emit(
    'EMERGENCY_CREATED',
    severity === 'CRITICAL' ? 'critical' : 'info',
    `New emergency ${id}`,
    `${severity} ${type.replace('_', ' ').toLowerCase()} at ${node.name}. Added to the priority queue (position ${queuePosition(id)}).`,
    { emergencyId: id },
  );
  return saved;
}

function queuePosition(id) {
  const idx = runtime.queue.toSortedArray().findIndex((e) => e.id === id);
  return idx === -1 ? null : idx + 1;
}

/**
 * Entry point for new reports. A second report of the same type at the same place while the
 * first is still waiting is merged into it: severity rises to the higher of the two and the
 * descriptions are joined. Returns { emergency, merged }.
 */
function reportEmergency(input, user) {
  const nodeId = input && typeof input.nodeId === 'string' ? input.nodeId : null;
  const dup = nodeId
    ? runtime.emergencies.values().find((e) => e.status === 'PENDING' && e.nodeId === nodeId && e.type === input.type)
    : null;
  if (!dup) return { emergency: createEmergency(input || {}, user), merged: false };

  const severity = oneOf(input.severity, SEVERITIES, 'Severity');
  const note = text(input.description, 'Description', { required: false, max: 300 });
  const patch = {};
  if (SEVERITY_PRIORITY[severity] > dup.priority) patch.severity = severity;
  if (note && !(dup.description || '').includes(note)) patch.description = (dup.description ? `${dup.description} | ${note}` : note).slice(0, 300);
  const updated = Object.keys(patch).length ? updateEmergency(dup.id, patch) : emergencies.get(dup.id);
  emit('EMERGENCY_MERGED', 'info', `Report merged into ${dup.id}`, `Another ${dup.type.replace('_', ' ').toLowerCase()} report at ${nodeName(dup.nodeId)} was added to the waiting emergency.`, { emergencyId: dup.id });
  return { emergency: updated, merged: true };
}

function updateEmergency(id, input) {
  const em = requireEmergency(id);
  const patch = {};
  if (input.description !== undefined) patch.description = text(input.description, 'Description', { required: false, max: 300 });

  const structural = ['type', 'severity', 'nodeId', 'requiredEquipment', 'requiredSpecialty'].some((k) => input[k] !== undefined);
  if (structural && em.status !== 'PENDING') {
    throw conflict('NOT_PENDING', 'Only pending emergencies can change type, severity, location or requirements');
  }
  if (input.type !== undefined) patch.type = oneOf(input.type, EMERGENCY_TYPES, 'Emergency type');
  if (input.severity !== undefined) {
    patch.severity = oneOf(input.severity, SEVERITIES, 'Severity');
    patch.priority = SEVERITY_PRIORITY[patch.severity];
  }
  if (input.requiredEquipment !== undefined) patch.requiredEquipment = oneOf(input.requiredEquipment, EQUIPMENT, 'Required equipment');
  if (input.requiredSpecialty !== undefined) patch.requiredSpecialty = oneOf(input.requiredSpecialty, SPECIALTIES, 'Required hospital specialty');
  if (input.nodeId !== undefined) {
    const node = runtime.graph.getNode(input.nodeId);
    if (!node) throw badRequest(`Location ${input.nodeId} is not on the map`);
    if (node.type !== 'JUNCTION' && node.type !== 'BUILDING') throw badRequest('Emergencies can only be reported at junctions and buildings');
    patch.nodeId = input.nodeId;
  }

  db.transaction(() => {
    if (em.status === 'PENDING') runtime.queue.remove(id);
    saveEmergency(id, patch);
    // Re-inserting with the original arrival sequence keeps first-come order among equals.
    if (em.status === 'PENDING') runtime.queue.enqueue(runtime.emergencies.get(id));
  })();
  return emergencies.get(id);
}

function cancelEmergency(id, user) {
  const open = runtime.emergencies.get(id);
  if (!open) {
    const row = emergencies.get(id);
    if (!row) throw notFound(`Emergency ${id} not found`);
    if (row.status === 'CANCELLED' && missions.count('emergency_id = ?', [id]) === 0) {
      emergencies.remove(id);
      return { deleted: true, id };
    }
    throw conflict('EMERGENCY_CLOSED', `Emergency ${id} is ${row.status} and is kept for history`);
  }

  db.transaction(() => {
    if (open.status === 'PENDING') {
      runtime.queue.remove(id);
    } else if (open.missionId) {
      const mission = runtime.missions.get(open.missionId);
      if (mission) {
        runtime.movements.delete(mission.ambulanceId);
        saveMission(mission.id, { status: 'CANCELLED', completedAt: now(), activeRoute: null, blocked: false });
        saveAmbulance(mission.ambulanceId, { status: 'AVAILABLE', currentMissionId: null });
        runtime.missions.delete(mission.id);
      }
    }
    saveEmergency(id, { status: 'CANCELLED', completedAt: now() });
    runtime.emergencies.delete(id);
  })();

  emit('EMERGENCY_CANCELLED', 'warning', `Emergency ${id} cancelled`, `Cancelled by ${user ? user.username : 'system'}.`, { emergencyId: id });
  return emergencies.get(id);
}

/* -------------------------------- dispatch -------------------------------- */

/** Ambulance recommendation for a pending emergency. No side effects. */
function recommend(id) {
  const em = requireEmergency(id);
  if (em.status !== 'PENDING') throw conflict('NOT_PENDING', `Emergency ${id} is already ${em.status}`);
  const selection = selectAmbulance(runtime.graph, ambulanceList(), em);
  const ahead = runtime.queue.toSortedArray();
  let blockedBy = null;
  for (let i = 0; i < ahead.length && ahead[i].id !== id; i += 1) {
    const other = selectAmbulance(runtime.graph, ambulanceList(), ahead[i]);
    if (other.selected) {
      blockedBy = { emergencyId: ahead[i].id, severity: ahead[i].severity };
      break;
    }
  }
  return {
    emergencyId: id,
    queuePosition: queuePosition(id),
    blockedBy,
    selection,
  };
}

function dispatch(id, options = {}, user) {
  const em = requireEmergency(id);
  if (em.status !== 'PENDING') throw conflict('NOT_PENDING', `Emergency ${id} is already ${em.status}`);

  if (!options.override) {
    const ahead = runtime.queue.toSortedArray();
    for (let i = 0; i < ahead.length && ahead[i].id !== id; i += 1) {
      const other = selectAmbulance(runtime.graph, ambulanceList(), ahead[i]);
      if (other.selected) {
        throw conflict(
          'HIGHER_PRIORITY_PENDING',
          `${ahead[i].id} (${ahead[i].severity}) has higher priority and a suitable ambulance is available. Dispatch it first.`,
          { blockingEmergencyId: ahead[i].id },
        );
      }
    }
  }

  const selection = selectAmbulance(runtime.graph, ambulanceList(), em);
  if (!selection.selected) {
    throw conflict(selection.code, selection.explanation, { selection: flow.trimSelection(selection) });
  }
  const chosen = selection.selected;
  // Path reconstruction pushes nodes target-first and pops them source-first.
  runtime.lastStackTrace = { source: chosen.fromNode, target: em.nodeId, pushed: chosen.path.slice().reverse(), popped: chosen.path.slice(), sample: false };

  const missionSeq = settings.nextSeq('mission_seq');
  const missionId = `M-${pad(missionSeq)}`;
  const stamp = now();

  db.transaction(() => {
    missions.insert({
      id: missionId,
      emergencyId: id,
      ambulanceId: chosen.ambulanceId,
      severity: em.severity,
      status: 'DISPATCHED',
      leg: 'SCENE',
      activeRoute: { path: chosen.path, roadIds: chosen.roadIds, oldPaths: [] },
      segIndex: 0,
      segFrac: 0,
      holdRemaining: TURNOUT_MINUTES,
      legElapsed: 0,
      blocked: false,
      sceneRoute: flow.routeRecord(chosen),
      selectionLog: flow.trimSelection(selection),
      reroutes: [],
      rerouteCount: 0,
      sceneDistance: 0,
      scenePlannedTime: chosen.travelTime,
      hospitalPlannedTime: 0,
      hospitalDistance: 0,
      trafficDelay: 0,
      dispatchSim: round2(runtime.simClock),
      dispatchedBy: user ? user.username : 'system',
      dispatchedAt: stamp,
    });
    runtime.missions.set(missionId, missions.get(missionId));
    saveAmbulance(chosen.ambulanceId, { status: 'DISPATCHED', currentMissionId: missionId });
    saveEmergency(id, { status: 'DISPATCHED', assignedAmbulanceId: chosen.ambulanceId, missionId });
    runtime.queue.remove(id);
  })();

  runtime.movements.set(
    chosen.ambulanceId,
    mv.createMovement({ ambulanceId: chosen.ambulanceId, missionId, kind: 'SCENE', path: chosen.path, roadIds: chosen.roadIds, hold: TURNOUT_MINUTES }),
  );

  emit(
    'AMBULANCE_DISPATCHED',
    'info',
    `${chosen.ambulanceId} dispatched`,
    `${chosen.ambulanceId} (${chosen.equipment}) to ${id} at ${nodeName(em.nodeId)}, ETA ${chosen.travelTime} min.`,
    { missionId, emergencyId: id, ambulanceId: chosen.ambulanceId },
  );

  return { mission: missions.get(missionId), selection };
}

/** Dispatches the highest priority emergency that currently has a suitable ambulance. */
function dispatchNext(user) {
  const ordered = runtime.queue.toSortedArray();
  for (let i = 0; i < ordered.length; i += 1) {
    const sel = selectAmbulance(runtime.graph, ambulanceList(), ordered[i]);
    if (sel.selected) return dispatch(ordered[i].id, {}, user);
  }
  throw conflict('NOTHING_TO_DISPATCH', ordered.length === 0 ? 'The priority queue is empty.' : 'No queued emergency has a suitable ambulance right now.');
}

function autoDispatchAll(user) {
  const done = [];
  for (let guard = 0; guard < 20; guard += 1) {
    try {
      done.push(dispatchNext(user || { username: 'auto-dispatch' }));
    } catch (err) {
      if (err.code === 'NOTHING_TO_DISPATCH') break;
      throw err;
    }
  }
  return done;
}

/* ------------------------- pickup and hospital leg ------------------------ */

function hospitalOptions(missionId) {
  const mission = requireMission(missionId);
  if (mission.status !== 'AT_SCENE') throw conflict('NOT_AT_SCENE', `Mission ${missionId} is ${mission.status}, not AT_SCENE`);
  const em = runtime.emergencies.get(mission.emergencyId);
  return selectHospital(runtime.graph, flow.hospitalList(), em.nodeId, em.requiredSpecialty, { inbound: flow.inboundCounts(missionId) });
}

function pickup(missionId, options = {}) {
  const mission = requireMission(missionId);
  if (mission.status !== 'AT_SCENE') throw conflict('NOT_AT_SCENE', `Mission ${missionId} is ${mission.status}. The ambulance must be AT_SCENE to pick up the patient.`);
  const em = runtime.emergencies.get(mission.emergencyId);
  const selection = hospitalOptions(missionId);
  if (!selection.selected) {
    throw conflict(selection.code, selection.explanation, { selection: flow.trimSelection(selection) });
  }
  let chosen = selection.selected;
  if (options.hospitalId) {
    chosen = selection.candidates.find((c) => c.hospitalId === options.hospitalId && c.reachable);
    if (!chosen) throw badRequest(`${options.hospitalId} is not a suitable hospital for this patient`);
  }

  db.transaction(() => {
    saveMission(missionId, {
      hospitalId: chosen.hospitalId,
      hospitalRoute: flow.routeRecord(chosen),
      hospitalLog: flow.trimSelection(selection),
      hospitalPlannedTime: chosen.travelTime,
      hospitalDistance: 0,
      leg: 'HOSPITAL',
      pickupAt: now(),
      activeRoute: { path: chosen.path, roadIds: chosen.roadIds, oldPaths: [] },
      segIndex: 0,
      segFrac: 0,
      holdRemaining: 0,
      legElapsed: 0,
      blocked: false,
    });
    flow.setStatuses(runtime.missions.get(missionId), 'TRANSPORTING');
  })();

  runtime.movements.set(
    mission.ambulanceId,
    mv.createMovement({ ambulanceId: mission.ambulanceId, missionId, kind: 'HOSPITAL', path: chosen.path, roadIds: chosen.roadIds }),
  );
  runtime.lastStackTrace = null;

  emit(
    'PATIENT_PICKED_UP',
    'info',
    'Patient picked up',
    `${mission.ambulanceId} is taking the ${em.id} patient to ${chosen.name}, ETA ${chosen.travelTime} min.`,
    { missionId, emergencyId: em.id, ambulanceId: mission.ambulanceId, hospitalId: chosen.hospitalId },
  );
  return { mission: missions.get(missionId), selection };
}

/** Skips the remaining travel and completes a transport that is in progress. */
function completeNow(missionId) {
  const mission = requireMission(missionId);
  if (mission.status !== 'TRANSPORTING') throw conflict('NOT_TRANSPORTING', `Mission ${missionId} is ${mission.status}. Only a transport in progress can be completed.`);
  const m = runtime.movements.get(mission.ambulanceId);
  if (!m) throw conflict('NO_MOVEMENT', 'The ambulance is not moving');
  if (m.blocked) throw conflict('ROUTE_BLOCKED', 'The destination is currently unreachable, so the transport cannot be completed.');

  m.elapsed += mv.eta(m);
  m.km += mv.remainingDistance(m);
  m.segIndex = m.roadIds.length;
  m.frac = 0;
  m.hold = 0;
  const last = m.path[m.path.length - 1];
  const ambulance = runtime.ambulances.get(m.ambulanceId);
  saveAmbulance(m.ambulanceId, { nodeId: last, distanceTravelled: round2(ambulance.distanceTravelled) });
  const finished = flow.tryHospitalArrival(m);
  if (!finished) {
    throw conflict('HOSPITAL_UNAVAILABLE', 'The hospital could not accept the patient on arrival. The ambulance was diverted or is waiting.');
  }
  return missions.get(missionId);
}

/* ----------------------------- return to station ---------------------------- */

function returnToStation(ambulanceId) {
  const a = runtime.ambulances.get(ambulanceId);
  if (!a) throw notFound(`Ambulance ${ambulanceId} not found`);
  if (a.status !== 'AVAILABLE') throw conflict('NOT_AVAILABLE', `${ambulanceId} is ${a.status}. Only an available ambulance can return to station.`);
  if (!a.homeStationId) throw conflict('NO_STATION', `${ambulanceId} has no home station`);
  if (a.nodeId === a.homeStationId) throw conflict('ALREADY_AT_STATION', `${ambulanceId} is already at its station`);
  const route = dijkstra(runtime.graph, a.nodeId, a.homeStationId);
  if (!route.found) throw conflict('UNREACHABLE', `${nodeName(a.homeStationId)} cannot be reached with the current road closures`);
  saveAmbulance(ambulanceId, { status: 'RETURNING' });
  runtime.movements.set(ambulanceId, mv.createMovement({ ambulanceId, kind: 'RETURN', path: route.path, roadIds: route.roadIds }));
  emit('AMBULANCE_RETURNING', 'info', `${ambulanceId} returning`, `${ambulanceId} is returning to ${nodeName(a.homeStationId)}, ETA ${route.estimatedTime} min.`, { ambulanceId });
  return runtime.ambulances.get(ambulanceId);
}

module.exports = {
  createEmergency,
  reportEmergency,
  updateEmergency,
  cancelEmergency,
  recommend,
  dispatch,
  dispatchNext,
  autoDispatchAll,
  hospitalOptions,
  pickup,
  completeNow,
  returnToStation,
  queuePosition,
};
