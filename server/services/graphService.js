const { nodes, roads } = require('../models/graph');
const { runtime, nodeName, emit, now } = require('./runtime');
const { connectedComponents } = require('../algorithms/bfs');
const { oneOf, text, number, identifier } = require('../utils/validate');
const { badRequest, conflict } = require('../utils/errors');
const { NODE_TYPES } = require('../constants');
const reroute = require('./rerouting');
const { serializeRoad } = require('./traffic');

const round1 = (n) => Math.round(n * 10) / 10;

function snapshot() {
  const g = runtime.graph;
  return {
    version: runtime.graphVersion,
    nodes: g.allNodes().map((n) => ({ id: n.id, name: n.name, type: n.type, x: n.x, y: n.y })).sort((a, b) => (a.id < b.id ? -1 : 1)),
    roads: g.allEdges().map(serializeRoad).sort((a, b) => (a.id < b.id ? -1 : 1)),
    stats: { vertices: g.nodeCount(), edges: g.edgeCount(), components: connectedComponents(g).length },
  };
}

function addNode(input) {
  const id = identifier(input.id, 'Node ID').toUpperCase();
  if (runtime.graph.hasNode(id)) throw conflict('DUPLICATE_ID', `Node ${id} already exists`);
  const name = text(input.name, 'Name', { max: 60 });
  const type = oneOf(input.type, NODE_TYPES, 'Node type');
  const x = number(input.x, 'X position', { min: 0, max: 1000 });
  const y = number(input.y, 'Y position', { min: 0, max: 620 });
  nodes.insert({ id, name, type, x, y, createdAt: now() });
  runtime.graph.addNode({ id, name, type, x, y });
  runtime.graphVersion += 1;
  emit('GRAPH_CHANGED', 'info', 'Map updated', `Node ${id} (${name}) added.`, { nodeId: id });
  return snapshot();
}

function nextRoadId() {
  let max = 0;
  runtime.graph.allEdges().forEach((e) => {
    const m = /^R(\d+)$/.exec(e.id);
    if (m) max = Math.max(max, Number(m[1]));
  });
  return `R${String(max + 1).padStart(2, '0')}`;
}

function addRoad(input, user) {
  const g = runtime.graph;
  const source = text(input.source, 'From node', { max: 24 });
  const destination = text(input.destination, 'To node', { max: 24 });
  if (!g.hasNode(source)) throw badRequest(`Node ${source} is not on the map`);
  if (!g.hasNode(destination)) throw badRequest(`Node ${destination} is not on the map`);
  if (source === destination) throw badRequest('A road must connect two different nodes');
  if (g.edgeBetween(source, destination)) throw conflict('DUPLICATE_ROAD', `A road between ${source} and ${destination} already exists`);

  const id = input.id ? identifier(input.id, 'Road ID').toUpperCase() : nextRoadId();
  if (g.getEdge(id)) throw conflict('DUPLICATE_ID', `Road ${id} already exists`);
  const distance = number(input.distance, 'Distance (km)', { min: 0.1, max: 100 });
  const travel = input.normalTravelTime === undefined || input.normalTravelTime === ''
    ? Math.max(0.5, round1((distance / 40) * 60))
    : number(input.normalTravelTime, 'Normal travel time (min)', { min: 0.1, max: 600 });

  roads.insert({ id, source, destination, distance, normalTravelTime: travel, currentTravelTime: travel, trafficLevel: 'LOW', isClosed: false, updatedAt: now() });
  g.addEdge({ id, source, destination, distance, normalTravelTime: travel });
  runtime.graphVersion += 1;
  emit('GRAPH_CHANGED', 'info', 'Map updated', `Road ${id} added between ${nodeName(source)} and ${nodeName(destination)}.`, { roadId: id });
  const effects = reroute.reevaluateAll({ roadId: id, improving: true, label: `New road ${id} opened`, by: user ? user.username : 'system' }, reroute.snapshotEtas());
  return { ...snapshot(), effects };
}

module.exports = { snapshot, addNode, addRoad };
