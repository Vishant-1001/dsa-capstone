const MinHeap = require('../datastructures/MinHeap');
const PriorityQueue = require('../datastructures/PriorityQueue');
const Queue = require('../datastructures/Queue');
const Stack = require('../datastructures/Stack');
const HashTable = require('../datastructures/HashTable');
const Graph = require('../datastructures/Graph');
const { buildGraph } = require('./helpers');

describe('MinHeap', () => {
  test('extracts values in ascending order', () => {
    const h = new MinHeap();
    [9, 4, 7, 1, 8, 2, 6].forEach((v) => h.insert(v));
    const out = [];
    while (!h.isEmpty()) out.push(h.extractMin());
    expect(out).toEqual([1, 2, 4, 6, 7, 8, 9]);
  });

  test('peek returns the minimum without removing it', () => {
    const h = new MinHeap();
    h.insert(5).insert(3).insert(8);
    expect(h.peek()).toBe(3);
    expect(h.size()).toBe(3);
  });

  test('empty heap returns null', () => {
    const h = new MinHeap();
    expect(h.isEmpty()).toBe(true);
    expect(h.peek()).toBeNull();
    expect(h.extractMin()).toBeNull();
  });

  test('keeps the heap property after every insert', () => {
    const h = new MinHeap();
    for (let i = 0; i < 200; i += 1) h.insert((i * 7919) % 101);
    const a = h.toArray();
    for (let i = 1; i < a.length; i += 1) expect(a[(i - 1) >> 1]).toBeLessThanOrEqual(a[i]);
  });

  test('supports a custom comparator and removeWhere', () => {
    const h = new MinHeap((a, b) => a.k - b.k);
    [5, 2, 9, 1].forEach((k) => h.insert({ k }));
    expect(h.removeWhere((x) => x.k === 2)).toEqual({ k: 2 });
    expect(h.extractMin().k).toBe(1);
    expect(h.extractMin().k).toBe(5);
    expect(h.extractMin().k).toBe(9);
  });
});

describe('EmergencyPriorityQueue', () => {
  const em = (id, severity, arrivalSeq) => ({ id, severity, arrivalSeq });

  test('higher severity comes out first', () => {
    const q = new PriorityQueue();
    q.enqueue(em('E1', 'LOW', 1));
    q.enqueue(em('E2', 'CRITICAL', 2));
    q.enqueue(em('E3', 'HIGH', 3));
    expect(q.peek().id).toBe('E2');
    expect([q.dequeue().id, q.dequeue().id, q.dequeue().id]).toEqual(['E2', 'E3', 'E1']);
    expect(q.isEmpty()).toBe(true);
  });

  test('equal priority is resolved by earlier arrival', () => {
    const q = new PriorityQueue();
    q.enqueue(em('E3', 'HIGH', 3));
    q.enqueue(em('E1', 'HIGH', 1));
    q.enqueue(em('E2', 'HIGH', 2));
    expect([q.dequeue().id, q.dequeue().id, q.dequeue().id]).toEqual(['E1', 'E2', 'E3']);
  });

  test('multiple emergencies: E1 critical, E2 low, E3 high processes E1, E3, E2', () => {
    const q = new PriorityQueue();
    q.enqueue(em('E1', 'CRITICAL'));
    q.enqueue(em('E2', 'LOW'));
    q.enqueue(em('E3', 'HIGH'));
    expect(q.toSortedArray().map((e) => e.id)).toEqual(['E1', 'E3', 'E2']);
    expect(q.size()).toBe(3);
  });

  test('uses the specified priority values', () => {
    expect(PriorityQueue.SEVERITY_PRIORITY).toEqual({ CRITICAL: 10, HIGH: 7, MEDIUM: 5, LOW: 2 });
  });

  test('remove takes out a specific entry and keeps order', () => {
    const q = new PriorityQueue();
    q.enqueue(em('E1', 'LOW'));
    q.enqueue(em('E2', 'MEDIUM'));
    q.enqueue(em('E3', 'CRITICAL'));
    expect(q.remove('E2').id).toBe('E2');
    expect(q.remove('missing')).toBeNull();
    expect(q.toSortedArray().map((e) => e.id)).toEqual(['E3', 'E1']);
  });

  test('rejects unknown severity and empty queue returns null', () => {
    const q = new PriorityQueue();
    expect(() => q.enqueue({ id: 'X', severity: 'NOPE' })).toThrow();
    expect(q.dequeue()).toBeNull();
    expect(q.peek()).toBeNull();
  });
});

describe('Queue, Stack, HashTable', () => {
  test('Queue is FIFO', () => {
    const q = new Queue();
    q.enqueue(1).enqueue(2).enqueue(3);
    expect(q.peek()).toBe(1);
    expect(q.dequeue()).toBe(1);
    expect(q.toArray()).toEqual([2, 3]);
    q.dequeue();
    q.dequeue();
    expect(q.isEmpty()).toBe(true);
    expect(q.dequeue()).toBeNull();
    q.enqueue(9);
    expect(q.size()).toBe(1);
  });

  test('Stack is LIFO', () => {
    const s = new Stack();
    s.push('a').push('b').push('c');
    expect(s.peek()).toBe('c');
    expect(s.pop()).toBe('c');
    expect(s.size()).toBe(2);
    s.pop();
    s.pop();
    expect(s.pop()).toBeNull();
    expect(s.isEmpty()).toBe(true);
  });

  test('HashTable stores, overwrites, deletes and resizes', () => {
    const h = new HashTable(4);
    for (let i = 0; i < 100; i += 1) h.set(`k${i}`, i);
    expect(h.size()).toBe(100);
    expect(h.capacity).toBeGreaterThan(4);
    expect(h.get('k42')).toBe(42);
    h.set('k42', 'x');
    expect(h.get('k42')).toBe('x');
    expect(h.size()).toBe(100);
    expect(h.delete('k42')).toBe(true);
    expect(h.delete('k42')).toBe(false);
    expect(h.has('k42')).toBe(false);
    expect(h.get('missing')).toBeUndefined();
    expect(h.keys().length).toBe(99);
    expect(h.stats().loadFactor).toBeLessThanOrEqual(0.75);
  });

  test('HashTable inspect reports bucket and chain', () => {
    const h = new HashTable();
    h.set('A1', { id: 'A1' });
    const info = h.inspect('A1');
    expect(info.found).toBe(true);
    expect(info.chain).toContain('A1');
    expect(info.bucket).toBe(HashTable.hash('A1') % h.capacity);
  });
});

describe('Graph', () => {
  test('adds nodes and two-way roads', () => {
    const g = buildGraph();
    expect(g.nodeCount()).toBe(7);
    expect(g.edgeCount()).toBe(9);
    expect(g.neighbors('A').map((n) => n.nodeId).sort()).toEqual(['B', 'C']);
    expect(g.neighbors('B').map((n) => n.nodeId)).toContain('A');
    expect(g.neighbors('G')).toEqual([]);
    expect(g.edgeBetween('B', 'A').id).toBe('R1');
  });

  test('rejects duplicates and invalid roads', () => {
    const g = buildGraph();
    expect(() => g.addNode({ id: 'A', name: 'dup' })).toThrow();
    expect(() => g.addEdge({ id: 'R1', source: 'A', destination: 'G', distance: 1, normalTravelTime: 1 })).toThrow();
    expect(() => g.addEdge({ id: 'X', source: 'A', destination: 'Z', distance: 1, normalTravelTime: 1 })).toThrow();
    expect(() => g.addEdge({ id: 'X', source: 'A', destination: 'B', distance: 1, normalTravelTime: 1 })).toThrow();
    expect(() => g.addEdge({ id: 'X', source: 'A', destination: 'A', distance: 1, normalTravelTime: 1 })).toThrow();
    expect(() => g.addEdge({ id: 'X', source: 'A', destination: 'G', distance: 0, normalTravelTime: 1 })).toThrow();
  });

  test('traffic multipliers change current travel time only', () => {
    const g = buildGraph();
    const e = g.setTraffic('R1', 'MODERATE');
    expect(e.currentTravelTime).toBe(5.6);
    expect(e.normalTravelTime).toBe(4);
    expect(g.setTraffic('R1', 'HIGH').currentTravelTime).toBe(8);
    expect(g.setTraffic('R1', 'SEVERE').currentTravelTime).toBe(12);
    expect(g.setTraffic('R1', 'LOW').currentTravelTime).toBe(4);
    expect(() => g.setTraffic('R1', 'BAD')).toThrow();
    expect(g.closeRoad('R1').isClosed).toBe(true);
    expect(g.reopenRoad('R1').isClosed).toBe(false);
  });

  test('adjacency list export', () => {
    const g = buildGraph();
    const list = g.toAdjacencyList();
    expect(Object.keys(list).length).toBe(7);
    expect(list.A.map((x) => x.to).sort()).toEqual(['B', 'C']);
  });

  test('Graph is a class with hash-table backed storage', () => {
    const g = new Graph();
    expect(g.nodes).toBeInstanceOf(HashTable);
    expect(g.adjacency).toBeInstanceOf(HashTable);
  });
});
