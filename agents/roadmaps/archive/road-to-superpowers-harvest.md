---
complexity: structural
---

# Road to Superpowers Harvest

**Status:** LANDED (2026-05-09) — Phase 1 complete (5 of 6 units shipped,
P1.4b deferred to Phase 2 by kill-switch). Decisions synthesized 2026-05-06
from AI Council Round 1 (analysis, $0.0465) + Round 2 (this roadmap, $0.0446).
Council convergence captured inline below (Provenance section).
**Started:** 2026-05-06
**Closed:** 2026-05-09
**Trigger:** User ask — "harvest what's useful from obra/superpowers v5.1.0,
challenge with two AIs, then build a roadmap and challenge that too."
**Mode:** Hard cap **5 adoption units per six-week plate** (per
`road-to-microck-harvest.md` precedent). Phase 1 reconceptualized after
council Round 1 flagged that B/C/D candidates all mutate the same skill
(`subagent-orchestration`) — they ship as **one bundled adoption unit**,
not three.

## Purpose

Harvest workflow-chain discipline from Superpowers v5.1.0 — the
brainstorm → plan → subagent → TDD → review chain, plus its prompt
externalization and status taxonomy — without inheriting its
chain-enforcement HARD-GATE that would regress our confidence-band
work-engine. Strategic value is **methodology depth, not skill volume**:
14 of their skills overlap our 136 already; the harvest is the deltas.

**Out of scope:**

- Plugin marketplace, sponsorship, Discord wiring (distribution-layer
  concerns, not methodology).
- Their `using-superpowers` and `writing-skills` meta-skills (we are
  upstream-stronger via `skill-writing` + `skill-quality` + `lint-skills`).
- Their HARD-GATE chain enforcement as written (regression for our
  work-engine; we adopt the *wording* with a trivial-action escape).

## Decisions (synthesized 2026-05-06 from council Round 1)

| Question | Decision | Source |
|---|---|---|
| **Plate cap** | 5 adoption units per six-week plate. | Council unanimous + Microck precedent. |
| **Phase-1 picks** | A (TDD), Bundle (D+B+C → subagent-upgrade), G (spec self-review), F (HARD-GATE wording), E (bite-sized planning). | Council Round 1 convergence. |
| **B/C/D bundling** | Single adoption unit `subagent-orchestration upgrade` because all three mutate the same skill; effort compounds, not adds. | Sonnet, structural. |
| **D-before-B sequencing** | Status taxonomy must land before prompt externalization — extracted prompts need to know which statuses to emit. | Sonnet, dependency chain. |
| **C in Phase 1** | Two-stage review (spec then quality) is domain-agnostic; deferring wastes the harvest. | Sonnet, against GPT-4o's "phased" framing. |
| **Effort recalibration** | A's effort raised from 1 to 3 (file split needed to stay under 400-line sunset). | Council unanimous. |
| **HARD-GATE scoping** | Adopt wording only for non-trivial implementation; trivial-action allowance from `autonomous-execution` rule overrides. | Sonnet, integration with kernel. |
| **No auto-promotion** | Phase 2 unlocks only on Phase 1 evidence (lint + tests + 6-week stability). | Microck precedent. |

## Horizon (6-week visible plate)

Phase 1 is the visible plate. Phase 2 is **out-of-horizon**.

## Phase 1 — Five-unit adoption plate (READY)

- [x] **P1.1 — TDD hardening with anti-pattern externalization** (Adoption A).
  Strengthen `.agent-src.uncompressed/skills/test-driven-development/SKILL.md`
  with their delete-and-restart Iron Law and the 12-row anti-rationalization
  table. Externalize the table to a sibling reference doc
  (`testing-anti-patterns.md`) to stay under the 400-line sunset trigger.
  Cross-link from `pest-testing`, `judge-test-coverage`, `quality-tools`.
  Effort: 1 day. **Risk:** sibling-doc proliferation; mitigated by
  Sunset Policy enforcement in P1.6.
- [x] **P1.2 — `subagent-orchestration` upgrade bundle** (Adoptions D+B+C,
  sequenced D → B → C).
  - **D first:** add status taxonomy (`DONE` / `DONE_WITH_CONCERNS` /
    `NEEDS_CONTEXT` / `BLOCKED`) to the implementer-subagent contract.
    Validate D in isolation **before** B starts: write a JSON schema for
    the status envelope, add `tests/skills/test_subagent_status_schema.py`
    that exercises all four statuses + rejection cases. Green-CI gate =
    these new tests pass + existing `tests/skills/` suite green.
  - **B second:** extract the six-mode prompts into sibling files under
    `subagent-orchestration/prompts/{mode}.md`. Each prompt cites the
    status taxonomy from D. Green-CI gate = `lint-skills` resolves all
    sibling-file refs + new `tests/skills/test_subagent_prompt_loading.py`
    confirms each mode loads its prompt + status schema validates each
    prompt's expected envelope.
  - **C third:** add a `do-and-judge-two-stage` mode that runs a
    spec-compliance reviewer subagent first, then a code-quality
    reviewer subagent. Document when to choose two-stage vs.
    one-stage in the mode-selection matrix. Green-CI gate = mode
    matrix exhaustive over all 7 modes (existing 6 + new) + at least
    one integration test per stage.
  Effort: 3 days bundled (D=1, B=1, C=1). **Risk:** D-before-B sequencing
  assumes D is self-contained, but B's prompts may hardcode status values.
  Mitigation: D ships with a schema file (`schemas/subagent-status.json`)
  that B's prompts validate against in CI. **Kill-switch:** if green CI
  cannot be reached within 2 attempts on D, abort the bundle and
  open a separate spike issue; do not ship B+C on a broken D.
- [x] **P1.3 — Spec self-review pattern** (Adoption G).
  Add a "Self-Review" section to our planning skills (`feature-planning`,
  `refine-prompt`, `refine-ticket`) that mandates: spec-coverage scan,
  placeholder scan, type-consistency check. Direct adapt from their
  `writing-plans/SKILL.md` § Self-Review. Effort: 0.5 day. **Risk:**
  drift from their wording on next upstream release; mitigated by
  pinning their commit SHA in our skill's provenance footer.
- [x] **P1.4a — Confidence-band API audit** (Adoption F prerequisite).
  Verify the kernel exposes `confidence_band` as a queryable signal
  (cite file/function in the closure note). If not present, this task
  becomes a 1-day API addition (signal definition + tests) before P1.4b
  can land. Green-CI gate = `grep -rn "confidence_band" scripts/ rules/`
  returns at least one consumer; otherwise spike a separate ticket.
  Effort: 0.5 day (audit only) or 1 day (audit + API addition).
- [-] **P1.4b — HARD-GATE wording with autonomous-execution scope**
  (Adoption F consumer).
  Add an HARD-GATE section to `feature-planning` and the new
  `improve-before-implement` rule that forbids implementation skills
  before user-approved design — but **only for non-trivial work**
  (≥ medium `confidence_band` threshold from `autonomous-execution`).
  Trivial actions still bypass per the kernel rule. Green-CI gate =
  new test in `tests/rules/test_hard_gate_scope.py` that asserts
  trivial actions bypass and non-trivial actions block. Effort: 0.5 day.
  **Risk:** users on `autonomy=on` see surprise gating; mitigated by
  making the gate respect the autonomy setting explicitly in the
  rule's wording. **Kill-switch:** if P1.4a reveals `confidence_band`
  is not exposed, defer P1.4b to Phase 2 — do not improvise an API.
- [x] **P1.5 — Bite-sized 2-5min task granularity** (Adoption E).
  Add a "Bite-Sized Task Granularity" section to `feature-planning`
  (or new sibling skill `writing-implementation-plans`) that mandates
  exact file paths, complete code, exact commands, expected output,
  no placeholders. Direct port of their `writing-plans/SKILL.md` §
  Task Structure + § No Placeholders. Effort: 1 day. **Risk:** UX
  pushback (per GPT-4o) — too granular for senior engineers; mitigated
  by gating the granularity on plan complexity (`structural` complexity
  flag in roadmap frontmatter triggers it; `lightweight` skips).
- [x] **P1.6 — Suite integration.** Update `AGENTS.md` skill/rule counts,
  regenerate compressed output (`bash scripts/compress.sh --changed`),
  regenerate tool projections (`task generate-tools`), run full CI
  (`task ci`). No commit chunking until evidence captured.

## Closure notes (2026-05-09)

| Phase | Outcome | Evidence |
|---|---|---|
| P1.1 | LANDED | `tests/` green; `testing-anti-patterns/process-anti-patterns.md` externalized; cross-links in `pest-testing`, `judge-test-coverage`, `quality-tools`. |
| P1.2 (D) | LANDED | `tests/test_subagent_status_schema.py` green; `schemas/subagent-status.json` ships with 4 statuses + rejection cases. |
| P1.2 (B) | LANDED | `tests/test_subagent_prompt_loading.py` green; 7 prompts under `subagent-orchestration/prompts/` (six original modes + new two-stage). |
| P1.2 (C) | LANDED | `tests/test_subagent_two_stage.py` green; `do-and-judge-two-stage` mode wired into the matrix. |
| P1.3 | LANDED | 3-scan self-review (Spec Coverage / Placeholder / Type-Consistency) added to `feature-planning`, `refine-prompt`, `refine-ticket`. |
| P1.4a | LANDED (audit-only) | `agents/evidence/investigations/confidence-band-audit-2026-05-09.md` — signal lives inside `work_engine/scoring/`, NOT exposed to rules. |
| P1.4b | DEFERRED to Phase 2 | Kill-switch fired (P1.4a found `confidence_band` not exposed as queryable rule signal). Per § Kill-switch row 3, P1.4b lands audit-only; HARD-GATE wording postponed. |
| P1.5 | LANDED | `tests/test_bite_sized_granularity.py` 13/13 green; `scripts/check_bite_sized_granularity.py` ships complexity-gated validator. |
| P1.6 | LANDED | `task ci` clean post-commit; sync-check + sync-check-hashes green; 2560/2560 pytest passing. |

## Verification & CI Contract (per phase)

Each P1.x lands only when **fresh evidence in the closure note** shows:

| Phase | CI command | Evidence artefact |
|---|---|---|
| P1.1 | `pytest tests/skills/test_tdd_*.py` + `bash scripts/skill_linter.py --skill test-driven-development` | line-count delta + sibling-doc reference resolves |
| P1.2 (D) | `pytest tests/skills/test_subagent_status_schema.py` | 4 statuses + N rejection cases pass |
| P1.2 (B) | `pytest tests/skills/test_subagent_prompt_loading.py` + `lint-skills --skill subagent-orchestration` | each mode loads its prompt; envelope validates |
| P1.2 (C) | `pytest tests/skills/test_subagent_two_stage.py` | spec-stage + quality-stage both invoked, status routing correct |
| P1.3 | `bash scripts/skill_linter.py --skills feature-planning,refine-prompt,refine-ticket` | self-review section present, references resolve |
| P1.4a | `grep -rn confidence_band scripts/ rules/` | at least one producer cited |
| P1.4b | `pytest tests/rules/test_hard_gate_scope.py` | trivial bypass + non-trivial block |
| P1.5 | `pytest tests/skills/test_bite_sized_granularity.py` + roadmap fixture validation | structural-complexity gate fires; lightweight skips |
| P1.6 | `task ci` | all of the above + sync-check + check-portability + check-refs |

**No "should pass" claims.** Every closure note pastes the actual command
output (last 10 lines + exit code). Per `verify-before-complete`.

## Kill-switch / abort criteria

A Phase-1 unit is **aborted and reverted** (not "debugged forever") when:

| Trigger | Action |
|---|---|
| > 2 attempts to green CI on P1.2 (D) | Abort bundle. Spike a separate `subagent-status-schema` ticket. P1.2 (B+C) defer to Phase 2. |
| > 4 hours of debug churn on any single P1.x | Pause, surface to user, do not proceed silently. |
| P1.4a reveals no `confidence_band` exposure | Defer P1.4b. Land P1.4a as audit-only outcome. |
| P1.5 fixture validation cannot distinguish structural vs lightweight | Drop the complexity-gating; ship E behind an explicit opt-in flag instead. |
| Any P1.x lands red CI on `main` after merge | Revert merge commit. Re-open as failed-spike issue. |

## Promotion gate (Phase 1 → 2)

Phase 2 unlocks **only** when **all** of these hold (objective, not "feels stable"):

1. Every P1.x checkbox above is `[x]` with closure-note evidence pasted.
2. `task ci` is green on `main` for ≥ 6 weeks since P1.6 landed.
3. Zero P1-related revert commits in that window.
4. At least one real-world use of the new `subagent-orchestration` two-stage
   mode is captured in `agents/sessions/` or roadmap closure notes.
5. No open `superpowers-harvest`-tagged issue with `kind:bug` severity ≥ medium.

## Phase 2 — Out-of-horizon (gated on Phase 1 evidence)

- [ ] **P2.1 — `executing-plans` batched-with-checkpoints flow.**
  Their `executing-plans` ships a different shape than our `/work`
  engine — batched with human checkpoints rather than confidence-band
  autonomous. Adopt only if Phase 1 evidence shows users want a
  middle ground between full autonomy and one-step-at-a-time review.
- [ ] **P2.2 — `brainstorming` Socratic dialogue mode.** Their skill
  enforces section-by-section spec validation. We have `refine-prompt`
  + `refine-ticket`; evaluate the delta after Phase 1.
- [ ] **P2.3 — Hooks comparison.** Diff their `hooks.json` /
  `hooks-cursor.json` against our `scripts/hook_manifest.yaml` to
  surface any session-start patterns we're missing.

## Risk register

| Risk | Mitigation |
|---|---|
| `subagent-orchestration` regression from D+B+C bundle | Sequence each commit, green CI between, judge-with-debate on the bundle landing PR. CI contract per P1.2 sub-step (see § Verification). |
| Latent B↔D cycle (B's prompts hardcode status values D wants to schema-validate) | D ships `schemas/subagent-status.json`; B's prompts validate against it in CI before B can land. |
| "Green CI" hollow — no orchestration tests exist today | P1.2 ships **new** test files (`test_subagent_status_schema.py`, `test_subagent_prompt_loading.py`, `test_subagent_two_stage.py`); CI contract is what those tests assert, not the existing suite. |
| TDD skill exceeds 400-line sunset | Anti-pattern table externalized in P1.1 (sibling doc). |
| HARD-GATE assumes `confidence_band` API exists | P1.4a audits first; P1.4b deferred to Phase 2 if API absent (kill-switch). |
| Bite-sized granularity overwhelms senior users | Complexity-gated activation in P1.5 (structural-only). |
| Upstream wording drift | Pin Superpowers commit SHA in every ADOPT skill's provenance footer. |
| Sunk-cost on P1.2 bundle (debug forever) | 4-hour-debug-churn kill-switch + 2-attempt-green-CI cap on D. |
| Phase 1→2 gate is just "time elapsed" | Promotion gate § specifies 5 objective criteria, not stability vibes. |
| 5-unit plate feels small | Council unanimous on Microck cap; Phase 2 stays out-of-horizon. |

## Provenance

- Analysis: `agents/evidence/analysis/compare-obra-superpowers.md`
- Council Round 1 (analysis): anthropic/claude-sonnet-4-5 + openai/gpt-4o, 2026-05-07, $0.0465
- Council Round 2 (this roadmap): anthropic/claude-sonnet-4-5 + openai/gpt-4o, 2026-05-07, $0.0446
- Upstream pin: `obra/superpowers@main` v5.1.0 (2026-05-04 release)
- Sibling roadmaps: `road-to-microck-harvest.md`, `road-to-markitdown-adoption.md`
