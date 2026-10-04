const { runtime, nodeName } = require('./runtime');
const { bfs, connectedComponents } = require('../algorithms/bfs');
const { dijkstra } = require('../algorithms/dijkstra');
const { SEVERITY_PRIORITY } = require('../datastructures/PriorityQueue');
const { emergencyBrief } = require('./live');
const { badRequest } = require('../utils/errors');
const HashTable = require('../datastructures/HashTable');

function tables() {
  return {
    ambulances: { table: runtime.ambulances, key: 'ambulanceId', value: 'ambulance record' },
    hospitals: { table: runtime.hospitals, key: 'hospitalId', value: 'hospital record' },
    emergencies: { table: runtime.emergencies, key: 'emergencyId', value: 'open emergency' },
    missions: { table: runtime.missions, key: 'missionId', value: 'active mission' },
    movements: { table: runtime.movements, key: 'ambulanceId', value: 'moving ambulance state' },
    nodes: { table: runtime.graph.nodes, key: 'nodeId', value: 'graph node' },
    roads: { table: runtime.graph.edges, key: 'roadId', value: 'graph edge' },
  };
}

function firstStation() {
  const nodes = runtime.graph.allNodes().sort((a, b) => (a.id < b.id ? -1 : 1));
  return nodes.find((n) => n.type === 'STATION') || nodes[0];
}

/** Live view of every data structure the application uses. */
function overview() {
  const g = runtime.graph;
  const components = connectedComponents(g);
  const nodes = g.allNodes().sort((a, b) => (a.id < b.id ? -1 : 1));
  const start = firstStation();
  const bfsResult = start ? bfs(g, start.id) : null;

  const hashTables = Object.entries(tables()).map(([name, def]) => {
    const keys = def.table.keys().sort();
    return {
      name,
      key: def.key,
      value: def.value,
      stats: def.table.stats(),
      sampleKey: keys[0] || null,
      layout: def.table.layout().filter((b) => b.keys.length > 0),
    };
  });

  let stack = runtime.lastStackTrace;
  if (!stack) {
    const hospital = nodes.find((n) => n.type === 'HOSPITAL');
    if (start && hospital) {
      const r = dijkstra(g, start.id, hospital.id);
      if (r.found) stack = { source: start.id, target: hospital.id, pushed: r.stackTrace.pushed, popped: r.stackTrace.popped, sample: true };
    }
  }

  const ordered = runtime.queue.toSortedArray();
  return {
    graph: {
      vertices: g.nodeCount(),
      edges: g.edgeCount(),
      adjacencyEntries: g.edgeCount() * 2,
      closedRoads: g.allEdges().filter((e) => e.isClosed).length,
      components: components.length,
      sample: nodes.slice(0, 8).map((n) => ({
        id: n.id,
        name: n.name,
        neighbors: g.neighbors(n.id).map(({ nodeId, edge }) => ({ to: nodeId, roadId: edge.id, time: edge.currentTravelTime, closed: edge.isClosed })),
      })),
    },
    hashTables,
    priorityQueue: {
      size: runtime.queue.size(),
      head: ordered.length ? emergencyBrief(ordered[0]) : null,
      ordered: ordered.map(emergencyBrief),
      heap: runtime.queue.heapArray(),
      comparisons: runtime.queue.heap.comparisons,
      swaps: runtime.queue.heap.swaps,
      priorities: SEVERITY_PRIORITY,
    },
    minHeapUse: 'Dijkstra uses a MinHeap keyed by tentative distance. The emergency queue uses a MinHeap with a priority then arrival comparator.',
    queue: {
      size: runtime.events.size(),
      pending: runtime.events.toArray().map((e) => ({ type: e.type, at: e.at })),
      processed: runtime.processedEvents.slice(-10),
    },
    stack,
    bfs: bfsResult && {
      start: start.id,
      startName: start.name,
      order: bfsResult.order,
      reachable: bfsResult.reachableCount,
      components: components.map((c) => c.length),
    },
  };
}

function inspectHash(tableName, key) {
  const def = tables()[tableName];
  if (!def) throw badRequest(`Unknown table. Choose one of: ${Object.keys(tables()).join(', ')}`);
  if (key === undefined || key === '') throw badRequest('A key is required');
  const info = def.table.inspect(String(key).slice(0, 64));
  let preview = null;
  if (info.found) {
    const v = def.table.get(key);
    if (tableName === 'nodes') preview = { id: v.id, name: v.name, type: v.type };
    else if (tableName === 'roads') preview = { id: v.id, from: nodeName(v.source), to: nodeName(v.destination), time: v.currentTravelTime };
    else if (tableName === 'movements') preview = { ambulanceId: v.ambulanceId, kind: v.kind, segments: v.roadIds.length };
    else preview = { id: v.id, status: v.status, name: v.name };
  }
  return { table: tableName, key: def.key, ...info, preview };
}

/** Inserts keys one by one into a fresh 4-bucket table and records each step. */
function hashDemo(keys) {
  if (!Array.isArray(keys) || keys.length === 0 || keys.length > 40) throw badRequest('Provide between 1 and 40 keys');
  const table = new HashTable(4);
  const steps = keys.map((raw) => {
    const key = String(raw).trim();
    if (!key || key.length > 32) throw badRequest('Each key must be 1 to 32 characters');
    const before = table.capacity;
    table.set(key, true);
    const info = table.inspect(key);
    return {
      key,
      hash: info.hash,
      bucket: info.bucket,
      chainLength: info.chain.length,
      capacity: table.capacity,
      resized: table.capacity !== before,
      size: table.size(),
      loadFactor: table.stats().loadFactor,
    };
  });
  return { steps, layout: table.layout(), stats: table.stats() };
}

module.exports = { overview, inspectHash, hashDemo };
