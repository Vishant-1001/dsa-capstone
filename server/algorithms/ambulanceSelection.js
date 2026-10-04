const { dijkstra } = require('./dijkstra');

/**
 * BASIC calls can be served by any unit (every ambulance carries basic life
 * support). ALS, TRAUMA and PEDIATRIC calls need a unit with that equipment.
 */
function meetsEquipment(ambulance, required) {
  if (!required || required === 'BASIC') return true;
  return ambulance.equipment === required;
}

const byTimeThenDistanceThenId = (a, b) => {
  if (a.travelTime !== b.travelTime) return a.travelTime - b.travelTime;
  if (a.distance !== b.distance) return a.distance - b.distance;
  return a.ambulanceId < b.ambulanceId ? -1 : a.ambulanceId > b.ambulanceId ? 1 : 0;
};

/**
 * Chooses the ambulance for an emergency.
 *
 * 1. keep AVAILABLE ambulances
 * 2. keep those with the required equipment
 * 3. run Dijkstra from each one to the emergency (travel time with current traffic)
 * 4. pick the lowest reachable travel time
 *
 * The geographically nearest unit is not preferred; the fastest route wins.
 */
function selectAmbulance(graph, ambulances, emergency) {
  const required = emergency.requiredEquipment || 'BASIC';
  const rejected = [];
  const pipeline = { total: ambulances.length, available: [], equipmentMatch: [], reachable: [] };

  const available = [];
  ambulances.forEach((a) => {
    if (a.status === 'AVAILABLE') {
      available.push(a);
      pipeline.available.push(a.id);
    } else {
      rejected.push({ ambulanceId: a.id, equipment: a.equipment, reason: `Status is ${a.status}` });
    }
  });

  const base = { required, candidates: [], rejected, pipeline, selected: null };

  if (available.length === 0) {
    return { ...base, code: 'NO_AVAILABLE_AMBULANCE', explanation: 'No ambulance is currently available.' };
  }

  const compatible = [];
  available.forEach((a) => {
    if (meetsEquipment(a, required)) {
      compatible.push(a);
      pipeline.equipmentMatch.push(a.id);
    } else {
      rejected.push({ ambulanceId: a.id, equipment: a.equipment, reason: `Carries ${a.equipment}, ${required} required` });
    }
  });

  if (compatible.length === 0) {
    return { ...base, code: 'NO_SUITABLE_EQUIPMENT', explanation: `No available ambulance carries ${required} equipment.` };
  }

  const candidates = compatible.map((a) => {
    const route = dijkstra(graph, a.nodeId, emergency.nodeId);
    return {
      ambulanceId: a.id,
      equipment: a.equipment,
      fromNode: a.nodeId,
      reachable: route.found,
      travelTime: route.found ? route.estimatedTime : null,
      distance: route.found ? route.totalDistance : null,
      path: route.path,
      roadIds: route.roadIds,
      visitedNodes: route.visitedNodes,
    };
  });

  const reachable = candidates.filter((c) => c.reachable).sort(byTimeThenDistanceThenId);
  candidates.filter((c) => !c.reachable).forEach((c) => {
    rejected.push({ ambulanceId: c.ambulanceId, equipment: c.equipment, reason: 'No open route to the emergency' });
  });
  reachable.forEach((c) => pipeline.reachable.push(c.ambulanceId));

  if (reachable.length === 0) {
    return {
      ...base,
      candidates,
      code: 'NO_REACHABLE_AMBULANCE',
      explanation: 'No suitable ambulance can reach the emergency location with the current road closures.',
    };
  }

  const selected = reachable[0];
  let explanation = `${selected.ambulanceId} (${selected.equipment}) has the lowest ETA, ${selected.travelTime} min over ${selected.distance} km`;
  if (reachable.length > 1) {
    const next = reachable[1];
    explanation += `, ahead of ${next.ambulanceId} at ${next.travelTime} min`;
  }
  explanation += `. ${reachable.length} of ${pipeline.total} units were eligible.`;

  return { ...base, candidates: reachable.concat(candidates.filter((c) => !c.reachable)), selected, code: 'OK', explanation };
}

module.exports = { selectAmbulance, meetsEquipment };
