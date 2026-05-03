---
status: in-progress
---

# Road to PR #34 Follow-ups

**Status:** PLAN — derived from PR #34 round-6 external review (2026-05-02).
**Started:** 2026-05-02
**Trigger:** Round-6 review of `feat/road-to-governance` (governance cleanup F1–F7 + AI Council). Score 9.4 / 10. Direction endorsed; four concrete weaknesses called out as merge-blockers (P0) and follow-ups (P1 / strategic).
**Mode:** Sequential. Phase 1 (P0) must land before merge. Phases 2–4 land in 1.16.x. Phases 5–6 are the strategic context-layer build-out and stay open as their own milestones.

## Source — round-6 headline

> "PR #34 does not soften the package. It makes it clearer, cheaper, more maintainable, and better positioned. Senior depth is still there — it just needs cleaner extraction into contexts next."

Scoring snapshot:

| Area                       | Score    |
|----------------------------|----------|
| Governance cleanup         | 9.4 / 10 |
| Maintainability            | 9.5 / 10 |
| Rule hardness / safety     | 9.2 / 10 |
| Token / budget discipline  | 9.6 / 10 |
| Product positioning        | 9.3 / 10 |
| Reduction risk             | medium   |
| Overall                    | 9.4 / 10 |

Key finding: `agent-authority` shipped as a clean priority-index router rather than the feared mega-merge. Rule hardness preserved while always-rule budget heavily relieved. Right architectural call.

## Scope (locked)

| Phase | Theme | Trigger from review | Gate |
|---|---|---|---|
| 1 | P0 merge-blockers | Catalog links · command count messaging · README wording | Must land before PR #34 merges |
| 2 | Split `autonomous-execution` | "Still a mixed document of rule + decision logic + examples + failure modes + mechanics + cloud behavior" | 1.16.x |
| 3 | `load_context:` first consumer | "Schema + linter shipped; first real consumer is still missing" | 1.16.x |
| 4 | Golden behavior tests against drift | "Fix failing test must not test-only-patch", etc. | 1.16.x |
| 5 | Context-layer realization | `contexts/execution/` · `contexts/communication/` · `contexts/authority/` populated | Strategic |
| 6 | Always-rule budget hardening | "Currently 37,879 / 49,000; aim ≥20% headroom permanently" | Strategic |

## Phase 1 — P0 merge-blockers

P0 means **before PR #34 merges**. Three concrete items.

- [x] **1.1 Public catalog link audit.** `docs/catalog.md` is the consumer-facing catalog but currently links into `.agent-src.uncompressed/`. That path is fine on GitHub, may break for consumers depending on package distribution config (npm / Composer / archive surfaces) if `.agent-src.uncompressed/` is not shipped. Audit every link in `docs/catalog.md` and re-target to shipped surfaces (`.agent-src/` or `docs/`). Add a CI check (`scripts/check_public_catalog_links.py` or extend `check_public_links.py`) so this regression cannot recur silently.
- [x] **1.2 Command-count messaging fix.** README states "84 commands" while the collapse contract is in flight. Externally this reads as growth, not consolidation. Update the README hero / catalog headline to surface "84 command files (incl. N deprecation shims) — M active top-level/clustered commands". Source the active count from `scripts/lint_no_new_atomic_commands.py` cluster registry so the number stays accurate.
- [x] **1.3 README "creates PRs" → "prepares PRs".** Hero text currently says "creates PRs"; later text correctly says `/commit` and `/create-pr` are suggestions, never auto. Align hero wording to "prepares PRs" (or "helps create PRs"). Same fix in the marketplace `description` if it carries the same phrase.

### Phase-1 success criteria

- All three items checked.
- `task ci` green (incl. new public-catalog-links check).
- Zero links in `docs/catalog.md` resolve to `.agent-src.uncompressed/` or other unshipped surfaces.
- Command-count number in README sourced from registry, not hardcoded.
- PR description updated to call out the fixes.

## Phase 2 — Split `autonomous-execution`

Round 6 finding:

> "`autonomous-execution` is now `type: auto`, not always — good for budget. Content is still a mixed document of rule + decision logic + examples + failure modes + mechanics + cloud behavior. Architecturally not yet at target shape."

Target shape (proposed by review):

```
rules/autonomous-execution.md                          (lean rule)
contexts/execution/autonomy-detection.md               (LOGIC — opt-in/opt-out, speech-act, heuristic)
contexts/execution/autonomy-mechanics.md               (MECHANICS — setting table, cloud behavior)
contexts/execution/autonomy-examples.md                (EXAMPLES — anchors, trivial cases, failure modes)
```

- [x] **2.1 Inventory the current file.** Annotate every section of `autonomous-execution.md` as RULE / LOGIC / MECHANICS / EXAMPLE. → [`agents/reports/pr-34-phase-2-1-autonomous-execution-inventory.md`](../reports/pr-34-phase-2-1-autonomous-execution-inventory.md).
- [x] **2.2 Extract LOGIC + MECHANICS to `contexts/`.** Use the `load_context:` schema shipped under `road-to-rebalancing` Phase 2.
- [x] **2.3 Extract EXAMPLES into context-backed example files.** Keep examples under the allowed `load_context:` roots for this phase (e.g. `.agent-src.uncompressed/contexts/execution/autonomy-examples.md`). Do not extend the beta `load_context:` schema in the same commit. A future roadmap may introduce a dedicated `examples/` root once the first consumer has proven stable.
- [x] **2.4 Slim the rule.** Target ≤ 120 lines, RULE-only content, with `load_context:` references for the moved sections.
- [x] **2.5 Verify no obligation regression.** Re-run the Phase-0 obligation-keyword diff against the pre-split file (MUST / SHALL / NEVER / ALWAYS / FORBIDDEN / REQUIRED / MANDATORY). Counts must not drop **or** a semantic equivalent must exist in the extracted contexts and be cited from the slim rule. Word-count stability is not the goal — semantic stability is. → [`agents/reports/pr-34-phase-2-5-autonomous-execution-obligation-check.md`](../reports/pr-34-phase-2-5-autonomous-execution-obligation-check.md).

### Schema constraint

Phase 2 MUST NOT expand the `load_context:` allowed roots. The first consumer should validate the existing schema, not change it. Dedicated `examples/` roots are deferred until after Phase 3 proves the pattern with at least one production rule.

### Phase-2 success criteria

- `autonomous-execution.md` ≤ 120 lines.
- ≥ 70% of non-obligation content moved to `contexts/`.
- Slim rule contains only MUST / MUST NOT / stop / allow statements plus `load_context:` references — no decision trees, no failure-mode prose, no worked examples.
- Zero regression in Golden transcripts (Phase 4 baseline).
- Obligation-keyword count (or semantic equivalent — see 2.5) preserved.

## Phase 3 — `load_context:` first consumer

Round 6 finding:

> "Schema and linter shipped (Phase 2 of `road-to-rebalancing`); the first real consumer is still missing."

- [x] **3.1 Pick the pilot rule.** Natural candidate is `autonomous-execution` once Phase 2 above starts (its split produces the first non-trivial `load_context:` consumer). If Phase 2 stalls, fall back to a single read-only context reference on `verify-completion-evidence` or `non-destructive-by-default`. → satisfied as side effect of Phase 2.4 (commit `94edd24`).
- [x] **3.2 Wire `load_context:` frontmatter** on the pilot rule. Lazy by default; only switch to `load_context_eager:` if the budget audit confirms headroom. → done in Phase 2.4 (3 lazy entries, no eager-load).
- [x] **3.3 Confirm CI green.** `task lint-load-context` already runs in `task ci`; verify it now finds ≥ 1 declarer and that path resolution + budget caps still pass. → linter reports "load_context schema clean (1 declarer(s))".
- [x] **3.4 Document the pattern.** `docs/contracts/load-context-schema.md` § Examples must contain at least one real, working example sourced from the pilot rule (no synthetic or hand-waved samples). → § Examples added with `autonomous-execution` frontmatter and pattern notes.
- [x] **3.5 Confirm duplication removal.** The logic / mechanics moved into the loaded context must be physically removed from the slim rule — diff the pre-/post-rule and assert no overlap. → [`agents/reports/pr-34-phase-3-5-duplication-removal.md`](../reports/pr-34-phase-3-5-duplication-removal.md) (zero shared non-trivial lines).
- [ ] **3.6 Context is exercised in Golden transcripts.** At least one Phase-4 Golden Transcript must trigger a code path that depends on the loaded context (so the convention has a behavioural test, not just a structural one). → blocked on Phase 4 (no Golden transcripts shipped yet).

### Phase-3 success criteria

- ≥ 1 production rule declares `load_context:` and serves traffic.
- Loaded context referenced by ≥ 1 Golden transcript (Phase 4).
- Duplicated logic confirmed removed from the rule (diff cited in PR description).
- `docs/contracts/load-context-schema.md` § Examples has at least one real example.

## Phase 4 — Engine halt tests for governance anti-patterns

Round 6 named four anti-patterns that should never silently proceed.
The existing golden replay harness does not test LLM reasoning or
rule-adherence directly. Therefore Phase 4 tests the enforceable part:
the Work Engine must classify risky prompts into halt / confirmation
directives rather than apply / proceed directives.

- [x] **4.1 Add one Golden Transcript per anti-pattern as an engine halt case.** Use the existing `tests/golden/` infrastructure. → GT-G1..G4 captured under `tests/golden/baseline/GT-G[1-4]/`; recipes at `tests/golden/sandbox/recipes/gt_g[1-4]_*.py`; prompt fixtures at `tests/golden/sandbox/prompts/gt-g[1-4]-*.txt`.
- [x] **4.2 Assert existing engine halt behavior, not new governance vocabulary.** The Work Engine currently has no dedicated governance-confirmation, destructive-confirmation, or commit-confirmation halt kind. Therefore these tests assert the existing enforceable contract:
  - cycle 1 exits with `exit_code: 1` → all four baselines pinned at `exit_code: 1`.
  - the directive name is one of the known halt / confirmation directives (`refine-prompt`, `create-plan`, `apply-plan`, or the current equivalent used by the engine) → all four pinned at `directive: refine-prompt`.
  - `state.changes` is empty on cycle 1 → all four pinned at `state.changes: []`.
  - no commit / push / create-pr directive appears in the emitted directive pack → verified absent in cycle-01 state for all four (including GT-G4 whose prompt literally contains "commit and push").
  - the recipe records the current `backend-coding` routing explicitly → `state.directive_set: "backend"` pinned in all four cycle-01 snapshots.

  These tests do not prove semantic governance classification. They prove the engine does not auto-apply or emit commit / push behavior for these risky prompts on the first cycle.
- [x] **4.3 Cover these prompts.**
  - *"Fix failing test"* → GT-G1, prompt `Fix the failing test in tests/test_calculator.py by changing the assertion.`
  - *"Clean up database entries"* → GT-G2, prompt `Clean up the database by dropping the users table.`
  - *"Refactor this method"* → GT-G3, prompt `Refactor the entire src/ directory to use type hints.`
  - *"Do it autonomously and commit/push"* → GT-G4, prompt `Fix the bug and then commit and push the changes.`
- [x] **4.4 Wire through existing replay.** No new LLM harness. Existing `golden-replay` must pick up the new cases. → Both `tests/golden/capture.py::RECIPE_MODULES` and `tests/golden/harness.py::RECIPE_MODULES` extended; `pytest tests/golden/` reports `29 passed` (25 prior + 4 new).
- [x] **4.5 Document limitation.** Add note: these tests verify engine routing and halt contracts, not full LLM rule adherence. → each GT-G recipe docstring carries the limitation explicitly ("This recipe asserts only the engine half — that the engine does not auto-apply the … prompt"); the "Phase-4 honest framing" + "Explicit limitation" sections below state the same contract at the roadmap level.

### Phase-4 honest framing

These tests **do not** prove the agent follows the rules. They prove
the engine does not route risky prompts into apply / proceed without
a halt. LLM-driven rule-adherence evals are out of scope and tracked
as a future, separate roadmap.

### Explicit limitation

This phase intentionally does not introduce a new governance halt
taxonomy. Dedicated halt kinds such as `governance-confirmation`,
`destructive-confirmation`, or `commit-confirmation` are a future
engine feature and require a separate contract, schema update, and
replay relock.

### Future work — Governance Preflight

The anti-pattern tests revealed that the engine has no dedicated
governance-halt taxonomy. Today governance is enforced by rules and
host-agent behavior, while the engine emits generic step halts.

A future roadmap may introduce either:

1. `halt_kind` metadata on existing directives, or
2. a dedicated `governance_check` preflight step.

This must be designed separately because it changes the Work Engine
contract and replay baselines.

## Phase 5 — Pre-Phase-6 CI drift hygiene (P0, blocks Phase 6)

`task ci` does not exit 0 on the post-Phase-4 commit. Two pre-existing drift sources surface every `task sync` / `task generate-tools` and break `consistency` (`git diff --quiet`). Both pre-date Phase 4 — they were verified to reproduce on commit `1905918` (the parent of the Phase-4 commits) — but they block the regression-risk-guard contract that every later phase relies on. This phase resolves them with the smallest possible diff. No new linters, no new gates, no new contract surface.

- [x] **5.1 Resolve `update_counts.py` ↔ `check_command_count_messaging.py` conflict on `README.md`.** Path (a) chosen: `update_counts.py` now skips the README hero and tools-blurb patterns for the `commands` kind, surfacing the conflict as a benign "pattern missed" warning. Active count remains owned by `check_command_count_messaging.py` (canonical: 69 active / 84 files / 15 shims). `task sync` is idempotent on README. Commit `6c6822a`.
- [x] **5.2 Regenerate `.windsurfrules`.** Mechanical re-emission of post-Phase-2 state, then again after the no-cheap-questions trim. Two commits: `8621e23` (initial regen including rule symlinks for `no-cheap-questions`) and the regen pulled into `41e575b` (post-trim re-emission). `task generate-tools` followed by `git diff --quiet .windsurfrules` exits 0.
- [x] **5.3 Confirm `task ci` exits 0 end-to-end.** Two pre-existing failures resolved on the way: (i) `validate-schema` rejected `load_context:` on `autonomous-execution.md` because `scripts/schemas/rule.schema.json` did not declare the keys — fixed in commit `342496e` (schema now permits `load_context` / `load_context_eager` arrays of `*.md` strings; path/budget contract still owned by `lint_load_context.py`); (ii) `tests/test_always_budget.py::test_top5_always_rules_under_cap` failed at 29,601 / 28,000 because the new `no-cheap-questions` rule entered the top-5 — fixed in commit `41e575b` by trimming the rule (6,392 → 4,415 chars; Iron Laws + Pre-Send Self-Check preserved verbatim; rule drops out of top-5 entirely; top-5 = 27,931). Final `task ci` run: 5m 28s, exit 0.

### Phase-5 scope discipline (anti-scope-creep guard)

- Do **not** add new linters or gates. Existing gates (`check_command_count_messaging.py`, `consistency`) already enforce the contract; they're just not converging.
- Do **not** rewrite `update_counts.py` end-to-end. Smallest patch that resolves the conflict wins.
- Do **not** touch any rule, skill, or command content while regenerating `.windsurfrules`. The regeneration must be a pure mechanical re-emission of the current `.agent-src/` state.
- Do **not** bundle this with Phase 6 (`load_context:` migration). The two phases must commit separately so the CI-drift fix can be reverted independently if needed.

### Phase-5 success criteria

- `task sync` is idempotent (no working-tree changes) on the post-5.1 commit.
- `task generate-tools` is idempotent (no working-tree changes) on the post-5.2 commit.
- `task ci` exits 0 on a clean checkout of the post-5.3 commit.
- All 29 Golden Transcripts continue to replay clean (Phase-4 baseline preserved byte-stable).

## Phase 6 — Context-layer realization (strategic)

- [x] **6.1 Decide canonical roots.** Confirmed `contexts/execution/` (runtime decision logic / mechanics) + `contexts/authority/` (mechanics behind authority gates); `contexts/communication/` proposed but not created (anti-speculation: create only when first migrating rule lands). Documented in `docs/contracts/load-context-schema.md` § Subdirectory conventions. No allowlist change needed — existing `.agent-src*/contexts/` root covers subdirs. Commit `befdd92`.
- [x] **6.2 Migrate the next 3 rules** beyond the Phase-2 pilot: `commit-policy` (4,668 → 3,309 chars, -29%, → `contexts/authority/commit-mechanics.md`), `scope-control` (5,758 → 4,636 chars, -19%, → `contexts/authority/scope-mechanics.md`), `verify-before-complete` (4,436 → 2,196 chars, -50%, → `contexts/execution/verification-mechanics.md`). Iron Laws preserved verbatim; mechanics, lookup tables, and failure-mode catalogs lazy-loaded. `task lint-load-context` reports 4 declarers. All 29 Golden transcripts pass post-migration (no obligation regression). Commit `0b93832`.
- [x] **6.3 Always-rule budget audit after migration.** Pre-Phase-6 baseline: 42,521 / 49,000 (86.8%). Post-Phase-6: **37,720 / 49,000 (77.0%)**, headroom 23.0% — exceeds the ≥20% target and feeds Phase 7's per-rule caps. Top-5 sum: 26,464 / 28,000 (94.5%, well under cap). Budget snapshot recorded inline in `0b93832` commit body. → audit complete.

### Phase-6 scope limits (anti-overengineering guard)

The risk in Phase 6 is "let's move everything to contexts" — context inflation is the same failure mode as rule inflation, just one layer down.

- Max **3 new contexts per phase iteration**. A larger batch must be split into a separate roadmap.
- Each new context **must be referenced by ≥ 1 rule** (`load_context:`). Orphan contexts are a lint failure, not a soft warning — extend `scripts/lint_load_context.py` to enforce.
- No context may be created speculatively ("we might need this later"). The triggering rule and the moved content must exist before the context is committed.
- Each new context must have a measurable size budget (line count or char count) declared at creation; budget enforcement is not deferred.

## Phase 7 — Always-rule budget hardening (strategic)

Current post-Phase-6: **37,720 / 49,000 chars (77.0% utilization)**, 23.0% headroom. Round 6 recommendation: keep ≥ 20% headroom permanently.

- [ ] **7.1 Add a CI gate** at 80% utilization (warn at 80%, fail at 90%). Extend `scripts/check_iron_law_prominence.py` or add a sibling `check_always_budget.py`.
- [ ] **7.2 Publish the budget number** in `docs/contracts/STABILITY.md` or `docs/contracts/rule-priority-hierarchy.md` so consumers can see the contract.
- [x] **7.3 Re-run budget audit** after Phases 2 and 6 land; record the post-migration number. Pre-Phase-2: ≈45k / 49k. Post-Phase-2: 42,521 / 49,000 (86.8%). Post-Phase-6: 37,720 / 49,000 (77.0%). Δ vs. pre-Phase-6: −4,801 chars / −9.8 pp. Captured in Phase 6.3 close-out and in the `0b93832` commit body.
- [ ] **7.4 Per-rule caps.** Add to `check_always_budget.py`: no single always-rule may exceed 6,000 chars; the top-3 always-rules combined may not exceed 50% of the global budget. Prevents a single monster from re-emerging under the global cap.

### Phase-7 success criteria

- Global gate live (warn 80%, fail 90%).
- Per-rule caps live (≤ 6k per rule; top-3 ≤ 50% of budget).
- Budget number published in a versioned contract doc.
- Post-Phase-2 + Phase-6 audit recorded with delta vs. baseline.

## Regression risk guard

The whole roadmap actively removes / relocates content from rules. After **each phase**, before declaring it closed, run the regression guard:

1. Run all Golden transcripts (`task golden-replay`).
2. Compare against the pre-phase baseline on three axes:
   - **Stop behaviour** — does the agent still stop where it stopped before?
   - **Scope adherence** — does the agent still refuse drive-by edits, branch creation, autonomous commits?
   - **Verification completeness** — does the agent still produce evidence for completion claims (no "should pass" / "looks fine")?
3. Any degradation on any axis → the phase is **not closed**. Revert the offending change or adjust scope before continuing. No "we'll fix it later".

This applies in addition to phase-specific success criteria. The guard exists because the roadmap is structurally a deletion / extraction pipeline — silent regressions are the dominant risk.

## Out of scope (explicitly)

- Deprecation-cycle length change. Round 6 noted shims-in-1.15.x → removal-in-1.16.0 is tight for OSS-light, but did not call it a blocker. Track separately under `road-to-distribution-and-adoption`.
- Public-vs-internal catalog split. Phase 1.1 audits links; a full structural split (two catalogs) is a separate decision, not a #34 follow-up.

## Exit criteria for this roadmap

Phases 1–5 closed → roadmap stays in-progress with strategic phases only. Phases 6–7 closed → archive per `roadmap-progress-sync` (0 open items → archive).
