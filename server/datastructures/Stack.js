/** LIFO stack backed by an array. push, pop, peek: O(1). */
class Stack {
  constructor() {
    this.items = [];
  }

  push(value) {
    this.items.push(value);
    return this;
  }

  pop() {
    return this.items.length === 0 ? null : this.items.pop();
  }

  peek() {
    return this.items.length === 0 ? null : this.items[this.items.length - 1];
  }

  isEmpty() {
    return this.items.length === 0;
  }

  size() {
    return this.items.length;
  }

  clear() {
    this.items = [];
  }

  /** Bottom to top. */
  toArray() {
    return this.items.slice();
  }
}

module.exports = Stack;
