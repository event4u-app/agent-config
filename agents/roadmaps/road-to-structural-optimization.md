---
status: locked
---

# Road to Structural Optimization

**Status:** LOCKED v3.1 (2026-05-03) — Round-4/5 council close-out folded in; three v3-introduced gaps fixed (G2 fan-out transitive, G3 tolerance band, A4 6.1 logic inverted); Phase 0 sequencing made explicit. Frozen for execution; further changes require a v4 revision and a new council session.
**Started:** 2026-05-03
**Trigger:** User request after `road-to-council-modes` cancellation: "Erstelle eine neue roadmap, die unsere bestehenden strukturen weiter optimiert, ohne dass wir qualität einbüßen." Building on the closure of five governance roadmaps (cleanup, council, council-modes 2a/2b, 1.15 follow-ups, PR #34 hardening) and the locked Phase-2 cluster contract.
**Mode:** Sequential per phase. Parallel within phase only where the file-ownership matrix (Phase 0.1) proves zero overlap. Quality-first: no obligation drops, no rule semantic regressions, no skill dispatch loss.
**Council reviews:**
- Round 1 — `agents/council-sessions/2026-05-03T06-52-20Z/` — initial design review (5 convergence findings, 3 Anthropic-only follow-ups).
- Round 2 — `agents/council-sessions/2026-05-03T07-15-02Z/` — independent re-review of v2; CONDITIONAL GREENLIGHT pending three CRITICAL fixes (file-ownership matrix, `load_context:` budget model, Phase 6→2B decoupling proof) plus three HIGH and three MODERATE fixes.
- Round 3 — `agents/council-sessions/2026-05-03T07-20-31Z/` — locked-decision round on the three open questions. Both members converged on **A/A/A** (Q1 separate skills + shared context, Q2 one rule + three contexts, Q3 safety-floor untouched).
- Round 4 — `agents/council-sessions/2026-05-03T07-40-17Z/` — v3 close-out validation. OpenAI FULL GREENLIGHT (zero residual); Anthropic CONDITIONAL with five v3-introduced gaps (G1 HIGH, G2/G3 MODERATE, G4/G5 LOW) plus seven additional structural findings (A1–A7).
- Round 5 — `agents/council-sessions/2026-05-03T07-45-30Z/` — binding tie-break on the five gaps. Consensus: G2 = REAL_GAP (both fix); G4 = NOT_A_GAP; G5 = OVER_CALIBRATED. Split on G1 (Anthropic re-classified as OVER_CALIBRATED — "well-chosen pair sufficient as canary") and G3 (host accepted Anthropic's 2% tolerance band over OpenAI's OVER_CALIBRATED). Anthropic R5 surfaced A1/A2/A4/A7 as substantial structural findings beyond the gap list; folded in as Tier-2 fixes.

## Purpose

The package shipped six major roadmaps in 2026-05. The structural surface is now stable but still carries
post-growth fat: 15 rules > 100 LOC without `load_context:`, 25 atomic commands waiting for the locked
Phase-2 cluster collapse, four `judge-*` skills + four `council-*` commands + three `chat-history-*` rules
that share patterns ripe for dispatcher consolidation. The always-rule budget sits at 74.2% with the top-3
holding 43% — headroom exists but is concentrated. This roadmap reduces surface and char load **without**
weakening the rule/skill/command contracts.

**Out of scope:**

- New skills, new rules, new commands (this is consolidation, not feature work).
- Engine work (work-engine, council scoring).
- Persona / stakeholder layer (lives in `road-to-better-skills-and-profiles`).
- README / catalog re-positioning (separate distribution roadmap).

## Inventory snapshot (2026-05-03)

| Surface | Count | Optimization vector |
|---|---:|---|
| Rules total | 57 | 15 rules > 100 LOC w/o `load_context:` (only 5/57 use it today) |
| Always-rule budget | 36,381 / 49,000 (74.2%) | Top-3 = 15,750 chars (43% of usage) — concentration risk |
| Skills total | 129 | `judge-*` ×4 · `project-analysis-*` ×8 · `skill-*` ×4 — dispatcher candidates |
| Commands total | 84 | Phase-2 clusters: 25 atomic → 10 cluster (−15 surface) |
| Deprecation shims | 4 | `feature.md`, `fix.md`, `optimize.md`, `feature-dev.md` (Phase-1 leftovers) |
| Context files | 13 | Existing `load_context:` infra ready for second wave |

## Definitions

To prevent ambiguity in the "locked" overload identified by Round 2 (response.md §4.4):

- **External-locked** — user-facing API; breaking changes require semver major bump. Example: `docs/contracts/command-clusters.md` after Phase 1 ships.
- **Internal-locked** — linter-enforced schema; changes require contract version bump + migration path. Example: cluster-pattern compliance check, ownership matrix.
- **Deferred** — planned but not yet enforced; can be modified freely. Example: Phase-2 cluster entries before Phase 1.4.

Use these terms consistently in commit messages, contract docs, and PR descriptions.

## Locked decisions (Round 3 council, 2026-05-03)

These three decisions resolve the v2 open questions. Both council members converged with HIGH confidence on Q1 and Q3, MEDIUM on Q2.

| # | Decision | Rationale | Rollback if wrong |
|---|---|---|---|
| **Q1** | Phase 3a uses **separate skills + shared context** (Option A). Each `judge-*` SKILL.md keeps its persona; shared procedure lives at `contexts/judges/judge-shared-procedure.md` and is loaded via `load_context:`. | File-level firewall preserves persona voice; adding a fifth judge later touches one file, not a dispatcher switch. | Convert to single-skill `mode:`-dispatcher post-hoc if production reveals persona bleed; re-gate with 3a.3 parity. |
| **Q2** | Phase 6 uses **one rule + three contexts** (Option A) **conditional on the 6.1 audit ≥ 30% trigger overlap** (v3.1 — A4 fix). Rule `chat-history` holds unified trigger language; `contexts/chat-history/{cadence,ownership,visibility}.md` hold concern-specific mechanics. If 6.1 returns < 30% overlap, the three rules stay separate as the evidence-supported optimum and Phase 6 closes after the audit. | Trigger-overlap audit is the diagnostic goal of Phase 6 — unified trigger surface is legible in one place; one-touch expansion when a fourth concern arrives. The < 30% branch is **not** a Q2 reversal but an empirical confirmation that the audit ran. | Split into router rule + three thin specialists if the unified rule exceeds 150 LOC; context files remain reusable. |
| **Q3** | Phase 5 **endorses keeping the four safety-floor rules untouched** (`non-destructive-by-default`, `commit-policy`, `scope-control`, `verify-before-complete`). | Marginal budget gain (~14.5k chars) is not worth the residual Iron-Law regression risk under obligation-diff. Phase 2A's ≤65% gate is achievable from the top-3 alone. | If Phase 2A fails the ≤65% gate, re-open **one** rule (`commit-policy`, smallest at 2,800 chars) under **two-gate** approval (see Phase 2A rollback). |

## Scope (locked)

| Phase | Theme | Hebel | Gate |
|---|---|---|---|
| **0** | **Pre-execution spikes & audits** | File-ownership matrix · `load_context:` budget model · 6→2B decoupling · 2A.4 worked example · 3a scoring protocol · path conventions | All CRITICAL items committed before Phase 1; all HIGH items before Phase 2A |
| 1 | Command Cluster Phase 2 | 25 atomic → 10 verb clusters | Locked contract; deprecation cycle from Phase 1 ended; cluster-pattern compliance check green |
| 2A | Rule slimming — `type: always` (budget-critical) | 3 always-rules >100 LOC | Phase 0.4 worked-example accepted; no obligation regression; budget delta ≥ −5%; safety-floor untouched (Q3) |
| 2B | Rule slimming — `type: auto` (maintenance-critical) | 13 auto-rules >100 LOC | Phase 0.3 decoupling-proof committed; per-rule custom LOC target from 2B.0 audit |
| 3 | Skill family dispatcher consolidation | `judge-*` (4), `project-analysis-*` (8), `skill-*` (4) | Q1=A locked; 3a.0 spike still validates persona-voice + mode-collision; 3a.2 staged extraction |
| 4 | Council command cluster | `council`, `council-pr`, `council-design`, `council-optimize` → `/council` cluster | 4.0 audit confirms `council.md` is dispatcher-ready |
| 5 | Budget threshold hardening (validation, not slimming) | Verify 2A gains; tighten warn/fail thresholds; concentration threshold | Always-budget ≤ 65% achieved by 2A first; safety-floor exclusion list locked in Phase 0 |
| 6 | Trigger-overlap audit | `chat-history-*` rules (3) — runs **before** 2B touches `chat-history-ownership` | Q2=A locked (one rule + three contexts); 6.0 dependency-surface scan |

## Phase 0 — Pre-execution spikes & audits

These six items resolve the three **CRITICAL** and three **HIGH** blockers identified by the Round-2 council debate. Every Phase-0 item is **internal-locked** (linter-enforced once committed). Estimated effort: 3.5 engineer-days total.

**Gating contract:**
- Phase 1 cannot start until **0.1, 0.2, 0.3** are committed (CRITICAL).
- Phase 2A cannot start until **0.4, 0.5, 0.6** are committed (HIGH).

**Phase-0 internal sequencing (A7 — fix in v3.1).** Phase-0 items are **not** independent; the prior "independent spikes" framing was incorrect (council R5 finding A7). Actual DAG:

```
0.6 (path conventions)            ─┐
                                   ├─→ 0.1 (ownership matrix) ─→ 0.2 (budget model) ─┬─→ 0.3 (decoupling proof)
                                   │                                                  ├─→ 0.5 (3a scoring protocol)
                                   │                                                  └─→ 0.4 (2A.4 worked example)
```

- **0.6 first** — paths must be locked before 0.1 can grep for context-file fan-out at the right tree.
- **0.1 before 0.2** — the ownership matrix names every context file; 0.2's budget model accounts for them.
- **0.2 before 0.3, 0.4, 0.5** — decoupling proof, worked example, and persona-voice scoring all reference the budget model.
- **0.3, 0.4, 0.5 in parallel** — independent of each other; only 0.4 is on the Phase 2A critical path.

The "Per-item independent" rollback note below is **scoped to council acceptance** of each artefact, not to execution order. If 0.6 fails, 0.1 cannot start; if 0.2 fails, 0.3/0.4/0.5 cannot start.

### 0.1 File-ownership matrix schema + generator (CRITICAL)

- [x] **0.1.1** Define schema: `[source_phase_artefact] × [dependency_type] × [target_phase_artefact] = {NONE, READ_ONLY, WRITE, BLOCKS_IF_CONCURRENT}`. Locked at `docs/contracts/file-ownership-matrix.md` (internal-locked, `stability: beta`). v1 emits `READ_ONLY` (lazy, eager, transitive, body-link) and `WRITE` (self-edge per file); `BLOCKS_IF_CONCURRENT` is reserved for the phase-manifest layer that lands with 0.1.5.
- [x] **0.1.2** Implement `scripts/generate_ownership_matrix.py`. Greps for `load_context:` references across rules, `skill:` frontmatter in rules, command invocations in skills, context-file inclusions. Accounts for **context-file fan-out transitively up to depth 2** (G2 — fix in v3.1); depth-3 chains fail the build with exit code 2 (matches the 0.2.4 nesting cap). **Scope notes (deviation):** (a) `skill:` frontmatter is reserved — no rules currently declare it, the field is scanned but emits zero edges in v1; (b) command invocations in skills are not extracted as edges yet — only markdown links to known `.md` files inside scanned roots count as `body_link` READ_ONLY edges (bare backtick names are too ambiguous to attribute). Both gaps documented in the contract under § Scope notes (v1) and re-opened when 2A starts citing skills via `skill:` frontmatter.
- [x] **0.1.3** Output: `docs/contracts/file-ownership-matrix.json` (machine, internal-locked) + `agents/contexts/structural/file-ownership-matrix.md` (human-readable, regenerated from JSON). Both produced by `task generate-ownership-matrix`; 291 files, 668 edges in the v1 baseline.
- [x] **0.1.4** Lock-in: matrix generated **before** Phase 1 starts; re-validated after each phase commit via `task check-ownership-matrix` (wired into `task ci`). Phase 2B and Phase 3 sequencing is gated on `BLOCKS_IF_CONCURRENT` cells being empty.
- [ ] **0.1.5 Phase-2A re-generation gate (A1 — fix in v3.1).** Every Phase-2A commit that adds, moves, or modifies a context file (i.e. every `2A.2` extraction or `2A.3` slim) re-runs `generate_ownership_matrix.py` as a pre-commit hook AND in CI. CI half is **already green** via `task check-ownership-matrix`; the **pre-commit hook** half lands with the first 2A commit (deferred per Phase-0 sequencing — no contexts move until 2A starts). Diff vs. previous green run: new `READ_ONLY` cells are accepted automatically; any new `BLOCKS_IF_CONCURRENT` cell fails the build and requires a roadmap revision.

### 0.2 `load_context:` budget accounting model (CRITICAL)

- [ ] **0.2.1** Pick model and document at `docs/contracts/load-context-budget-model.md` (internal-locked). Decision space: (a) rule chars only, (b) rule + context chars, (c) rule + (context chars / N rules loading it). **Default recommendation:** (b) — simplest invariant for the linter; rule + every context it loads counts against the always-budget when the rule is `type: always`. Council confirms or selects alternative before Phase 2A starts.
- [ ] **0.2.2** Update `scripts/check_always_budget.py` to apply the locked model.
- [ ] **0.2.3** Retroactive test: re-calculate PR #34's `autonomous-execution` split under the new model. Must still pass the 49,000-char cap. **Tolerance band (G3 — fix in v3.1):** overshoot ≤ 2% of cap (≤ 980 chars) → council refines the model parameters (e.g., shared-context divisor); overshoot > 2% → model (b) is rejected, escalate to council for an alternative. The 2% band reflects empirical noise in `load_context:` accounting (whitespace, frontmatter, footer references) and prevents a 0.4% delta from triggering a roadmap-wide pause.
- [ ] **0.2.4** Constrain nesting to **max 2 levels**. Rule loads context A; context A may load context B; context B loading context C aborts the build. Add to `scripts/check_always_budget.py` as a separate check.

### 0.3 Phase 6 → 2B decoupling proof (CRITICAL)

- [ ] **0.3.1** Grep all 13 Phase-2B target rules for references to `chat-history-{cadence,ownership,visibility}` (rule names in `load_context:`, command names in body, frontmatter keywords).
- [ ] **0.3.2** Document findings at `agents/roadmaps/phase6-2b-coupling.md`. Cases:
  - **0 hits** → decouple confirmed; Phase 6 ↔ Phase 2B can run in either order.
  - **>0 hits** → Phase 6 must ship a backward-compatible call-signature contract (`docs/contracts/chat-history-router.md`) **before** Phase 2B touches the coupled rule. Alternative: Phase 2B excludes the coupled rule and waits until Phase 6 commits.
- [ ] **0.3.3** Linter check: `scripts/check_phase_coupling.py` re-runs the grep on every Phase-2B PR; new coupling fails the build.

### 0.4 2A.4 worked example (HIGH)

- [ ] **0.4.1** Pick one Phase-2A rule for the dry-run. Recommend `direct-answers` (smallest of the top-3, cleanest mechanics/logic split).
- [ ] **0.4.2** Apply 2A.4 obligation-keyword diff. Produce the per-rule table (keyword × count_before × count_after_rule × count_in_context × total_after × accept(Y/N) × rationale) plus any human-rationale entries.
- [ ] **0.4.3** Land at `agents/roadmaps/structural-optimization-2A4-example.md`. Council reviews. **Pass:** 2A.4 contract is locked, Phase 2A unblocked. **Fail:** revise contract; re-run example before any rule slimming.

### 0.5 Phase 3a spike scoring protocol + persona-voice rubric (HIGH)

- [ ] **0.5.1** Define 3-scorer protocol: author + 2 reviewers; average score must be ≥ 3.5/5; any individual score < 3.0 escalates to council.
- [ ] **0.5.2** Write rubric at `agents/contexts/judges/persona-voice-rubric.md`. Cover: tone, vocabulary, prompt-shape preservation, refusal patterns, evidence-citation style.
- [ ] **0.5.3** Lock 5-day decision deadline from spike start. If deadline passes without consensus, council decides; **default = A** (separate skills + shared context, per locked Q1=A).
- [ ] **0.5.4** Spike scope confirmed against Q1-locked decision: Option A is the leading hypothesis; the spike still tests Option B for empirical falsification (and for **mode-collision risk** — see 3a.0.1).

### 0.6 Context-file path conventions (HIGH)

- [x] **0.6.1** Lock the path tree:
  - Phase 2A contexts → `contexts/communication/rules-always/<rule-name>-mechanics.md`
  - Phase 2B contexts → `contexts/communication/rules-auto/<rule-name>-mechanics.md`
  - Phase 3a shared → `contexts/judges/judge-shared-procedure.md` + `contexts/judges/persona-voice-rubric.md` + `contexts/judges/no-consolidate-rationale.md` (if 3a aborts)
  - Phase 3b shared → `contexts/analysis/project-analysis-core-procedure.md`
  - Phase 3c shared → `contexts/skills/skill-quality-rules.md`
  - Phase 6 contexts → `contexts/chat-history/{cadence,ownership,visibility}.md`
  - Locked at `docs/contracts/context-paths.md` (internal-locked, `stability: beta`); also covers six grandfathered root files plus existing `execution/` and `authority/` sub-trees.
- [x] **0.6.2** Implement `scripts/check_context_paths.py`: collisions and out-of-tree placements fail CI. Wired via `task check-context-paths` and added to `task ci`.
- [x] **0.6.3** Orphan check: ensure each new context file is referenced from at least one rule, skill, command, or other context. **Deviation:** the roadmap named `scripts/docs-sync.py`, but no such script exists in the repo (cross-reference checking lives in `scripts/check_references.py`, which is scoped to *broken* refs). The orphan check is folded into `scripts/check_context_paths.py` instead, which keeps every context-file invariant in one linter. Functionally equivalent to the roadmap intent; recorded in `docs/contracts/context-paths.md` § "Why `check_context_paths.py` carries the orphan check".

### Success criteria

- All six Phase-0 items committed; six new contracts/scripts in place.
- File-ownership matrix shows `BLOCKS_IF_CONCURRENT` cells only for the explicitly sequenced phases (1→2A, 6→2B if coupled, 2A→3 for shared contexts).
- 2A.4 worked example accepted by council.
- All linters green.

### Abort / rollback

- **Per-item (council acceptance):** Each Phase-0 artefact is independently council-reviewed. If 0.4 (worked example) fails review, only 2A.4 needs revision; 0.1/0.2/0.3 artefacts still ship. (Note: this is acceptance-independence, not execution-independence — see Phase-0 internal sequencing DAG above.)
- **Scoped kill-switch (A2 — fix in v3.1):** If 0.2.3 retroactive test fails > 2% overshoot (above the G3 tolerance band), the `load_context:` budget model is questioned → council emergency review pauses **only the budget-critical phases**: Phase 2A (depends on the budget model directly) and Phase 5 (verifies 2A's ≤ 65% gain). **Phases 1, 4, and 6 continue** — they don't move the always-budget. Phase 2B is paused too (uses the same model for maintenance accounting) but its blocking effect on Phase 6 (per 0.3) is lifted while paused. Prior v3 framing ("entire roadmap pauses") was over-broad; council R5 finding A2.

## Phase 1 — Command Cluster Phase 2 (the deferred 12)

Locked in `docs/contracts/command-clusters.md` since 1.15.0. Deprecation cycle elapsed; Phase 2 can ship.

- [ ] **1.1 Audit each cluster's atomic surface.** For each of the 12 clusters (`chat-history`, `agents`, `memory`, `roadmap`, `module`, `tests`, `context`, `override`, `copilot-agents`, `commit`, `judge`, `create-pr`), list current atomic commands and target sub-command names.
- [ ] **1.2 Generate cluster commands.** One file per cluster under `.agent-src.uncompressed/commands/<cluster>.md`, using `commands/fix.md`, `commands/optimize.md`, `commands/feature.md` as templates (copy structure: frontmatter `cluster: true`, dispatch table, mode arg parsing, fall-through to default sub-command).
- [ ] **1.3 Convert atomics to deprecation shims.** Same shim contract as Phase 1: stub file, `superseded_by:` frontmatter, identical behavior for one release cycle.
- [ ] **1.4 Update cluster contract.** Move Phase-2 entries from "deferred" to "locked" (internal-locked, per Definitions). Update `docs/contracts/command-clusters.md`. Linter starts blocking new atomic commands matching these prefixes.
- [ ] **1.4.1 Cluster-pattern compliance check.** `scripts/check_cluster_patterns.py` compares each new Phase-2 cluster's dispatch table structure against Phase-1 reference (`commands/fix.md`, `commands/optimize.md`). Fails CI if new dispatch patterns are invented. Runs before 1.4 contract flip.
- [ ] **1.5 Update slash-command-routing-policy rule.** Cluster names live in a context table (`contexts/communication/command-routing-clusters.md`), loaded via `load_context:`. The rule itself stays at current LOC and references the table — no growth, no in-rule list. (Resolves the "reflect new clusters" + "do not grow rule" tension by externalizing the data.)

### Success criteria

- 25 atomic commands → 10 cluster commands + 25 shims (net −15 active surface).
- `task ci` green incl. atomic-command linter and cluster-pattern compliance check.
- All Phase-1 cluster patterns reused (no new dispatching invention) — enforced by 1.4.1.
- `slash-command-routing-policy.md` LOC unchanged; new context file holds the cluster table.

### Abort / rollback

- **Per-cluster:** If a shim breaks dispatch (different output vs. old atomic) → revert that one cluster + its 2–3 shims; other clusters keep shipping. Do **not** roll back the whole phase.
- **Phase-wide kill:** If >2 clusters fail the shim parity check → pause Phase 1, council-review the dispatch-template (likely a flaw in the Phase-1 reference templates that propagates).
- **Pre-1.4 gate:** Do not flip the contract from "deferred" to "locked" until **all 10 clusters** pass parity. Once locked, the linter starts blocking new atomics — that's the point of no return.

## Phase 2 — Rule slimming via `load_context:`

Today only 5/57 rules use `load_context:`. The pattern proved itself in PR #34 (autonomous-execution split).
Apply to the next wave: 18 rules > 100 LOC. **Council-driven split: 2A drives the budget, 2B drives maintenance.**

**Empirical fact (verified 2026-05-03):** Of all 18 rules > 100 LOC, only **3** are `type: always` and contribute to the always-rule budget. The other 15 are `type: auto` and load on-demand — slimming them reduces maintenance cost but does **not** move the budget needle. Phase 2A and 2B reflect this asymmetry.

### 2A — `type: always` rules (budget-critical)

These three rules **are** the Phase-5 top-3. Slimming them is what makes Phase 5's threshold tightening possible.

| Rule | LOC | chars | Notes |
|---|---:|---:|---|
| `language-and-tone` | 124 | 5,832 | #1 budget consumer; failure modes already in guidelines; mirror-language Iron Law stays in rule |
| `ask-when-uncertain` | 110 | 5,196 | Vague-request triggers table is data → context candidate |
| `direct-answers` | 114 | 4,722 | Three Iron Laws + emoji whitelist; whitelist tables → context candidate |

**Pre-conditions:** Phase 0.1, 0.2, 0.3 (CRITICAL) committed; Phase 0.4 worked example accepted by council; Phase 0.6 path conventions in place.

- [ ] **2A.0 Safety-floor exclusion linter.** Per Q3=A (locked decision), the four safety-floor rules (`non-destructive-by-default`, `commit-policy`, `scope-control`, `verify-before-complete`) are out of scope for slimming. Add `scripts/check_safety_floor_untouched.py`: any diff that modifies these four rule files in a Phase-2A commit fails CI. Lifted only via the two-gate rollback (see Abort).
- [ ] **2A.1 Inventory each rule.** Annotate sections as RULE / LOGIC / MECHANICS / EXAMPLE (Phase-1 method).
- [ ] **2A.2 Extract MECHANICS + EXAMPLES** to `contexts/communication/rules-always/<rule-name>-mechanics.md` (path locked in 0.6).
- [ ] **2A.3 Slim each rule** to RULE+LOGIC only. Target: each rule ≤ 4,000 chars (top-3 sum ≤ 12,000 chars).
- [ ] **2A.4 Obligation-keyword diff** per the contract locked by Phase 0.4. See contract below.
- [ ] **2A.5 Always-budget gate.** After each commit: `scripts/check_always_budget.py` must show delta ≤ 0 chars vs. previous green run, applying the Phase-0.2 budget model (rule chars + every context the rule loads). JSONL log delta-tracked. Nesting depth check (max 2) enforced separately.

**2A.4 Obligation-diff contract** (resolves council finding #4; worked example produced in Phase 0.4):
- Format: per-rule table — `keyword | count_before_rule | count_after_rule | count_in_context | total_after | accept(Y/N) | rationale`.
- Total-after = count_after_rule + count_in_context. If total_after < count_before_rule → flagged for human review (council).
- Acceptance = (a) total_after ≥ count_before_rule, OR (b) total_after < count_before_rule AND human-rationale documents the obligation is preserved by structure (e.g., "MUST verify X before Y" → "Follow procedure P" where P enforces ordering).
- Worked example artefact: `agents/roadmaps/structural-optimization-2A4-example.md` (Phase 0.4 output). Council acceptance of that artefact is the gate; **no rule slimming begins until Phase 0.4 is green**.

### 2B — `type: auto` rules (maintenance-critical, runs after Phase 6)

13 rules. **Excludes** `chat-history-ownership`, `chat-history-cadence`, and `chat-history-visibility` — those are Phase 6's territory. Phase 6 runs **before** 2B if Phase 0.3 detects coupling; otherwise 2B and 6 are independent (see Sequencing rationale).

**Pre-conditions:** Phase 0.3 decoupling-proof committed; Phase 0.6 path conventions in place.

Priority list:

| # | Rule | LOC | type |
|---|---|---:|:-:|
| 1 | `roadmap-progress-sync` | 192 | auto |
| 2 | `user-interaction` | 181 | auto |
| 3 | `augment-source-of-truth` | 140 | auto |
| 4 | `command-suggestion-policy` | 134 | auto |
| 5 | `artifact-engagement-recording` | 133 | auto |
| 6 | `review-routing-awareness` | 125 | auto |
| 7 | `autonomous-execution` | 122 | auto |
| 8 | `docs-sync` | 119 | auto |
| 9 | `cli-output-handling` | 117 | auto |
| 10 | `augment-portability` | 116 | auto |
| 11 | `ui-audit-gate` | 106 | auto |
| 12 | `skill-quality` | 105 | auto |
| 13 | `package-ci-checks` | 104 | auto |
| —  | `chat-history-ownership` | 123 | auto → handed to Phase 6 |
| —  | `chat-history-cadence` | 109 | auto → handed to Phase 6 |

- [ ] **2B.0 LOC reduction feasibility audit.** For each of the 13 rules, manually annotate what % is MECHANICS vs. LOGIC (same method as 2A.1). If any rule is >70% LOGIC, flag it as "30% infeasible" and set a custom target (e.g., 15%). Document exceptions at `agents/roadmaps/phase2b-custom-targets.md`. Prevents gaming the 30% bar by forcing artificial slimming on logic-heavy rules.
- [ ] **2B.1–2B.4** — same procedure as 2A.1–2A.4 but applied to the 13 auto-rules. Per-rule LOC target = 30% OR the custom target from 2B.0, whichever was set.

### Success criteria

- **2A:** 3 rules slimmed; top-3 sum ≤ 12,000 chars; always-budget ≤ 65% of cap; zero obligation regressions per 2A.4 contract; safety-floor untouched (Q3=A).
- **2B:** 13 rules slimmed; per-rule LOC −30% (or custom target from 2B.0) hit; zero obligation regressions; budget unaffected (auto-rules don't move it).

### Abort / rollback

- **Per-rule (2A):** If 2A.5 budget gate fails (delta > 0) → revert that rule's commit; that rule stays at original size. Phase continues with remaining rules.
- **Per-rule (2B):** If 2B.4 obligation diff cannot be human-rationalized → revert; mark rule as "irreducible" in `agents/contexts/structural/irreducible-rules.md`.
- **Budget kill-switch (Phase 2A only):** If after slimming the first always-rule the budget delta is positive (rule grew net of context-load overhead) → **stop Phase 2A**, council-review the `load_context:` overhead model. Do not proceed to rules 2 and 3 until the model is corrected. (Resolves council finding #8.)
- **Phase-wide kill:** If >3 rules in 2B fail obligation-diff → pause 2B, council-review the slimming-template (likely a structural flaw repeating across rules).

## Phase 3 — Skill family dispatcher consolidation

Three skill families with shared dispatch patterns. Goal: keep all personas/use cases, reduce SKILL.md duplication.

### 3a — `judge-*` (4 skills)

`judge-bug-hunter`, `judge-code-quality`, `judge-security-auditor`, `judge-test-coverage`.

**Shape locked (Q1=A):** Separate skills + shared procedure context. Mode-dispatch (B) rejected by both council members on persona-isolation, mode-collision, and future-extensibility grounds. The 3a.0 spike still runs — its job is now to **validate** A empirically and produce a kill-criterion if voice preservation under shared-context extraction falls below threshold.

**Pre-conditions:** Phase 0.1 file-ownership matrix proves no `judge-*` skill is touched by a Phase-2B rule; Phase 0.6 path conventions in place.

- [ ] **3a.0 Validation spike on `judge-test-coverage`** (smallest persona surface). Build the locked shape A: keep `judge-test-coverage` as a standalone skill, extract shared procedure to `contexts/judges/judge-shared-procedure.md`. No B-shape prototype — Q1 is locked.
- [ ] **3a.0.1 Benchmark the slimmed A-shape** against three judge prompts (real diffs from past PRs). Criteria:
  - Persona-voice preservation (manual diff vs. current `judge-test-coverage` output, 5-point scale, threshold ≥ 4.0/5).
  - LOC saved (target ≥ 30% per skill once rolled out).
  - Dispatch latency delta vs. baseline (must be ≤ +50ms; the shared-context load adds an extra file read).
  - **Mode-collision proxy:** load shared procedure + `judge-test-coverage` persona, then prompt with a security-only diff; verify the output does not adopt `judge-security-auditor` framing. Anthropic's R2 finding: even file-isolated personas can leak via shared-context priming.
- [ ] **3a.0.2 Spike report** at `agents/roadmaps/structural-optimization-3a-spike.md`. Includes: empirical scores, voice/latency/collision verdicts, **kill criterion**: if voice < 4.0/5 OR mode-collision detected on the proxy test → abort 3a, mark `judge-*` as "do not consolidate", document at `contexts/judges/no-consolidate-rationale.md`.
- [ ] **3a.1 Audit overlap** for the remaining 3 judge skills (only after 3a.0.2 passes the kill-criterion gate).
- [ ] **3a.2 Roll out the A-shape** across all 4 judges. Each gets its own skill file; shared procedure stays in one context file.
- [ ] **3a.3 Verify dispatch parity** — run all 4 judges on the same diff before/after; output diff must be ≤ 10% lexical drift (cosine similarity of tokens) and 100% verdict parity.

### 3b — `project-analysis-*` (8 skills)

`core`, `hypothesis-driven`, `laravel`, `nextjs`, `node-express`, `react`, `symfony`, `zend-laminas`.

**Shape:** Same A-pattern as 3a — separate skills + shared procedure context. Q1=A applies family-wide; no per-family relitigation.

- [ ] **3b.1 Audit overlap.** Most lines = stack-specific; core procedure is shared.
- [ ] **3b.2 Extract shared procedure** to `contexts/analysis/project-analysis-core-procedure.md` (staged: extract to context first, slim skills only after the context file passes a council voice-check on one sample stack).
- [ ] **3b.3 Slim per-stack skills** to stack-specific deltas (boot flow, framework idioms, failure patterns).

### 3c — `skill-*` (4 skills)

`skill-improvement-pipeline`, `skill-management`, `skill-reviewer`, `skill-writing`.

**Shape:** Same A-pattern. Q1=A applies family-wide.

- [ ] **3c.1 Audit overlap.** Skill lifecycle: write → review → improve → manage. Likely shared vocabulary.
- [ ] **3c.2 Extract shared "skill killers" + frontmatter rules** to `contexts/skills/skill-quality-rules.md` (staged extraction; same gate as 3b.2).
- [ ] **3c.3 Slim each skill** to its phase-specific procedure.

### Success criteria

- 16 skills → still 16 (no skill deletion) with **per-skill LOC reduction ≥ 30%** (not average — every skill must hit the bar individually, prevents averaging-effect failure mode). Custom targets allowed for logic-heavy skills (same pattern as 2B.0).
- All personas / modes preserved; user-facing dispatch unchanged.
- New shared contexts under `contexts/judges/`, `contexts/analysis/`, `contexts/skills/`.
- Phase-3a spike report exists, A-shape passes voice + collision gates before 3a.2.

### Abort / rollback

- **3a-specific:** Spike report scores A < 4.0/5 on persona voice OR detects mode-collision → mark `judge-*` as "do not consolidate", skip 3a.1+, document in `contexts/judges/no-consolidate-rationale.md`. 3b and 3c continue independently.
- **3b/3c-specific:** If extracted shared context grows >50% of original combined LOC → consolidation isn't paying off; revert that sub-phase, keep skills separate.
- **Per-skill:** If post-slim skill fails persona-parity check (manual review by host on 2 sample prompts) → revert that one skill; the other 3 in the family keep shipping.
- **File-ownership note:** Phase 3 must **not** start before Phase 2B finishes if Phase 0.1's file-ownership matrix shows any 3a/3b/3c skill is also referenced from a 2B-targeted rule. The matrix is the gate, not a recommendation.

## Phase 4 — Council command cluster

`council`, `council-pr`, `council-design`, `council-optimize` are four atomic commands that share transport,
neutrality preamble, and cost gate. Natural cluster: `/council` with `mode:` sub-arg.

- [ ] **4.1 Design `/council` cluster shape.** `mode:` arg = `default | pr | design | optimize`. Each mode keeps its current preamble + scoring contract.
- [ ] **4.2 Implement cluster command.** One `commands/council.md` (already exists) becomes the dispatcher; sub-modes loaded from contexts.
- [ ] **4.3 Add three deprecation shims.** `council-pr.md`, `council-design.md`, `council-optimize.md` → shims pointing to `/council mode:<x>`.
- [ ] **4.3.1 Dispatch latency benchmark.** Measure mode-dispatch overhead vs. atomic invocation on `/council mode:pr` and `/council mode:design`. Threshold: ≤ +100ms wall-clock at the dispatch layer (not counting AI provider time). Fails CI if exceeded; rollback to atomic shape if the cluster pattern itself is the bottleneck.
- [ ] **4.4 Update cluster contract** (`docs/contracts/command-clusters.md`) — add `council` to the locked list (internal-locked).

### Success criteria

- 4 council commands → 1 cluster + 3 shims (net −3 active surface).
- All four invocation patterns produce identical output to today.
- Dispatch latency overhead ≤ +100ms (4.3.1 gate).
- Contract docs updated.

## Phase 5 — Always-rule budget hardening

Top-3 today: `language-and-tone` (5,832), `ask-when-uncertain` (5,196), `direct-answers` (4,722) = 15,750 chars (43% of used budget).

**Q3=A locked:** Safety-floor rules (`non-destructive-by-default`, `commit-policy`, `scope-control`, `verify-before-complete`) are out of scope for slimming. Phase 2A's 2A.0 linter enforces this; Phase 5 inherits the same exclusion. Both council members converged High-confidence: marginal budget gain (~14.5k chars) is not worth nonzero Iron Law regression risk.

- [ ] **5.1 Slim the top-3 non-safety-floor rules** (Phase 2A targets) via the locked method. Target: top-3 sum ≤ 12,000 chars (≤ 25% of 49k cap).
- [ ] **5.2 Tighten budget thresholds.** Once headroom ≥ 30%, raise warn from 80% to 75%, fail from 90% to 85%. Locks the gain in CI.
- [ ] **5.2.1 Add concentration threshold.** Beyond total-budget cap, fail CI when **any single rule exceeds 12% of used budget** OR **top-3 sum exceeds 30% of used budget**. Prevents the post-slim state from re-concentrating into a new top-3 over time.
- [ ] **5.3 Add per-rule trend report.** Extend `scripts/check_always_budget.py` to print delta vs. previous successful run (read from a JSONL log).

### Success criteria

- Always-rule budget ≤ 65% of cap.
- Top-3 ≤ 30% of used budget; no single rule > 12% (5.2.1 gate).
- Budget linter thresholds tightened in CI.
- Safety-floor rules unchanged in size and obligation surface.

### Abort / rollback

- **If Phase 2A cannot hit ≤ 65% without touching safety-floor rules** → re-open exactly **one** safety-floor rule (`commit-policy`, smallest at 2,800 chars) under a **two-gate** rollback:
  1. Council pre-approval of the obligation-diff table for that one rule.
  2. Sandboxed dry-run on 10 historical destructive-operation tasks (Hard-Floor triggers, bulk-deletion confirmations, prod-merge prompts) verifying zero behavior regression.

  Both gates required. Do **not** batch-slim the other three. Anthropic R2 finding: a single gate (council approval alone) is insufficient for safety-floor regressions.

## Phase 6 — Trigger-overlap audit (`chat-history-*`)

Three rules + three commands all touch the same surface. Q2=A locked: **one unified rule + three context files**, not router-plus-specialists. Both council members converged on the unified shape: Phase 6's stated goal (auditing trigger overlap) requires triggers to be legible in one place; router+specialists scatters trigger logic across four files and forces two-file reads.

**Pre-conditions:** Phase 0.3 decoupling-proof committed (determines whether 6 must run before 2B or independently); Phase 0.6 path conventions in place.

- [ ] **6.0 Dependency surface scan.** Before 6.1, run `scripts/scan_chat_history_consumers.py`: enumerate every rule/skill/command that references `chat-history-cadence`, `chat-history-ownership`, or `chat-history-visibility` by name (load_context, explicit cite, trigger reference). Output to `agents/roadmaps/phase6-dependency-scan.md`. Any consumer that names a rule by file path → flagged as a 6.3 migration target. Catches the "ghost reference" risk (R1 finding from Round 2).
- [ ] **6.1 Compare triggers (logic inverted in v3.1 — A4 fix).** Build the overlap matrix at `agents/roadmaps/phase6-trigger-matrix.md`: pairwise trigger-set overlap across `chat-history-cadence`, `chat-history-ownership`, `chat-history-visibility` (Jaccard overlap of trigger keyword sets). Threshold-driven branch:
  - **Pairwise overlap ≥ 30% on ≥ 2 of the 3 pairs → proceed to 6.2** (unified shape per Q2=A). The shared-trigger surface justifies a single rule; scattering it across three files forces multi-file reads.
  - **Pairwise overlap < 30% on ≥ 2 of the 3 pairs → STOP at 6.1.** This is **success, not escalation** — the three concerns are genuinely orthogonal and the current three-rule shape is already optimal. Document the non-overlap evidence at `agents/roadmaps/phase6-non-overlap-evidence.md` (explicit table: which triggers, which concern, why orthogonal). Mark Phase 6 as **closed without restructure**; the dependency scan from 6.0 still ships (it was useful regardless), but 6.2/6.3/6.4 are skipped.
  - **Mixed (one pair ≥ 30%, two pairs < 30%) → escalate to council.** Possible router shape (the one pair merges; the orthogonal one stays separate). Council decides; default = stop without restructure.

  Prior v3 framing treated zero overlap as "halt + escalate, may favor three rules" — implying the orthogonal outcome was a failure mode. R5 finding A4: the orthogonal outcome is the **correct outcome** when the data supports it, not a Q2 violation. Q2=A is conditional on the audit; this is the audit.
- [ ] **6.2 Build the unified shape (only if 6.1 takes the ≥ 30% branch).** One `chat-history.md` rule, three contexts under `contexts/chat-history/<concern>.md` (cadence, ownership, visibility). Triggers stay inline in the rule body so the audit goal stays satisfied. The mechanics-per-concern live in the contexts.
- [ ] **6.3 Migrate consumers.** Update every reference flagged in 6.0 to point at the new unified rule (or the appropriate context where direct citation was the pattern). Verify with `check_references` linter.
- [ ] **6.4 Implement and verify.** No behavior change; same triggers fire today, just from one rule + three contexts. Trigger-coverage parity test: replay 10 historical chat-history events through the agent on the new shape; verdict must be unchanged.

### Success criteria

Two outcome paths, both green per A4 (v3.1):

- **Path A — restructure (6.1 ≥ 30% branch):** 3 rules → 1 rule + 3 contexts. All consumers migrated (6.0 scan → 6.3 migration → check_references green). Trigger coverage unchanged (6.4 parity test green). Unified rule LOC ≤ 150 (if exceeded → 6.2 abort, escalate to council per Anthropic R2 fallback). Always-budget unaffected (these are `auto`, not `always`, but reduce maintenance surface).
- **Path B — keep separate (6.1 < 30% branch):** 6.0 dependency scan + 6.1 overlap matrix + non-overlap evidence document committed. Phase 6 closed; no rule changes. The audit ran, the answer was "already optimal" — that is a valid Phase-6 success.

## Risk register

| # | Risk | Source | Mitigation |
|---:|---|---|---|
| 1 | Rule slimming drops obligations | Original | Per-rule keyword diff (2A.4); worked-example gate (Phase 0.4); council-review every Phase-2 batch |
| 2 | Cluster shim cycle breaks user muscle memory | Original | Same one-release deprecation cycle as Phase 1; cluster-pattern compliance check (1.4.1) |
| 3 | Skill dispatcher loses persona voice | Original | A-shape locked (Q1); 3a.0 spike with voice ≥ 4.0/5 gate; per-skill parity check |
| 4 | Phase 5 hits a Hard-Floor rule | Original | Q3=A locks safety-floor exclusion; 2A.0 linter enforces; two-gate rollback if budget unreachable |
| 5 | Council cost on review batches | Original | Each phase has one council pass max; `mode:optimize` keeps it ranked + evidence-cited |
| 6 | File-ownership ambiguity (multiple rules claim same trigger surface) | R2 CRITICAL | Phase 0.1 file-ownership matrix; pre-phase gate for 2A/2B/3 |
| 7 | `load_context:` budget accounting undefined | R2 CRITICAL | Phase 0.2 budget model (rule chars + every loaded context, depth ≤ 2); 2A.5 gate uses the model |
| 8 | Phase 6 → 2B coupling unproven | R2 CRITICAL | Phase 0.3 decoupling proof; sequencing decision derives from the proof, not assumption |
| 9 | Recursive context nesting blowup | R2 HIGH | Hard depth limit of 2 enforced by `check_always_budget.py`; CI fails on any context that loads another context that loads a third |
| 10 | Mode-collision via shared-context priming (3a) | R2 HIGH | 3a.0.1 explicit collision proxy test on `judge-test-coverage`; failure → kill 3a per 3a.0.2 |
| 11 | Persona-voice drift on staged extraction (3b/3c) | R2 MODERATE | Staged extraction with council voice-check on one sample stack before family rollout |
| 12 | Concentration regrows post-slim | R2 MODERATE | 5.2.1 concentration threshold (≤ 12% per rule, ≤ 30% top-3 sum); CI gate, not human review |
| 13 | Ghost references in `chat-history-*` migration | R2 MODERATE | Phase 6.0 dependency surface scan; check_references linter on 6.3 migration |
| 14 | Path-convention drift between contexts | R2 MODERATE | Phase 0.6 path conventions; linter rejects context files outside the locked tree |
| 15 | Two-gate rollback insufficient if council pre-approval lacks domain expertise | R2 R3 finding | Sandbox dry-run on 10 historical destructive-operation tasks is the second gate, not optional |
| 16 | Internal vs. external lock confusion | R2 HIGH | Definitions section locks the three states (Internal, External, Deferred); contract files cite which they are |
| 17 | 3a.0.1 collision-proxy may underestimate the risk surface (only one judge-pair tested) | R5 G1 (re-classified as OVER_CALIBRATED — well-chosen pair sufficient as canary) | 3a.0.2 kill-criterion is binary; if the canary pair detects collision, all four judges abort. Adding more pairs costs effort without changing the abort threshold. Accept residual risk: rare collision modes specific to a non-tested pair will surface in 3a.3 dispatch parity. |
| 18 | 0.4 worked example uses an atypical rule and the 2A.4 contract overfits | R5 G5 (LOW) | 0.4.1 selects `direct-answers` (smallest top-3, cleanest mechanics/logic split) — known atypicality. 2A.4 contract review by council on the worked example explicitly checks for keyword classes that don't generalize; flagged classes get a second worked example before 2A.3 ships. |
| 19 | 2A.4 obligation-diff acceptance ties when total_after ≈ count_before | R5 A3 | Tiebreaker: when total_after equals count_before AND human-rationale is contested (split council), default to **reject** the slim — keep the rule at original size, mark as "irreducible at current method" in `agents/contexts/structural/irreducible-rules.md`. Bias toward obligation preservation, not budget. |
| 20 | Phase 3 claims independence from Phase 2 but shares the budget model + path conventions + ownership matrix | R5 A5 | Independence claim narrowed in v3.1: Phase 3 is independent of Phase 2's **rule slimming outcome**, not of Phase 0's contracts. Phase 3 still requires 0.1, 0.2, 0.6 committed (already in pre-conditions). 0.1.5 hook re-validates ownership matrix on every Phase-3 commit. |
| 21 | 1.4.1 cluster-pattern compliance check has no documented failure path | R5 A6 | If 1.4.1 fails on > 2 clusters, the Phase-1 reference templates (`commands/fix.md`, `commands/optimize.md`) are themselves the flaw — handed to the existing Phase-1 phase-wide kill gate. Single-cluster failure → revert that one cluster, ship the other 9; the failed cluster goes to a separate council-reviewed re-design micro-roadmap, not a v3.2 of this one. |
| 22 | Three v3-introduced gaps surfaced post-lock; v3.1 may itself introduce gaps | R4/R5 self-referential | Round 6 council pass scheduled before Phase 0 execution starts: target = "Are v3.1 fixes self-consistent and do they introduce new gaps?" Same scope as R4 (close-out validation), bounded to v3 → v3.1 delta. Cost ~$0.15. If R6 surfaces > 2 new gaps → roadmap freezes for explicit re-scope conversation, not auto-patched to v3.2. |

## Sequencing rationale

**Phase 0 first, internally sequenced** (A7 fix in v3.1). Pre-execution spikes/audits unblock the rest. Internal DAG: 0.6 → 0.1 → 0.2 → {0.3, 0.4, 0.5} (see Phase-0 internal sequencing block). Without the file-ownership matrix (0.1), budget model (0.2), decoupling proof (0.3), and worked example (0.4), Phases 1-6 carry hidden assumptions the council flagged as CRITICAL.

**Phase 1 next.** Command cluster collapse is a closed contract; lowest risk, highest visible surface reduction. Independent of Phases 2/3/5/6; gated only on 0.1 ownership matrix being green.

**Phase 2A then Phase 5.** Rule slimming feeds Phase 5 directly — the top-3 always-rules are Phase 2A's targets. 5.1 is essentially the verification step of 2A. Every 2A commit re-runs 0.1 matrix per 0.1.5 (A1 fix).

**Phase 6 ordering depends on Phase 0.3 AND Phase 6.1 outcome** (A4 fix in v3.1). If 0.3 detects coupling, Phase 6 runs before 2B touches the coupled rule. If 6.1 takes the < 30% branch, Phase 6 closes after 6.1 with no rule changes — 2B then runs unconditionally on its full 13-rule list (the `chat-history-*` rules stay in Phase 6's territory but don't migrate).

**Phase 2B after Phase 6 (conditional) or in parallel.** 13 auto-rules; budget-neutral, maintenance-only.

**Phase 3 is independent of Phase 2's outcome but not of Phase 0** (A5 fix in v3.1). Can run any time after Phase 0.1 (matrix), 0.2 (budget model), 0.6 (paths) commit. Phase 0.1 is the gate, not Phase 2 completion. 0.1.5 hook re-validates the matrix on every Phase-3 commit.

**Phase 4 is small, opportunistic.** Run any time after Phase 1's cluster pattern is locked.

**Phase 5 closes the budget loop.** Locks the gain via tightened thresholds + concentration cap.

## Locked decisions reference

The three open questions previously listed here have been resolved by Round 3 council:

- **Q1 → A** (Phase 3): Separate skills + shared procedure context.
- **Q2 → A** (Phase 6): One unified rule + three context files.
- **Q3 → A** (Phase 5): Safety-floor rules (`non-destructive-by-default`, `commit-policy`, `scope-control`, `verify-before-complete`) untouched.

Rationales, rollback gates, and the cross-question coupling analysis live in `agents/council-sessions/2026-05-03T07-20-31Z/response.md`. Re-opening any of the three requires a new council session and a roadmap revision (v4).

---

**Total scope:** 7 phases. Phase 0 = 6 work-streams / ~22 sub-tasks (CRITICAL + HIGH gates; +1 from v3 for 0.1.5 ownership-matrix re-gen hook per A1 fix). Phases 1-6 = ~44 sub-tasks. Estimated PR cluster: one PR per phase (7 PRs), or one combined branch with phase-tagged commits (1 PR, larger review). Decide at execution start, after Phase 0 closes. Estimated effort: Phase 0 ≈ 3.5–4.0 engineer-days (+0.5d for 0.1.5 hook + transitive resolution + tolerance band); Phases 1-6 unchanged from v2 estimates.
