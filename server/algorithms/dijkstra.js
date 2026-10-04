const MinHeap = require('../datastructures/MinHeap');
const HashTable = require('../datastructures/HashTable');
const Stack = require('../datastructures/Stack');

const round2 = (n) => Math.round(n * 100) / 100;

/**
 * Rebuilds source -> target by walking predecessor links back from the target.
 * Nodes are pushed on a Stack while walking backwards; popping the stack yields
 * the path in forward order.
 */
function reconstructPath(prevNode, prevEdge, sourceId, targetId) {
  const nodeStack = new Stack();
  const roadStack = new Stack();
  const pushed = [];
  let current = targetId;
  while (current !== undefined && current !== null) {
    nodeStack.push(current);
    pushed.push(current);
    if (current === sourceId) break;
    const edge = prevEdge.get(current);
    if (edge) roadStack.push(edge);
    current = prevNode.get(current);
  }
  const path = [];
  const popped = [];
  while (!nodeStack.isEmpty()) {
    const n = nodeStack.pop();
    path.push(n);
    popped.push(n);
  }
  const edges = [];
  while (!roadStack.isEmpty()) edges.push(roadStack.pop());
  return { path, edges, stackTrace: { pushed, popped } };
}

function failure(reason, extra) {
  return {
    algorithm: 'Dijkstra',
    found: false,
    reason,
    path: [],
    roadIds: [],
    totalDistance: null,
    estimatedTime: null,
    visitedNodes: [],
    ...extra,
  };
}

/**
 * Dijkstra's shortest path using a MinHeap as the priority queue.
 *
 * Closed roads are ignored. The default weight is the road's current travel
 * time (so traffic changes the answer); pass { weight: 'distance' } to
 * optimise kilometres instead. { trace: true } records every step for the
 * visualiser.
 *
 * Complexity: O((V + E) log V) with a binary heap and lazy deletion.
 *
 * Returns { found, path, roadIds, totalDistance, estimatedTime, visitedNodes, ... }.
 */
function dijkstra(graph, sourceId, targetId, options = {}) {
  const weightKey = options.weight === 'distance' ? 'distance' : 'currentTravelTime';
  const trace = Boolean(options.trace);

  if (!graph.hasNode(sourceId)) return failure('UNKNOWN_SOURCE', { source: sourceId, target: targetId });
  const hasTarget = targetId !== undefined && targetId !== null;
  if (hasTarget && !graph.hasNode(targetId)) return failure('UNKNOWN_TARGET', { source: sourceId, target: targetId });

  const dist = new HashTable();
  const prevNode = new HashTable();
  const prevEdge = new HashTable();
  const settled = new HashTable();
  const nodeIds = graph.allNodes().map((n) => n.id).sort();
  nodeIds.forEach((id) => dist.set(id, Infinity));
  dist.set(sourceId, 0);

  const heap = new MinHeap((a, b) => a.dist - b.dist);
  heap.insert({ nodeId: sourceId, dist: 0 });

  const visitedNodes = [];
  const steps = [];
  const stats = { heapInserts: 1, heapExtracts: 0, relaxations: 0 };

  const snapshot = (current, currentDist, relaxed) => {
    const distances = {};
    const previous = {};
    nodeIds.forEach((id) => {
      const d = dist.get(id);
      distances[id] = d === Infinity ? null : round2(d);
      if (prevNode.has(id)) previous[id] = prevNode.get(id);
    });
    steps.push({
      index: steps.length,
      current,
      currentDistance: currentDist === null ? null : round2(currentDist),
      visited: visitedNodes.slice(),
      distances,
      previous,
      heap: heap.toArray().map((h) => ({ nodeId: h.nodeId, dist: round2(h.dist) })),
      relaxed,
    });
  };

  if (trace) snapshot(null, null, []);

  while (!heap.isEmpty()) {
    const { nodeId, dist: d } = heap.extractMin();
    stats.heapExtracts += 1;
    if (settled.has(nodeId)) continue; // stale heap entry
    settled.set(nodeId, true);
    visitedNodes.push(nodeId);

    if (hasTarget && nodeId === targetId) {
      if (trace) snapshot(nodeId, d, []);
      break;
    }

    const relaxed = [];
    const adjacent = graph.neighbors(nodeId);
    for (let i = 0; i < adjacent.length; i += 1) {
      const { nodeId: next, edge } = adjacent[i];
      if (edge.isClosed || settled.has(next)) continue;
      const candidate = d + edge[weightKey];
      if (candidate < dist.get(next)) {
        dist.set(next, candidate);
        prevNode.set(next, nodeId);
        prevEdge.set(next, edge);
        heap.insert({ nodeId: next, dist: candidate });
        stats.heapInserts += 1;
        stats.relaxations += 1;
        relaxed.push({ from: nodeId, to: next, roadId: edge.id, distance: round2(candidate) });
      }
    }
    if (trace) snapshot(nodeId, d, relaxed);
  }

  if (!hasTarget) {
    const distances = {};
    nodeIds.forEach((id) => {
      distances[id] = dist.get(id) === Infinity ? null : round2(dist.get(id));
    });
    return { algorithm: 'Dijkstra', found: true, source: sourceId, target: null, distances, visitedNodes, stats, steps };
  }

  if (dist.get(targetId) === Infinity) {
    return failure('UNREACHABLE', { source: sourceId, target: targetId, visitedNodes, stats, steps });
  }

  const { path, edges, stackTrace } = reconstructPath(prevNode, prevEdge, sourceId, targetId);
  let totalDistance = 0;
  let estimatedTime = 0;
  edges.forEach((e) => {
    totalDistance += e.distance;
    estimatedTime += e.currentTravelTime;
  });

  return {
    algorithm: 'Dijkstra',
    found: true,
    source: sourceId,
    target: targetId,
    weight: weightKey === 'distance' ? 'distance' : 'time',
    path,
    roadIds: edges.map((e) => e.id),
    totalDistance: round2(totalDistance),
    estimatedTime: round2(estimatedTime),
    visitedNodes,
    stackTrace,
    stats,
    steps,
  };
}

module.exports = { dijkstra, reconstructPath };
