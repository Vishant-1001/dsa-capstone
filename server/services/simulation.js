const { db } = require('../models/factory');
const { runtime, saveAmbulance, persistClock, processEvents } = require('./runtime');
const { SIM_MINUTES_PER_SECOND } = require('../constants');
const mv = require('./movement');
const flow = require('./missionFlow');

const round2 = (n) => Math.round(n * 100) / 100;
const EPS = 1e-9;

/**
 * Moves one ambulance along its route for dt simulation minutes.
 * The ambulance holds for the crew turnout time, then walks the road segments in
 * order. Time left over after finishing a segment carries into the next one.
 */
function stepMovement(m, dt, clockAtStart) {
  if (m.awaitHospital) {
    m.elapsed += dt;
    flow.tryHospitalArrival(m);
    return;
  }
  if (m.blocked) {
    m.elapsed += dt;
    mv.persist(m);
    return;
  }

  let budget = dt;
  let km = 0;
  let reachedNode = null;

  if (m.hold > 0) {
    const used = Math.min(m.hold, budget);
    m.hold -= used;
    budget -= used;
    if (m.hold <= EPS) {
      m.hold = 0;
      if (m.kind === 'SCENE') flow.onDeparture(m);
    }
  }

  if (m.hold === 0) {
    while (budget > EPS && m.segIndex < m.roadIds.length) {
      const edge = runtime.graph.getEdge(m.roadIds[m.segIndex]);
      if (!edge) break;
      const segTime = Math.max(0.05, edge.currentTravelTime);
      const needed = (1 - m.frac) * segTime;
      if (needed <= budget + EPS) {
        budget -= needed;
        km += (1 - m.frac) * edge.distance;
        m.frac = 0;
        m.segIndex += 1;
        reachedNode = m.path[m.segIndex];
      } else {
        const advance = budget / segTime;
        m.frac += advance;
        km += advance * edge.distance;
        budget = 0;
      }
    }
  }

  const consumed = dt - budget;
  m.elapsed += consumed;
  m.km += km;

  const ambulance = runtime.ambulances.get(m.ambulanceId);
  if (ambulance && (km > 0 || reachedNode)) {
    const patch = { distanceTravelled: round2(ambulance.distanceTravelled + km) };
    if (reachedNode) patch.nodeId = reachedNode;
    saveAmbulance(m.ambulanceId, patch);
  }

  const finished = m.hold === 0 && m.segIndex >= m.roadIds.length;
  if (!finished) {
    mv.persist(m);
    return;
  }

  if (m.kind === 'SCENE') flow.arriveScene(m, clockAtStart + consumed);
  else if (m.kind === 'HOSPITAL') flow.tryHospitalArrival(m);
  else flow.arriveReturn(m);
}

/** Advances the whole simulation by dt simulation minutes. Deterministic, used by tests. */
function advance(dt) {
  const moving = runtime.movements.values();
  if (moving.length > 0) {
    const clockAtStart = runtime.simClock;
    db.transaction(() => {
      moving.forEach((m) => stepMovement(m, dt, clockAtStart));
    })();
    runtime.simClock = clockAtStart + dt;
  }
  processEvents();
}

let ticksSincePersist = 0;
let ticksSinceAuto = 0;

/** Real-time tick. dtSeconds is wall-clock time since the previous tick. */
function tick(dtSeconds) {
  if (runtime.paused) {
    processEvents();
    return;
  }
  const dt = Math.min(dtSeconds, 1) * runtime.speed * SIM_MINUTES_PER_SECOND;
  advance(dt);

  ticksSincePersist += 1;
  if (ticksSincePersist >= 8) {
    ticksSincePersist = 0;
    persistClock();
  }
  // Required lazily so these modules can depend on the rest of the services.
  require('./demo').update(dtSeconds);
  ticksSinceAuto += 1;
  if (ticksSinceAuto >= 8) {
    ticksSinceAuto = 0;
    if (runtime.autoDispatch) require('./dispatch').autoDispatchAll(null);
  }
}

module.exports = { advance, tick, stepMovement };
