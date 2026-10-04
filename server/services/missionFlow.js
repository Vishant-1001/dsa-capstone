const { db } = require('../models/factory');
const { missions } = require('../models/operations');
const { runtime, saveAmbulance, saveEmergency, saveMission, saveHospital, nodeName, emit, now } = require('./runtime');
const { selectHospital } = require('../algorithms/hospitalSelection');
const { TURNOUT_MINUTES } = require('../constants');
const mv = require('./movement');

const round2 = (n) => Math.round(n * 100) / 100;

function hospitalList() {
  return runtime.hospitals.values().sort((a, b) => (a.id < b.id ? -1 : 1));
}

/** Ambulances already heading to each hospital, so one free bed is not promised twice. */
function inboundCounts(excludeMissionId) {
  const out = {};
  runtime.missions.values().forEach((m) => {
    if (m.status === 'TRANSPORTING' && m.hospitalId && m.id !== excludeMissionId) {
      out[m.hospitalId] = (out[m.hospitalId] || 0) + 1;
    }
  });
  return out;
}

/** Mission, ambulance and emergency always share the same status while a mission is moving. */
function setStatuses(mission, status) {
  saveMission(mission.id, { status });
  saveAmbulance(mission.ambulanceId, { status });
  saveEmergency(mission.emergencyId, { status });
}

/** Removes the visited-node arrays so decision logs stay small. */
function trimSelection(sel) {
  const slim = (c) => {
    const { visitedNodes, ...rest } = c;
    return { ...rest, visitedCount: visitedNodes ? visitedNodes.length : 0 };
  };
  return {
    code: sel.code,
    explanation: sel.explanation,
    required: sel.required,
    specialty: sel.specialty,
    pipeline: sel.pipeline,
    rejected: sel.rejected,
    candidates: sel.candidates.map(slim),
    selected: sel.selected ? sel.selected.ambulanceId || sel.selected.hospitalId : null,
  };
}

function routeRecord(c) {
  return {
    algorithm: 'Dijkstra',
    path: c.path,
    roadIds: c.roadIds,
    distance: c.distance,
    time: c.travelTime,
    visitedNodes: c.visitedNodes,
  };
}

function onDeparture(m) {
  const mission = runtime.missions.get(m.missionId);
  if (mission && mission.status === 'DISPATCHED') setStatuses(mission, 'EN_ROUTE');
}

function arriveScene(m, arrivalClock) {
  const mission = runtime.missions.get(m.missionId);
  const emergency = runtime.emergencies.get(mission.emergencyId);
  const delay = Math.max(0, round2(m.elapsed - TURNOUT_MINUTES - mission.scenePlannedTime));
  saveMission(mission.id, {
    sceneActualTime: round2(m.elapsed),
    sceneDistance: round2(m.km),
    responseTime: round2(arrivalClock - emergency.createdSim),
    trafficDelay: delay,
    arrivedSceneAt: now(),
    activeRoute: null,
    blocked: false,
    holdRemaining: 0,
    legElapsed: round2(m.elapsed),
  });
  setStatuses(mission, 'AT_SCENE');
  runtime.movements.delete(m.ambulanceId);
  emit(
    'AMBULANCE_ARRIVED',
    'success',
    'AMBULANCE ARRIVED',
    `${mission.ambulanceId} is at ${nodeName(emergency.nodeId)} for ${emergency.id}. Pick up the patient to start hospital selection.`,
    { missionId: mission.id, emergencyId: emergency.id, ambulanceId: mission.ambulanceId },
  );
}

function arriveReturn(m) {
  saveAmbulance(m.ambulanceId, { status: 'AVAILABLE' });
  runtime.movements.delete(m.ambulanceId);
  emit('AMBULANCE_AVAILABLE', 'info', 'Ambulance back at station', `${m.ambulanceId} returned to ${nodeName(m.path[m.path.length - 1])} and is available.`, {
    ambulanceId: m.ambulanceId,
  });
}

function completeMission(m) {
  const mission = runtime.missions.get(m.missionId);
  const emergency = runtime.emergencies.get(mission.emergencyId);
  const hospital = runtime.hospitals.get(mission.hospitalId);
  const bedsBefore = hospital.availableBeds;

  db.transaction(() => {
    saveHospital(hospital.id, { availableBeds: bedsBefore - 1 });
    const hospitalDelay = Math.max(0, round2(m.elapsed - mission.hospitalPlannedTime));
    saveMission(mission.id, {
      status: 'COMPLETED',
      hospitalActualTime: round2(m.elapsed),
      hospitalDistance: round2(m.km),
      travelTime: round2((mission.sceneActualTime || 0) + m.elapsed),
      totalDistance: round2((mission.sceneDistance || 0) + m.km),
      trafficDelay: round2(mission.trafficDelay + hospitalDelay),
      completedAt: now(),
      activeRoute: null,
      blocked: false,
      holdRemaining: 0,
      legElapsed: round2(m.elapsed),
    });
    saveEmergency(emergency.id, { status: 'COMPLETED', completedAt: now() });
    saveAmbulance(mission.ambulanceId, { status: 'AVAILABLE', nodeId: hospital.nodeId, currentMissionId: null });
  })();

  runtime.movements.delete(m.ambulanceId);
  runtime.missions.delete(mission.id);
  runtime.emergencies.delete(emergency.id);
  emit(
    'MISSION_COMPLETED',
    'success',
    'Mission completed',
    `${mission.ambulanceId} delivered the ${emergency.id} patient to ${hospital.name}. Beds ${bedsBefore} to ${bedsBefore - 1}. ${mission.ambulanceId} is available.`,
    { missionId: mission.id, emergencyId: emergency.id, ambulanceId: mission.ambulanceId, hospitalId: hospital.id },
  );
  if (runtime.autoReturn) {
    try {
      // Required here because dispatch depends on this module.
      require('./dispatch').returnToStation(mission.ambulanceId);
    } catch (err) {
      // Already at its station, or no route: it simply stays available.
    }
  }
  return missions.get(mission.id);
}

/**
 * Called when the ambulance reaches its hospital. Completes the mission when the
 * hospital can still take the patient, otherwise diverts or waits for a hospital.
 * Returns true when the mission completed.
 */
function tryHospitalArrival(m) {
  const mission = runtime.missions.get(m.missionId);
  const emergency = runtime.emergencies.get(mission.emergencyId);
  const hospital = runtime.hospitals.get(mission.hospitalId);

  if (hospital && hospital.status === 'OPEN' && hospital.availableBeds > 0) {
    completeMission(m);
    return true;
  }

  const here = mv.destinationNode(m);
  const sel = selectHospital(runtime.graph, hospitalList(), here, emergency.requiredSpecialty, { inbound: inboundCounts(mission.id) });
  if (sel.selected) {
    const c = sel.selected;
    m.path = c.path.slice();
    m.roadIds = c.roadIds.slice();
    m.segIndex = 0;
    m.frac = 0;
    m.awaitHospital = false;
    saveMission(mission.id, {
      hospitalId: c.hospitalId,
      hospitalRoute: routeRecord(c),
      hospitalPlannedTime: round2(mission.hospitalPlannedTime + c.travelTime),
    });
    mv.persist(m);
    emit(
      'HOSPITAL_DIVERSION',
      'warning',
      'Hospital diversion',
      `${hospital ? hospital.name : 'The hospital'} cannot accept the patient. ${mission.ambulanceId} is diverted to ${c.name}, ETA ${c.travelTime} min.`,
      { missionId: mission.id, ambulanceId: mission.ambulanceId },
    );
    return false;
  }

  if (!m.awaitHospital) {
    m.awaitHospital = true;
    emit(
      'HOSPITAL_UNAVAILABLE',
      'critical',
      'No hospital can accept the patient',
      `${mission.ambulanceId} is waiting at ${nodeName(here)}. Free a bed or reopen a hospital with ${emergency.requiredSpecialty}.`,
      { missionId: mission.id, ambulanceId: mission.ambulanceId },
    );
  }
  mv.persist(m);
  return false;
}

module.exports = {
  hospitalList,
  inboundCounts,
  setStatuses,
  trimSelection,
  routeRecord,
  onDeparture,
  arriveScene,
  arriveReturn,
  completeMission,
  tryHospitalArrival,
};
