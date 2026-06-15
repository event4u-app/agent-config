// Monotonic sequence source. Every event gets a strictly increasing seq so the
// ledger can be replayed in a deterministic order regardless of insertion
// timing. A single shared clock instance backs the engine.

export class Clock {
  constructor() {
    this._seq = 0;
  }

  next() {
    this._seq += 1;
    return this._seq;
  }
}

export const clock = new Clock();
