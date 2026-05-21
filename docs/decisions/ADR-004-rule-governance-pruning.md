---
adr: 004
status: accepted
date: 2026-05-08
decision: rule-governance-pruning
supersedes: —
superseded_by: —
phase: road-to-augment-limit-fit · P5.5
---

# ADR-004 — Rule-Governance Pruning (Phase 5)

## Status

**Accepted** · 2026-05-08.

## Context

`road-to-augment-limit-fit` Phase 5 ran a Rule-Governance Audit on
the 49 `type: auto` rules that consume the workspace-guidelines
budget via description-stub injection (~250 chars each). Three
analytic passes ran:

- **5.1** `scripts/audit_auto_rules.py` — measured stub vs. body
  cost. Auto-rule stubs total **11,513 chars · 23.3 %** of the
  49,512 ceiling.
- **5.2** `scripts/audit_overlap.py` — pairwise Jaccard on
  `path_prefix` triggers + symmetric keyword overlap on
  description/keyword/intent token sets. 4 pairs flagged
  (path-Jaccard ≥ 0.5 OR keyword-overlap ≥ 0.4).
- **5.3** `scripts/audit_likelihood.py` — corpus-keyword scoring
  against indexed skills + commands + contexts + guidelines. 0
  rules below the strict `< 2` hits floor; bottom-10 list surfaced
  for council walk.

**5.4** AI Council R3 (claude-sonnet-4-5 + gpt-4o, 2 rounds, prompt
mode) walked the candidate list. Council convergence and host
verdicts are recorded in `agents/runtime/reports/auto-rules-audit.md`
§ Phase 5.4. The dominant council insight:

> *"Rarity ≠ redundancy. Low corpus hits often indicate a
> preventative rule that fires precisely when needed, not a useless
> one. The audit cannot distinguish dead weight from option-value
> insurance."* — claude-sonnet-4-5

This narrowed the action surface from "remove anything in the
bottom 10" to four targeted decisions where redundancy or
mechanical-already status was structurally provable.

## Decision

Four approved actions, applied in Phase 5.6:

### Implementation pattern: demote via frontmatter

All four actions use the same mechanical pattern: change rule
frontmatter `type: "auto"` → `type: "manual"`. This:

- **Removes the stub from the workspace budget.**
  `scripts/measure_augment_budget.py` only counts `type: "auto"`
  rules (line 99). Anything else has zero stub cost.
- **Preserves the file and its cross-references.**
  Skills, contexts, templates, and contracts that link to the rule
  (`size-enforcement` is referenced from `rule-writing/SKILL.md`,
  `command-writing/SKILL.md`, `artifact-drafting-protocol.md`,
  `proposal.example.md`, `rule-classification.md`,
  `self-improvement-pipeline.md`, etc.) keep working.
- **Keeps `compile_router.py` deterministic.**
  Non-auto rules are skipped by `_resolve_tier`; the rule no
  longer routes through `router.json` but remains a reference
  document.

This pattern was chosen over hard deletion after the
cross-reference audit (Phase 5.6 prep) showed each candidate has
≥ 5 inbound references. Deletion would force a wide-radius
documentation rewrite for marginal additional savings.

### 1. `guidelines` — demote

- **Verdict:** demote (`type: "auto"` → `type: "manual"`).
- **Rationale:** Generic name, no `routes_to:` target, 552 corpus
  hits, no `path_prefix` trigger. Description ("Writing or
  reviewing code — check relevant guideline before writing or
  reviewing code") is ambient guidance already covered by the 9
  always-rules and the Iron-Law floor. The auto-stub adds ~185
  chars of overhead for a rule that fires on every code touch but
  has no specific routing target — i.e., it functions as a noop
  reminder. The body remains as a reference doc citing the
  guidelines-mechanics context.
- **Preserved triggers:** the body retains its trigger discussion
  for human readers; auto-discovery is dropped.
- **Migration:** none. Inbound link in
  `contexts/communication/rules-auto/guidelines-mechanics.md`
  remains valid.

### 2. `size-enforcement` — demote (logical merge into `rule-type-governance`)

- **Verdict:** demote (`type: "auto"` → `type: "manual"`); record
  the logical merge in this ADR rather than physically folding the
  body. `rule-type-governance` already routes to its own
  guideline; both rules now share the same auto-trigger surface
  conceptually but only `rule-type-governance` injects a stub.
- **Rationale:** Both rules fire during rule/skill/command
  authoring. `size-enforcement` enforces character budgets;
  `rule-type-governance` enforces always-vs-auto classification.
  Council R3 convergence on the merge. Physical body-fold rejected
  to keep blast radius small (see implementation-pattern note).
- **Preserved triggers:** "size", "budget", "limit", "char count",
  artefact creation/editing scope — all retained in the rule body
  for ad-hoc consultation; the auto-discovery surface is dropped.
- **Migration:** none required. `rule-writing/SKILL.md`,
  `command-writing/SKILL.md`, `artifact-drafting-protocol.md`,
  `proposal.example.md`, and the contracts continue to cite the
  rule by file path; the file still exists.

### 3. `package-ci-checks` — demote

- **Verdict:** demote (`type: "auto"` → `type: "manual"`).
- **Rationale:** Rule is `mechanical-already` — `task ci` already
  enforces the same checks before a PR can merge. The rule is also
  package-self-referential (it only fires when contributing to
  `event4u/agent-config` itself); consumer projects never benefit
  from the stub. Council R3: gpt-4o (demote), Sonnet (verify skill
  links contract first — confirmed: `routes_to: skill:lint-skills`).
- **Preserved triggers:** "task ci", "before push", "before pr".
  Body retains trigger phrases for human reference.
- **Migration:** AGENTS.md "Working on this repo" section already
  documents `task ci`; no consumer-project regression because
  consumers never received this rule's stub anyway (`source: package`).

### 4. `analysis-skill-routing` — demote

- **Verdict:** demote (`type: "auto"` → `type: "manual"`).
- **Rationale:** The rule's only function is to point host agents
  at the `analysis-skill-router` skill when an analysis request
  fires. The skill's own description carries the same trigger
  surface ("picking which analysis or project-analysis-* skill
  fits a request") and is already auto-discoverable as a Skill.
  The rule is a redundant pointer-to-pointer. Council R3:
  gpt-4o (merge into slash-command-routing-policy — host rejected:
  analysis ≠ slash-commands; merge would collapse a meaningful
  category distinction). Sonnet (keep + add `routes_to:` — host
  rejected: routing already exists via the skill itself).
- **Preserved triggers:** "analyze", "analysis", "dig into the
  codebase". Already present in the skill's description.
- **Migration:** Verify `analysis-skill-router` skill description
  is pushy enough; no other action required.

## Consequences

### Accepted

- **Stub-cost saving:** ~849 chars freed (~1.7 % of the 49,512 cap).
  Phase 5 alone is insufficient to hit the 20 % headroom goal.
- **Phase 6 (Thin-Root AGENTS.md) was mandatory**, not optional.
  AGENTS.md was the largest single asset (12,042 chars) and the
  only remaining lever once Phase 5 was locked in.
- **Four rules (`guidelines`, `size-enforcement`,
  `package-ci-checks`, `analysis-skill-routing`) demoted from
  `type: "auto"` to `type: "manual"`.** Total auto-rules: 49 → 45.
  Files preserved on disk; cross-references intact.
- **Final budget after Phases 5–7** (`scripts/measure_augment_budget.py`,
  2026-05-08): AGENTS.md 2,773 + always-rules (9) 26,322 + auto-rule
  stubs (45) 10,664 = **39,759 chars · 80.3 % utilisation · 19.7 %
  headroom** (149 chars / 0.3 % short of the ≥ 20 % goal — within
  rounding; effectively at target). Phase 6 (Thin-Root AGENTS.md
  refactor: 12,042 → 2,773 chars) carried the bulk of the saving
  that Phase 5 alone could not deliver. Phase 7 (`scripts/lint_agents_md.py`,
  CI-blocking) locks the contract in.

### Trade-offs

- **Sonnet's "rarity ≠ redundancy" critique honored.** The audit
  identified 14 candidates; only 4 pass the host's redundancy /
  mechanical-already test. Aggressive ceiling (~2,750 chars, per
  gpt-4o) was rejected as it would force domain-specific rules
  (`docker-commands`, `laravel-translations`) into manual
  guideline-load workflows for the 20 % of projects that need them.
- **`upstream-proposal` and `slash-command-routing-policy` both
  retained without `routes_to:` fix.** Flagged as follow-up work
  outside this ADR's scope; their preservation is justified by
  rare-but-critical activation pattern.
- **No `augment-portability` / `docs-sync` merge** despite 1.00
  path-Jaccard. Council R3 convergence: workspace-layout
  coincidence, not logical duplication. Different intents
  (host-portability vs. sync-workflow hygiene).

## Re-evaluation trigger

- Augment changes its accounting model (e.g. starts injecting
  auto-rule bodies into the workspace prompt) → re-open this
  governance pass; the stub-cost / body-cost ratio changes
  drastically.
- Auto-rule count grows by ≥ 5 (history check via
  `agents/runtime/.augment-budget-history.jsonl`) → repeat the audit
  with the same three-pass methodology.
- A retained rule (`upstream-proposal`, `slash-command-routing-policy`,
  `analysis-skill-routing`'s sibling skill) shows a 30-day window
  with zero documented activation in `agents/runtime/council/sessions/` →
  open a follow-up ADR demoting it.

## Alternatives considered

- **Aggressive prune (gpt-4o R1 line):** demote
  `agent-docs`, `docker-commands`, `laravel-translations`. Rejected.
  Sonnet's rarity-≠-redundancy critique applies; these are
  domain-specific rules with substantial corpus presence (240+
  hits each) and their absence forces consumer projects into
  manual guideline-load. The ~750-char additional saving is not
  worth the behavioural regression.
- **`augment-portability` / `docs-sync` merge (gpt-4o R2):**
  Rejected. 1.00 path-Jaccard reflects shared filesystem
  triggers (`docs/guides/agent-setup/augment.md`), not shared
  intent. `augment-portability` enforces project-agnostic content
  in `.agent-src/`; `docs-sync` enforces cross-reference integrity
  on add/rename/delete. Different verbs, different blast radii.
- **Defer all rule changes; focus on Phase 6 only:** Rejected.
  The four approved actions are independently defensible; bundling
  them with Phase 6 would obscure the rationale and conflate two
  different optimisation strategies (rule-set hygiene vs.
  AGENTS.md restructure). Each phase ships its own savings on its
  own audit trail.

## References

- `agents/roadmaps/archive/road-to-augment-limit-fit.md` § Phase 5
- `agents/runtime/reports/auto-rules-audit.md` (full audit findings,
  council walk, host verdicts)
- `agents/runtime/reports/auto-rules-overlap.json` (Phase 5.2 data)
- `agents/runtime/reports/auto-rules-likelihood.json` (Phase 5.3 data)
- `agents/runtime/council/questions/augment-limit-fit-rule-governance.md` <!-- council-ref-allowed: ADR decision trace -->
  (Phase 5.4 prompt)
- `agents/runtime/council/responses/augment-limit-fit-rule-governance.json` <!-- council-ref-allowed: ADR decision trace -->
  (Phase 5.4 R3 raw debate)
- `docs/decisions/ADR-rule-kernel-and-router.md` (kernel-membership
  contract — Phase 5 changes leave kernel untouched per Lever C lock)
- `.agent-src.uncompressed/rules/guidelines.md` (deprecated subject)
- `.agent-src.uncompressed/rules/size-enforcement.md` (merged subject)
- `.agent-src.uncompressed/rules/package-ci-checks.md` (demoted subject)
- `.agent-src.uncompressed/rules/analysis-skill-routing.md` (demoted subject)
