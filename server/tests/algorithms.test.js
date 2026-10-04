const { dijkstra } = require('../algorithms/dijkstra');
const { bfs, isReachable, connectedComponents } = require('../algorithms/bfs');
const { selectAmbulance, meetsEquipment } = require('../algorithms/ambulanceSelection');
const { selectHospital } = require('../algorithms/hospitalSelection');
const { buildGraph, amb, hosp } = require('./helpers');

describe('Dijkstra', () => {
  test('finds the shortest route on a normal network', () => {
    const r = dijkstra(buildGraph(), 'A', 'F');
    expect(r.found).toBe(true);
    expect(r.path).toEqual(['A', 'C', 'B', 'D', 'E', 'F']);
    expect(r.estimatedTime).toBe(13);
    expect(r.totalDistance).toBe(10.4);
    expect(r.roadIds).toEqual(['R2', 'R3', 'R4', 'R7', 'R9']);
    expect(r.visitedNodes[0]).toBe('A');
    expect(r.visitedNodes).toContain('F');
  });

  test('source equals target gives a zero-length path', () => {
    const r = dijkstra(buildGraph(), 'D', 'D');
    expect(r.found).toBe(true);
    expect(r.path).toEqual(['D']);
    expect(r.estimatedTime).toBe(0);
  });

  test('road closure forces a different route', () => {
    const g = buildGraph();
    expect(dijkstra(g, 'A', 'D').path).toEqual(['A', 'C', 'B', 'D']);
    g.closeRoad('R4');
    const r = dijkstra(g, 'A', 'D');
    expect(r.path).toEqual(['A', 'C', 'D']);
    expect(r.estimatedTime).toBe(10);
  });

  test('disconnected graph is reported as unreachable', () => {
    const r = dijkstra(buildGraph(), 'A', 'G');
    expect(r.found).toBe(false);
    expect(r.reason).toBe('UNREACHABLE');
    expect(r.path).toEqual([]);
  });

  test('closing every road around a node makes it unreachable', () => {
    const g = buildGraph();
    g.closeRoad('R2');
    g.closeRoad('R1');
    expect(dijkstra(g, 'A', 'F').found).toBe(false);
  });

  test('traffic changes the chosen route', () => {
    const g = buildGraph();
    expect(dijkstra(g, 'A', 'D').path).toEqual(['A', 'C', 'B', 'D']);
    g.setTraffic('R3', 'SEVERE');
    const r = dijkstra(g, 'A', 'D');
    expect(r.path).toEqual(['A', 'B', 'D']);
    expect(r.estimatedTime).toBe(9);
  });

  test('distance weighting ignores traffic', () => {
    const g = buildGraph();
    g.setTraffic('R3', 'SEVERE');
    expect(dijkstra(g, 'A', 'D', { weight: 'distance' }).path).toEqual(['A', 'C', 'B', 'D']);
  });

  test('unknown nodes are handled', () => {
    expect(dijkstra(buildGraph(), 'Z', 'A').found).toBe(false);
    expect(dijkstra(buildGraph(), 'A', 'Z').reason).toBe('UNKNOWN_TARGET');
  });

  test('trace records heap contents and tentative distances', () => {
    const r = dijkstra(buildGraph(), 'A', 'D', { trace: true });
    expect(r.steps.length).toBeGreaterThan(2);
    expect(r.steps[0].heap).toEqual([{ nodeId: 'A', dist: 0 }]);
    expect(r.steps[1].current).toBe('A');
    expect(r.steps[1].distances.C).toBe(2);
    expect(r.stackTrace.popped).toEqual(r.path);
  });

  test('without a target it returns distances to every node', () => {
    const r = dijkstra(buildGraph(), 'A', null);
    expect(r.distances.F).toBe(13);
    expect(r.distances.G).toBeNull();
  });
});

describe('BFS', () => {
  test('visits every reachable node in breadth-first order', () => {
    const r = bfs(buildGraph(), 'A');
    expect(r.order[0]).toBe('A');
    expect(r.reachableCount).toBe(6);
    expect(r.hops.B).toBe(1);
    expect(r.hops.D).toBe(2);
    expect(r.order).not.toContain('G');
  });

  test('reachability after road closures', () => {
    const g = buildGraph();
    expect(isReachable(g, 'A', 'F')).toBe(true);
    expect(isReachable(g, 'A', 'G')).toBe(false);
    g.closeRoad('R8');
    expect(isReachable(g, 'A', 'F')).toBe(true);
    g.closeRoad('R9');
    expect(isReachable(g, 'A', 'F')).toBe(false);
  });

  test('connected components', () => {
    const g = buildGraph();
    expect(connectedComponents(g)).toEqual([['A', 'B', 'C', 'D', 'E', 'F'], ['G']]);
    g.closeRoad('R8');
    g.closeRoad('R9');
    expect(connectedComponents(g).length).toBe(3);
  });

  test('unknown start', () => {
    expect(bfs(buildGraph(), 'Q').found).toBe(false);
    expect(isReachable(buildGraph(), 'Q', 'A')).toBe(false);
  });
});

describe('Ambulance selection', () => {
  const emergency = (extra = {}) => ({ id: 'E1', nodeId: 'D', requiredEquipment: 'BASIC', ...extra });

  test('selects the lowest travel time', () => {
    const g = buildGraph();
    const r = selectAmbulance(g, [amb('X', 'B'), amb('Y', 'F')], emergency());
    expect(r.code).toBe('OK');
    expect(r.selected.ambulanceId).toBe('X');
    expect(r.selected.travelTime).toBe(5);
    expect(r.explanation).toMatch(/X/);
  });

  test('fastest route beats the geographically nearest unit', () => {
    const g = buildGraph();
    g.setTraffic('R7', 'SEVERE'); // D-E: 2 -> 6 minutes
    g.setTraffic('R9', 'SEVERE'); // E-F: 3 -> 9 minutes
    const units = [amb('X', 'B'), amb('Y', 'E')];
    const free = selectAmbulance(buildGraph(), units, emergency());
    expect(free.selected.ambulanceId).toBe('Y'); // 2 min free-flow
    const jammed = selectAmbulance(g, units, emergency());
    expect(jammed.selected.ambulanceId).toBe('X'); // 5 min versus 6
  });

  test('filters by required equipment', () => {
    const g = buildGraph();
    const units = [amb('B1', 'D', 'BASIC'), amb('A1', 'A', 'ALS'), amb('A2', 'F', 'ALS')];
    const r = selectAmbulance(g, units, emergency({ requiredEquipment: 'ALS' }));
    expect(r.pipeline.equipmentMatch.sort()).toEqual(['A1', 'A2']);
    expect(['A1', 'A2']).toContain(r.selected.ambulanceId);
    expect(r.rejected.find((x) => x.ambulanceId === 'B1')).toBeDefined();
  });

  test('BASIC requirement accepts any equipment, others need an exact match', () => {
    expect(meetsEquipment({ equipment: 'TRAUMA' }, 'BASIC')).toBe(true);
    expect(meetsEquipment({ equipment: 'TRAUMA' }, 'ALS')).toBe(false);
    expect(meetsEquipment({ equipment: 'ALS' }, 'ALS')).toBe(true);
  });

  test('no available ambulance', () => {
    const r = selectAmbulance(buildGraph(), [amb('X', 'B', 'BASIC', 'EN_ROUTE'), amb('Y', 'E', 'BASIC', 'OFFLINE')], emergency());
    expect(r.code).toBe('NO_AVAILABLE_AMBULANCE');
    expect(r.selected).toBeNull();
  });

  test('no suitable equipment', () => {
    const r = selectAmbulance(buildGraph(), [amb('X', 'B', 'BASIC')], emergency({ requiredEquipment: 'ALS' }));
    expect(r.code).toBe('NO_SUITABLE_EQUIPMENT');
  });

  test('no reachable ambulance when the graph is disconnected', () => {
    const r = selectAmbulance(buildGraph(), [amb('X', 'G', 'BASIC')], emergency());
    expect(r.code).toBe('NO_REACHABLE_AMBULANCE');
    expect(r.selected).toBeNull();
  });

  test('a closed road can leave only the unreachable unit', () => {
    const g = buildGraph();
    g.closeRoad('R8');
    g.closeRoad('R9');
    const r = selectAmbulance(g, [amb('X', 'F'), amb('Y', 'A')], emergency({ nodeId: 'C' }));
    expect(r.selected.ambulanceId).toBe('Y');
  });

  test('an ambulance already at the scene has zero travel time', () => {
    const r = selectAmbulance(buildGraph(), [amb('X', 'D'), amb('Y', 'B')], emergency());
    expect(r.selected.ambulanceId).toBe('X');
    expect(r.selected.travelTime).toBe(0);
  });
});

describe('Hospital selection', () => {
  test('picks the closest suitable hospital', () => {
    const hospitals = [hosp('H1', 'F'), hosp('H2', 'B')];
    const r = selectHospital(buildGraph(), hospitals, 'A', 'GENERAL');
    expect(r.code).toBe('OK');
    expect(r.selected.hospitalId).toBe('H2');
  });

  test('requires the specialty', () => {
    const hospitals = [hosp('H1', 'B'), hosp('H2', 'F', { specialties: ['GENERAL', 'CARDIAC'] })];
    const r = selectHospital(buildGraph(), hospitals, 'A', 'CARDIAC');
    expect(r.selected.hospitalId).toBe('H2');
    expect(selectHospital(buildGraph(), hospitals, 'A', 'BURN').code).toBe('NO_SPECIALTY_MATCH');
  });

  test('skips closed hospitals and hospitals without beds', () => {
    const hospitals = [hosp('H1', 'B', { status: 'CLOSED' }), hosp('H2', 'C', { availableBeds: 0 }), hosp('H3', 'F')];
    const r = selectHospital(buildGraph(), hospitals, 'A', 'GENERAL');
    expect(r.selected.hospitalId).toBe('H3');
    expect(r.rejected.map((x) => x.hospitalId).sort()).toEqual(['H1', 'H2']);
  });

  test('no suitable hospital cases', () => {
    const g = buildGraph();
    expect(selectHospital(g, [hosp('H1', 'B', { status: 'CLOSED' })], 'A', 'GENERAL').code).toBe('NO_OPEN_HOSPITAL');
    expect(selectHospital(g, [hosp('H1', 'B', { availableBeds: 0 })], 'A', 'GENERAL').code).toBe('NO_HOSPITAL_BEDS');
    expect(selectHospital(g, [hosp('H1', 'G')], 'A', 'GENERAL').code).toBe('NO_REACHABLE_HOSPITAL');
    expect(selectHospital(g, [], 'A', 'GENERAL').code).toBe('NO_OPEN_HOSPITAL');
  });

  test('beds already promised to inbound ambulances are not offered again', () => {
    const hospitals = [hosp('H1', 'B', { availableBeds: 1 }), hosp('H2', 'F')];
    const r = selectHospital(buildGraph(), hospitals, 'A', 'GENERAL', { inbound: { H1: 1 } });
    expect(r.selected.hospitalId).toBe('H2');
  });

  test('reported free beds exclude beds promised to inbound ambulances', () => {
    const r = selectHospital(buildGraph(), [hosp('H1', 'B', { availableBeds: 3 })], 'A', 'GENERAL', { inbound: { H1: 2 } });
    expect(r.selected.availableBeds).toBe(1);
    expect(r.explanation).toContain('1 free bed and');
  });

  test('traffic can change which hospital is fastest', () => {
    const g = buildGraph();
    const hospitals = [hosp('H1', 'B'), hosp('H2', 'C')];
    expect(selectHospital(g, hospitals, 'A', 'GENERAL').selected.hospitalId).toBe('H2');
    g.setTraffic('R2', 'SEVERE');
    g.setTraffic('R3', 'SEVERE');
    expect(selectHospital(g, hospitals, 'A', 'GENERAL').selected.hospitalId).toBe('H1');
  });
});
