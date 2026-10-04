const { roads } = require('../models/graph');
const { trafficEvents } = require('../models/operations');
const { runtime, nodeName, emit, now } = require('./runtime');
const { TRAFFIC_LEVELS, TRAFFIC_MULTIPLIER } = require('../constants');
const { notFound, conflict, badRequest } = require('../utils/errors');
const reroute = require('./rerouting');

function serializeRoad(edge) {
  return {
    id: edge.id,
    source: edge.source,
    destination: edge.destination,
    sourceName: nodeName(edge.source),
    destinationName: nodeName(edge.destination),
    distance: edge.distance,
    normalTravelTime: edge.normalTravelTime,
    currentTravelTime: edge.currentTravelTime,
    trafficLevel: edge.trafficLevel,
    isClosed: edge.isClosed,
  };
}

function requireRoad(id) {
  const edge = runtime.graph.getEdge(id);
  if (!edge) throw notFound(`Road ${id} not found`);
  return edge;
}

function describeRoad(edge) {
  return `${nodeName(edge.source)} to ${nodeName(edge.destination)}`;
}

function persistRoad(edge) {
  roads.update(edge.id, {
    trafficLevel: edge.trafficLevel,
    currentTravelTime: edge.currentTravelTime,
    isClosed: edge.isClosed,
    updatedAt: now(),
  });
}

function setTraffic(roadId, level, user, options = {}) {
  const edge = requireRoad(roadId);
  if (!TRAFFIC_LEVELS.includes(level)) throw badRequest(`Traffic level must be one of: ${TRAFFIC_LEVELS.join(', ')}`);
  if (edge.trafficLevel === level) return { road: serializeRoad(edge), effects: [] };

  const oldLevel = edge.trafficLevel;
  const before = reroute.snapshotEtas();
  runtime.graph.setTraffic(roadId, level);
  persistRoad(edge);
  trafficEvents.insert({ eventType: 'TRAFFIC_CHANGE', roadId, oldLevel, newLevel: level, createdBy: user ? user.username : 'system', createdAt: now() });

  const label = `Traffic on ${describeRoad(edge)} is now ${level}`;
  if (!options.quiet) {
    emit('TRAFFIC_CHANGED', level === 'HIGH' || level === 'SEVERE' ? 'warning' : 'info', 'Traffic updated', `${label} (x${TRAFFIC_MULTIPLIER[level]}).`, { roadId });
  }
  const effects = reroute.reevaluateAll(
    { roadId, improving: TRAFFIC_MULTIPLIER[level] < TRAFFIC_MULTIPLIER[oldLevel], label, by: user ? user.username : 'system' },
    before,
  );
  return { road: serializeRoad(edge), effects };
}

function closeRoad(roadId, user) {
  const edge = requireRoad(roadId);
  if (edge.isClosed) throw conflict('ALREADY_CLOSED', `Road ${roadId} is already closed`);
  const before = reroute.snapshotEtas();
  runtime.graph.closeRoad(roadId);
  persistRoad(edge);
  trafficEvents.insert({ eventType: 'ROAD_CLOSED', roadId, oldLevel: edge.trafficLevel, newLevel: edge.trafficLevel, createdBy: user ? user.username : 'system', createdAt: now() });

  const label = `${describeRoad(edge)} is closed`;
  emit('ROAD_CLOSED', 'warning', 'Road closed', `${label}.`, { roadId });
  const effects = reroute.reevaluateAll({ roadId, improving: false, label, by: user ? user.username : 'system' }, before);
  return { road: serializeRoad(edge), effects };
}

function reopenRoad(roadId, user) {
  const edge = requireRoad(roadId);
  if (!edge.isClosed) throw conflict('NOT_CLOSED', `Road ${roadId} is not closed`);
  const before = reroute.snapshotEtas();
  runtime.graph.reopenRoad(roadId);
  persistRoad(edge);
  trafficEvents.insert({ eventType: 'ROAD_REOPENED', roadId, oldLevel: edge.trafficLevel, newLevel: edge.trafficLevel, createdBy: user ? user.username : 'system', createdAt: now() });

  const label = `${describeRoad(edge)} is open again`;
  emit('ROAD_REOPENED', 'info', 'Road reopened', `${label}.`, { roadId });
  const effects = reroute.reevaluateAll({ roadId, improving: true, label, by: user ? user.username : 'system' }, before);
  return { road: serializeRoad(edge), effects };
}

module.exports = { serializeRoad, setTraffic, closeRoad, reopenRoad };
