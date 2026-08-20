<!-- evidence-type: analysis -->

# Phase 2 transport — the two properties spike 2 deferred, measured

**Date:** 2026-08-20
**Roadmap:** [road-to-org-telemetry.md](../../roadmaps/road-to-org-telemetry.md) Phase 2, step 2.1
**Tree:** `drain/road-to-org-telemetry`, branched from `239d3bf1c`
**Host stamp:** node v26.7.0 · macOS · loopback stub
**Predecessor:** [org-telemetry-s02.md](org-telemetry-s02.md), which closed with
"Two things this spike did **not** measure, and Phase 2 must: whether a detached
child survives host teardown of the session process group, and what the queue
file's growth bound is when the sink is down for days."

Both are now measured. Neither needed a sink to exist, which is why this step
was executable while `sink-choice` is transferred.

## Property 1 — a detached child survives teardown of the spawning process group

**PASS.** Measured twice, once as a bare probe and once as the shipped code.

The bare probe (scratch, `/tmp`): a stand-in session spawned with
`detached: true` becomes its own group leader; it spawns a grandchild with
`detached: true` + `stdio: 'ignore'` + `unref()`; `process.kill(-<session-pid>,
'SIGKILL')` then kills the group. The grandchild wrote its marker file **after**
the group was killed — `"STARTED pid=43994\nSURVIVED"`. `setsid()` on the
grandchild is what does it: the sender is not a member of the group being torn
down.

The shipped path, asserted in
`tests/scripts/telemetry_transport.test.ts` § "detached survival": the real
`flush_sender.mjs` is spawned by a real stand-in session, the session's whole
group is `SIGKILL`ed, and the loopback sink — which deliberately answers only
after 700 ms, i.e. long after the group is gone — records that the request
arrived and was completed. The claim file is then cleaned up, which only a live
sender does.

**One false-pass this measurement had to survive, recorded because it passed
first and was wrong.** Asserting "the spool is gone" is NOT evidence that the
sender lived: `spool_has_work` goes false the instant the sender CLAIMS the
spool by rename, which happens before the request is made. A sender killed
mid-flight satisfies that assertion perfectly. The load-bearing assertions are
(a) the sink answered, after the kill, and (b) no `.sending.` claim file
remains.

## Property 2 — the queue's growth bound across a multi-day outage

**Bounded by construction, and the bound is the log's own.** The spool carries
the same `RetentionPolicy` as the record log, enforced by the same code in the
same call, because the spool is written by `append_class_a_record` rather than
by the flush.

At the rate this tree has actually observed — 6.6 `Skill` events per day, 270 B
per Class-A line, from the retention block in `remote.ts` — a sink that is down
for the full 90-day age window leaves a spool of ≈ 600 records ≈ 160 KiB. The
2 MiB byte cap is the backstop for a rate this tree has not observed; it binds
at ≈ 7,700 unsent records.

Asserted in `tests/scripts/telemetry_transport.test.ts` § "bounds the spool with
the SAME policy as the log": 400 records against a 4 KiB cap leave the spool at
or under 4 KiB with the newest record still present.

**What that bound costs, stated rather than left to be discovered.** A record
evicted from the spool by retention is a record that is never sent. This is the
same trade the log already makes and the same one `settings.ts` documents for
`flush: never` — a growth budget is a decision to lose the oldest data rather
than keep all of it. An org that cannot accept that raises `max_bytes` or fixes
its sink; there is no third option, and pretending otherwise would be an
unbounded queue with a policy comment on it.

## Why the enqueue happens at write time and not at flush time

A flush that had to work out which logged records were still unsent needs a
byte watermark into the log. `enforce_retention` rewrites that log in place. A
watermark over a compacting file is a silent-corruption pair: the offset
survives the prune, the records it pointed at do not. Enqueue-at-write has no
watermark to invalidate and spools each record exactly once, by the only writer.

## Sensitivity — the tests were seen RED before they were trusted

Per the local discipline that a test never seen red has unknown sensitivity,
the suite was run against two deliberate sabotages of `flush_sender.mjs`.

| Sabotage | Result | Reading |
|---|---|---|
| `claim_spool` uses `copyFileSync` + truncate instead of `renameSync` | **11/11 still GREEN** | The suite does NOT discriminate this variant. Copy-then-truncate has no gap between read and truncate, so it does not actually lose the concurrent record; the test is right to pass, but this is a *limit* of the suite's reach and is recorded as one. |
| The naive design: read the spool, POST, truncate on success (no claim at all) | **3 tests RED** — non-2xx retention, blackhole retention, and "does not lose a record appended DURING the send" | This is the failure mode the design exists to prevent, and the suite catches it. |

So the concurrency assertion is sensitive to the realistic naive implementation
and silent about one safe variant. That is the honest coverage statement; the
first sabotage is reported rather than dropped because a sabotage that fails to
red is itself a finding about the test.

## What this step did NOT ship

- **No sink.** `sink-choice` is transferred
  ([`stubs/road-to-org-telemetry-sink.md`](../../roadmaps/stubs/road-to-org-telemetry-sink.md)).
  With no endpoint the settings never resolve `active`, so not a byte moves.
  Every test above supplies its own loopback endpoint.
- **No enablement.** `dpo-signoff` is transferred
  ([`stubs/road-to-org-telemetry-enablement.md`](../../roadmaps/stubs/road-to-org-telemetry-enablement.md)).
- **No end-to-end second-machine proof.** The phase exit criterion "records
  written on a second machine appear in the sink" needs both of the above and is
  not claimed here.
