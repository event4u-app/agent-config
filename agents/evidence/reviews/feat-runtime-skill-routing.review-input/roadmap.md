<!-- check-refs: skip -->
<!-- verbatim roadmap snapshot for the R2 reviewer; the live roadmap layer is excluded from check_references, and a snapshot must not fail a gate its source is exempt from -->
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

- [x] 1.1 Extend the catalogue capture to report projected **skill** counts per
      host under `scoped` and under `legacy-all`, side by side, as a measurement
      only. No default changes and no install behaviour changes in this step.
      Shipped as `capture_skill_catalogue --projection-modes` (repeatable
      `--host-root`): 218 scoped / 289 legacy-all, one walk partitioned by the
      installer's own predicate. A host root matching neither is reported
      `indeterminate` rather than snapped to the nearer number.
      <!-- verify: grep -c 'scoped' src/scripts/capture_skill_catalogue.ts -->
- [x] 1.2 Verify end to end that a `scoped` install delivers skill descriptions
      un-stripped on at least one host that strips them today, and record the
      observation as a row rather than as prose.
      **Ran, and the premise is FALSE — published as a null.** Two
      `codex exec --json` arms against one copy-on-write-cloned host home,
      skill set the only variable: `legacy-all` 297 skills → 402 dropped,
      `scoped` 226 skills → 330 dropped, **every description stripped in both**.
      Scoping moves the count roughly one-for-one (−71 skills, −72 dropped) and
      is an order of magnitude too short to clear this host's budget. Both rows
      carry `projection_mode`; reading and method in
      `agents/evidence/analysis/scoped-projection-host-delivery.md`. Phase 4 is
      the recovery path and does not depend on this answer being yes.
      <!-- verify: grep -c 'projection_mode' agents/evidence/metrics/skill-catalogue.jsonl -->

## Phase 2 — Bind the ranker

- [x] 2.1 Add a `skill-route` concern on `user_prompt_submit` that runs the
      existing ranker and injects at most one line of top-k skill **pointers** —
      never bodies, silence as the default when nothing scores. Its budget row
      ships in the same change, inside the slot's 4,096-byte sum cap. Mirror
      `delegation-nudge`, which already proves delivery on this slot.
      Shipped: `src/scripts/hooks/skill_route_hook.ts`, bound on `claude` only
      (the one platform whose exit-2 warn delivery is verified) and dropped for
      the `worker` role. Budget row **512** — half the default, so a later
      change that starts injecting bodies fails the build. Emission on a real
      firing prompt is **323 bytes**; `bench_hook_injection` reports the concern
      at **0 B** because its synthetic probe does not clear the floor. Both
      readings are stated rather than the flattering one.
      **TWO floors, both measured — the R2 review found one of them
      insufficient and the correction is the substance of this step.** Score
      ≥ **31**, not the p90 of 30: the scorer is `overlap*70 + persona*30`, so a
      persona-only coincidence scores exactly 30 and a floor of 30 admitted it.
      Task terms ≥ **3**: the scorer divides by the term count, so `"fix it"`
      (1 term) scored 70/100 and emitted the alphabetically first three skills —
      a defect no score floor can fix, because the denominator is the problem.
      3 is the corpus's own minimum, so it excludes **none** of the 496 prompt
      lines the calibration rests on. Corpus fire rate 9.1 %.
      Cost measured rather than assumed: 12.3 ms warm when it ranks, 0 ms below
      the term floor (checked before the catalogue read), against a 250 ms p95
      slot budget. Ten tests pin both floors; mutating them back to 30/0 fails
      three.
      <!-- verify: grep -c 'skill-route' src/scripts/hook_manifest.yaml -->
- [x] 2.2 Register its adoption metric alongside the existing advisory metrics,
      with no threshold committed before data — the house baseline-first rule.
      A carrier whose effect is never read is the failure this package has
      already measured twice.
      `skill_route_pointer_rate` registered with **no threshold**, an expected
      fire rate of 13.9 % as the trigger-half falsifier, and the honest gap
      named: no deterministic counter exists for "the agent acted on the
      pointer", so the numerator is audit-carried.
      <!-- verify: grep -c 'skill_route' src/config/hook-token-budget.json -->

## Phase 3 — Give skill triggers a schema before giving them content

- [x] 3.1 Add a `triggers` property to `src/scripts/schemas/skill.schema.json`,
      shaped after the rule-side field so the two stay legible together. The
      schema lands empty of adopters, which is the point: the capability is
      declarable before anything declares it.
      Same five match keys as the rule side, same `additionalProperties: false`,
      and deliberately no `intent`. **Mutation-verified rather than assumed:**
      swapping one seeded `phrase` for `intent` takes the validator from 0 to 1
      failing over 436 artefacts, and reverting returns it to 0.
      <!-- verify: grep -c 'triggers' src/scripts/schemas/skill.schema.json -->
- [x] 3.2 Extend the trigger-coverage validator to a skill scope. It reads rule
      triggers only today, through `router_match.ts`; a skill scope reuses that
      matcher rather than forking it.
      Shipped as `trigger_coverage --scope skill`, calling the shared
      `match_prompt` over a router-shaped view of the skill catalogue. The rule
      scope's pinned byte-identical output is untouched.
      **A premise in this roadmap's Risk 2 is corrected here:** it assumed the
      corpus counts activations "across the whole router", so a skill tranche
      could regress the rule-side number. `compile_router.ts` contains zero
      skill references and `dist/router.json` carries only kernel + tier_1 +
      tier_2 rules — the two catalogues are separate, so the 433 census is
      structurally out of a skill tranche's reach. The skill-side count is
      therefore a NEW number needing its own baseline, which is why the scope
      reports and never gates.
      <!-- verify: grep -c 'skill' src/scripts/trigger_coverage.ts -->
- [x] 3.3 Seed the first tranche of skill triggers and measure it against the
      302-prompt corpus. **The unintended-activation census may not rise above
      433.** A tranche that raises it is reverted, and the reading is published
      either way. **The gate is the MECHANICAL matcher, by decision, and its
      limit is stated rather than hidden:** it measures substring/regex
      activation, not model-judged relevance, so it catches a tranche that fires
      too widely and cannot catch one that fires plausibly but unhelpfully. The
      live LLM evaluation was not chosen because it has never run — its blocker
      has stood since the description rewrite shipped, and gating on it would
      gate on never. If it ever runs, it supersedes this gate.
      **Tranche of 4 skills seeded** (`authz-review`, `merge-conflicts`,
      `systematic-debugging`, `threat-modeling`), 11 narrow triggers.
      Measured over the 496 matrix prompt lines: **3 activations on 3 prompts**
      — `systematic-debugging` 2, `authz-review` 1. The 433 ceiling **did not
      move and could not**, per the 3.2 correction: `dist/router.json` is
      byte-identical after the seed and the rule scope still passes 26/26. The
      stated limit of this gate stands — it catches a tranche that fires too
      widely and cannot catch one that fires plausibly but unhelpfully.
      <!-- verify: git show HEAD:docs/contracts/rule-router.md | grep -c '433' -->

## Phase 4 — Recover what the host dropped

- [x] 4.1 Promote `suggest_skill_for_task` from an MCP stub to a real entry, so
      an agent that needs a skill the host never delivered has a way to ask for
      it by task rather than by name.
      Real handler in `ALLOWLIST`, removed from `STUB_TOOLS` (the generator
      refuses a name in both), catalog and inventory regenerated — stub count
      **12 → 11**. The stub's published `task` + `limit` schema was carried over
      **verbatim** rather than re-designed: a stub is a contract a consumer may
      already have read. Three paths probed: a real rank, an empty `task`, and a
      root with no catalogue — the last returns `no_catalogue`, never a
      confident empty list.
      <!-- verify: grep -c '_(stub)_' docs/contracts/mcp-tool-inventory.md -->
- [x] 4.2 Add a `missing-skill-recovery` route stating what to do when a skill
      exists in the tree and not in the host catalogue — the case the codex row
      makes concrete, with 393 entries dropped on the measured host.
      Shipped as a `type: auto`, tier-2a rule; router `tier-2` 77 → 78. It cites
      **402** rather than 393 — the figure re-measured on this branch
      (2026-08-16) instead of the 2026-08-15 row's, per the house rule that a
      premise is re-derived and not inherited. `enforced_by: none` is stated in
      the rule: `skill-route` covers the confident decile by construction and
      nothing observes the rest.
      <!-- verify: test -f src/rules/missing-skill-recovery.md -->

## Acceptance criteria

- [x] Per-host projected **skill** counts are recorded for both projection
      modes, and no default was flipped to get them.
      `--projection-modes` reports 218 scoped / 289 legacy-all per host root;
      the two live arms are rows carrying `projection_mode`. Nothing read or
      wrote a setting.
- [x] A ranker-backed concern is bound, budgeted, and carries an adoption metric
      with no pre-committed threshold.
      `skill-route`, 512-byte row (measured 323), `skill_route_pointer_rate`
      registered with `"threshold": "none committed before data"`.
- [x] The skill schema declares `triggers`, a validator reads it, and the first
      seeded tranche is measured against the 302-prompt corpus.
      Schema mutation-verified; `trigger_coverage --scope skill` reads it via
      the shared matcher; tranche of 4 skills → 3 activations over 496 prompt
      lines.
- [x] The unintended-activation census is at or below 433 after seeding.
      **Unchanged.** The skill SEED is structurally unreachable from the census
      — skills are not compiled into the router (zero skill references in
      `compile_router.ts`; `dist/router.json` byte-identical after the seed;
      rule scope still 26/26). **That argument does not cover the tier-2 rule
      this same branch adds**, which IS routed and therefore can move the
      number; the R2 review caught the gap and replayed the corpus, and the new
      rule's contribution is **0**. So the outcome holds on evidence and the
      structural argument holds only for the half it actually covers — recorded
      that way rather than as one sweeping claim.
- [x] No survivor count is computed anywhere, and no host limit is extrapolated
      from another host.
      No subtraction across the two denominators appears in the new code, the
      evidence page, or the rule; every host is reported on its own row.

## Blockers

### blocker: skill-trigger-seeding-precision-gate

- **Status:** resolved

- **Resolution:** 2026-08-15 — option (b), the mechanical census gates
  the tranche.** The deciding fact is that option (a) was never available: the
  predecessor live evaluation has **never been run**, its only artefact carries
  `"source": "tfidf-baseline"` and its own roadmap disqualifies it, and its
  blocker has stood since the rewrite shipped. Gating a seeding tranche on a
  human-gated run that has not happened in months is gating it on never.
  The 302-prompt matrix corpus is deterministic, available now, and its
  unintended-activation census (495 → 433) is a real ceiling a tranche can be
  measured against. **Its weakness is named rather than hidden:** it measures
  mechanical substring/regex activation, not model-judged relevance, so it can
  catch a tranche that fires too widely and cannot catch one that fires
  plausibly but unhelpfully. Step 3.3 states that limit inline. If the live
  evaluation ever runs, it supersedes this gate rather than duplicating it.
- **Owner:** user
- **Blocks:** Step 3.3
- **Question:** the precision reading that admits or rejects a seeded tranche
  comes from a live trigger evaluation, and the existing instrument is
  human-gated in `road-to-skill-description-measurement`. May the seeding
  tranche reuse that evaluation? **Measured answer: the harness yes, the run
  no** — and the shape of the reuse is now known:
  - **Two different instruments are easy to conflate.** The 302-prompt matrix
    corpus and its 495 → 433 unintended-activation census are the *mechanical*
    router matcher (`router_match.ts` / `trigger_coverage.ts`) — deterministic,
    no model calls. The human-gated one is the *live LLM* eval
    (`skill_trigger_eval.ts`, with `rule_trigger_eval.ts` as its sibling),
    which hard-aborts under automation via a `/dev/tty` confirmation gate.
  - **The harness is already proven reusable across catalogues.**
    `rule_trigger_eval.ts` exists precisely by importing `MockRouter`,
    `compute_metrics` and `_extract_field` from the skill one and swapping the
    catalogue and suite loaders (`export type RuleMeta = SkillMeta`). A
    skill-trigger variant is the same move a third time.
  - **The run is not reusable.** It needs its own corpus — a skill-trigger
    suite analogous to `tests/eval/routing-matrix/*.yaml` — which does not
    exist, so there is no existing execution to piggyback on.
  - **The predecessor eval has never been run.** The only artefact,
    `agents/evidence/reports/skill-selection-accuracy.json`, carries
    `"source": "tfidf-baseline"` and predates both the description rewrite and
    the scorer's 2026-08-09 repoint; that roadmap disqualifies it explicitly.
    So (a) as originally written was never available.
- **What to do:** pick exactly one — (a) author the skill-trigger suite and run
  the live eval as its own human-gated session, accepting that it is a third
  sibling script plus a new corpus; (b) gate the seeding tranche on the
  *mechanical* 433 census alone, accepting a weaker precision signal and saying
  so in the step; or (c) defer Phase 3 entirely until the predecessor roadmap's
  own live eval has run, so one human session produces both readings.
- **Resolved when:** the user states which of (a), (b) or (c) holds.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-08-16 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The ranker routes confidently to the wrong skill and costs more than the truncation it fixes | product | A pointer line the agent trusts is worse than no line when the ranking is poor, and the ranker has never run against real prompts in this position | 2.1 injects pointers rather than bodies and defaults to silence when nothing scores; 2.2 registers the adoption metric so the carrier can be removed on a reading rather than defended on intuition | Phase 2 — Bind the ranker |
| 2 | Seeded triggers raise unintended activations and degrade routing for rules that already work | product | **Premise FALSIFIED 2026-08-16 (3.2).** This read "the corpus counts activations across the whole router, so a skill-side tranche can regress a rule-side number". It cannot: `compile_router.ts` has zero skill references and `dist/router.json` carries only kernel + tier_1 + tier_2 rules, so the two catalogues are disjoint and the 433 census is out of a skill tranche's reach. The real residual risk is narrower — a skill tranche degrading SKILL routing, which has no baseline yet | The 433 ceiling held trivially (router byte-identical after the seed, rule scope 26/26). The live mitigation is the new skill-side count: 3 activations over 496 prompt lines from 4 skills, published as the baseline a later tranche is judged against. `--scope skill` reports and never gates, because a ceiling invented on the instrument's first day is not evidence | Phase 3 — Give skill triggers a schema before giving them content |
| 3 | Phase 1's measurement is read as a mandate to flip the projection default | implementation | The measurement and the decision look adjacent, and the decision is already locked with an open implementation elsewhere | The scope section names the owning roadmap and the locked decision explicitly, and both Phase 1 steps are written as measurement with no install behaviour change | What this roadmap does not touch |
| 4 | A tenth concern on a nine-concern slot pushes the byte sum over its cap | implementation | The slot is capped at 4,096 bytes in total and already carries nine carriers | The budget row ships in the same change and the existing CI gate fails the build on an unregistered emission, so the cap is enforced before the concern reaches a session | Phase 2 — Bind the ranker |
| 5 | The schema field ships and nothing ever declares one, repeating the capability it was built to end | product | The rule-side field has existed and gone unused, which is the defect this roadmap names | 3.1 and 3.3 are sequenced so the schema is followed by a seeded tranche in the same roadmap rather than left as an open invitation | Phase 3 — Give skill triggers a schema before giving them content |
