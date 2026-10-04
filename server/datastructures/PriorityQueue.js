const MinHeap = require('./MinHeap');

const SEVERITY_PRIORITY = Object.freeze({ CRITICAL: 10, HIGH: 7, MEDIUM: 5, LOW: 2 });

/**
 * Orders entries so the highest priority comes out first. Equal priorities are
 * resolved by arrival sequence (earlier arrival first). The MinHeap treats the
 * "smallest" entry as the one to extract, so the comparator inverts priority.
 */
function compareEntries(a, b) {
  if (a.priority !== b.priority) return b.priority - a.priority;
  return a.seq - b.seq;
}

/**
 * Emergency priority queue built on MinHeap.
 * enqueue / dequeue: O(log n), peek / size / isEmpty: O(1).
 */
class EmergencyPriorityQueue {
  constructor() {
    this.heap = new MinHeap(compareEntries);
    this.nextSeq = 1;
  }

  /** emergency needs an id and either a severity or a numeric priority. */
  enqueue(emergency) {
    if (!emergency || emergency.id === undefined || emergency.id === null) {
      throw new Error('Emergency must have an id');
    }
    let priority = emergency.priority;
    if (typeof priority !== 'number') priority = SEVERITY_PRIORITY[emergency.severity];
    if (typeof priority !== 'number') throw new Error(`Unknown severity: ${emergency.severity}`);

    let seq = emergency.arrivalSeq;
    if (typeof seq !== 'number') seq = this.nextSeq;
    if (seq >= this.nextSeq) this.nextSeq = seq + 1;

    this.heap.insert({ id: emergency.id, priority, seq, emergency });
    return this;
  }

  dequeue() {
    const entry = this.heap.extractMin();
    return entry ? entry.emergency : null;
  }

  peek() {
    const entry = this.heap.peek();
    return entry ? entry.emergency : null;
  }

  isEmpty() {
    return this.heap.isEmpty();
  }

  size() {
    return this.heap.size();
  }

  contains(id) {
    return this.heap.items.some((e) => e.id === id);
  }

  /** Removes a specific emergency (cancel, or dispatch of a non-head entry). */
  remove(id) {
    const entry = this.heap.removeWhere((e) => e.id === id);
    return entry ? entry.emergency : null;
  }

  /** Non-destructive list in dequeue order: copies the heap and extracts every entry. */
  toSortedArray() {
    const copy = new MinHeap(compareEntries);
    copy.items = this.heap.toArray();
    const out = [];
    while (!copy.isEmpty()) out.push(copy.extractMin().emergency);
    return out;
  }

  /** Raw heap array in level order, for the heap visualiser. */
  heapArray() {
    return this.heap.toArray().map((e) => ({ id: e.id, priority: e.priority, seq: e.seq, severity: e.emergency.severity }));
  }

  clear() {
    this.heap.clear();
  }
}

module.exports = EmergencyPriorityQueue;
module.exports.SEVERITY_PRIORITY = SEVERITY_PRIORITY;
