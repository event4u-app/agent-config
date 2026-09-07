> Clean by construction: a genuine reference list where the bold term is the
> thing being defined. Near-miss for `tell-bold-header-list`.

Three settings control the retry behaviour and they interact, so here is what
each one does.

- **attempts** — how many times a failed job is re-queued before it lands in
  the dead-letter table. Counts the first run.
- **backoff** — seconds between attempts, doubling each time, capped at ten
  minutes.
- **timeout** — how long a single attempt may run before the worker kills it.
  A timeout counts as a failure and consumes an attempt.

Set `timeout` above `backoff` and the queue will look stuck when it is only
slow.
