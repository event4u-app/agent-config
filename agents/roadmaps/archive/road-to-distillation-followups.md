---
complexity: lightweight
---

# Road to the distillation follow-ups — two maintainer-gated items, relocated intact

> Successor to `road-to-inbox-harvest-distillation`, which reached
> `count_open == 0` with one deferred step and two open blockers. Iron Law 3
> forbids archiving a roadmap that still carries `[~]` work, and the archival
> sweep additionally refuses one with open blockers — correctly, because both
> are how planned work gets buried.
>
> This file exists so neither gets buried. The step and both blockers are
> carried over **verbatim in substance**: nothing here is newly decided, nothing
> is quietly dropped, and the predecessor archives honestly because its
> remaining work has an owner rather than because the work stopped mattering.

## Outcome

Closed 2026-08-20. **Archived does not mean achieved.** One item was done, one
was transferred out; per-item states below, and the roadmap is honest about
which is which.

| Item | Outcome state | What actually happened |
|---|---|---|
| Phase 1 Step 1 — the router-head retrofit | **narrowed → satisfied** | Done. All four offenders restructured to router heads under the published cap; `GRANDFATHERED` emptied. Narrowed because the instrument the blocker asked for was never built and **no token or activation saving is claimed** — the justification is the published cap alone. |
| Phase 2 Step 1 — the first true analysis run | **transferred** | Not done, and not attempted. Moved to [`stubs/road-to-first-reference-analysis-run.md`](stubs/road-to-first-reference-analysis-run.md) with the three-point integrity check and three probes, all measured failing. The acceptance criterion is unmet and stays unmet until a maintainer runs it. |

Dispositions from the council record
[`drain-blocker-dispositions-b.md`](../evidence/council/drain-blocker-dispositions-b.md)
(2026-08-20, quorum 2/2): `router-head-retrofit-instrument` → **D, narrowed**;
`first-contract-true-analysis-run` → **B, transferred**.

**One correction against that record, stated rather than silently applied.** The
adopted line reads "Restructure the **three** K6 offenders on the published
cap". The count is **four**, and this roadmap already said so before the council
ran — see the `Count corrected 2026-08-14` note on Phase 1 Step 1, which spells
out that retrofitting three would leave the fourth allowlist entry unremovable
and the step falsely done. `lint_skill_router_head` measured four at
`d6cc42e63` (`ai-council` 1134, `skill-writing` 802, `roadmap-management` 557,
`quality-tools` 445). The file wins over the count in the record; all four were
retrofitted. The disposition itself — restructure on the cap, claim no saving —
is applied unchanged.

## Why relocation rather than a decision

Both items are maintainer calls of a kind an agent should not take:

- The retrofit is gated on an instrument that **does not exist** — and building
  it means observing what a host loads on skill trigger, which nothing in this
  tree can see. Proceeding without it would be deciding on an unmeasurable
  premise, which is exactly what ADR-202 forbids.
- The analysis run **spends** on external fetches and produces raw named
  evidence that `source-confidentiality` keeps local-only unless anonymised.

Neither is blocked on effort. Both are blocked on a call, and relocating them
is the only move that neither fakes the call nor loses the item.

## Phase 1 — The router-head retrofit

- [x] **Step 1: Retrofit the four offenders.** Restructure the `SKILL.md`
      files that exceed the published K6 cap into an entry head (when-to-use,
      mode table, routing) plus its detail, per the router-head contract that
      already shipped as Phase 4.1 of the predecessor. **Done 2026-08-20** —
      blocker resolved as disposition D (narrowed). All four restructured into
      an entry head plus per-mode bodies under `references/`:
      `ai-council` 1134 → 375, `skill-writing` 802 → 266,
      `roadmap-management` 557 → 163, `quality-tools` 445 → 153.
      `GRANDFATHERED` in `src/scripts/lint_skill_router_head.ts:61-66` is now
      empty, and the gate reports *"290 skill head(s) scanned · 0 over the
      400-line cap · allowlist holds 0 entry(ies), shrink-only"*.
      Content moved verbatim: measured against `git show HEAD:` per file, the
      only original lines not surviving byte-identical are 11 relative links
      re-depthed by one directory level and 1 same-file anchor retargeted to
      its new sibling — no prose, bullet, fence or negation clause was lost.
      Three obligations a pointer could not carry stayed in their head instead,
      with other material moving in their place: the `ai-council` ordered
      output-format MUST, the `skill-writing` `## Frugality Standards` section
      that the skill linter requires by name, and the `quality-tools`
      analysis-before-action step (restated in the head procedure as an
      explicit config-inspection step covering both stacks).
      <!-- decision 2026-08-20: proceed on the published K6 cap alone, per
      disposition D of drain-blocker-dispositions-b.md. The instrument the
      blocker asked for — one that observes what a host loads on skill trigger
      — was NOT built and does not exist in this tree. Therefore NO
      token-savings or activation figure is claimed anywhere in this diff or
      this roadmap, and none may be added later without that instrument. The
      reason is not modesty: the host loads SKILL.md whole on trigger, and
      whether it then follows a pointer into references/ is host behaviour
      nothing here observes, so any saving figure would be unmeasurable by
      construction. That is exactly the class of claim ADR-202 forbids, and it
      is precisely the number the missing instrument would have been needed to
      support. The defensible claim is narrower and sufficient: the cap was
      already this repository's published position, and now no skill sits
      above it. -->
      **Count corrected 2026-08-14: four, not three.** `lint_skill_router_head`
      reports *"4 over the 400-line cap, all grandfathered or routed · allowlist
      holds 4 entry(ies), shrink-only"*, and `GRANDFATHERED` in
      `src/scripts/lint_skill_router_head.ts:60-65` names them with their
      measured line counts — `ai-council` (1055), `skill-writing` (767),
      `roadmap-management` (552), `quality-tools` (445). The allowlist is
      shrink-only, so retrofitting three and closing this step would leave the
      fourth entry unremovable and the step falsely done.
      <!-- verify: ./scripts-run src/scripts/lint_skill_router_head -->

  > **`quality-tools` at 445 is the one to check first, not last.** It is 45
  > lines over a 400-line cap, i.e. the only offender where the retrofit might
  > be a section move rather than a restructure — and if the instrument (see the
  > blocker) ever arrives, the smallest offender is where a before/after reading
  > is cheapest to take and least likely to be confounded by the restructure
  > itself.

**Falsifier.** The instrument arrives and its first before/after reading shows
no measurable difference on one skill → the retrofit is not worth its churn;
cancel this phase and record the reading, because a restructure that costs
review attention and buys nothing is worse than the cap being unmet on paper.

> **Falsifier status 2026-08-20: moot, not passed.** The instrument never
> arrived, so its reading was never taken and this falsifier never had the
> chance to fire. The work proceeded on the disposition's narrower ground — the
> published cap — which is a claim the falsifier does not test. If the
> instrument is ever built and reads no difference, that does **not** retract
> this phase: the cap is met either way. What it would retract is any future
> attempt to justify a retrofit on savings grounds.

**Rollback.** Four skill files; the contract itself is already shipped and
unaffected.

## Phase 2 — The untested contract path

- [-] **Step 1: Run `/analyze:reference-repo` end to end under its own §5b
      convergence contract** against a small reference, and land the evidence
      artefact. **Transferred 2026-08-20** (disposition B, outcome state
      `transferred`) to
      [`stubs/road-to-first-reference-analysis-run.md`](stubs/road-to-first-reference-analysis-run.md)
      — the run makes outbound third-party fetches and yields raw named
      evidence, neither of which an agent may authorise; the criterion is
      **unmet** and the stub carries it with three probes, all measured failing.
      <!-- verify: ls agents/roadmaps/stubs/road-to-first-reference-analysis-run.md -->

**Falsifier.** The run shows the §5b contract cannot converge on a real
reference (the verdict table never stops flipping within its four-pass cap) →
the contract is wrong rather than untested, and this becomes a fix to the
command instead of an evidence gap.

**Rollback.** One evidence artefact.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-08-13 | reviewer: claude/host -->
| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | A relocation roadmap that is really a graveyard | product | Moving two blocked items into a new file discharges the predecessor's gates without advancing either item. If nobody ever returns, the relocation has bought archival tidiness at the cost of a second file nobody reads — which is worse than the honest red it replaced | Both phases carry a falsifier that can DELETE them on evidence rather than only on completion, and each blocker keeps its original `Resolved when` verbatim, so the condition that would restart the work is unchanged and checkable | Phase 1, Phase 2 |
| 2 | The carried-over text drifts from what the predecessor argued | implementation | Substance restated in a new file is substance that can be paraphrased into something slightly different, and the predecessor is archived where nobody will diff it | The blockers below are copied unchanged including their `What to do` and `Resolved when` fields, and the predecessor's step note is quoted rather than summarised | Blockers |

## Blockers

### blocker: router-head-retrofit-instrument
- **Status:** resolved
- **Owner:** maintainer
- **Class:** 2 — consent-once
- **Blocks:** Phase 1 Step 1 only.
- **What to do:** either supply an instrument that observes what the host
  actually loads on skill trigger (no such observation exists in this tree
  today), or decide explicitly that the published K6 cap is reason enough to
  restructure the three offenders without a token claim.
- **Resolved when:** an instrument exists and has produced a before/after
  reading on one skill, **or** a maintainer decision is recorded that the
  contract alone justifies the retrofit.
- **Resolution 2026-08-20:** the **second** limb, via disposition D (narrowed)
  in [`drain-blocker-dispositions-b.md`](../evidence/council/drain-blocker-dispositions-b.md)
  — "the published K6 cap is sufficient to justify structural compliance, but
  not a quantitative token-savings claim", with the second seat putting it as
  "the contract alone justifies the retrofit", which is this field's own
  wording. The first limb is **not** satisfied: no instrument was built, no
  before/after reading exists, and none is claimed. Phase 1 Step 1 is done on
  the cap alone and carries no savings figure.
  Two notes on the field text above, left verbatim rather than edited so the
  record stays diffable. It says "three offenders" while the step it blocks
  says four; four is correct and four were retrofitted (see § Outcome). And
  "consent-once" describes the shape accurately — one recorded decision
  unblocked the whole step, with no per-file consent needed.

### blocker: first-contract-true-analysis-run
- **Status:** resolved
- **Owner:** maintainer
- **Class:** 2 — consent-once
- **Blocks:** Phase 2 Step 1 only.
- **What to do:** run the command against a small reference and land the
  evidence artefact. Two things make this a maintainer call rather than an
  autonomous step: it spends on external fetches, and its output is raw named
  evidence, which `source-confidentiality` keeps local-only unless anonymised.
- **Resolved when:** one evidence artefact exists that was produced by the
  command rather than by an ad-hoc pass.
- **Resolution 2026-08-20:** resolved as **transferred**, not as satisfied, via
  disposition B in [`drain-blocker-dispositions-b.md`](../evidence/council/drain-blocker-dispositions-b.md)
  — "the run crosses the external-fetch and raw named-evidence trust
  boundaries". The `Resolved when` criterion above is **unmet and remains
  unmet**: no artefact exists. It travels verbatim to
  [`stubs/road-to-first-reference-analysis-run.md`](stubs/road-to-first-reference-analysis-run.md)
  together with the complete list of dependent steps and a named re-entry
  producer — the repository maintainer operating an approved outbound-fetch
  environment — plus three detection probes, each measured **failing** at
  `d6cc42e63`: no `compare-*.md` under `agents/evidence/analysis/` (0 files),
  no file there carrying `## Iteration record` (0 files), and therefore no
  confidentiality classification to check. "Resolved" here means the blocker no
  longer gates this roadmap, not that the work happened.

## Non-goals

- **No new decisions.** This file relocates two items and decides neither.
- **No re-derivation of the predecessor's evidence** — its Context section
  stays authoritative and is archived, not deleted.
