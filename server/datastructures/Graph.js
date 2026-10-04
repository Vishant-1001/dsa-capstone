const HashTable = require('./HashTable');
const { TRAFFIC_MULTIPLIER } = require('../constants');

const round2 = (n) => Math.round(n * 100) / 100;

/**
 * Weighted graph stored as an adjacency list.
 *
 * Vertices are in a HashTable (nodeId -> node). Each road is stored once in an
 * edge table (roadId -> edge) and referenced from the adjacency list of both
 * endpoints, because roads are two-way. So |E| counts roads once and the
 * adjacency list holds 2|E| entries.
 *
 * Space: O(V + E).
 */
class Graph {
  constructor() {
    this.nodes = new HashTable();
    this.edges = new HashTable();
    this.adjacency = new HashTable(); // nodeId -> [{ nodeId, edge }]
  }

  addNode(node) {
    if (!node || node.id === undefined || node.id === null || node.id === '') throw new Error('Node needs an id');
    if (this.nodes.has(node.id)) throw new Error(`Node ${node.id} already exists`);
    this.nodes.set(node.id, { ...node });
    this.adjacency.set(node.id, []);
    return this.nodes.get(node.id);
  }

  hasNode(id) {
    return this.nodes.has(id);
  }

  getNode(id) {
    return this.nodes.get(id) || null;
  }

  addEdge(input) {
    const { id, source, destination } = input;
    if (!id) throw new Error('Edge needs an id');
    if (this.edges.has(id)) throw new Error(`Road ${id} already exists`);
    if (!this.hasNode(source) || !this.hasNode(destination)) throw new Error('Both endpoints must exist');
    if (source === destination) throw new Error('A road cannot connect a node to itself');
    if (this.edgeBetween(source, destination)) throw new Error(`A road between ${source} and ${destination} already exists`);
    const distance = Number(input.distance);
    const normalTravelTime = Number(input.normalTravelTime);
    if (!(distance > 0) || !(normalTravelTime > 0)) throw new Error('Distance and travel time must be positive');

    const trafficLevel = input.trafficLevel || 'LOW';
    const multiplier = TRAFFIC_MULTIPLIER[trafficLevel];
    if (multiplier === undefined) throw new Error(`Unknown traffic level ${trafficLevel}`);
    const edge = {
      id,
      source,
      destination,
      distance,
      normalTravelTime,
      currentTravelTime: input.currentTravelTime !== undefined && input.currentTravelTime !== null
        ? Number(input.currentTravelTime)
        : round2(normalTravelTime * multiplier),
      trafficLevel,
      isClosed: Boolean(input.isClosed),
    };
    this.edges.set(id, edge);
    this.adjacency.get(source).push({ nodeId: destination, edge });
    this.adjacency.get(destination).push({ nodeId: source, edge });
    return edge;
  }

  getEdge(id) {
    return this.edges.get(id) || null;
  }

  /** Neighbours of a node as { nodeId, edge } pairs. */
  neighbors(nodeId) {
    return this.adjacency.get(nodeId) || [];
  }

  edgeBetween(a, b) {
    const list = this.adjacency.get(a);
    if (!list) return null;
    for (let i = 0; i < list.length; i += 1) {
      if (list[i].nodeId === b) return list[i].edge;
    }
    return null;
  }

  setTraffic(roadId, level) {
    const edge = this.getEdge(roadId);
    if (!edge) throw new Error(`Unknown road ${roadId}`);
    const multiplier = TRAFFIC_MULTIPLIER[level];
    if (multiplier === undefined) throw new Error(`Unknown traffic level ${level}`);
    edge.trafficLevel = level;
    edge.currentTravelTime = round2(edge.normalTravelTime * multiplier);
    return edge;
  }

  closeRoad(roadId) {
    const edge = this.getEdge(roadId);
    if (!edge) throw new Error(`Unknown road ${roadId}`);
    edge.isClosed = true;
    return edge;
  }

  reopenRoad(roadId) {
    const edge = this.getEdge(roadId);
    if (!edge) throw new Error(`Unknown road ${roadId}`);
    edge.isClosed = false;
    return edge;
  }

  nodeCount() {
    return this.nodes.size();
  }

  edgeCount() {
    return this.edges.size();
  }

  allNodes() {
    return this.nodes.values();
  }

  allEdges() {
    return this.edges.values();
  }

  /** Adjacency list as plain data: nodeId -> [{ to, roadId, time, closed }]. */
  toAdjacencyList() {
    const out = {};
    this.nodes.forEach((node, id) => {
      out[id] = this.neighbors(id).map(({ nodeId, edge }) => ({
        to: nodeId,
        roadId: edge.id,
        time: edge.currentTravelTime,
        closed: edge.isClosed,
      }));
    });
    return out;
  }
}

module.exports = Graph;
