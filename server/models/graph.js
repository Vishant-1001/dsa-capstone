const { makeModel } = require('./factory');

const nodes = makeModel({
  table: 'nodes',
  columns: { id: 'id', name: 'name', type: 'type', x: 'x', y: 'y', createdAt: 'created_at' },
});

const roads = makeModel({
  table: 'roads',
  columns: {
    id: 'id',
    source: 'source',
    destination: 'destination',
    distance: 'distance',
    normalTravelTime: 'normal_travel_time',
    currentTravelTime: 'current_travel_time',
    trafficLevel: 'traffic_level',
    isClosed: 'is_closed',
    updatedAt: 'updated_at',
  },
  bool: ['isClosed'],
});

module.exports = { nodes, roads };
