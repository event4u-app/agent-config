---
complexity: lightweight
review_by: 2027-01-15
---

# Stub: a line budget that does not tax a why-comment

> **Stub — not active work.** Created 2026-11-05 by
> `road-to-a-rerun-on-the-repaired-scorer` (step 3.2), from an observed
> failure with a reproducing artifact, not from a score delta alone.

## The failure, with its reproducing artifact

Strong-host rerun, report `2026-11-04T22-57-15Z` (`claude-sonnet-4-6`), task
`capH-debug-05` (discipline oracle `max_files_changed: 1`,
`max_lines_changed: 5`).

In seeds 1 and 2, `vanilla` and `package` wrote the same fix: a `visited` set,
a guard and an `add`, 5 added lines. `package` added one more line inside the
guard:

```diff
     if (visited.has(node)) {
+      // Already fully processed via another path — skip to avoid duplicates.
       return;
     }
```

That is 6 lines, so `package` scored 0.5 against `vanilla`'s 1.0 in both seeds,
with capability passing on both arms. Reproduce: diff
`records[id=capH-debug-05].arms.<arm>[1|2].final_files["src/resolve.mjs"]`
against `internal/bench/ab/fixtures-v2/capH-debug-05/src/resolve.mjs`.

## Why it matters

Two of the four Sonnet pairs where the package scored below vanilla are this
one comment. The package's own `code-comment-discipline` permits a comment that
states a non-obvious reason, so the scorer and the package disagree about what a
disciplined diff is. The headline Δ −0.042 partly measures that disagreement.

## Scope

Decide, before any rerun, whether the discipline oracle's line budget counts
comment-only lines. The decision has to be made on the oracle's purpose, not on
this result: changing a scorer after seeing which arm it penalises is tuning
toward the package. If the budget changes, it applies from a new scorer epoch,
and earlier reports keep their epoch label.

## Trigger

An owner or council decision on the oracle question above, or a planned
scorer-epoch change for another reason.

## Kill criteria

- The oracle is confirmed to count every changed line by design; record that
  in the corpus notes and close this stub.
