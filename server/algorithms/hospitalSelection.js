const { dijkstra } = require('./dijkstra');

const byTimeThenBedsThenId = (a, b) => {
  if (a.travelTime !== b.travelTime) return a.travelTime - b.travelTime;
  if (a.availableBeds !== b.availableBeds) return b.availableBeds - a.availableBeds;
  return a.hospitalId < b.hospitalId ? -1 : a.hospitalId > b.hospitalId ? 1 : 0;
};

/**
 * Chooses the destination hospital.
 *
 * Filters: OPEN, at least one free bed, required specialty, reachable.
 * Among the survivors the lowest travel time from the scene wins.
 *
 * options.inbound maps hospitalId to the number of ambulances already heading
 * there, so a bed that is about to be taken is not offered twice.
 */
function selectHospital(graph, hospitals, fromNodeId, requiredSpecialty, options = {}) {
  const inbound = options.inbound || {};
  const specialty = requiredSpecialty || 'GENERAL';
  const rejected = [];
  const pipeline = { total: hospitals.length, open: [], withBeds: [], specialtyMatch: [], reachable: [] };
  const base = { specialty, candidates: [], rejected, pipeline, selected: null };

  const open = [];
  hospitals.forEach((h) => {
    if (h.status === 'OPEN') {
      open.push(h);
      pipeline.open.push(h.id);
    } else {
      rejected.push({ hospitalId: h.id, name: h.name, reason: 'Hospital is closed' });
    }
  });
  if (open.length === 0) {
    return { ...base, code: 'NO_OPEN_HOSPITAL', explanation: 'No hospital is currently open.' };
  }

  const withBeds = [];
  open.forEach((h) => {
    const free = h.availableBeds - (inbound[h.id] || 0);
    if (free > 0) {
      withBeds.push(h);
      pipeline.withBeds.push(h.id);
    } else {
      rejected.push({ hospitalId: h.id, name: h.name, reason: 'No beds available' });
    }
  });
  if (withBeds.length === 0) {
    return { ...base, code: 'NO_HOSPITAL_BEDS', explanation: 'No open hospital has a free bed.' };
  }

  const matching = [];
  withBeds.forEach((h) => {
    if ((h.specialties || []).includes(specialty)) {
      matching.push(h);
      pipeline.specialtyMatch.push(h.id);
    } else {
      rejected.push({ hospitalId: h.id, name: h.name, reason: `No ${specialty} specialty` });
    }
  });
  if (matching.length === 0) {
    return { ...base, code: 'NO_SPECIALTY_MATCH', explanation: `No hospital with a free bed offers ${specialty}.` };
  }

  const candidates = matching.map((h) => {
    const route = dijkstra(graph, fromNodeId, h.nodeId);
    return {
      hospitalId: h.id,
      name: h.name,
      toNode: h.nodeId,
      // Beds not already promised to an inbound ambulance.
      availableBeds: h.availableBeds - (inbound[h.id] || 0),
      reachable: route.found,
      travelTime: route.found ? route.estimatedTime : null,
      distance: route.found ? route.totalDistance : null,
      path: route.path,
      roadIds: route.roadIds,
      visitedNodes: route.visitedNodes,
    };
  });
  const reachable = candidates.filter((c) => c.reachable).sort(byTimeThenBedsThenId);
  candidates.filter((c) => !c.reachable).forEach((c) => {
    rejected.push({ hospitalId: c.hospitalId, name: c.name, reason: 'No open route from the scene' });
  });
  reachable.forEach((c) => pipeline.reachable.push(c.hospitalId));

  if (reachable.length === 0) {
    return { ...base, candidates, code: 'NO_REACHABLE_HOSPITAL', explanation: 'No suitable hospital can be reached with the current road closures.' };
  }

  const selected = reachable[0];
  let explanation = `${selected.name} offers ${specialty} with ${selected.availableBeds} free bed${selected.availableBeds === 1 ? '' : 's'} and the shortest trip, ${selected.travelTime} min`;
  if (reachable.length > 1) {
    explanation += `, ahead of ${reachable[1].name} at ${reachable[1].travelTime} min`;
  }
  explanation += '.';

  return { ...base, candidates: reachable.concat(candidates.filter((c) => !c.reachable)), selected, code: 'OK', explanation };
}

module.exports = { selectHospital };
