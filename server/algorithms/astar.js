const MinHeap = require('../datastructures/MinHeap');
const HashTable = require('../datastructures/HashTable');
const { reconstructPath } = require('./dijkstra');

const round2 = (n) => Math.round(n * 100) / 100;

// Map units are roughly 0.043 km. Seeded roads never exceed 45 km/h, so this stays admissible.
const KM_PER_UNIT = 0.04;
const MAX_SPEED_KMH = 50;

function heuristic(a, b) {
  return (Math.hypot(a.x - b.x, a.y - b.y) * KM_PER_UNIT * 60) / MAX_SPEED_KMH;
}

/**
 * A* shortest path on travel time. Same inputs and outputs as dijkstra(), but the heap is
 * ordered by g + h, where h is the straight-line travel time at the fastest allowed speed.
 * Nodes may be reopened, so the answer stays optimal even if h is not consistent.
 */
function astar(graph, sourceId, targetId) {
  const fail = (reason) => ({
    algorithm: 'A*', found: false, reason, path: [], roadIds: [], totalDistance: null, estimatedTime: null, visitedNodes: [],
    stats: { heapInserts: 0, heapExtracts: 0, relaxations: 0 },
  });
  if (!graph.hasNode(sourceId) || !graph.hasNode(targetId)) return fail('UNKNOWN_NODE');

  const goal = graph.getNode(targetId);
  const g = new HashTable();
  const prevNode = new HashTable();
  const prevEdge = new HashTable();
  g.set(sourceId, 0);
  const heap = new MinHeap((a, b) => a.f - b.f);
  heap.insert({ nodeId: sourceId, g: 0, f: heuristic(graph.getNode(sourceId), goal) });

  const visited = [];
  const seen = new HashTable();
  const stats = { heapInserts: 1, heapExtracts: 0, relaxations: 0 };

  while (!heap.isEmpty()) {
    const cur = heap.extractMin();
    stats.heapExtracts += 1;
    if (cur.g > g.get(cur.nodeId)) continue; // outdated entry
    if (!seen.has(cur.nodeId)) {
      seen.set(cur.nodeId, true);
      visited.push(cur.nodeId);
    }
    if (cur.nodeId === targetId) break;

    const adjacent = graph.neighbors(cur.nodeId);
    for (let i = 0; i < adjacent.length; i += 1) {
      const { nodeId: next, edge } = adjacent[i];
      if (edge.isClosed) continue;
      const candidate = cur.g + edge.currentTravelTime;
      const known = g.get(next);
      if (known === undefined || candidate < known) {
        g.set(next, candidate);
        prevNode.set(next, cur.nodeId);
        prevEdge.set(next, edge);
        heap.insert({ nodeId: next, g: candidate, f: candidate + heuristic(graph.getNode(next), goal) });
        stats.heapInserts += 1;
        stats.relaxations += 1;
      }
    }
  }

  if (!g.has(targetId)) return { ...fail('UNREACHABLE'), source: sourceId, target: targetId, visitedNodes: visited, stats };

  const { path, edges } = reconstructPath(prevNode, prevEdge, sourceId, targetId);
  let totalDistance = 0;
  let estimatedTime = 0;
  edges.forEach((e) => {
    totalDistance += e.distance;
    estimatedTime += e.currentTravelTime;
  });
  return {
    algorithm: 'A*',
    found: true,
    source: sourceId,
    target: targetId,
    path,
    roadIds: edges.map((e) => e.id),
    totalDistance: round2(totalDistance),
    estimatedTime: round2(estimatedTime),
    visitedNodes: visited,
    stats,
  };
}

module.exports = { astar, heuristic };
