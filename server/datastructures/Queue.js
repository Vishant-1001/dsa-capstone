/** FIFO queue backed by a singly linked list. enqueue, dequeue, peek: O(1). */
class Queue {
  constructor() {
    this.head = null;
    this.tail = null;
    this.length = 0;
  }

  enqueue(value) {
    const node = { value, next: null };
    if (this.tail) this.tail.next = node;
    else this.head = node;
    this.tail = node;
    this.length += 1;
    return this;
  }

  dequeue() {
    if (!this.head) return null;
    const { value } = this.head;
    this.head = this.head.next;
    if (!this.head) this.tail = null;
    this.length -= 1;
    return value;
  }

  peek() {
    return this.head ? this.head.value : null;
  }

  isEmpty() {
    return this.length === 0;
  }

  size() {
    return this.length;
  }

  clear() {
    this.head = null;
    this.tail = null;
    this.length = 0;
  }

  toArray() {
    const out = [];
    for (let n = this.head; n; n = n.next) out.push(n.value);
    return out;
  }
}

module.exports = Queue;
