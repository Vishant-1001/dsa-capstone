const Graph = require('../datastructures/Graph');
const HashTable = require('../datastructures/HashTable');
const EmergencyPriorityQueue = require('../datastructures/PriorityQueue');
const Queue = require('../datastructures/Queue');
const { nodes, roads } = require('../models/graph');
const { ambulances, hospitals } = require('../models/fleet');
const { emergencies, missions } = require('../models/operations');
const { settings } = require('../models/system');
const { ACTIVE_EMERGENCY_STATUSES, ACTIVE_MISSION_STATUSES } = require('../constants');

const now = () => new Date().toISOString();
const MAX_NOTIFICATIONS = 100;
const MAX_PROCESSED = 40;

/**
 * In-memory working set. The database is the source of truth; these structures
 * are rebuilt from it at start-up and updated together with every write.
 *
 *   graph       road network (adjacency list)
 *   ambulances  HashTable  ambulanceId -> ambulance
 *   hospitals   HashTable  hospitalId  -> hospital
 *   emergencies HashTable  emergencyId -> open emergency
 *   missions    HashTable  missionId   -> active mission
 *   movements   HashTable  ambulanceId -> moving ambulance state
 *   queue       emergency priority queue (pending emergencies)
 *   events      FIFO Queue of simulation events waiting to be processed
 */
const runtime = {
  graph: new Graph(),
  ambulances: new HashTable(),
  hospitals: new HashTable(),
  emergencies: new HashTable(),
  missions: new HashTable(),
  movements: new HashTable(),
  queue: new EmergencyPriorityQueue(),
  events: new Queue(),
  processedEvents: [],
  notifications: [],
  notifSeq: 0,
  simClock: 0,
  speed: 2,
  paused: false,
  autoDispatch: false,
  autoReturn: false,
  graphVersion: 1,
  lastStackTrace: null,
  demo: null,
};

function load() {
  runtime.graph = new Graph();
  runtime.ambulances = new HashTable();
  runtime.hospitals = new HashTable();
  runtime.emergencies = new HashTable();
  runtime.missions = new HashTable();
  runtime.movements = new HashTable();
  runtime.queue = new EmergencyPriorityQueue();
  runtime.events = new Queue();
  runtime.processedEvents = [];
  runtime.notifications = [];
  runtime.lastStackTrace = null;
  runtime.graphVersion += 1;

  nodes.all('id').forEach((n) => runtime.graph.addNode(n));
  roads.all('id').forEach((r) => runtime.graph.addEdge(r));
  ambulances.all('id').forEach((a) => runtime.ambulances.set(a.id, a));
  hospitals.all().forEach((h) => runtime.hospitals.set(h.id, h));

  runtime.simClock = Number(settings.get('sim_clock', '0'));
  runtime.speed = Number(settings.get('sim_speed', '2'));
  runtime.paused = settings.get('sim_paused', '0') === '1';
  runtime.autoDispatch = settings.get('auto_dispatch', '0') === '1';
  runtime.autoReturn = settings.get('auto_return', '0') === '1';

  const placeholders = ACTIVE_EMERGENCY_STATUSES.map(() => '?').join(',');
  emergencies.where(`status IN (${placeholders}) ORDER BY arrival_seq`, ACTIVE_EMERGENCY_STATUSES).forEach((e) => {
    runtime.emergencies.set(e.id, e);
    if (e.status === 'PENDING') runtime.queue.enqueue(e);
  });

  const mph = ACTIVE_MISSION_STATUSES.map(() => '?').join(',');
  missions.where(`status IN (${mph})`, ACTIVE_MISSION_STATUSES).forEach((m) => {
    runtime.missions.set(m.id, m);
    const moving = m.activeRoute && ['DISPATCHED', 'EN_ROUTE', 'TRANSPORTING'].includes(m.status);
    if (moving) {
      runtime.movements.set(m.ambulanceId, {
        ambulanceId: m.ambulanceId,
        missionId: m.id,
        kind: m.leg,
        path: m.activeRoute.path,
        roadIds: m.activeRoute.roadIds,
        oldPaths: m.activeRoute.oldPaths || [],
        segIndex: m.segIndex,
        frac: m.segFrac,
        hold: m.holdRemaining,
        elapsed: m.legElapsed,
        km: m.leg === 'SCENE' ? m.sceneDistance : m.hospitalDistance,
        blocked: m.blocked,
        awaitHospital: false,
      });
    }
  });

  // Repair ambulances whose recorded state has no matching mission or movement.
  runtime.ambulances.values().forEach((a) => {
    const hasMission = a.currentMissionId && runtime.missions.has(a.currentMissionId);
    if (!hasMission && ['DISPATCHED', 'EN_ROUTE', 'AT_SCENE', 'TRANSPORTING', 'RETURNING'].includes(a.status)) {
      saveAmbulance(a.id, { status: 'AVAILABLE', currentMissionId: null });
    }
  });
}

function saveAmbulance(id, patch) {
  const current = runtime.ambulances.get(id);
  const full = { ...patch, updatedAt: now() };
  ambulances.update(id, full);
  if (current) Object.assign(current, full);
  return current;
}

function saveHospital(id, patch) {
  const current = runtime.hospitals.get(id);
  const full = { ...patch, updatedAt: now() };
  const { specialties, ...columns } = full;
  hospitals.update(id, columns);
  if (specialties) hospitals.setSpecialties(id, specialties);
  if (current) Object.assign(current, full);
  return current;
}

function saveEmergency(id, patch) {
  const current = runtime.emergencies.get(id);
  const full = { ...patch, updatedAt: now() };
  emergencies.update(id, full);
  if (current) Object.assign(current, full);
  return current;
}

function saveMission(id, patch) {
  const current = runtime.missions.get(id);
  missions.update(id, patch);
  if (current) Object.assign(current, patch);
  return current;
}

function nodeName(id) {
  const n = runtime.graph.getNode(id);
  return n ? n.name : id;
}

/** Queues a simulation event. It becomes a notification when processEvents runs. */
function emit(type, level, title, message, refs = {}) {
  runtime.events.enqueue({ type, level, title, message, refs, at: now() });
}

/** Drains the FIFO event queue in arrival order. */
function processEvents() {
  while (!runtime.events.isEmpty()) {
    const ev = runtime.events.dequeue();
    runtime.notifSeq += 1;
    const note = { id: runtime.notifSeq, ...ev };
    runtime.notifications.push(note);
    if (runtime.notifications.length > MAX_NOTIFICATIONS) runtime.notifications.shift();
    runtime.processedEvents.push({ id: note.id, type: ev.type, at: ev.at });
    if (runtime.processedEvents.length > MAX_PROCESSED) runtime.processedEvents.shift();
  }
}

function persistClock() {
  settings.set('sim_clock', runtime.simClock);
}

module.exports = {
  runtime,
  load,
  now,
  saveAmbulance,
  saveHospital,
  saveEmergency,
  saveMission,
  nodeName,
  emit,
  processEvents,
  persistClock,
};
