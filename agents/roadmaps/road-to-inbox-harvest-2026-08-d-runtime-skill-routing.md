---
complexity: structural
status: ready
---

# Road to a ranker that actually routes

**Goal.** The deterministic task→skill ranker that already ships stops being
inert: it gets bound to the one slot whose delivery is proven, the catalogue it
ranks over stops being truncated silently, and the activation-trigger capability
that no skill declares gets a schema and a precision harness before a single
trigger is seeded.

**Source:** a proposal roadmap that arrived in the inbox, pinned at `e3bd96158`,
archived local-only at `agents/tmp.old/context-custodian/`. Triage, claim
verification, and the three corrections folded in here:
`agents/evidence/analysis/inbox-harvest-2026-08-d-triage.md`.

## Context

Re-verified against the tree at `e3bd96158`. Where the proposal's figures were
stale, the current ones are used and the correction is named.

- **The projection is wholesale.** `src/scripts/install.ts:1914` defines
  `_CLAUDE_SKILL_BUNDLE` as rules + skills + commands + personas, and
  `:1921-1949` hands that same bundle to 13 hosts unchanged. Nothing trims by
  size on the way out.
- **One host reports its own truncation, and the number is not the one the
  proposal carries.** `agents/evidence/metrics/skill-catalogue.jsonl` holds two
  rows. Codex, observed 2026-08-15 from a host event:
  `entries_total: 497`, `dropped_count: 393`, `truncation_mode:
  budget-strip-and-drop`, verdict `insufficient-observation`. Claude, observed
  2026-08-12: 336 entries, 16 bare, verdict `no-selector`. **The proposal's
  "667 dropped, ~31 survive" is the retracted anecdotal reading** — its own
  investigation page says the double-count does not reproduce and that the
  `entries_total − dropped_count` subtraction describes neither host
  (`agents/evidence/investigations/skill-catalogue-codex-truncation.md` §2–3).
  Nothing here computes a survivor count.
- **A deterministic ranker exists and is bound to nothing.**
  `src/scripts/skill_tools/suggest_skill_for_task.ts` and
  `score_skill_relevance.ts` both ship; `docs/contracts/mcp-tool-inventory.md:52`
  lists `suggest_skill_for_task` as a stub, and `hook_manifest.yaml` has no
  concern that calls either.
- **The slot is available and its delivery is proven, but it is not free.**
  `src/scripts/hook_manifest.yaml:632` shows nine concerns already on
  `user_prompt_submit`, under a 4,096-byte sum cap
  (`src/config/hook-token-budget.json:35`). A new injector needs its own budget
  row or the build fails — which is the gate working, not an obstacle.
- **Zero of 289 skills declare an activation trigger, and the schema does not
  have the field.** The single `^triggers:` hit under `src/skills/` is a code
  example inside `rule-writing/SKILL.md:195`, teaching rule authors. **The
  proposal's claim that "the schema supports them" is wrong in a way that
  changes the work:** `src/scripts/schemas/skill.schema.json` contains no
  `triggers` property at all, and `trigger_coverage.ts` validates *rule*
  triggers through `router_match.ts`. Seeding skill triggers is net-new schema
  plus a net-new validator, not reuse of an existing harness.
- **The precision harness those triggers would be measured against is real.**
  `docs/contracts/rule-router.md:111-112` records the 302-prompt corpus and the
  unintended-activation census at 495 → 433. 433 is the number a seeding tranche
  may not raise.
- **Classification stays deterministic.** `auto-dispatch-classification.md` v1 is
  rule-based with no per-turn LLM meta-call; nothing here introduces one.

## What this roadmap does not touch

- **The scoped-projection default and the migration notice.** Those belong to
  `road-to-skill-catalogue-budget` and to the decision recorded for it on
  2026-08-15 (owner ruling plus a 2/2 council): fresh installs stay `scoped`,
  an existing install may be *asked* and never written, and the notice never
  offers `settings:set` because `projection.mode` is a class-C key. **That work
  shipped and the roadmap archived while this one was being written** — the
  decision is closed, not pending. Phase 1 below produces a per-host
  measurement that stands on its own; it does not re-open the decision,
  re-implement the notice, or flip any default.
- **The comparison basis the proposal assumed.** The same decision falsified it
  on this estate's own probe: adding 60 command files moved the measured host's
  dropped count by 0, adding 60 skills moved it by 53, against run-to-run noise
  of 8. Any threshold in Phase 1 compares **skill counts**, never artefact
  totals, and never extrapolates one host's limit to another.
- **Deleting or merging skills to fit a limit.** Whether 289 is the right number
  is owned elsewhere; over-shipping stays the safe direction.

## Phase 1 — Measure what each host would actually receive

- [ ] 1.1 Extend the catalogue capture to report projected **skill** counts per
      host under `scoped` and under `legacy-all`, side by side, as a measurement
      only. No default changes and no install behaviour changes in this step.
      <!-- verify: grep -c 'scoped' src/scripts/capture_skill_catalogue.ts -->
- [ ] 1.2 Verify end to end that a `scoped` install delivers skill descriptions
      un-stripped on at least one host that strips them today, and record the
      observation as a row rather than as prose.
      <!-- verify: grep -c 'projection_mode' agents/evidence/metrics/skill-catalogue.jsonl -->

## Phase 2 — Bind the ranker

- [ ] 2.1 Add a `skill-route` concern on `user_prompt_submit` that runs the
      existing ranker and injects at most one line of top-k skill **pointers** —
      never bodies, silence as the default when nothing scores. Its budget row
      ships in the same change, inside the slot's 4,096-byte sum cap. Mirror
      `delegation-nudge`, which already proves delivery on this slot.
      <!-- verify: grep -c 'skill-route' src/scripts/hook_manifest.yaml -->
- [ ] 2.2 Register its adoption metric alongside the existing advisory metrics,
      with no threshold committed before data — the house baseline-first rule.
      A carrier whose effect is never read is the failure this package has
      already measured twice.
      <!-- verify: grep -c 'skill_route' src/config/hook-token-budget.json -->

## Phase 3 — Give skill triggers a schema before giving them content

- [ ] 3.1 Add a `triggers` property to `src/scripts/schemas/skill.schema.json`,
      shaped after the rule-side field so the two stay legible together. The
      schema lands empty of adopters, which is the point: the capability is
      declarable before anything declares it.
      <!-- verify: grep -c 'triggers' src/scripts/schemas/skill.schema.json -->
- [ ] 3.2 Extend the trigger-coverage validator to a skill scope. It reads rule
      triggers only today, through `router_match.ts`; a skill scope reuses that
      matcher rather than forking it.
      <!-- verify: grep -c 'skill' src/scripts/trigger_coverage.ts -->
- [ ] 3.3 Seed the first tranche of skill triggers and measure it against the
      302-prompt corpus. **The unintended-activation census may not rise above
      433.** A tranche that raises it is reverted, and the reading is published
      either way.
      <!-- verify: git show HEAD:docs/contracts/rule-router.md | grep -c '433' -->

## Phase 4 — Recover what the host dropped

- [ ] 4.1 Promote `suggest_skill_for_task` from an MCP stub to a real entry, so
      an agent that needs a skill the host never delivered has a way to ask for
      it by task rather than by name.
      <!-- verify: grep -c '_(stub)_' docs/contracts/mcp-tool-inventory.md -->
- [ ] 4.2 Add a `missing-skill-recovery` route stating what to do when a skill
      exists in the tree and not in the host catalogue — the case the codex row
      makes concrete, with 393 entries dropped on the measured host.
      <!-- verify: test -f src/rules/missing-skill-recovery.md -->

## Acceptance criteria

- [ ] Per-host projected **skill** counts are recorded for both projection
      modes, and no default was flipped to get them.
- [ ] A ranker-backed concern is bound, budgeted, and carries an adoption metric
      with no pre-committed threshold.
- [ ] The skill schema declares `triggers`, a validator reads it, and the first
      seeded tranche is measured against the 302-prompt corpus.
- [ ] The unintended-activation census is at or below 433 after seeding.
- [ ] No survivor count is computed anywhere, and no host limit is extrapolated
      from another host.

## Blockers

### blocker: skill-trigger-seeding-precision-gate

- **Status:** open
- **Owner:** user
- **Blocks:** Step 3.3
- **Question:** the precision reading that admits or rejects a seeded tranche
  comes from a live trigger evaluation, and the existing instrument for that is
  itself human-gated in `road-to-skill-description-measurement`. May the seeding
  tranche reuse that evaluation, or does it need its own run?
- **What to do:** pick exactly one — (a) run the existing live trigger
  evaluation once and let both roadmaps read it, or (b) declare the skill-side
  census a separate measurement and state who runs it.
- **Resolved when:** the user states which of (a) or (b) holds.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-08-15 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The ranker routes confidently to the wrong skill and costs more than the truncation it fixes | product | A pointer line the agent trusts is worse than no line when the ranking is poor, and the ranker has never run against real prompts in this position | 2.1 injects pointers rather than bodies and defaults to silence when nothing scores; 2.2 registers the adoption metric so the carrier can be removed on a reading rather than defended on intuition | Phase 2 — Bind the ranker |
| 2 | Seeded triggers raise unintended activations and degrade routing for rules that already work | product | The 302-prompt corpus counts activations across the whole router, so a skill-side tranche can regress a rule-side number | 3.3 pins 433 as a ceiling the tranche may not raise and reverts rather than caveats; the schema and validator land first so a tranche is measurable before it is written | Phase 3 — Give skill triggers a schema before giving them content |
| 3 | Phase 1's measurement is read as a mandate to flip the projection default | implementation | The measurement and the decision look adjacent, and the decision is already locked with an open implementation elsewhere | The scope section names the owning roadmap and the locked decision explicitly, and both Phase 1 steps are written as measurement with no install behaviour change | What this roadmap does not touch |
| 4 | A tenth concern on a nine-concern slot pushes the byte sum over its cap | implementation | The slot is capped at 4,096 bytes in total and already carries nine carriers | The budget row ships in the same change and the existing CI gate fails the build on an unregistered emission, so the cap is enforced before the concern reaches a session | Phase 2 — Bind the ranker |
| 5 | The schema field ships and nothing ever declares one, repeating the capability it was built to end | product | The rule-side field has existed and gone unused, which is the defect this roadmap names | 3.1 and 3.3 are sequenced so the schema is followed by a seeded tranche in the same roadmap rather than left as an open invitation | Phase 3 — Give skill triggers a schema before giving them content |
