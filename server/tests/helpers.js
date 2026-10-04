const Graph = require('../datastructures/Graph');

/**
 * Small test network.
 *
 *   A --4-- B --5-- D --6-- F
 *   |      /|       |      /
 *   2    1  |       2     3
 *   |  /    8       |    /
 *   C ------+------ E ---+
 *   (C-D 8, C-E 10, A-B 4, C-B 1)
 *
 * G has no roads (disconnected).
 */
const ROADS = [
  ['R1', 'A', 'B', 4],
  ['R2', 'A', 'C', 2],
  ['R3', 'C', 'B', 1],
  ['R4', 'B', 'D', 5],
  ['R5', 'C', 'D', 8],
  ['R6', 'C', 'E', 10],
  ['R7', 'D', 'E', 2],
  ['R8', 'D', 'F', 6],
  ['R9', 'E', 'F', 3],
];

function buildGraph(extraRoads = []) {
  const g = new Graph();
  'ABCDEFG'.split('').forEach((id, i) => g.addNode({ id, name: `Node ${id}`, type: 'JUNCTION', x: i * 10, y: 0 }));
  ROADS.concat(extraRoads).forEach(([id, s, d, t]) => {
    g.addEdge({ id, source: s, destination: d, distance: Number((t * 0.8).toFixed(2)), normalTravelTime: t });
  });
  return g;
}

const amb = (id, nodeId, equipment = 'BASIC', status = 'AVAILABLE') => ({ id, nodeId, equipment, status });
const hosp = (id, nodeId, extra = {}) => ({
  id,
  name: `Hospital ${id}`,
  nodeId,
  availableBeds: 5,
  status: 'OPEN',
  specialties: ['GENERAL'],
  ...extra,
});

module.exports = { buildGraph, amb, hosp };
