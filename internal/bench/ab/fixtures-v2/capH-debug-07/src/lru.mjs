// Fixed-capacity LRU (least-recently-used) cache.
//
// Recency rule: BOTH reading a key (`get`) AND writing a key (`set`) count as
// "using" it — after either operation that key is the most-recently-used, and
// the key evicted when the cache is full is always the one untouched for the
// longest. Capacity is fixed at construction.
//
// Backed by a Map, whose iteration order is insertion order; the oldest live
// entry is therefore the first key the Map yields.

export class LruCache {
  constructor(capacity) {
    this.capacity = capacity;
    this.map = new Map();
  }

  get(key) {
    if (!this.map.has(key)) {
      return undefined;
    }
    const value = this.map.get(key);
    // Touch: move to the most-recent end.
    this.map.delete(key);
    this.map.set(key, value);
    return value;
  }

  set(key, value) {
    if (this.map.has(key)) {
      // Key already present — just refresh its value.
      this.map.set(key, value);
      return;
    }
    if (this.map.size >= this.capacity) {
      // Evict the least-recently-used (first) entry.
      const oldest = this.map.keys().next().value;
      this.map.delete(oldest);
    }
    this.map.set(key, value);
  }

  keys() {
    return [...this.map.keys()];
  }
}
