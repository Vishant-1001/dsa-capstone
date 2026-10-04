process.env.RAPIDRESQ_DB = ':memory:';
process.env.JWT_SECRET = 'test-secret';

const request = require('supertest');
const createApp = require('../app');
const { bootstrap } = require('../bootstrap');
const { runtime, load } = require('../services/runtime');
const simulation = require('../services/simulation');
const demo = require('../services/demo');

bootstrap();
const app = createApp();

let adminToken;
let dispatcherToken;

const login = async (username, password) => {
  const res = await request(app).post('/api/auth/login').send({ username, password });
  return res.body.token;
};
const as = (token) => ({ Authorization: `Bearer ${token}` });
const get = (path, token = adminToken) => request(app).get(path).set(as(token));
const post = (path, body, token = adminToken) => request(app).post(path).set(as(token)).send(body || {});
const put = (path, body, token = adminToken) => request(app).put(path).set(as(token)).send(body || {});
const del = (path, token = adminToken) => request(app).delete(path).set(as(token));

const cardiac = { type: 'CARDIAC', severity: 'CRITICAL', nodeId: 'N21', requiredEquipment: 'ALS', requiredSpecialty: 'CARDIAC', description: 'test' };
const basic = (nodeId, severity = 'LOW') => ({ type: 'GENERAL', severity, nodeId, requiredEquipment: 'BASIC', requiredSpecialty: 'GENERAL' });

function runUntil(predicate, dt = 0.5, max = 4000) {
  for (let i = 0; i < max; i += 1) {
    if (predicate()) return true;
    simulation.advance(dt);
  }
  return predicate();
}
const missionStatus = (id) => (runtime.missions.get(id) ? runtime.missions.get(id).status : 'GONE');

async function findRoad(a, b) {
  const res = await get('/api/traffic');
  return res.body.roads.find((r) => (r.source === a && r.destination === b) || (r.source === b && r.destination === a));
}

beforeAll(async () => {
  adminToken = await login('admin', 'Admin@123');
  dispatcherToken = await login('dispatcher', 'Dispatch@123');
});

beforeEach(async () => {
  await post('/api/sim/reset');
});

describe('authentication and roles', () => {
  test('rejects bad credentials and missing tokens', async () => {
    const bad = await request(app).post('/api/auth/login').send({ username: 'admin', password: 'wrong' });
    expect(bad.status).toBe(401);
    expect(bad.body.error.message).toBe('Invalid username or password');
    expect((await request(app).post('/api/auth/login').send({})).status).toBe(400);
    expect((await request(app).get('/api/live')).status).toBe(401);
    expect((await request(app).get('/api/live').set({ Authorization: 'Bearer nonsense' })).status).toBe(401);
  });

  test('logout revokes the token', async () => {
    const token = await login('dispatcher', 'Dispatch@123');
    expect((await get('/api/auth/me', token)).body.user.role).toBe('DISPATCHER');
    expect((await post('/api/auth/logout', {}, token)).status).toBe(200);
    expect((await get('/api/auth/me', token)).status).toBe(401);
  });

  test('dispatchers cannot use admin endpoints', async () => {
    expect((await get('/api/analytics', dispatcherToken)).status).toBe(403);
    expect((await put('/api/roads/R01/close', {}, dispatcherToken)).status).toBe(403);
    expect((await post('/api/ambulances', { id: 'A9', equipment: 'BASIC', nodeId: 'ST1' }, dispatcherToken)).status).toBe(403);
    expect((await get('/api/missions', dispatcherToken)).status).toBe(403);
    expect((await get('/api/analytics')).status).toBe(200);
  });
});

describe('emergency reporting and the priority queue', () => {
  test('validates input', async () => {
    expect((await post('/api/emergencies', {})).status).toBe(400);
    expect((await post('/api/emergencies', { ...cardiac, nodeId: 'NOPE' })).status).toBe(400);
    expect((await post('/api/emergencies', { ...cardiac, nodeId: 'ST1' })).status).toBe(400);
    expect((await post('/api/emergencies', { ...cardiac, severity: 'URGENT' })).status).toBe(400);
    expect((await post('/api/emergencies', { ...cardiac, description: 'x'.repeat(400) })).status).toBe(400);
  });

  test('orders E1 critical, E2 low, E3 high as E1, E3, E2', async () => {
    const e2 = (await post('/api/emergencies', basic('N05', 'LOW'))).body.emergency;
    const e1 = (await post('/api/emergencies', basic('N06', 'CRITICAL'))).body.emergency;
    const e3 = (await post('/api/emergencies', basic('N07', 'HIGH'))).body.emergency;
    const live = (await get('/api/live')).body;
    expect(live.queue.ordered.map((e) => e.id)).toEqual([e1.id, e3.id, e2.id]);
    expect(live.queue.size).toBe(3);
    expect(live.queue.heap.length).toBe(3);
    expect(live.kpis.totalEmergencies).toBe(3);
  });

  test('equal priority keeps arrival order', async () => {
    const a = (await post('/api/emergencies', basic('N05', 'HIGH'))).body.emergency;
    const b = (await post('/api/emergencies', basic('N06', 'HIGH'))).body.emergency;
    const live = (await get('/api/live')).body;
    expect(live.queue.ordered.map((e) => e.id)).toEqual([a.id, b.id]);
  });

  test('changing severity re-prioritises a pending emergency', async () => {
    const a = (await post('/api/emergencies', basic('N05', 'LOW'))).body.emergency;
    const b = (await post('/api/emergencies', basic('N06', 'MEDIUM'))).body.emergency;
    expect((await put(`/api/emergencies/${a.id}`, { severity: 'CRITICAL' })).status).toBe(200);
    expect((await get('/api/live')).body.queue.ordered.map((e) => e.id)).toEqual([a.id, b.id]);
  });

  test('cancelling removes it from the queue', async () => {
    const a = (await post('/api/emergencies', basic('N05'))).body.emergency;
    const res = await del(`/api/emergencies/${a.id}`);
    expect(res.body.emergency.status).toBe('CANCELLED');
    expect((await get('/api/live')).body.queue.size).toBe(0);
    expect((await del(`/api/emergencies/${a.id}`)).body.deleted).toBe(true);
  });

  test('a lower priority emergency cannot jump the queue unless the override is used', async () => {
    const low = (await post('/api/emergencies', basic('N05', 'LOW'))).body.emergency;
    const crit = (await post('/api/emergencies', basic('N06', 'CRITICAL'))).body.emergency;
    const blocked = await post(`/api/dispatch/${low.id}`);
    expect(blocked.status).toBe(409);
    expect(blocked.body.error.code).toBe('HIGHER_PRIORITY_PENDING');
    expect(blocked.body.error.details.blockingEmergencyId).toBe(crit.id);
    const next = await post('/api/dispatch/next');
    expect(next.body.mission.emergencyId).toBe(crit.id);
    expect((await post(`/api/dispatch/${low.id}`)).status).toBe(201);
  });
});

describe('dispatch rules', () => {
  test('recommends the ALS ambulance with the lowest travel time', async () => {
    const e = (await post('/api/emergencies', cardiac)).body.emergency;
    const rec = (await get(`/api/dispatch/${e.id}/recommendation`)).body.recommendation;
    expect(rec.selection.code).toBe('OK');
    expect(rec.selection.pipeline.equipmentMatch.sort()).toEqual(['A2', 'A5']);
    expect(rec.selection.selected.ambulanceId).toBe('A2');
    expect(rec.selection.candidates.length).toBeGreaterThanOrEqual(2);
  });

  test('no suitable equipment', async () => {
    await put('/api/ambulances/A2', { status: 'OFFLINE' });
    await put('/api/ambulances/A5', { status: 'OFFLINE' });
    const e = (await post('/api/emergencies', cardiac)).body.emergency;
    const res = await post(`/api/dispatch/${e.id}`);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('NO_SUITABLE_EQUIPMENT');
    expect((await get('/api/live')).body.queue.size).toBe(1);
  });

  test('no available ambulance', async () => {
    const ids = ['A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7', 'A8'];
    for (const id of ids) await put(`/api/ambulances/${id}`, { status: 'OFFLINE' });
    const e = (await post('/api/emergencies', basic('N05'))).body.emergency;
    const res = await post(`/api/dispatch/${e.id}`);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('NO_AVAILABLE_AMBULANCE');
  });

  test('two emergencies run as simultaneous missions on different ambulances', async () => {
    await post('/api/emergencies', basic('N05', 'HIGH'));
    await post('/api/emergencies', basic('N19', 'MEDIUM'));
    const first = (await post('/api/dispatch/next')).body.mission;
    const second = (await post('/api/dispatch/next')).body.mission;
    expect(first.ambulanceId).not.toBe(second.ambulanceId);
    const live = (await get('/api/live')).body;
    expect(live.kpis.activeMissions).toBe(2);
    expect(live.ambulances.filter((a) => a.movement).length).toBe(2);
    expect((await post('/api/dispatch/next')).status).toBe(409);
  });

  test('dispatching twice is rejected', async () => {
    const e = (await post('/api/emergencies', basic('N05'))).body.emergency;
    expect((await post(`/api/dispatch/${e.id}`)).status).toBe(201);
    const again = await post(`/api/dispatch/${e.id}`);
    expect(again.status).toBe(409);
    expect((await post('/api/dispatch/E-9999')).status).toBe(404);
  });
});

describe('full mission lifecycle', () => {
  test('emergency to dispatch to scene to pickup to hospital to completion', async () => {
    const e = (await post('/api/emergencies', cardiac)).body.emergency;
    const dispatched = await post(`/api/dispatch/${e.id}`);
    expect(dispatched.status).toBe(201);
    const missionId = dispatched.body.mission.id;
    expect(dispatched.body.mission.ambulanceId).toBe('A2');
    expect(dispatched.body.mission.status).toBe('DISPATCHED');

    simulation.advance(0.25);
    simulation.advance(1.5);
    expect(missionStatus(missionId)).toBe('EN_ROUTE');
    const mid = (await get('/api/live')).body;
    expect(mid.ambulances.find((a) => a.id === 'A2').status).toBe('EN_ROUTE');
    expect(mid.missions[0].movement.etaMinutes).toBeGreaterThan(0);

    expect(runUntil(() => missionStatus(missionId) === 'AT_SCENE')).toBe(true);
    const arrived = (await get(`/api/missions/${missionId}`)).body.mission;
    expect(arrived.responseTime).toBeGreaterThan(0);
    expect((await get('/api/live')).body.ambulances.find((a) => a.id === 'A2').status).toBe('AT_SCENE');

    const pick = await post(`/api/missions/${missionId}/pickup`);
    expect(pick.status).toBe(200);
    const hid = pick.body.selection.selected.hospitalId;
    const bedsBefore = runtime.hospitals.get(hid).availableBeds + 0;
    const hospitalNode = runtime.hospitals.get(hid).nodeId;
    const hospitalName = runtime.hospitals.get(hid).name;
    expect(pick.body.mission.status).toBe('TRANSPORTING');
    expect((await post(`/api/missions/${missionId}/pickup`)).status).toBe(409);

    expect(runUntil(() => missionStatus(missionId) === 'GONE')).toBe(true);
    const done = (await get(`/api/missions/${missionId}`)).body.mission;
    expect(done.status).toBe('COMPLETED');
    expect(done.hospitalId).toBe(hid);
    expect(done.totalDistance).toBeGreaterThan(0);
    expect(done.travelTime).toBeGreaterThan(done.responseTime);
    expect(runtime.hospitals.get(hid).availableBeds).toBe(bedsBefore - 1);
    const a2 = (await get('/api/ambulances/A2')).body.ambulance;
    expect(a2.status).toBe('AVAILABLE');
    expect(a2.nodeId).toBe(hospitalNode);
    expect(a2.distanceTravelled).toBeGreaterThan(0);
    expect(a2.completedMissions).toBe(1);

    const history = (await get('/api/missions?status=COMPLETED')).body.missions;
    expect(history.length).toBe(1);
    expect(history[0].hospitalName).toBe(hospitalName);
    const analytics = (await get('/api/analytics')).body;
    expect(analytics.totals.completedMissions).toBe(1);
    expect(analytics.severityDistribution.find((s) => s.severity === 'CRITICAL').count).toBe(1);
    expect(analytics.hospitalUsage.find((h) => h.id === hid).patients).toBe(1);
    const kpis = (await get('/api/live')).body.kpis;
    expect(kpis.completedMissions).toBe(1);
    expect(kpis.avgResponseTime).toBeGreaterThan(0);
    expect((await get(`/api/emergencies/${e.id}`)).body.emergency.status).toBe('COMPLETED');
  });

  test('state survives a server restart mid-mission', async () => {
    const e = (await post('/api/emergencies', cardiac)).body.emergency;
    const missionId = (await post(`/api/dispatch/${e.id}`)).body.mission.id;
    simulation.advance(6);
    const before = runtime.movements.get('A2');
    const snapshot = { seg: before.segIndex, frac: before.frac, path: before.path.join() };
    load();
    const after = runtime.movements.get('A2');
    expect(after.path.join()).toBe(snapshot.path);
    expect(after.segIndex).toBe(snapshot.seg);
    expect(after.frac).toBeCloseTo(snapshot.frac, 5);
    expect(runUntil(() => missionStatus(missionId) === 'AT_SCENE')).toBe(true);
  });

  test('cancelling an active mission frees the ambulance', async () => {
    const e = (await post('/api/emergencies', basic('N05'))).body.emergency;
    const { mission } = (await post(`/api/dispatch/${e.id}`)).body;
    simulation.advance(2);
    const res = await del(`/api/emergencies/${e.id}`);
    expect(res.body.emergency.status).toBe('CANCELLED');
    expect(runtime.ambulances.get(mission.ambulanceId).status).toBe('AVAILABLE');
    expect(runtime.movements.size()).toBe(0);
  });

  test('complete now finishes a transport in progress', async () => {
    const e = (await post('/api/emergencies', cardiac)).body.emergency;
    const missionId = (await post(`/api/dispatch/${e.id}`)).body.mission.id;
    expect((await post(`/api/missions/${missionId}/complete`)).status).toBe(409);
    runUntil(() => missionStatus(missionId) === 'AT_SCENE');
    await post(`/api/missions/${missionId}/pickup`);
    const res = await post(`/api/missions/${missionId}/complete`);
    expect(res.status).toBe(200);
    expect(res.body.mission.status).toBe('COMPLETED');
  });
});

describe('hospital selection through the API', () => {
  async function atScene() {
    const e = (await post('/api/emergencies', cardiac)).body.emergency;
    const missionId = (await post(`/api/dispatch/${e.id}`)).body.mission.id;
    runUntil(() => missionStatus(missionId) === 'AT_SCENE');
    return missionId;
  }

  test('no hospital offers the specialty, then one reopens', async () => {
    const missionId = await atScene();
    await put('/api/hospitals/H1', { status: 'CLOSED' });
    await put('/api/hospitals/H2', { status: 'CLOSED' });
    await put('/api/hospitals/H5', { status: 'CLOSED' });
    const res = await post(`/api/missions/${missionId}/pickup`);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('NO_SPECIALTY_MATCH');
    expect(missionStatus(missionId)).toBe('AT_SCENE');
    await put('/api/hospitals/H2', { status: 'OPEN' });
    const ok = await post(`/api/missions/${missionId}/pickup`);
    expect(ok.status).toBe(200);
    expect(ok.body.selection.selected.hospitalId).toBe('H2');
  });

  test('no beds anywhere', async () => {
    const missionId = await atScene();
    for (const id of ['H1', 'H2', 'H3', 'H4', 'H5']) await put(`/api/hospitals/${id}`, { availableBeds: 0 });
    const res = await post(`/api/missions/${missionId}/pickup`);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('NO_HOSPITAL_BEDS');
  });

  test('a hospital that fills up during transport diverts the ambulance', async () => {
    const missionId = await atScene();
    const before = {};
    runtime.hospitals.values().forEach((h) => { before[h.id] = h.availableBeds; });
    const first = (await post(`/api/missions/${missionId}/pickup`)).body.selection.selected.hospitalId;
    await put(`/api/hospitals/${first}`, { availableBeds: 0 });
    expect(runUntil(() => missionStatus(missionId) === 'GONE')).toBe(true);
    const done = (await get(`/api/missions/${missionId}`)).body.mission;
    expect(done.status).toBe('COMPLETED');
    expect(done.hospitalId).not.toBe(first);
    expect(['H1', 'H2', 'H5']).toContain(done.hospitalId);
    expect(runtime.hospitals.get(done.hospitalId).availableBeds).toBe(before[done.hospitalId] - 1);
  });

  test('hospital updates are validated', async () => {
    expect((await put('/api/hospitals/H1', { availableBeds: 99 })).status).toBe(400);
    expect((await put('/api/hospitals/H1', { specialties: [] })).status).toBe(400);
    expect((await put('/api/hospitals/H1', { specialties: ['MAGIC'] })).status).toBe(400);
    expect((await put('/api/hospitals/NOPE', { name: 'x' })).status).toBe(404);
    const ok = await put('/api/hospitals/H5', { totalBeds: 30, availableBeds: 20, specialties: ['GENERAL', 'BURN'] });
    expect(ok.body.hospital.specialties).toEqual(['BURN', 'GENERAL']);
  });
});

describe('traffic, closures and rerouting', () => {
  test('closing a road on the route reroutes the ambulance', async () => {
    const e = (await post('/api/emergencies', cardiac)).body.emergency;
    const { mission } = (await post(`/api/dispatch/${e.id}`)).body;
    simulation.advance(4);
    const m = runtime.movements.get('A2');
    const upcoming = m.roadIds[m.segIndex + 1];
    const etaBefore = (await get('/api/live')).body.ambulances.find((a) => a.id === 'A2').movement.etaMinutes;
    const res = await put(`/api/roads/${upcoming}/close`);
    expect(res.status).toBe(200);
    const effect = res.body.effects.find((x) => x.ambulanceId === 'A2');
    expect(effect.status).toBe('REROUTED');
    expect(effect.etaAfter).toBeGreaterThanOrEqual(etaBefore - 0.01);
    const newMove = runtime.movements.get('A2');
    expect(newMove.roadIds).not.toContain(upcoming);
    expect(runtime.missions.get(mission.id).rerouteCount).toBe(1);
    expect((await get('/api/live')).body.notifications.some((n) => n.type === 'ROUTE_RECALCULATED')).toBe(true);
    expect(runUntil(() => missionStatus(mission.id) === 'AT_SCENE')).toBe(true);
  });

  test('severe traffic on the route changes the ETA', async () => {
    const e = (await post('/api/emergencies', cardiac)).body.emergency;
    await post(`/api/dispatch/${e.id}`);
    simulation.advance(3);
    const m = runtime.movements.get('A2');
    const before = (await get('/api/live')).body.ambulances.find((a) => a.id === 'A2').movement.etaMinutes;
    const road = m.roadIds[m.roadIds.length - 1];
    const res = await put(`/api/roads/${road}/traffic`, { level: 'SEVERE' });
    expect(res.status).toBe(200);
    expect(res.body.road.trafficLevel).toBe('SEVERE');
    const after = (await get('/api/live')).body.ambulances.find((a) => a.id === 'A2').movement.etaMinutes;
    expect(after).toBeGreaterThan(before - 0.01);
    expect((await put(`/api/roads/${road}/traffic`, { level: 'BOGUS' })).status).toBe(400);
    expect((await put('/api/roads/NOPE/traffic', { level: 'LOW' })).status).toBe(404);
  });

  test('an unreachable destination is reported, then recovers when a road reopens', async () => {
    const e = (await post('/api/emergencies', { ...cardiac, nodeId: 'N01' })).body.emergency;
    const { mission } = (await post(`/api/dispatch/${e.id}`)).body;
    const unit = mission.ambulanceId;
    simulation.advance(3);
    const r1 = await findRoad('N01', 'N02');
    const r2 = await findRoad('N01', 'N06');
    expect((await put(`/api/roads/${r1.id}/close`)).status).toBe(200);
    const closed = await put(`/api/roads/${r2.id}/close`);
    expect(closed.body.effects.find((x) => x.ambulanceId === unit).status).toBe('UNREACHABLE');
    const live = (await get('/api/live')).body;
    expect(live.missions[0].blocked).toBe(true);
    expect(live.notifications.some((n) => n.title === 'DESTINATION CURRENTLY UNREACHABLE')).toBe(true);
    expect(live.alerts.some((a) => a.title === 'Destination unreachable')).toBe(true);

    const pos = runtime.movements.get(unit).segIndex;
    simulation.advance(5);
    expect(runtime.movements.get(unit).segIndex).toBe(pos);

    const reopened = await put(`/api/roads/${r2.id}/reopen`);
    expect(reopened.body.effects.find((x) => x.ambulanceId === unit).status).toBe('RESTORED');
    expect(runUntil(() => missionStatus(mission.id) === 'AT_SCENE')).toBe(true);
    expect((await put(`/api/roads/${r2.id}/reopen`)).status).toBe(409);
  });

  test('a closed road makes dispatch pick the reachable ambulance', async () => {
    const e = (await post('/api/emergencies', basic('N01', 'HIGH'))).body.emergency;
    const rec = (await get(`/api/dispatch/${e.id}/recommendation`)).body.recommendation;
    expect(rec.selection.selected).toBeTruthy();
    const slow = await findRoad('N01', 'N02');
    const other = await findRoad('N01', 'N06');
    await put(`/api/roads/${slow.id}/close`);
    await put(`/api/roads/${other.id}/close`);
    const blocked = await get(`/api/dispatch/${e.id}/recommendation`);
    expect(blocked.body.recommendation.selection.code).toBe('NO_REACHABLE_AMBULANCE');
    const res = await post(`/api/dispatch/${e.id}`);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('NO_REACHABLE_AMBULANCE');
  });
});

describe('graph, ambulance and hospital administration', () => {
  test('graph snapshot matches the required size', async () => {
    const g = (await get('/api/graph')).body;
    expect(g.nodes.length).toBe(30);
    expect(g.roads.length).toBe(50);
    expect(g.stats.components).toBe(1);
    expect(g.nodes.filter((n) => n.type === 'STATION').length).toBe(3);
    expect(g.nodes.filter((n) => n.type === 'HOSPITAL').length).toBe(5);
    expect(runtime.ambulances.size()).toBe(8);
  });

  test('adds nodes and roads and rejects duplicates', async () => {
    const node = { id: 'X1', name: 'New Depot', type: 'JUNCTION', x: 500, y: 300 };
    expect((await post('/api/graph/nodes', node)).status).toBe(201);
    expect((await post('/api/graph/nodes', node)).status).toBe(409);
    expect((await post('/api/graph/nodes', { ...node, id: 'X2', type: 'ROCKET' })).status).toBe(400);
    const road = await post('/api/graph/roads', { source: 'X1', destination: 'N08', distance: 2.5 });
    expect(road.status).toBe(201);
    expect(road.body.roads.length).toBe(51);
    expect((await post('/api/graph/roads', { source: 'X1', destination: 'N08', distance: 2.5 })).status).toBe(409);
    expect((await post('/api/graph/roads', { source: 'X1', destination: 'ZZ', distance: 2.5 })).status).toBe(400);
    expect((await post('/api/graph/roads', { source: 'X1', destination: 'N09', distance: -3 })).status).toBe(400);
  });

  test('ambulance management persists and validates', async () => {
    const created = await post('/api/ambulances', { id: 'a9', equipment: 'ALS', nodeId: 'ST3' });
    expect(created.status).toBe(201);
    expect(created.body.ambulance.id).toBe('A9');
    expect((await post('/api/ambulances', { id: 'A9', equipment: 'ALS', nodeId: 'ST3' })).status).toBe(409);
    expect((await post('/api/ambulances', { id: 'A10', equipment: 'JET', nodeId: 'ST3' })).status).toBe(400);
    expect((await post('/api/ambulances', { id: 'A10', equipment: 'ALS', nodeId: 'NOPE' })).status).toBe(400);
    expect((await put('/api/ambulances/A9', { status: 'OFFLINE' })).body.ambulance.status).toBe('OFFLINE');
    expect((await put('/api/ambulances/A9', { status: 'OFFLINE' })).status).toBe(409);
    expect((await put('/api/ambulances/A9', { status: 'AVAILABLE', name: 'Reserve' })).body.ambulance.name).toBe('Reserve');
    expect((await put('/api/ambulances/A9', { status: 'EN_ROUTE' })).status).toBe(400);
    expect((await get('/api/ambulances/NOPE')).status).toBe(404);
  });

  test('an ambulance on a mission cannot be edited or set offline', async () => {
    const e = (await post('/api/emergencies', cardiac)).body.emergency;
    await post(`/api/dispatch/${e.id}`);
    expect((await put('/api/ambulances/A2', { status: 'OFFLINE' })).status).toBe(409);
    expect((await put('/api/ambulances/A2', { equipment: 'BASIC' })).status).toBe(409);
  });

  test('available ambulances can return to station', async () => {
    await put('/api/ambulances/A1', { nodeId: 'N08' });
    const res = await post('/api/ambulances/A1/return');
    expect(res.body.ambulance.status).toBe('RETURNING');
    expect((await post('/api/ambulances/A2/return')).status).toBe(409);
    expect(runUntil(() => runtime.ambulances.get('A1').status === 'AVAILABLE')).toBe(true);
    expect(runtime.ambulances.get('A1').nodeId).toBe('ST1');
  });

  test('hospital creation needs a free hospital node', async () => {
    const body = { id: 'H6', name: 'Test Clinic', nodeId: 'HN1', totalBeds: 10, specialties: ['GENERAL'] };
    expect((await post('/api/hospitals', body)).status).toBe(409);
    await post('/api/graph/nodes', { id: 'HN6', name: 'Test Clinic', type: 'HOSPITAL', x: 600, y: 300 });
    expect((await post('/api/hospitals', { ...body, nodeId: 'N01' })).status).toBe(400);
    const ok = await post('/api/hospitals', { ...body, nodeId: 'HN6' });
    expect(ok.status).toBe(201);
    expect(ok.body.hospital.availableBeds).toBe(10);
    expect((await post('/api/hospitals', { ...body, nodeId: 'HN6' })).status).toBe(409);
  });
});

describe('routes, data structures and errors', () => {
  test('Dijkstra route calculation with trace and BFS reachability', async () => {
    const res = await post('/api/routes/calculate', { source: 'ST1', target: 'HN3', trace: true });
    expect(res.body.route.found).toBe(true);
    expect(res.body.route.path[0]).toBe('ST1');
    expect(res.body.route.path[res.body.route.path.length - 1]).toBe('HN3');
    expect(res.body.route.steps.length).toBeGreaterThan(3);
    expect((await post('/api/routes/calculate', { source: 'ST1', target: 'NOPE' })).status).toBe(400);
    const bfs = await post('/api/routes/bfs', { start: 'ST1' });
    expect(bfs.body.bfs.reachableCount).toBe(30);
    expect(bfs.body.bfs.unreachable).toEqual([]);
  });

  test('data structures overview reports live structures', async () => {
    await post('/api/emergencies', basic('N05', 'HIGH'));
    const ds = (await get('/api/datastructures')).body;
    expect(ds.graph.vertices).toBe(30);
    expect(ds.graph.adjacencyEntries).toBe(100);
    expect(ds.priorityQueue.size).toBe(1);
    expect(ds.hashTables.find((t) => t.name === 'ambulances').stats.size).toBe(8);
    const lookup = (await get('/api/datastructures/hash?table=ambulances&key=A3')).body.inspect;
    expect(lookup.found).toBe(true);
    expect((await get('/api/datastructures/hash?table=bogus&key=A3')).status).toBe(400);
  });

  test('unknown routes and bad JSON do not crash the server', async () => {
    expect((await get('/api/nothing-here')).status).toBe(404);
    const bad = await request(app).post('/api/auth/login').set('Content-Type', 'application/json').send('{broken');
    expect(bad.status).toBe(400);
    expect((await get('/api/health')).body.status).toBe('ok');
    expect((await get('/api/emergencies/E-9999')).status).toBe(404);
    expect((await get('/api/missions/M-9999')).status).toBe(404);
  });

  test('simulation controls', async () => {
    expect((await put('/api/sim', { speed: 4 })).body.speed).toBe(4);
    expect((await put('/api/sim', { speed: 7 })).status).toBe(400);
    expect((await put('/api/sim', { paused: true })).body.paused).toBe(true);
    await put('/api/sim', { paused: false, speed: 2 });
  });
});

describe('public helplines and hospital numbers', () => {
  test('lists seeded helplines and hospital entries for any role', async () => {
    const res = await get('/api/resources', dispatcherToken);
    expect(res.status).toBe(200);
    const numbers = res.body.contacts.filter((c) => c.kind === 'HELPLINE').map((c) => c.phone);
    expect(numbers).toEqual(expect.arrayContaining(['112', '108', '104']));
    const hospitals = res.body.contacts.filter((c) => c.kind === 'HOSPITAL');
    expect(hospitals.length).toBe(5);
    expect(hospitals[0].hospital).toBeTruthy();
    expect((await get('/api/resources?kind=HELPLINE&q=ambulance')).body.contacts.length).toBeGreaterThan(0);
  });

  test('only admins change entries and input is validated', async () => {
    const body = { kind: 'HOSPITAL', name: 'Test Clinic', phone: '+91 44 0000 0000', hospitalId: 'H1' };
    expect((await post('/api/resources', body, dispatcherToken)).status).toBe(403);
    expect((await post('/api/resources', { ...body, phone: 'call me' })).status).toBe(400);
    expect((await post('/api/resources', { ...body, hospitalId: 'H99' })).status).toBe(400);
    expect((await post('/api/resources', { ...body, website: 'javascript:alert(1)' })).status).toBe(400);
    const created = await post('/api/resources', body);
    expect(created.status).toBe(201);
    const id = created.body.contact.id;
    const updated = await put(`/api/resources/${id}`, { phone: '044 1111 1111', notes: 'Updated' });
    expect(updated.body.contact.phone).toBe('044 1111 1111');
    expect(updated.body.contact.name).toBe('Test Clinic');
    expect((await del(`/api/resources/${id}`)).body.deleted).toBe(true);
    expect((await del(`/api/resources/${id}`)).status).toBe(404);
  });
});

describe('scripted demo', () => {
  test('runs the whole scenario with the real services', async () => {
    const started = await post('/api/sim/demo');
    expect(started.status).toBe(201);
    expect((await post('/api/sim/demo')).status).toBe(409);
    let guard = 0;
    while (runtime.demo.running && guard < 6000) {
      demo.update(0.25);
      simulation.advance(0.5);
      guard += 1;
    }
    expect(runtime.demo.error).toBeNull();
    expect(runtime.demo.finished).toBe(true);
    expect(runtime.demo.steps.every((s) => s.status === 'done')).toBe(true);
    const done = (await get('/api/missions?status=COMPLETED')).body.missions;
    expect(done.length).toBe(1);
    expect(done[0].rerouteCount).toBeGreaterThanOrEqual(1);
    expect(runtime.graph.allEdges().filter((x) => x.isClosed).length).toBe(0);
    expect(runtime.graph.allEdges().filter((x) => x.trafficLevel !== 'LOW').length).toBe(0);
  });
});
