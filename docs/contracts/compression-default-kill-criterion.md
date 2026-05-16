# Compression default — kill-criterion

> **Status:** parked, criterion-deferred · **Owner:** `step-4-measurement-and-benchmark.md`
> closeout phase · **Source:** [`council-synthesis.md` § 7](../../agents/audit-2026-05-14-north-star/council-synthesis.md)

## Rule

```
DEFAULT STAYS OFF UNTIL `task bench` PRODUCES A NUMBER.
DECISION OWNED BY step-4 CLOSEOUT, NOT BY THIS DOC OR BY step-99.
```

1. **Current state.** `caveman.speak_scope` defaults `off`. Carve-outs
   (security · destructive · multi-step · code blocks · paths · numbered
   options · Iron-Law markers) are documented in
   [`caveman-speak`](../../.agent-src.uncompressed/rules/caveman-speak.md)
   but the feature is non-promoted: no skill recommends turning it on,
   no preset enables it, no profile depends on it.
2. **Baseline window.** 60 days from the first green run of
   `task bench` against the locked 25-prompt corpus
   ([`step-4-measurement-and-benchmark.md`](../../agents/roadmaps/step-4-measurement-and-benchmark.md)
   Phase 2). The corpus, the model, and the cost-tracker are frozen
   for the window; mid-window changes restart the clock.
3. **Decision points.** After the window closes, `step-4` closeout
   reads `docs/parity/bench.json` and applies exactly one of:

   | Measured tokens saved | Quality regression on corpus | Verdict |
   |---|---|---|
   | < 30 % | any | **Deprecate** — remove `caveman-speak` rule, archive `caveman-compress` script, retire `caveman.*` settings keys with a one-release deprecation window |
   | ≥ 30 % | < 5 % | **Flip default on** — `caveman.speak_scope` defaults to a non-`off` value, carve-outs stay, statusline surfaces lifetime tokens saved |
   | ≥ 30 % | ≥ 5 % | **Hold** — repeat the window once with tuned intensity ladder; second hold → deprecate |

   "Quality regression" = host-side rubric on the corpus per
   `step-4-measurement-and-benchmark.md` Phase 3. Numbers checked into
   `docs/parity/bench.json` as the decision artefact.
4. **No interim flip.** The default does not move on anecdote,
   gut feeling, or a single benchmark snapshot. The 60-day window and
   the table above are the only path to a default change.

## Why this is parked, not decided

The council split (Opus = remove now, o1 = measure-then-decide) is
real. Either branch is wrong-shaped without numbers. The kill-criterion
gives the audit a deterministic resolution path and stops every
downstream roadmap from re-litigating compression on every PR.

## Cross-references

- [`step-99-north-star-restructure.md` § Phase 4](../../agents/roadmaps/step-99-north-star-restructure.md)
  — parks this criterion, does not decide.
- [`step-4-measurement-and-benchmark.md`](../../agents/roadmaps/step-4-measurement-and-benchmark.md)
  — owns `task bench`, the corpus, and the closeout that applies the
  table above.
- [`step-10-caveman-parity.md`](../../agents/roadmaps/step-10-caveman-parity.md)
  — implements the carve-outs and the statusline integration the
  "flip default on" branch depends on; blocks the default flip until
  acceptance is green.
- [`caveman-speak`](../../.agent-src.uncompressed/rules/caveman-speak.md)
  — runtime rule; reads `caveman.speak_scope` from settings.

## Done

This doc exists to keep the decision visible. It is **not** an action
item. `step-4` closeout closes the loop.
