<!-- evidence-type: analysis -->
# Spec axis on the review path — the observation window

**Measured:** 2026-08-22 · **Instrument:** `./scripts-run src/scripts/review_axis_report`
**Ledger:** `agents/runtime/state/review-axis/*.jsonl` (gitignored, machine-local)

## The number, as it actually stands

```
NO WINDOW — 0 reviews recorded, so the spec axis has no measured effect in either direction.
This is not "the axis changed nothing": nothing has been observed yet. Rerun once reviews have run.
scanned: 0
```

**Zero, and the report says which kind of zero.** The window is empty because
the instrument was built in the same change as the axis it measures — no review
has run through the six-judge path since `review-axis-v1` existed. That is
"nothing observed", and the report separates it in words from "the axis ran and
changed nothing", because those two readings license opposite decisions: the
first says come back later, the second says the axis is not earning the sixth
dispatch.

Reporting it this way is the point rather than an apology for it. Risk 4 of the
roadmap that added the axis names the failure mode precisely — *"a sixth judge
makes the default path slower and the axis gets switched off"* — and the defence
was supposed to be a number. A number that cannot yet distinguish "unmeasured"
from "useless" would have been worse than none, because the cheap reading of a
bare `0 changed` is exactly the one that switches the axis off.

## What the instrument will and will not be able to say

**Will:** how often the axis ran, how often criteria were supplied, and — over
the runs where a counterfactual exists — how often it flipped the
recommendation. `comparable` is the denominator, never `observed`: a review
where the axis was unreachable carries `spec_axis_effect: null` and enters
neither population, so an axis that was never given the chance to act cannot be
reported as having failed to act.

**Will not:** whether the flips were *correct*. The line records that the
recommendation changed, not that the change was right. Establishing that needs a
human reading the reviews, and no counter in this ledger substitutes for it.

**Also will not:** anything about the eval corpus, which has never been
executed. `_spawn_subagent` in `src/scripts/run_skill_evals.ts:95-101` is an
unimplemented stub that throws, so every scenario in
`src/skills/code-review/evals/evals.json` — the three added for this axis
included — is **declared, not run**. The three spec scenarios are asserted
structurally by `tests/contracts/review_spec_axis.test.ts` (their presence, the
negative control's `SATISFIED` assertion, the no-criteria case's
`not_contains`); nothing in this repository has yet put them in front of a
model.

## Rerun condition

Rerun after any period in which `/review:changes` was used. The report needs no
argument; `--dir` points it at another ledger. It exits 0 on every outcome
including the empty one — it is a report, and a gate over an unmeasured surface
would fail for the wrong reason.
