<!-- evidence-type: analysis -->

# Condition (c) of the worker-reuse decision compares two different quantities — what now?

Repository: event4u/agent-config, branch `feat/subagent-system-2583-rest`. Roadmap
`agents/roadmaps/road-to-a-cold-start-paid-once.md`, step 3.1 condition (c): a worker is re-tasked
only when its "transcript tokens [are] below the observed fresh cold start for that definition —
a Phase 1 figure, never a constant". Kill K1 of the same roadmap: after the cache TTL a resume
replays the transcript at full price. Condition (b) already refuses a resume once the worker's
last request is older than the cache TTL; (d) refuses a worker above its capsule watermark
(`src/scripts/_lib/worker_budget.ts`).

Code (`src/scripts/_lib/worker_reuse.ts:102-103`):

```ts
if (context.observed_fresh_cold_start_tokens === null) reasons.push('no_observed_cold_start');
else if (worker.transcript_tokens >= context.observed_fresh_cold_start_tokens) reasons.push('transcript_over_cold_start');
```

The report fills `observed_fresh_cold_start_tokens` with the median first-call
**written-or-uncached** tokens of fresh runs of that definition (the metric of the pre-registered
claim `warm-worker-cold-start-relief`), and `transcript_tokens` with the stopped worker's whole
transcript size.

A manufactured window was run on 2026-10-22 (Claude Code 2.1.308, 16 child sessions, 144 tasks:
80 fresh spawns, 64 resumes; every task a real citation check over the roadmaps). Readings:

- Fresh first call: median written-or-uncached 863.5 tokens; about 84 % of the fresh prefix was
  already cache-read.
- Resumed first call: median written-or-uncached 147 tokens (ratio 0.170 against the 0.20 bar of
  the pre-registered claim), verify-pass 98.4 % resumed against 87.5 % fresh.
- Stopped workers' transcripts: about 7,000 tokens.
- The reconstructed shadow verdict over 81 complete joins: **0 `would_resume`**; 64 refusals are
  `transcript_over_cold_start`, 17 `no_candidate`. So condition (c) refused every resume the
  measurement shows to be cheaper and no worse.

The window's result is already filed as measured (0 `would_resume`). Any change to (c) is made
after seeing these data, which is the move the activation policy warns about when it is used to
tune a threshold toward a desired reading.

Options:

- (a) Compare like with like: `transcript_tokens` against the median first-call **total** input
  tokens of fresh runs (cache-read included) — both are "tokens a call must process", so (c)
  says "a resumed context no larger than what a fresh start processes".
- (b) Remove (c): inside the TTL, (b) already guarantees the replay is cache-read, which is the
  cost (c) was written to bound, and context growth is bounded by (d).
- (c) Keep (c) as written; the guard can then never admit a resume of a worker whose transcript
  outgrew the written-or-uncached figure, and the window stays a null by construction.
- (d) Measure first: keep (c) unchanged in the shipped function, add the alternative as a
  second, pre-registered shadow reading alongside it, and decide on a later window that was not
  used to choose it.

Choose one, give the deciding facts, the condition under which your choice would be wrong, how
the already-filed reading must be labelled, and whether the choice is reversible.
