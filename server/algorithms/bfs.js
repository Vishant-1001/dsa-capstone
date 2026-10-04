const Queue = require('../datastructures/Queue');
const HashTable = require('../datastructures/HashTable');

/**
 * Breadth-first search from a start node over open roads.
 * Returns the visit order, hop distance from the start, and the BFS parent of each node.
 * Complexity: O(V + E).
 */
function bfs(graph, startId) {
  if (!graph.hasNode(startId)) {
    return { found: false, start: startId, order: [], hops: {}, parent: {}, reachableCount: 0 };
  }
  const seen = new HashTable();
  const hops = {};
  const parent = {};
  const order = [];
  const queue = new Queue();

  seen.set(startId, true);
  hops[startId] = 0;
  queue.enqueue(startId);

  while (!queue.isEmpty()) {
    const current = queue.dequeue();
    order.push(current);
    const adjacent = graph.neighbors(current);
    for (let i = 0; i < adjacent.length; i += 1) {
      const { nodeId, edge } = adjacent[i];
      if (edge.isClosed || seen.has(nodeId)) continue;
      seen.set(nodeId, true);
      hops[nodeId] = hops[current] + 1;
      parent[nodeId] = current;
      queue.enqueue(nodeId);
    }
  }

  return { found: true, start: startId, order, hops, parent, reachableCount: order.length };
}

/** True when target can be reached from source using only open roads. */
function isReachable(graph, sourceId, targetId) {
  if (!graph.hasNode(sourceId) || !graph.hasNode(targetId)) return false;
  if (sourceId === targetId) return true;
  const result = bfs(graph, sourceId);
  return Object.prototype.hasOwnProperty.call(result.hops, targetId);
}

/** Connected components over open roads, each a sorted list of node ids. */
function connectedComponents(graph) {
  const remaining = graph.allNodes().map((n) => n.id).sort();
  const assigned = new HashTable();
  const components = [];
  for (let i = 0; i < remaining.length; i += 1) {
    const id = remaining[i];
    if (assigned.has(id)) continue;
    const { order } = bfs(graph, id);
    order.forEach((n) => assigned.set(n, true));
    components.push(order.slice().sort());
  }
  return components;
}

module.exports = { bfs, isReachable, connectedComponents };
