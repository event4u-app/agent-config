// Append-only event log. The ledger never mutates or deletes past events; it
// only grows. Its length is the system's logical version — the snapshot layer
// uses that length as a cache key so it can skip re-folding when nothing new has
// been appended.

export class Ledger {
  constructor() {
    this._events = [];
  }

  append(event) {
    this._events.push(event);
  }

  // Events in replay order (ascending seq). Returns a fresh array each call so
  // callers cannot accidentally mutate the log.
  all() {
    return [...this._events].sort((a, b) => a.seq - b.seq);
  }

  version() {
    return this._events.length;
  }
}
