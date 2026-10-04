process.env.RAPIDRESQ_DB = ':memory:';
process.env.JWT_SECRET = 'test-secret';

const request = require('supertest');
const createApp = require('../app');
const { bootstrap } = require('../bootstrap');
const { runtime } = require('../services/runtime');
const simulation = require('../services/simulation');
const { cell } = require('../services/exports');
const Graph = require('../datastructures/Graph');
const { dijkstra } = require('../algorithms/dijkstra');
const { astar } = require('../algorithms/astar');
const seed = require('../../database/seed');

function seedGraph() {
  const g = new Graph();
  seed.NODES.forEach(([id, name, type, x, y]) => g.addNode({ id, name, type, x, y }));
  seed.buildRoads().forEach((r) => g.addEdge({ id: r.id, source: r.source, destination: r.destination, distance: r.distance, normalTravelTime: r.time }));
  return g;
}

describe('A* search', () => {
  test('finds the same travel time as Dijkstra for every pair of nodes', () => {
    const g = seedGraph();
    const ids = g.allNodes().map((n) => n.id).sort();
    let dVisited = 0;
    let aVisited = 0;
    ids.forEach((a) => {
      ids.forEach((b) => {
        if (a === b) return;
        const d = dijkstra(g, a, b);
        const s = astar(g, a, b);
        expect(s.found).toBe(true);
        expect(s.estimatedTime).toBeCloseTo(d.estimatedTime, 1);
        dVisited += d.visitedNodes.length;
        aVisited += s.visitedNodes.length;
      });
    });
    expect(aVisited).toBeLessThan(dVisited);
  });

  test('agrees with Dijkstra after traffic and closures, and reports unreachable', () => {
    const g = seedGraph();
    g.setTraffic('R12', 'SEVERE');
    g.setTraffic('R18', 'HIGH');
    g.closeRoad('R19');
    expect(astar(g, 'ST1', 'N22').estimatedTime).toBeCloseTo(dijkstra(g, 'ST1', 'N22').estimatedTime, 1);
    g.closeRoad('R01');
    g.closeRoad('R09');
    const blocked = astar(g, 'ST1', 'N01');
    expect(blocked.found).toBe(false);
    expect(blocked.reason).toBe('UNREACHABLE');
    expect(astar(g, 'ST1', 'NOPE').found).toBe(false);
    expect(astar(g, 'N05', 'N05').path).toEqual(['N05']);
  });
});

describe('CSV cells', () => {
  test('quotes separators and neutralises formulas', () => {
    expect(cell('a,b')).toBe('"a,b"');
    expect(cell('say "hi"')).toBe('"say ""hi"""');
    expect(cell('=SUM(A1)')).toBe("'=SUM(A1)");
    expect(cell(-3.5)).toBe('-3.5');
    expect(cell(null)).toBe('');
  });
});

describe('API additions', () => {
  bootstrap();
  const app = createApp();
  let admin;
  let dispatcher;
  const as = (t) => ({ Authorization: `Bearer ${t}` });
  const get = (p, t = admin) => request(app).get(p).set(as(t));
  const post = (p, b, t = admin) => request(app).post(p).set(as(t)).send(b || {});
  const put = (p, b, t = admin) => request(app).put(p).set(as(t)).send(b || {});
  const login = async (u, p) => (await request(app).post('/api/auth/login').send({ username: u, password: p })).body.token;
  const runUntil = (fn, dt = 0.5, max = 4000) => {
    for (let i = 0; i < max; i += 1) {
      if (fn()) return true;
      simulation.advance(dt);
    }
    return fn();
  };
  const basic = (nodeId, severity = 'LOW', type = 'GENERAL') => ({ type, severity, nodeId, requiredEquipment: 'BASIC', requiredSpecialty: 'GENERAL' });

  beforeAll(async () => {
    admin = await login('admin', 'Admin@123');
    dispatcher = await login('dispatcher', 'Dispatch@123');
  });
  beforeEach(async () => {
    await post('/api/sim/reset');
  });

  test('route comparison returns both algorithms with work counters', async () => {
    const res = await post('/api/routes/compare', { source: 'ST1', target: 'N22' });
    expect(res.status).toBe(200);
    expect(res.body.dijkstra.algorithm).toBe('Dijkstra');
    expect(res.body.astar.algorithm).toBe('A*');
    expect(res.body.astar.estimatedTime).toBeCloseTo(res.body.dijkstra.estimatedTime, 1);
    expect(res.body.astar.stats.heapInserts).toBeGreaterThan(0);
    expect((await post('/api/routes/compare', { source: 'ST1', target: 'NOPE' })).status).toBe(400);
  });

  test('traffic presets change roads and CLEAR restores them', async () => {
    const morning = await post('/api/traffic/preset', { preset: 'MORNING_PEAK' });
    expect(morning.status).toBe(200);
    expect(morning.body.changedRoads).toBeGreaterThan(5);
    const levels = runtime.graph.allEdges().map((e) => e.trafficLevel);
    expect(levels).toContain('HIGH');
    expect(levels).toContain('MODERATE');
    expect((await post('/api/traffic/preset', { preset: 'CLEAR' })).status).toBe(200);
    expect(runtime.graph.allEdges().every((e) => e.trafficLevel === 'LOW')).toBe(true);
    expect((await post('/api/traffic/preset', { preset: 'NOPE' })).status).toBe(400);
    expect((await post('/api/traffic/preset', { preset: 'CLEAR' }, dispatcher)).status).toBe(403);
    expect((await get('/api/traffic/presets')).body.presets.length).toBe(3);
  });

  test('a preset reroutes an ambulance already on the road', async () => {
    await post('/api/emergencies', { type: 'CARDIAC', severity: 'CRITICAL', nodeId: 'N21', requiredEquipment: 'ALS', requiredSpecialty: 'CARDIAC' });
    await post('/api/dispatch/E-0001');
    simulation.advance(3);
    const res = await post('/api/traffic/preset', { preset: 'EVENING_PEAK' });
    expect(res.status).toBe(200);
    expect(res.body.effects.length).toBeGreaterThan(0);
  });

  test('CSV exports are admin only', async () => {
    await post('/api/emergencies', basic('N05'));
    await post('/api/dispatch/E-0001');
    const missions = await get('/api/missions/export.csv');
    expect(missions.status).toBe(200);
    expect(missions.headers['content-type']).toMatch(/text\/csv/);
    expect(missions.text.split('\r\n')[0]).toMatch(/^mission,emergency,type/);
    expect(missions.text).toMatch(/M-0001/);
    const traffic = await get('/api/traffic/export.csv');
    expect(traffic.status).toBe(200);
    expect(traffic.text.split('\r\n')[0]).toMatch(/^id,type,road/);
    expect((await get('/api/missions/export.csv', dispatcher)).status).toBe(403);
    expect((await get('/api/traffic/export.csv', dispatcher)).status).toBe(403);
  });

  test('hash table demo shows chains and resizing', async () => {
    const keys = ['A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7', 'A8', 'H1', 'H2', 'H3', 'H4'];
    const res = await post('/api/datastructures/hash-demo', { keys });
    expect(res.status).toBe(200);
    expect(res.body.steps.length).toBe(keys.length);
    expect(res.body.steps.some((s) => s.resized)).toBe(true);
    expect(res.body.stats.size).toBe(12);
    expect(res.body.stats.loadFactor).toBeLessThanOrEqual(0.75);
    expect((await post('/api/datastructures/hash-demo', { keys: [] })).status).toBe(400);
    expect((await post('/api/datastructures/hash-demo', { keys: ['x'.repeat(40)] })).status).toBe(400);
  });

  test('auto-return sends the ambulance back to its station after delivery', async () => {
    expect((await put('/api/sim', { autoReturn: true })).body.autoReturn).toBe(true);
    await post('/api/emergencies', { type: 'CARDIAC', severity: 'CRITICAL', nodeId: 'N21', requiredEquipment: 'ALS', requiredSpecialty: 'CARDIAC' });
    const unit = (await post('/api/dispatch/E-0001')).body.mission.ambulanceId;
    expect(runUntil(() => runtime.missions.get('M-0001').status === 'AT_SCENE')).toBe(true);
    await post('/api/missions/M-0001/pickup');
    expect(runUntil(() => !runtime.missions.has('M-0001'))).toBe(true);
    expect(runtime.ambulances.get(unit).status).toBe('RETURNING');
    expect(runUntil(() => runtime.ambulances.get(unit).status === 'AVAILABLE')).toBe(true);
    expect(runtime.ambulances.get(unit).nodeId).toBe(runtime.ambulances.get(unit).homeStationId);
    await put('/api/sim', { autoReturn: false });
  });

  test('a repeat report at the same place is merged into the waiting emergency', async () => {
    const first = await post('/api/emergencies', basic('N05', 'LOW', 'ACCIDENT'));
    expect(first.status).toBe(201);
    expect(first.body.merged).toBe(false);
    const second = await post('/api/emergencies', { ...basic('N05', 'CRITICAL', 'ACCIDENT'), description: 'Second caller' });
    expect(second.status).toBe(200);
    expect(second.body.merged).toBe(true);
    expect(second.body.emergency.id).toBe(first.body.emergency.id);
    expect(second.body.emergency.severity).toBe('CRITICAL');
    expect(second.body.emergency.description).toMatch(/Second caller/);
    const other = await post('/api/emergencies', basic('N05', 'LOW', 'CARDIAC'));
    expect(other.body.merged).toBe(false);
    expect((await get('/api/live')).body.queue.size).toBe(2);
  });
});
