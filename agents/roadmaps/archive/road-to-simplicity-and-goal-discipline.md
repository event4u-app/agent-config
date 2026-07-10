---
complexity: simple
status: ready
execution:
  mode: phase-checkpoints
---

# Road to simplicity and goal discipline — close the over-engineering and vague-goal gaps

> Source-anonymous harvest per `source-confidentiality`. Source A is an
> external behavioral-guidelines reference (a compact 4-principle ruleset for
> reducing common LLM coding mistakes, plus a wrong/right example corpus).
> The transferable lesson: the dominant *commission* failure of LLM coding is
> premature complexity — speculative features, unrequested flexibility,
> impossible-scenario error handling — and the dominant *execution* failure is
> accepting vague tasks without transforming them into verifiable success
> criteria.

## Provenance

- Source A: `ENC1:b7Kou24burt71Eoa/gpeoTK+dyWW3uRVH1RYctmQINGcCt8qswUiIrSWfLunK+pYGSOfq22tIHBv+ck5S4jJcw==`

## Goal

Fold Source A's genuinely-new deltas into the existing rule surface —
extend-over-create, no new kernel rule, no new always-loaded cost. After this
roadmap, an agent in any consumer project (a) refuses speculative complexity
with a concrete self-check, (b) cleans up exactly the orphans its own change
created — and nothing else, and (c) transforms vague tasks into verifiable
per-step success criteria before executing.

## Gap analysis — what Source A adds vs. what we already have

| Source A principle | Our coverage | Verdict |
|---|---|---|
| 1. Think Before Coding (surface assumptions, present interpretations, push back) | `think-before-action`, `ask-when-uncertain`, `improve-before-implement`, `invite-challenge` | **Covered** — no action |
| 2. Simplicity First (no speculative features/configurability, no impossible-scenario error handling, "200→50 lines" rewrite, senior self-check) | `minimal-safe-diff § Anti-over-engineering` covers premature abstraction + tombstones only | **Gap** — extend `minimal-safe-diff` |
| 3. Surgical Changes (touch only what you must; clean up your own orphans; leave pre-existing dead code) | `minimal-safe-diff` covers the diff floor; `downstream-changes` covers callers/refs | **Partial gap** — the positive orphan-cleanup obligation (imports/vars/functions *your* change made unused) is nowhere explicit |
| 4. Goal-Driven Execution (transform tasks into verifiable goals; per-step verify plan) | `verify-before-complete` (after-the-fact), `test-driven-development` (skill, on demand) | **Partial gap** — the *before-acting* task→verifiable-criteria transformation is not in the always surface |
| Wrong/right example corpus | House pattern exists (`*-demos.md` guidelines) | **Gap** — no simplicity/goal demos file |

## Decisions

- **Extend, don't create.** All three deltas land inside existing rules
  (`minimal-safe-diff`, `think-before-action`) + one demos guideline. No new
  rule file, no router change, no new trigger surface.
- **No CLAUDE.md/AGENTS.md generation change.** The kernel rules already
  project into every tool surface; landing the content in kernel rules IS the
  CLAUDE.md integration.
- **Kernel budget respected.** Rule bodies get only the obligation lines;
  worked detail goes to the mechanics context / demos guideline. Verified via
  `check_always_budget`.
- **No conflict with prior locks.** The `council-ai-failure-mode-prevention`
  lock targets *omission* failures (missing invisible controls); this roadmap
  targets *commission* failures (premature complexity) — different mechanism,
  mechanism-match check passed.

## Council convergence (2026-07-10, claude-sonnet-4-5 + gpt-4o, 2 rounds)

- **Demos are the enforcement mechanism, not an auxiliary.** LLM failure is
  non-recognition, not rationalization — a checklist question the agent
  cannot ground answers itself "yes" while the violation ships. Each rule ban
  therefore cross-references its wrong/right demo pair; Phase 3 is
  load-bearing, not optional polish.
- **Own-orphan boundary is the diff, made testable.** An identifier is an
  own-orphan iff its last reference disappeared in a file THIS diff touched;
  if any reference survives in an untouched file it is pre-existing debt
  (surface via `active-remediation`, never delete). This resolves the
  causal-attribution concern mechanically — no time-boundary reasoning.
- **Self-check questions land verbatim in the rule** (not paraphrased):
  "Would a senior engineer call this overcomplicated?" and, per new
  abstraction, "cite the second caller — or inline it".
- **Anonymization is verified deterministically** — run the
  no-external-sources check on every new/touched file, not just asserted.
- Rejected: a standalone "simplicity-first" rule (extend-over-create
  confirmed) and rigid procedural checklists that would themselves violate
  simplicity.

## Phase 1 — Simplicity-first + orphan discipline in `minimal-safe-diff`

- [x] Extend `src/rules/minimal-safe-diff.md § Anti-over-engineering` with the
      speculative-complexity bans: no features beyond the ask, no
      configurability/"flexibility" that wasn't requested, no error handling
      for scenarios that cannot occur, and the rewrite trigger ("if the change
      could be half the size, rewrite before presenting"). The self-checks
      land verbatim: "Would a senior engineer call this overcomplicated?" and,
      per new abstraction, "cite the second caller — or inline it". Each ban
      cross-references its wrong/right demo pair (Phase 3) — the demos are the
      enforcement, per council convergence.
- [x] Add an "Own-orphan cleanup" clause to `src/rules/minimal-safe-diff.md`
      with the testable boundary: an identifier is an own-orphan iff its last
      reference disappeared in a file THIS diff touched — remove it in the
      same diff; any reference surviving in an untouched file marks it
      pre-existing debt — surface via `active-remediation`'s note-and-ask
      ladder, never delete drive-by.
- [x] Cross-link the clause from `src/rules/downstream-changes.md` (stale-
      reference check already greps for old names — own-orphans is the same
      sweep applied to the new diff).
- [x] Verify: `npx tsx src/scripts/check_always_budget.ts` passes (per-rule
      cap respected).

**Exit:** `minimal-safe-diff` names both the speculative-complexity ban and
the own-orphan obligation; budget check green.

## Phase 2 — Goal-driven execution in `think-before-action`

- [x] Add one obligation line to `src/rules/think-before-action.md`: before a
      multi-step task, restate it as verifiable success criteria (test that
      reproduces the bug, failing-then-passing check, before/after invariant);
      a task whose success cannot be checked is a clarification trigger, not
      an execution trigger.
- [x] Add the worked transformation table (vague ask → verifiable goal, and
      the per-step `step → verify:` plan shape) to the mechanics context
      `src/agent-src/contexts/communication/rules-auto/think-before-action-mechanics.md`
      so the rule body stays lean.
- [x] Verify: `npx tsx src/scripts/check_always_budget.ts` still green.

**Exit:** the task→verifiable-criteria transformation is in the always
surface as one line, with mechanics on demand.

## Phase 3 — Demos guideline (wrong/right corpus)

- [x] Create `docs/guidelines/agent-infra/simplicity-and-goal-demos.md` with
      adapted wrong/right/why demos: over-abstraction vs. one function,
      speculative features vs. just-what-was-asked, drive-by refactor vs.
      surgical diff, style drift vs. match-existing-style, vague plan vs.
      verifiable per-step plan. Cross-stack examples (PHP + TypeScript
      side-by-side per `framework-neutrality-in-generic-skills`), fully
      anonymized.
- [x] Link the demos file from `minimal-safe-diff` and the think-before-action
      mechanics context ("Examples" pointer, house pattern of
      `direct-answers-demos`).
- [x] Verify: `npx tsx src/scripts/check_refs.ts` (or the repo's reference
      checker task target) reports no broken links for the touched files.
- [x] Verify: the no-external-sources check
      (`src/scripts/check_no_external_sources.ts`) is green for every
      new/touched file — anonymization proven, not asserted.

**Exit:** demos file exists, linked, reference + confidentiality checks green.

## Phase 4 — Condense + projections

- [x] Run the condensation flow for the touched `src/` files (per
      `source-of-truth`; `/condense` semantics — hashes updated, projections
      regenerated).
- [x] Verify: condensation hash check green for touched files; no stale
      `dist/agent-src/` for the edited rules.

**Exit:** projections in sync; working tree ready for review.

## Acceptance criteria

- `minimal-safe-diff` bans speculative complexity and mandates own-orphan
  cleanup; `think-before-action` mandates verifiable success criteria.
- No new rule file, no router/trigger change, `check_always_budget` green.
- Demos guideline linked and reference-check green.
- All content anonymized; provenance only as `ENC1:` token.
