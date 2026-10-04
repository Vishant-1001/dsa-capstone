const { runtime, nodeName } = require('./runtime');
const { settings } = require('../models/system');
const { missions } = require('../models/operations');
const dispatch = require('./dispatch');
const traffic = require('./traffic');
const analytics = require('./analytics');
const mv = require('./movement');
const { selectAmbulance } = require('../algorithms/ambulanceSelection');
const { selectHospital } = require('../algorithms/hospitalSelection');
const { isReachable } = require('../algorithms/bfs');
const { conflict } = require('../utils/errors');

const DEMO_LOCATION = 'N21';
const DEMO_USER = { username: 'demo' };
const DEMO_EMERGENCY = {
  type: 'CARDIAC',
  severity: 'CRITICAL',
  nodeId: DEMO_LOCATION,
  requiredEquipment: 'ALS',
  requiredSpecialty: 'CARDIAC',
  description: 'Demo scenario: adult with chest pain.',
};

const missionOf = (d) => runtime.missions.get(d.missionId) || missions.get(d.missionId);

function listAmbulances() {
  return runtime.ambulances.values();
}

/**
 * Each step runs its enter() once, then waits at least `dwell` real seconds and
 * until done() (when given) is true. Every enter() calls the same services the
 * rest of the application uses.
 */
const STEPS = [
  {
    title: 'Critical cardiac emergency reported',
    dwell: 1.5,
    enter(d) {
      const em = dispatch.createEmergency(DEMO_EMERGENCY, DEMO_USER);
      d.emergencyId = em.id;
      return `${em.id}, CRITICAL cardiac at ${nodeName(em.nodeId)}. Requires ALS and a CARDIAC hospital.`;
    },
  },
  {
    title: 'Added to the priority queue',
    dwell: 1.5,
    enter(d) {
      return `Queue position ${dispatch.queuePosition(d.emergencyId)} of ${runtime.queue.size()}. Priority 10.`;
    },
  },
  {
    title: 'ALS ambulances filtered',
    dwell: 2,
    enter(d) {
      d.selection = dispatch.recommend(d.emergencyId).selection;
      const p = d.selection.pipeline;
      return `Available units: ${p.available.join(', ') || 'none'}. ALS units kept: ${p.equipmentMatch.join(', ') || 'none'}.`;
    },
  },
  {
    title: 'Routes calculated with Dijkstra',
    dwell: 2,
    enter(d) {
      return d.selection.candidates
        .filter((c) => c.reachable)
        .map((c) => `${c.ambulanceId}: ${c.travelTime} min, ${c.distance} km, ${c.visitedNodes.length} nodes visited`)
        .join('. ');
    },
  },
  {
    title: 'Best ambulance selected',
    dwell: 2,
    enter(d) {
      return d.selection.explanation;
    },
  },
  {
    title: 'Ambulance dispatched',
    dwell: 1.5,
    enter(d) {
      const { mission, selection } = dispatch.dispatch(d.emergencyId, { override: true }, DEMO_USER);
      d.missionId = mission.id;
      d.ambulanceId = mission.ambulanceId;
      d.plannedKm = selection.selected.distance;
      return `${mission.id}: ${mission.ambulanceId} dispatched, ETA ${selection.selected.travelTime} min.`;
    },
  },
  {
    title: 'Ambulance moving on the map',
    dwell: 0.5,
    done(d) {
      const m = runtime.movements.get(d.ambulanceId);
      return !m || m.km >= 0.3 * d.plannedKm;
    },
    enter() {
      return 'Watch the ambulance marker follow the highlighted route.';
    },
  },
  {
    title: 'Traffic and a road closure introduced',
    dwell: 2,
    enter(d) {
      const m = runtime.movements.get(d.ambulanceId);
      if (!m) return 'The ambulance had already arrived, so no traffic was added.';
      const g = runtime.graph;
      const startNode = m.frac > 0 ? m.path[m.segIndex + 1] : m.path[m.segIndex];
      const target = mv.destinationNode(m);
      const ahead = m.roadIds.slice(m.segIndex + 1);

      // Close the first upcoming road that still leaves a detour (BFS check).
      let pick = null;
      for (let i = 0; i < ahead.length && !pick; i += 1) {
        const edge = g.getEdge(ahead[i]);
        if (edge && !edge.isClosed) {
          g.closeRoad(edge.id);
          const ok = isReachable(g, startNode, target);
          g.reopenRoad(edge.id);
          if (ok) pick = edge;
        }
      }
      if (pick) {
        const result = traffic.closeRoad(pick.id, DEMO_USER);
        d.closed.push(pick.id);
        d.effect = result.effects.find((e) => e.ambulanceId === d.ambulanceId) || null;
        return `${pick.id} (${nodeName(pick.source)} to ${nodeName(pick.destination)}) closed on the planned route.`;
      }
      const fallback = ahead.length ? ahead[Math.floor(ahead.length / 2)] : m.roadIds[m.segIndex];
      const result = traffic.setTraffic(fallback, 'SEVERE', DEMO_USER);
      d.traffic.push(fallback);
      d.effect = result.effects.find((e) => e.ambulanceId === d.ambulanceId) || null;
      return `No detour exists, so ${fallback} was set to SEVERE traffic instead.`;
    },
  },
  {
    title: 'Route recalculated',
    dwell: 2,
    enter(d) {
      const e = d.effect;
      if (!e) return 'The planned route was not affected.';
      if (e.status === 'REROUTED') return `New route found by Dijkstra from the current position. ETA ${e.etaBefore} to ${e.etaAfter} min.`;
      if (e.status === 'ETA_UPDATED') return `Same route is still best. ETA ${e.etaBefore} to ${e.etaAfter} min.`;
      return `Status: ${e.status}.`;
    },
  },
  {
    title: 'Ambulance reaches the patient',
    dwell: 0.5,
    done(d) {
      const m = missionOf(d);
      return !m || m.status !== 'EN_ROUTE' && m.status !== 'DISPATCHED';
    },
    enter() {
      return 'Travelling to the scene.';
    },
    finish(d) {
      return `${d.ambulanceId} is at the scene. Status AT_SCENE.`;
    },
  },
  {
    title: 'Patient picked up',
    dwell: 1.5,
    enter(d) {
      const { selection } = dispatch.pickup(d.missionId, {});
      d.hospitalSelection = selection;
      d.hospitalId = selection.selected.hospitalId;
      d.hospitalName = selection.selected.name;
      d.bedsBefore = runtime.hospitals.get(d.hospitalId).availableBeds;
      return 'Hospital selection ran. Status TRANSPORTING.';
    },
  },
  {
    title: 'Cardiac hospital selected',
    dwell: 2,
    enter(d) {
      return d.hospitalSelection.explanation;
    },
  },
  {
    title: 'Ambulance travels to the hospital',
    dwell: 0.5,
    done(d) {
      return !runtime.missions.has(d.missionId);
    },
    enter(d) {
      const m = runtime.movements.get(d.ambulanceId);
      return m ? `Route to ${d.hospitalName}, ETA ${mv.eta(m)} min.` : 'En route.';
    },
    finish(d) {
      return `${d.ambulanceId} arrived at ${d.hospitalName}.`;
    },
  },
  {
    title: 'Patient delivered',
    dwell: 1,
    enter(d) {
      return `Handed over at ${d.hospitalName}.`;
    },
  },
  {
    title: 'Bed count updated',
    dwell: 1.5,
    enter(d) {
      const h = runtime.hospitals.get(d.hospitalId);
      return `${h.name}: ${d.bedsBefore} to ${h.availableBeds} available beds.`;
    },
  },
  {
    title: 'Mission completed',
    dwell: 1.5,
    enter(d) {
      const m = missions.get(d.missionId);
      return `${m.id} completed. Response ${m.responseTime} min, travel ${m.travelTime} min, ${m.totalDistance} km, ${m.rerouteCount} reroute${m.rerouteCount === 1 ? '' : 's'}.`;
    },
  },
  {
    title: 'Ambulance available again',
    dwell: 1,
    enter(d) {
      const a = runtime.ambulances.get(d.ambulanceId);
      return `${a.id} is ${a.status} at ${nodeName(a.nodeId)}.`;
    },
  },
  {
    title: 'Analytics updated',
    dwell: 1.5,
    enter() {
      const k = analytics.kpis();
      return `Completed missions: ${k.completedMissions}. Average response time: ${k.avgResponseTime} min.`;
    },
  },
];

function status() {
  const d = runtime.demo;
  if (!d) return null;
  return {
    running: d.running,
    finished: d.finished,
    error: d.error,
    index: d.index,
    total: STEPS.length,
    emergencyId: d.emergencyId,
    missionId: d.missionId,
    ambulanceId: d.ambulanceId,
    steps: d.steps.map((s) => ({ title: s.title, status: s.status, detail: s.detail })),
  };
}

/** Puts back the roads the scenario changed. */
function cleanup(d) {
  d.closed.forEach((id) => {
    const edge = runtime.graph.getEdge(id);
    if (edge && edge.isClosed) traffic.reopenRoad(id, DEMO_USER);
  });
  d.traffic.forEach((id) => {
    const edge = runtime.graph.getEdge(id);
    if (edge && edge.trafficLevel !== 'LOW') traffic.setTraffic(id, 'LOW', DEMO_USER);
  });
  d.closed = [];
  d.traffic = [];
}

function start() {
  if (runtime.demo && runtime.demo.running) throw conflict('DEMO_RUNNING', 'The demo is already running.');

  const probe = { nodeId: DEMO_LOCATION, requiredEquipment: 'ALS' };
  const unit = selectAmbulance(runtime.graph, listAmbulances(), probe);
  if (!unit.selected) throw conflict('DEMO_UNAVAILABLE', `The demo needs an available ALS ambulance. ${unit.explanation}`);
  const hospital = selectHospital(runtime.graph, runtime.hospitals.values(), DEMO_LOCATION, 'CARDIAC');
  if (!hospital.selected) throw conflict('DEMO_UNAVAILABLE', `The demo needs an open cardiac hospital with a free bed. ${hospital.explanation}`);

  runtime.paused = false;
  settings.set('sim_paused', '0');
  runtime.demo = {
    running: true,
    finished: false,
    error: null,
    index: 0,
    closed: [],
    traffic: [],
    steps: STEPS.map((s) => ({ title: s.title, status: 'pending', detail: '', entered: false, timer: 0 })),
  };
  return status();
}

function stop() {
  const d = runtime.demo;
  if (!d || !d.running) return status();
  d.running = false;
  d.steps.forEach((s) => {
    if (s.status === 'active') s.status = 'stopped';
  });
  try {
    cleanup(d);
  } catch (err) {
    d.error = err.message;
  }
  return status();
}

/** Advances the scripted scenario. dtSeconds is real elapsed time. */
function update(dtSeconds) {
  const d = runtime.demo;
  if (!d || !d.running) return;
  try {
    const def = STEPS[d.index];
    const s = d.steps[d.index];
    if (!s.entered) {
      s.entered = true;
      s.status = 'active';
      const detail = def.enter(d);
      if (detail) s.detail = detail;
    }
    s.timer += dtSeconds;
    const ready = s.timer >= def.dwell && (!def.done || def.done(d));
    if (!ready) return;
    s.status = 'done';
    if (def.finish) s.detail = def.finish(d);
    d.index += 1;
    if (d.index >= STEPS.length) {
      cleanup(d);
      d.running = false;
      d.finished = true;
    }
  } catch (err) {
    d.error = err.message;
    d.running = false;
    const active = d.steps[d.index];
    if (active) active.status = 'failed';
    try {
      cleanup(d);
    } catch (e) {
      // best effort only
    }
  }
}

module.exports = { start, stop, update, status, STEPS, DEMO_LOCATION };
