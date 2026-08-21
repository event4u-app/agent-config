---
complexity: lightweight
status: ready
parent_roadmap: road-to-rule-delivery-integrity
---

# Roadmap: Measure the de-collided skill descriptions

> **Source:** the deferred half of P2.2 in
> `road-to-rule-delivery-integrity`, migrated here when that roadmap closed
> rather than archived as a loose `[~]`. The rewrite shipped; only the
> measurement is open, and it needs one human act that cannot be automated.

## Context

P2.2 rewrote 9 skill descriptions discriminator-first — the census predicted 7,
the tree carried 9: `adversarial-review`, `analysis-autonomous-mode`,
`performance-analysis`, `persona-improvement`, `project-analyzer`,
`security-audit`, `sequential-thinking`, `skill-improvement-pipeline`,
`universal-project-analysis`. All are ≤ 200 chars, sibling-routing lines kept or
added, `validate_frontmatter` clean over 435 artefacts, and
`grep 'description: "ONLY '` over `src/skills` returns 0.

What is missing is the number. `score_skill_selection` is a **scorer**: it
consumes a predictions JSON (`{fixture_id: selected_skill}`) that only a live
model run produces. So no baseline can be computed locally, and the pre-rewrite
baseline is therefore **UNMEASURED** — no lift is claimed anywhere, deliberately.

**What changed since the deferral, and why the measurement is now possible at
all:** the scorer read the uncondensed legacy tree ADR-051 retired, which does
not exist. A glob over a missing directory yields nothing, so every fixture
would have scored against an empty skill set and the run would have emitted a
baseline of **silent zeros** — void, and indistinguishable from a real one. It
was repointed at the live tree via the shared resolver and now reads 289 skills
instead of 0. Until that landed, running this measurement would have produced a
confident wrong answer rather than an error.

## Goal

Produce the pre-rewrite baseline and the post-rewrite rate for the
`skill-selection-accuracy` instrument, then decide `proceed` / `iterate` /
`revert` against criteria that were fixed **before** the rewrite and are not
renegotiated by the outcome.

## Non-goals

- No new descriptions. The rewrite is done; this roadmap measures it.
- No re-derivation of the criteria. They are pre-registered below verbatim.
- No substitution of an AI rater for the human-gated run — that would break the
  pre-registration and would itself be the self-preference bias the parent
  roadmap was about.
- No use of the census's 1.4 % invocation share as the baseline. It is a
  different instrument; mixing the two is the error the parent roadmap named.

## Phase 1 — Run the instrument

- [ ] **1.1 Capture the pre-rewrite baseline.** Check out the tree state before
      the 9 descriptions were rewritten, run the live trigger-eval to produce a
      predictions JSON, and score it. This is the human-gated leg: the eval
      hard-aborts under automation by design.
      *Verify:* a baseline report exists with per-cluster hit rates (a) and (b),
      and names the tree state it was taken against.
- [ ] **1.2 Capture the post-rewrite rate** on the current tree, same fixture
      set, same protocol.
      *Verify:* both reports were produced by the same scorer version and the
      same fixture file; any difference in either is recorded, not averaged over.
- [ ] **1.3 Emit the verdict** against the three pre-registered criteria, all of
      which must hold:
      (i) the per-cluster hit rate improves by the factor pre-registered against
      **that instrument's own** measured baseline · (ii) no individual skill
      degrades by more than 20 % in isolation, so sibling-routing cannot make a
      previously-reachable skill invisible · (iii) measurement spans at least
      100 requests across at least three request shapes.
      *Verify:* the run emits baseline-vs-post rates per skill, per-skill change
      with any > 20 % degradation flagged, the overall rate with a confidence
      interval, and exactly one of `proceed` / `iterate` / `revert`.
- [ ] **1.4 Publish the outcome either way.** A null is a result: if the rewrite
      did not move the instrument, that is recorded as an honest null with the
      same prominence a win would get.
      *Verify:* the verdict is written where a reader looking for the
      description-rewrite decision will find it, and the roadmap states which of
      the three criteria failed if any did.

## Success criteria

- A pre-rewrite baseline and a post-rewrite rate exist for the same fixture set
  and the same scorer.
- The verdict cites all three pre-registered criteria and states which held.
- No lift is claimed anywhere without both numbers present.
- If the outcome is `revert`, the 9 descriptions are restored and that is
  recorded as the measurement working, not as a failure of the roadmap.

## Blockers

### blocker: human-gated-live-trigger-eval

- **Status:** open
- **Owner:** user
- **Class:** 3 — human-only (hard-aborts under automation by design; simulating it breaks the prereg)
- **Blocks:** all of Phase 1 — 1.1 and 1.2 both need a live model run
- **What to do:** run the live trigger-eval to produce the predictions JSON for
  both tree states — `./scripts-run src/scripts/rule_trigger_eval` on the
  maintainer machine, once per tree state, same protocol both times. It
  hard-aborts under automation on purpose, so an agent cannot supply it and
  must not simulate it. Substituting an AI rater would break the
  pre-registration.
- **Recommendation:** **(agent-drafted 2026-08-18 — this entry predates the
  field; drafted from the roadmap's own text for the consolidated decision
  sheet, not from a maintainer decision.)** Run both tree states in ONE sitting
  under the same protocol, or park the roadmap in `later/` with exactly that as
  its resume condition. Two sittings is the failure mode to avoid: the entry's
  Resolved-when requires both JSONs to come from the *same* protocol, and a
  protocol that drifted between runs produces two files that look comparable
  and are not. This blocker also gates
  `road-to-cost-parity-1-rule-payload-diet`'s `skill-activation-window`, so one
  sitting discharges two entries — which is why it outranks its own step count.
- **If you do nothing:** all of Phase 1 stays open, and the description
  rewrite ships with no before/after activation reading — the claim it exists
  to test stays unmeasured while reading as ordinary open work.
- **Answer:** NOT COVERED by option (a) — 2026-08-20, disposition **transferred**,
  merged into `skill-activation-window`'s single live-trigger-eval stub per
  [drain-blocker-dispositions-a](../evidence/council/drain-blocker-dispositions-a.md).
  The rendered default (run both tree states in ONE sitting under the same protocol, or
  park with exactly that as the resume condition) is accepted as the PROTOCOL and is
  what makes the merge sound — one human sitting discharges both entries. The sitting is
  human-gated and host-controlled, so Rule 3 assigns it `B`. Batch A's probe is the
  concrete one: both predictions JSON files exist, share protocol metadata, and cover
  >=100 requests, >=3 shapes and the <=20% degradation bar.
- **Resolved when:** a predictions JSON exists for the pre-rewrite and the
  post-rewrite tree state, produced by the same protocol.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-08-09 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The baseline is taken against the wrong tree state | implementation | The pre-rewrite state must exclude the 9 rewrites but include the scorer repoint, or the two runs differ in more than the variable under test | 1.1 records the tree state it measured; 1.2 asserts scorer and fixture parity | Phase 1 |
| 2 | A single-number target invites Goodharting | implementation | A selector is probabilistic; one pre-registered floor would invite tuning the fixtures instead of the descriptions | Three criteria, all of which must hold, including a per-skill degradation ceiling | Phase 1 |
| 3 | The null is quietly dropped | implementation | A rewrite that did not move the instrument is the least satisfying outcome and the easiest to leave unpublished | 1.4 makes publishing the null a step with its own verify clause | Phase 1 |
