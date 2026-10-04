/**
 * Binary min-heap stored in an array.
 *
 * Parent of i is floor((i - 1) / 2), children are 2i + 1 and 2i + 2.
 * A comparator may be supplied; compare(a, b) < 0 means a has higher priority
 * (comes out first). The default compares numbers.
 *
 * insert: O(log n), extractMin: O(log n), peek: O(1).
 */
class MinHeap {
  constructor(compare) {
    this.items = [];
    this.compare = compare || ((a, b) => a - b);
    this.comparisons = 0;
    this.swaps = 0;
  }

  size() {
    return this.items.length;
  }

  isEmpty() {
    return this.items.length === 0;
  }

  peek() {
    return this.items.length === 0 ? null : this.items[0];
  }

  insert(value) {
    this.items.push(value);
    this.heapifyUp(this.items.length - 1);
    return this;
  }

  extractMin() {
    if (this.items.length === 0) return null;
    const top = this.items[0];
    const last = this.items.pop();
    if (this.items.length > 0) {
      this.items[0] = last;
      this.heapifyDown(0);
    }
    return top;
  }

  heapifyUp(index) {
    let i = index;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      this.comparisons += 1;
      if (this.compare(this.items[i], this.items[parent]) < 0) {
        this._swap(i, parent);
        i = parent;
      } else {
        break;
      }
    }
  }

  heapifyDown(index) {
    let i = index;
    const n = this.items.length;
    for (;;) {
      const left = 2 * i + 1;
      const right = left + 1;
      let smallest = i;
      if (left < n) {
        this.comparisons += 1;
        if (this.compare(this.items[left], this.items[smallest]) < 0) smallest = left;
      }
      if (right < n) {
        this.comparisons += 1;
        if (this.compare(this.items[right], this.items[smallest]) < 0) smallest = right;
      }
      if (smallest === i) break;
      this._swap(i, smallest);
      i = smallest;
    }
  }

  /** Removes the first item matching the predicate. O(n) search plus O(log n) repair. */
  removeWhere(predicate) {
    const idx = this.items.findIndex(predicate);
    if (idx === -1) return null;
    const removed = this.items[idx];
    const last = this.items.pop();
    if (idx < this.items.length) {
      this.items[idx] = last;
      this.heapifyUp(idx);
      this.heapifyDown(idx);
    }
    return removed;
  }

  /** Copy of the raw heap array (level order). */
  toArray() {
    return this.items.slice();
  }

  clear() {
    this.items = [];
  }

  _swap(i, j) {
    const tmp = this.items[i];
    this.items[i] = this.items[j];
    this.items[j] = tmp;
    this.swaps += 1;
  }
}

module.exports = MinHeap;
