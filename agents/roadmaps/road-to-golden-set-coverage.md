---
complexity: structural
status: ready
parent_roadmap: road-to-token-saving
---

# Road to golden-set coverage — make every flip verdict mean something

> The quality gate that guards projection/tier flips judges only what the
> golden set covers: today **14 of 91 router rules** (verified 2026-07-07:
> 30 tasks, all labelled, exactly 1.0 rules/task — multi-rule tagging
> unused). The uncovered rules split into **23 consumer-relevant** (including
> ALL four domain safety floors, `non-destructive-by-default`,
> `lethal-trifecta-guard`, `untrusted-input-defense`) and **54
> exclusively-maintainer** that leave the consumer gate once consumer-scoped
> projection lands. Cover the 23 first, make coverage claims falsifiable via
> a mechanical prompt↔trigger check, and respect the locked hand-labelling
> rule. Council-integrated per
> `agents/settings/contexts/token-program-integration-verdict.md`: labels are
> configuration-independent — drafting and labelling proceed NOW; only the
> PAID judge run waits for consumer scoping.

## Goal

`check_token_quality_golden --require-complete` goes green for the
**consumer-scoped rule set** before any consumer-facing flip (thin OR the
essential default), with every task's prompt mechanically verified to
actually activate its tagged rules — so "covered" means *fires*, not
*mentioned*. Locked and not re-litigated: `expected` anchors are
**hand-labelled, never LLM-generated**; the ≥48% win-rate threshold and the
length-controlled paired-judge design (`road-to-token-saving` Phase 0).

## Context — verified on the live checkout, 2026-07-07

- Golden set (`internal/bench/corpora/token-quality-golden.yaml`): 30 tasks,
  30 labelled, 0 stubs, structurally valid. Coverage **14/91 router rules**;
  1.0 rules/task.
- Uncovered split (cross-referenced against `workspaces:` frontmatter):
  **23 consumer-relevant** — all four domain safety floors (`engineering-`,
  `finance-`, `legal-`, `strategy-safety-floor`),
  `non-destructive-by-default`, `lethal-trifecta-guard`,
  `untrusted-input-defense`, the stack-routing cluster (`laravel-routing`,
  `laravel-translations`, `symfony-routing`, `php-coding`,
  `docker-commands`), the git-surface cluster (`commit-policy`,
  `commit-conventions`, `git-history-discipline`,
  `no-decorative-emojis-in-git-surfaces`, `no-pr-progress-comments`), the
  design cluster (`design-fidelity`, `icon-consistency`,
  `brand-consistency`, `brand-source-of-truth`), plus
  `linked-projects-onboarding-gate`, `source-discovery-gate`. And **54
  exclusively-maintainer** rules. Recompute the exact consumer universe in
  Phase 0 (file-count 32 non-maintainer vs draft's 37 — resolve against the
  router entry list, not file counts).
- **The riskiest uncovered rules are the safety floors.** The token-saving
  council named "silent breakage misread as model regression" the top
  flip risk; a safety floor that silently stops firing under any
  conditional-load mechanism is the worst instance — and none of them has a
  single golden task today. Safety-floor coverage guards EVERY flip
  (essential default AND thin), which is why this work is not gated on
  either.
- Validator: `check_token_quality_golden` reports coverage and gates
  structure; `--require-complete` is the designed exit flip.
  `trigger_coverage.ts` already implements the matching semantics (keyword =
  case-insensitive substring; intent = all alpha words >2 chars present)
  needed to verify a prompt fires a rule — reusable for Phase 3.
- Judge-run cost scales linearly with labelled tasks × eager-arm context.
  After consumer scoping the eager arm shrinks ~3× — the paid run waits for
  `road-to-request-scoped-rule-load` Phase 1 and is batched into the
  operator sitting defined in `road-to-token-proof-and-story` Phase 1.

**Covered elsewhere — not duplicated:** judge harness, Wilcoxon machinery,
bias controls (`road-to-token-saving` Phase 0, built); the live judge run
(operator/cost gate, sequenced by the program tracking table); the
consumer/maintainer projection split (`road-to-request-scoped-rule-load`).

## Automation & human gates

- **Fully autonomous:** Phases 0, 1, 3 (validator extension, stub drafting,
  prompt↔trigger linter — mechanical, CI-verified). Stub drafting produces
  `label_status: stub` entries with empty `expected` — structurally valid,
  excluded from judge runs, zero quality claims made.
- **One human gate, by design:** Phase 2 — writing `expected` anchors.
  Hand-labelling is locked (agent output judged against agent-written
  anchors would be circular). The agent surfaces each rule's Iron-Law line
  in `notes:` as raw material; rubric and anchors are operator-authored.
- **Maintainer track: DELETED** (council + handoff consolidation) — one
  backlog line lives in `road-to-token-saving` Phase 10; no parked phase
  here.

## Phase 0 — Scope-aware coverage accounting

- [ ] Extend `check_token_quality_golden` with
      `--scope consumer|maintainer|all`: coverage universe = router rules
      filtered by `workspaces:` frontmatter (consumer = not exclusively
      `agent-config-maintainer`). Default `all` (non-breaking). Emit the
      exact consumer-universe count in the report (resolves the 32-vs-37
      draft discrepancy authoritatively).
- [ ] Report block per scope: covered/uncovered counts + ids; wire the
      consumer-scope report into the existing CI scaffold output (report
      only, no new failure).
- [ ] Document in `TOKEN-QUALITY-GOLDEN-SCHEMA.md`: any consumer-facing flip
      requires `--require-complete --scope consumer`; a maintainer-side flip
      would require `--scope all`.

**Exit:** `--scope consumer` reports 14/N covered with N printed from the
router; existing CI unchanged.
**Rollback:** flag removal; default path untouched.

## Phase 1 — Trigger-anchored stub drafting (consumer rules, autonomous)

Draft structurally-valid stubs for the uncovered consumer rules — prompts
derived from each rule's actual router triggers so activation is checkable.

- [ ] Cluster plan (target ~18–22 new tasks via multi-rule tagging):
      - **Safety floors: one dedicated task each** (`engineering-`,
        `finance-`, `legal-`, `strategy-safety-floor`,
        `non-destructive-by-default`, `lethal-trifecta-guard`,
        `untrusted-input-defense`) — safety rules never share a task, so a
        per-rule verdict is readable from the pair results.
      - **Stack cluster:** one Laravel task tagging `laravel-routing` +
        `laravel-translations` + `php-coding` + `docker-commands`; one
        Symfony task for `symfony-routing`.
      - **Git-surface cluster:** one PR-flow multi-turn task tagging
        `commit-policy` + `commit-conventions` +
        `no-decorative-emojis-in-git-surfaces` + `no-pr-progress-comments`;
        one `git-history-discipline` corner-case.
      - **Design cluster:** one UI task tagging `design-fidelity` +
        `icon-consistency`; one brand task for `brand-consistency` +
        `brand-source-of-truth`.
      - Singles for the remainder (`source-discovery-gate`,
        `linked-projects-onboarding-gate`).
- [ ] Scenario-mix guard: keep all four types present per scope; add ≥2
      multi-turn and ≥2 conflicting-rule tasks among the new stubs (e.g.
      safety floor vs `direct-answers` tension).
- [ ] Each stub carries `notes:` citing the rule's Iron-Law line + which
      trigger the prompt exercises — operator raw material, not labels.

**Exit:** `--scope consumer` reports full coverage (stubs count for
coverage), 0 structural errors; labelled count unchanged (30) — no quality
claim inflated.
**Rollback:** delete the stub entries; YAML-only change.

## Phase 2 — Operator labelling sprint (the human gate)

Labels are configuration-independent — this can start any time after
Phase 1; only the paid judge run is sequenced by the program table.

- [ ] Label the 7 safety-floor tasks **first** — they guard the highest
      flip risk; a partial live run gated on `--limit` should sample these
      preferentially.
- [ ] Label the remaining consumer stubs (clusters second, singles last).
      A `labelled` task needs a non-TODO rubric + ≥1 `must_include` anchor
      (validator-enforced).
- [ ] Flip the consumer gate: `--require-complete --scope consumer` goes
      green; record the flip against the parent roadmap's
      `phase-0-golden-set` blocker.

**Exit:** ~48–52 labelled tasks, consumer scope complete, zero stubs in
scope; the live judge run is unblocked at consumer scope (run timing per the
program tracking table).
**Rollback:** none needed — labels only add information.

## Phase 3 — Prompt↔trigger falsifiability linter

"Covered" must mean the prompt would actually fire the rule.

- [ ] New check in `check_token_quality_golden`: for every task, each tagged
      rule must have ≥1 router trigger matched by the task prompt, reusing
      `trigger_coverage.ts` matching semantics (keyword substring / intent
      word-set; `path_prefix`/`file_pattern`/`command` triggers satisfiable
      via an optional per-task `context_files:`/`command:` field — additive
      schema change).
- [ ] Run against the full set including the 30 existing tasks; fix or
      re-tag any nominal-only coverage found (honest finding either way —
      if existing tasks fail, that is a real defect in today's 14/91 claim).
- [ ] Wire into CI (structure-level, always on — it validates tagging, not
      labels, so it is autonomous-safe).

**Exit:** every covered rule is trigger-verified; the check fails a
synthetic mis-tagged fixture.
**Rollback:** demote the check to warning.

## Acceptance criteria

- [ ] Validator is scope-aware; the consumer universe is computed from the
      router, printed in the report (Phase 0).
- [ ] All uncovered consumer rules gain trigger-anchored stubs; safety
      floors have dedicated tasks (Phase 1).
- [ ] Operator labels complete the consumer scope;
      `--require-complete --scope consumer` green (Phase 2).
- [ ] Coverage is falsifiable: prompt↔trigger check in CI, existing set
      audited under it (Phase 3).
- [ ] No `expected` anchor in the corpus is LLM-generated — drafting stops
      at stubs + notes, verifiably (`label_status` discipline).
- [ ] The maintainer track exists ONLY as a backlog line in
      `road-to-token-saving` Phase 10 — no parked phase here.

## Blockers

### blocker: operator-labelling-capacity
- **Status:** open
- **Owner:** maintainer
- **Blocks:** Phase 2 (and thus the consumer-scope `--require-complete`
  flip + the live judge run at full consumer coverage)
- **What to do:** label the ~18–22 drafted stubs, safety floors first
  (est. 2–4 h focused work; stub `notes` carry each rule's Iron-Law line as
  raw material). Batch with the operator sitting defined in
  `road-to-token-proof-and-story` Phase 1.
- **Resolved when:** `check_token_quality_golden --require-complete
  --scope consumer` exits 0.

### blocker: paid-judge-run-sequencing (soft)
- **Status:** open — ordering decision, owned by the program tracking table
- **Owner:** maintainer
- **Note:** the live judge run is ~3× cheaper and more representative
  **after** `road-to-request-scoped-rule-load` Phase 1 shrinks the eager
  arm to the consumer set (est. US$8–12 today, ~US$3–4 after). Labelling
  proceeds in parallel; only the paid run waits.
