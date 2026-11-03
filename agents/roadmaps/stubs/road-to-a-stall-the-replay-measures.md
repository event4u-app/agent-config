---
complexity: lightweight
review_by: 2026-12-01
---

# Stub: a stall the replay measures

> **Stub — not active work.** Trigger: **2026-12-01** at the latest, because the
> `rejectedTacticRepeat` entry in `src/config/loop-surfaces.yaml` expires on
> 2026-12-12 and states that no roadmap owns the question after it. This stub
> is that owner. Source: `agents/tmp.old/inbox-2026-11-m/` T2 (0.1, 0.2, 2.1-2.3, 4.1-4.3).

## 1. Wire or delete `rejectedTacticRepeat` before 2026-12-12

- Offline replay first: a `--loops` reading over the local transcript store,
  fingerprint = tool + canonical input + result digest, waits and polls
  (`sleep`, `ci_settle`, `gh pr checks`, `gh run watch`) excluded; report
  sessions, calls, 2/3/4-repeat streaks, the store window, at most 10 digests.
- At least one hand-confirmed real loop → wire it into `context_hygiene_hook`
  as a shadow verdict (nothing to the model). Otherwise delete the function,
  its contract test and its `loop-surfaces.yaml` entry, and say in
  `context-hygiene` that tool-loop detection is model-carried.
- Fail: the expiry is extended without the replay report.

## 2. Pipe-masked exit codes

- Count, per host and with a denominator, records whose verifying segment
  pipes into a non-verifying one without `pipefail` / `PIPESTATUS`
  (`report_verification_record_coverage`).
- Shadow reason `exit_masked_by_pipe` in `INSTRUMENT_GAP_REASONS` when no
  summary shows failures; the gate line names both repairs (`set -o pipefail`,
  or the runner's own filter instead of a pipe).
- Arm only after 20 hand-judged masked records with 0 misclassifications of a
  `pipefail` command; if 20 do not arrive by 2027-01-31, the fixture corpus
  decides and the Decisions row says "too rare to judge".
