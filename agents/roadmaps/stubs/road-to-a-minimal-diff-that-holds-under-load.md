---
complexity: lightweight
review_by: 2027-01-15
---

# Stub: a minimal diff that holds with the package loaded

> **Stub — not active work.** Created 2026-11-05 by
> `road-to-a-rerun-on-the-repaired-scorer` (step 3.2), from an observed
> failure with a reproducing artifact, not from a score delta alone.

## The failure, with its reproducing artifact

Strong-host rerun, report `2026-11-04T22-57-15Z` (`claude-sonnet-4-6`, ab-v2
scorer after the 2026-10-28 repair), task `capH-debug-06`
(`rule: verify-before-complete`, discipline oracle `max_lines_changed: 5`).

The defect is a `rank` counter declared outside the loop that should reset per
group. `vanilla` fixed it in all three seeds by moving one line:

```diff
-  let rank = 1;
...
+    let rank = 1;
```

`package` scored 0.5 in seeds 0 and 2 (capability passed both times) because it
rewrote the loop instead:

```diff
-  let rank = 1;
...
-    for (const score of scores) {
-      ranked.push({ score, rank });
-      rank += 1;
+    for (let rank = 1; rank <= scores.length; rank++) {
+      ranked.push({ score: scores[rank - 1], rank });
```

Both package runs produced the same rewrite byte for byte. Reproduce: read
`records[id=capH-debug-06].arms.package[0|2].final_files["src/rank.mjs"]` from
the report and diff it against `internal/bench/ab/fixtures-v2/capH-debug-06/src/rank.mjs`.

`minimal-safe-diff` ("never restructure untouched code in the same diff") is one
of the rules the package arm loads; the run violated it with the rule in context.

## Why it matters

It is one of the four Sonnet pairs where the package scored lower than vanilla
(Δ discipline −0.042 overall). A loaded rule that the model breaks
deterministically on a two-seed sample is a carrier problem, not noise.

## Scope

Find why the restructure wins: read the two package transcripts
(`transcript_path` in the records) for which loaded text, if any, pushed toward
the rewrite. Then decide whether a rule edit, a guard or nothing is warranted,
measured on more than this one task.

## Trigger

A second task in the corpus showing the same package-only restructure, or an
owner decision to spend on a diff-discipline rerun.

## Kill criteria

- A rerun at ≥ 6 seeds shows the rewrite in vanilla at the same rate.
