/**
 * Hash table with separate chaining.
 *
 * Keys are converted to strings and hashed with djb2. Each bucket is an array
 * of [key, value] entries. The table doubles its capacity when the load factor
 * exceeds 0.75, which keeps the average chain length constant.
 *
 * get / set / delete / has: average O(1), worst case O(n) when every key lands in one bucket.
 */
class HashTable {
  constructor(initialCapacity = 16) {
    this.capacity = Math.max(4, initialCapacity);
    this.buckets = this._makeBuckets(this.capacity);
    this.count = 0;
    this.maxLoadFactor = 0.75;
  }

  _makeBuckets(capacity) {
    const buckets = new Array(capacity);
    for (let i = 0; i < capacity; i += 1) buckets[i] = [];
    return buckets;
  }

  static hash(key) {
    const text = String(key);
    let h = 5381;
    for (let i = 0; i < text.length; i += 1) {
      h = ((h << 5) + h + text.charCodeAt(i)) | 0;
    }
    return h >>> 0;
  }

  bucketIndex(key, capacity = this.capacity) {
    return HashTable.hash(key) % capacity;
  }

  set(key, value) {
    const k = String(key);
    const bucket = this.buckets[this.bucketIndex(k)];
    for (let i = 0; i < bucket.length; i += 1) {
      if (bucket[i][0] === k) {
        bucket[i][1] = value;
        return this;
      }
    }
    bucket.push([k, value]);
    this.count += 1;
    if (this.count / this.capacity > this.maxLoadFactor) this._resize(this.capacity * 2);
    return this;
  }

  get(key) {
    const k = String(key);
    const bucket = this.buckets[this.bucketIndex(k)];
    for (let i = 0; i < bucket.length; i += 1) {
      if (bucket[i][0] === k) return bucket[i][1];
    }
    return undefined;
  }

  has(key) {
    const k = String(key);
    const bucket = this.buckets[this.bucketIndex(k)];
    for (let i = 0; i < bucket.length; i += 1) {
      if (bucket[i][0] === k) return true;
    }
    return false;
  }

  delete(key) {
    const k = String(key);
    const bucket = this.buckets[this.bucketIndex(k)];
    for (let i = 0; i < bucket.length; i += 1) {
      if (bucket[i][0] === k) {
        bucket.splice(i, 1);
        this.count -= 1;
        return true;
      }
    }
    return false;
  }

  _resize(newCapacity) {
    const old = this.buckets;
    this.capacity = newCapacity;
    this.buckets = this._makeBuckets(newCapacity);
    for (let b = 0; b < old.length; b += 1) {
      for (let i = 0; i < old[b].length; i += 1) {
        const [k, v] = old[b][i];
        this.buckets[this.bucketIndex(k)].push([k, v]);
      }
    }
  }

  size() {
    return this.count;
  }

  isEmpty() {
    return this.count === 0;
  }

  clear() {
    this.buckets = this._makeBuckets(this.capacity);
    this.count = 0;
  }

  keys() {
    const out = [];
    this.forEach((v, k) => out.push(k));
    return out;
  }

  values() {
    const out = [];
    this.forEach((v) => out.push(v));
    return out;
  }

  entries() {
    const out = [];
    this.forEach((v, k) => out.push([k, v]));
    return out;
  }

  forEach(fn) {
    for (let b = 0; b < this.buckets.length; b += 1) {
      const bucket = this.buckets[b];
      for (let i = 0; i < bucket.length; i += 1) fn(bucket[i][1], bucket[i][0]);
    }
  }

  /** Describes where a key lives, used by the Data Structures page. */
  inspect(key) {
    const k = String(key);
    const index = this.bucketIndex(k);
    return {
      key: k,
      hash: HashTable.hash(k),
      capacity: this.capacity,
      bucket: index,
      chain: this.buckets[index].map((e) => e[0]),
      found: this.has(k),
    };
  }

  stats() {
    let longestChain = 0;
    let usedBuckets = 0;
    for (let i = 0; i < this.buckets.length; i += 1) {
      const len = this.buckets[i].length;
      if (len > 0) usedBuckets += 1;
      if (len > longestChain) longestChain = len;
    }
    return {
      size: this.count,
      capacity: this.capacity,
      loadFactor: Number((this.count / this.capacity).toFixed(3)),
      usedBuckets,
      longestChain,
    };
  }

  /** Bucket occupancy as lists of keys, for visualisation. */
  layout() {
    return this.buckets.map((bucket, index) => ({ index, keys: bucket.map((e) => e[0]) }));
  }
}

module.exports = HashTable;
