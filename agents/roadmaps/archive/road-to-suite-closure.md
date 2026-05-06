---
complexity: lightweight
---

# Road to Suite Closure

> Sibling roadmap to `road-to-better-skills-and-profiles.md` (Wing 1),
> `road-to-unified-senior-roles.md` (Foundation + Wing 2),
> `road-to-gtm-and-growth.md` (Wing 3), and
> `road-to-money-strategy-ops.md` (Wing 4). Where those four lift
> engineering, product, GTM, and money cognition to senior level,
> this roadmap closes the loop **across** them: shared identity
> (`AGENTS.md`), shared authoring standard (Bundle α patterns),
> shared handoff contract, shared lint floor, shared orchestration
> primitives. Goal: the four wings stop being four parallel tracks
> and start being one suite.

**Source:** `agents/council-sessions/suite-closure-iter1/responses.json`
+ `responses-cont.json` (joint Anthropic + GPT-4o, $0.10 total).
13 OQs across five buckets (identity, patterns, tools, glue,
sequencing) plus two cross-cutting checks. Verdicts are locked
**outside** this roadmap — see § Council verdicts at the bottom.

## Status

`ready-for-execution` — council-iter1 landed
(`agents/council-sessions/suite-closure-iter1/responses.json`,
`...-cont.json`, $0.1010 total). Sibling-roadmap dependencies
declared per § Block sequencing.

Block sequencing: **Phase 1 starts immediately and is the gate for
Wing 3 + Wing 4 plate-1.** SO1 verdict locks the timing —
clean-shape-first beats parallel-and-rewrite-later. Phases 2–6 are
sequenced by dependency, not capacity.

## Scope shift vs the sibling roadmaps

The four wing roadmaps each commit to a slice of senior cognition
(engineering, product, GTM, money). They do **not** commit to:

| Lane | In (this roadmap) | Out |
|---|---|---|
| **Suite identity** | `AGENTS.md` rewrite, "## The four wings" section, depth-first positioning, Wing-1 out-of-scope reconciliation | Public marketing copy, README rewrite, blog post |
| **Authoring standard** | Bundle α (Context-First, Related-Skills WHEN/NOT, Proactive-Triggers, Output-Artifacts, text-tag confidence) into skill-quality contract + skill template + lint floor | Retrofit of ~150 existing W1 skills |
| **Cross-wing glue** | Master `cross-wing-handoff.md` contract, `lint_handoffs.py` validator, retrofit W2/W3/W4 plate-1 chain references | Per-wing chain prose (already scoped in K3/G3/J3) |
| **Cognition tooling** | Bundle β cognition ported as **runnable examples** inside senior-tier skills (`examples/dcf_model.md`, `okr_tree_query.md`, `rice_scoring.md`, `unit_econ_walkthrough.md`, `funnel_analysis_walkthrough.md`) | Standalone Python CLI; J2/G2 cognition-only floor stays absolute (no carve-out) |
| **Lint hardening** | Structural malicious-pattern check in `skill_linter.py` (5 regexes — credential exfil, arbitrary execution, force-push, world-readable secrets path) | Prompt-injection / PII semantic analysis (deferred to v2 / external tools) |
| **Orchestration primitives** | `do-in-worktrees` as 6th mode in `subagent-orchestration` skill | Worktree-creation runtime (`finishing-a-development-branch` already covers it) |

The line we hold: **suite-closure ships the contract surface that
makes the four wings interoperate, not the per-wing content.** Each
wing keeps its own roadmap, its own plate, its own personas. This
roadmap is the seam.

## Decisions (synthesized from council-iter1)

Block sequencing locked by dependency. ICE table later in this file
sanity-checks the chain, not re-orders it.

| # | Decision | Why |
|---:|---|---|
| 1 | Identity = "depth + cross-department cognition under shared Iron-Law floor" — **no** "alternative to claude-skills" framing | IO1 verdict — competitive positioning ages poorly; intrinsic value (depth + Iron Laws) is the durable anchor |
| 2 | `AGENTS.md` § "What this repo is" gets a full rewrite, not a bolt-on; new "## The four wings" section with 2-sentence per-wing descriptor; "## Tech stack" gets a 1-sentence cognition-only addendum for W2-4 | IO2 verdict — bolt-on buries the lede that W2-4 operate under a different boundary than W1 |
| 3 | Wing-1 out-of-scope reconciliation lands **with** suite closure, not before — single coherent change | IO3 verdict — pre-closure update creates 6+ weeks of contradiction surface; bundling makes the deletion legible |
| 4 | Bundle α adoption: 4 of 5 patterns (Context-First, Related-Skills WHEN/NOT, Proactive-Triggers, Output-Artifacts) into `skill-quality.md` as required structure | PO1 verdict — already implied by current contract; formalizing structure costs nothing |
| 5 | Confidence mechanic = text-tag `[CONFIDENCE: high\|medium\|low]`, **not** emoji 🟢/🟡/🔴 | PO3 verdict — emoji collides with `direct-answers.md` blacklist; text-tag preserves the signal without rule edit |
| 6 | Bundle α adoption applies to **new senior-tier additions** (W2-4 greenfield + new W1 senior upgrades) — **no** retrofit of ~150 existing W1 skills | PO2 verdict — rewrite tax with no user-facing benefit; lint enforces forward, doesn't punish backward |
| 7 | Bundle β (DCF, OKR, RICE, funnel-analysis, unit-econ) ports as **runnable examples** inside senior-tier skills, not standalone CLI | TO1 verdict — carve-out clause contradicts the cognition-only differentiator; J2/G2 stay absolute |
| 8 | Bundle γ (skill-security-auditor) ships as `skill_linter.py` extension with 5-regex structural malice check; semantic prompt-injection / PII analysis **deferred** | TO2 verdict — separate top-level skill implies skill-on-skill execution which the cognition-only frame does not support |
| 9 | `do-in-worktrees` lands as 6th orchestration mode in `subagent-orchestration` skill — not a separate upgrade | TO3 verdict — handoff chains require worktree isolation; defining mode is suite-level state-machine, executor lives elsewhere |
| 10 | Master `docs/contracts/cross-wing-handoff.md` + `scripts/lint_handoffs.py` instead of three independent per-wing handoff prose blocks | GO1 verdict — handoff = contract primitive (typed input/output + worktree boundary), not wing-specific pattern; per-wing files drift independently |
| 11 | Composite personas (`solo-founder`, etc.) **deferred** to v2 | GO2 verdict (split, conservative path) — map § "Cognition role vs org title" already covers the use case via on-demand load; pre-bake risks scope creep |
| 12 | `composes:` frontmatter field **rejected** for v1 — prose Related-Skills block stays the source, `lint_handoffs.py` covers structural validation | GO3 verdict (split, conservative path) — structured field drifts faster than prose if not maintained |
| 13 | Closure roadmap ships **before** Wing 3 + Wing 4 plate-1 starts — accepts ~1.5-week block on those wings | SO1 verdict — clean shape beats rewrite risk; identity contradiction lives 0 weeks publicly instead of 6+ |

## Out of scope (locked)

- **Composite personas** — deferred to v2 pending real-consumer demand signal (GO2).
- **`composes:` frontmatter field** — rejected for v1; prose block + lint script suffice (GO3).
- **Standalone Bundle β CLI** — cognition ports as runnable examples only; no `scripts/dcf.py` / `scripts/okr.py` (TO1).
- **Semantic prompt-injection / PII linter** — deferred until external consumers; v1 is structural malice only (TO2).
- **Retrofit of ~150 existing W1 skills with Bundle α patterns** — forward-only enforcement (PO2).
- **README rewrite + public marketing copy** — `AGENTS.md` is the suite identity surface; README stays scoped to install/use.
- **Worktree-creation runtime** — `do-in-worktrees` defines the mode (when to use, what handoff shape), `finishing-a-development-branch` covers the executor; no new runtime skill.

## Phase 1 — Identity closure (1 week, gate for W3 + W4 plate-1)

Locks IO1 / IO2 / IO3. Removes the only contradiction between Wing 1
and Wings 2–4 today: Wing-1 declares C-level / marketing / compliance
out-of-scope while three other wings ship those exact lanes.

- [x] **Phase 1** — Identity closure shipped (phase marker; flips when 1.1–1.5 are all done). **Gates W3 plate-1 Block G start AND W4 plate-1 Block J start** (per SO1).
- [x] **1.1** — `AGENTS.md` § "What this repo is" full rewrite: new opening paragraph anchored on IO1 verdict ("governed skill suite for engineering depth + senior cross-department cognition under shared Iron-Law floor; depth over breadth, decisions over boilerplate"). Drops the implicit engineering-only framing in the current 6-paragraph block. **No** mention of competitive positioning or "alternative to claude-skills".
- [x] **1.2** — `AGENTS.md` new "## The four wings" section between "What this repo is" and "Source of truth": four 2-sentence descriptors (Wing 1 Engineering, Wing 2 Product + Foundation, Wing 3 GTM + Growth, Wing 4 Money + Strategy + Ops), each with link to its sibling roadmap and a one-line cognition-cluster anchor. Order: 1, 2, 3, 4 (matches roadmap numbering, not alphabetical).
- [x] **1.3** — `AGENTS.md` § "Tech stack" addendum: single sentence at the end clarifying that W2-4 enforce a cognition-only floor (no SaaS-auth, no vendor SDKs, no stage-prescription) per `road-to-gtm-and-growth.md` G2 and `road-to-money-strategy-ops.md` J2 linters. Matches IO2 verdict — preserves engineering-anchor framing while surfacing W2-4 boundary as architecture, not afterthought.
- [x] **1.4** — `road-to-better-skills-and-profiles.md` § Decisions table: replace "No C-level / marketing / compliance" row with "Wing 1 scope = engineering craft + tooling; cross-department cognition lives in W2-4 (own roadmaps, own personas, own plates)." Wing-1 Philosophy prose: drop the two echoes; replace with one-line pointer to `senior-personas-and-skills-map.md`. **Single coherent change** per IO3 — landed atomically with 1.1–1.3, not before.
- [x] **1.5** — `agents/contexts/senior-personas-and-skills-map.md` § "Why this map exists": confirm wording aligns with IO1 ("cross-department cognition under shared Iron-Law floor"). No structural change to map v3; minor copy alignment only. Verify "Wing 5" prose deleted (already absorbed into Wing 4 per joint-iter2 Q2). Update v3 → v3.1 with delta line.

## Phase 2 — Skill authoring standard (3–5 days, gate for W2-4 Block A)

Locks PO1 / PO2 / PO3. Adopts 4 of 5 Bundle-α patterns into the
`skill-quality.md` contract, plus the text-tag confidence mechanic,
without touching ~150 existing W1 skills.

- [x] **Phase 2** — Authoring standard shipped (phase marker; flips when 2.1–2.6 are all done). **Gates W2 Block A1 (`product-manager` persona), W3 Block I1 (`cmo` persona), W4 Block T1 (`finance-partner` persona) start** — those are the first new senior-tier shipments under the updated standard.
- [x] **2.1** — `.agent-src.uncompressed/rules/skill-quality.md` § Senior-Tier Required Structure: four named subsections — (a) **Context-First** (description must lead with one-sentence cognition-cluster anchor + one-sentence trigger), (b) **Related Skills** (`## Related Skills` block with `WHEN to use this` / `WHEN NOT to use this` two-list pattern), (c) **Proactive Triggers** (`## When the agent should load this` block listing 3–5 user-prompt patterns), (d) **Output Artifacts** (`## Output` block declaring artifact name + shape). Detail spec + good/bad pattern pairs in `contexts/communication/rules-auto/skill-quality-mechanics.md` § Senior-tier patterns. **Forward-only** — applies to `tier: senior` skills, not retrofits. *Path-corrected: roadmap originally cited `docs/contracts/skill-quality.md` (does not exist); canonical contract lives in `.agent-src.uncompressed/rules/skill-quality.md`.*
- [x] **2.2** — `.agent-src.uncompressed/rules/skill-quality.md` § Confidence Tagging: text-tag `[CONFIDENCE: high|medium|low]` placement locked (end of procedure step, optional but recommended for multi-step chains). Cites `direct-answers.md` § Emoji scope to document the deliberate avoidance of 🟢/🟡/🔴 (functional-marker collision).
- [x] **2.3** — `.agent-src.uncompressed/templates/skill.md` template update: HTML-commented stub blocks for Related Skills WHEN/NOT, Proactive Triggers, Output Artifacts. Stub block is delete-by-default — mid-tier / untiered skills MUST remove it; senior-tier skills uncomment + fill. Quality Checklist line updated to reflect the tier-conditional rule.
- [x] **2.4** — `scripts/skill_linter.py` extension: `lint_senior_tier_blocks()` validates `tier: senior` skills carry the three section blocks (`## Related Skills` with WHEN + WHEN NOT, `## When the agent should load this`, `## Output`). Mid-tier and untiered skills skip the check (forward-only). Schema (`scripts/schemas/skill.schema.json`) extended with `tier: senior` enum. Linter run against full tree: 0 fail / 285 total — no Wing-1 regression.
- [x] **2.5** — `tests/test_skill_linter.py` extension: 6 new test cases — 1 passing senior skill, 4 failing variants (one per missing block: related-skills, when-not list, proactive triggers, output artifacts), 1 non-senior skill that skips the checks. All 64 linter tests pass; full suite: 2341 passed.
- [x] **2.6** — Sibling-roadmap K2 (`road-to-unified-senior-roles.md` — marked `[x]`, K2 row in cross-roadmap table updated), G2 (`road-to-gtm-and-growth.md`), J2 (`road-to-money-strategy-ops.md`) lint extensions now **cite** 2.4 as the shared floor, not duplicate it. K2/G2/J2 keep their wing-specific tests (cognition-only floor, channel-agnosticism, stage-agnosticism, agent-operability); they stack on top of 2.4. All three roadmaps' `docs/contracts/skill-quality.md` references corrected to `.agent-src.uncompressed/rules/skill-quality.md`.

## Phase 3 — Cross-wing handoff contract (1 week, gate for W2/W3/W4 plate-1 chain steps)

Locks GO1 + part of TO3. Replaces three independent per-wing handoff
prose blocks with one master contract, plus a structural validator.

- [x] **Phase 3** — Cross-wing handoff contract shipped (phase marker; flips when 3.1–3.5 are all done). **Gates W2 K3 (cross-role glue), W3 G3 (gtm-handoff guidelines), W4 J3 (wing4-handoff guidelines)** — those three retrofit against this contract instead of writing their own.
- [x] **3.1** — `docs/contracts/cross-wing-handoff.md` lands with five sections per GO1 verdict: § 1 Purpose ("typed composition across wings; prevents cognition-cluster collision"), § 2 Anatomy (initiator-skill → delegated-skill(input-shape) → output-artifact), § 3 Worktree boundary (each handoff = optional new worktree per `subagent-orchestration` 6th mode landing in Phase 6), § 4 Lint rules (no circular deps; input-shape must be declared in delegated skill's `## Input` section), § 5 Reference chains drawn from sibling roadmaps (W3 H1→H2→H3 launch chain, W4 O2→H10 forecasting chain, W4 P1→Q1 build-buy → org-design chain).
- [x] **3.2** — `scripts/lint_handoffs.py` lands: parses senior-tier skills' `## Related Skills` block, splits `**WHEN to use this**` (composition / delegation edges → cycle graph) from `**WHEN NOT to use this**` (alternative pointers → never cycle edges, but still validated for dangling/tier-mismatch). Fails on (a) cycles in WHEN-to-use graph, (b) any link to non-existent skill, (c) any link from senior to non-senior (tier mismatch). Run via `task lint-handoffs`. Output mirrors `lint_skills` shape (file:line:reason). *Sub-block split refined during Phase 6 closure to honor the bidirectional sibling pointer pattern from Phase 4.6 (`DCF ↔ unit-economics`).*
- [x] **3.3** — `tests/test_lint_handoffs.py`: 6 fixtures — 2 valid chains (W3 launch, W4 forecasting), 1 cycle, 1 dangling reference, 1 tier-mismatch, 1 valid cross-wing chain. Exit code 0 / 1 per case. **Shipped with 9 fixtures** — added: 1 non-senior skip (forward-only floor), 1 mode-6 worktree chain (Phase 6.4), 1 WHEN-NOT mutual-pointer non-cycle (Phase 4.6 / 6 closure). All 9 pass.
- [x] **3.4** — `road-to-unified-senior-roles.md` K3 step: replace inline "Cross-role glue documented in `docs/guidelines/cross-role-handoff.md`" prose with two sentences pointing at `docs/contracts/cross-wing-handoff.md` for the contract + a wing-specific guidelines file for prose examples. Same retrofit pattern for `road-to-gtm-and-growth.md` G3 and `road-to-money-strategy-ops.md` J3 — they cite contract, ship guidelines.
- [x] **3.5** — `Taskfile.yml` extension: `task lint-handoffs` target wired into `task ci` (after `lint-skills` + `lint-rule-tiers`, before `test`). CI fails if either lint fails. No grace period — Phase 3 is the floor for plate-1 work.

## Phase 4 — Cognition examples port (1 week, follows Phase 2)

Locks TO1. Ports the five Bundle-β cognition tools (DCF, OKR, RICE,
funnel-analysis, unit-econ) as **runnable examples inside senior-tier
skills**, not standalone CLI. Preserves J2 / G2 cognition-only floor
without carve-out.

- [x] **Phase 4** — Cognition examples shipped (phase marker; flips when 4.1–4.6 are all done). Depends on Phase 2 (template + lint floor) — examples land under the new Output-Artifacts block shape.
- [x] **4.1** — `dcf-modeling` skill (Wing 4, tier `senior`): full DCF walkthrough as embedded example in `## Output` block — assumptions table (revenue growth, terminal-value method, WACC components), 5-year projection, sensitivity grid (±200 bps WACC × ±5 pts terminal growth). Cognition only — no `numpy`/`pandas` import; tabular markdown the agent can render in any host. Lives under W4 Block N or T (whichever owns valuation; cross-link to map v3.1).
- [x] **4.2** — `okr-tree-modeling` skill (Wing 2/4 boundary, tier `senior`): example showing one company-level Objective decomposed into 3 KRs, each KR decomposed into 2–3 team-level KRs, each leaf KR carrying a measurable trailing/leading metric + check-in cadence. Source skill placement: Wing 4 if it ladders to OKR-as-strategy; Wing 2 if it ladders to OKR-as-PM-tool. Decision deferred to skill-author at shipment; map v3.1 records the placement.
- [x] **4.3** — `rice-prioritization` skill (Wing 2, tier `senior`): example showing 5 candidate features scored on Reach × Impact × Confidence ÷ Effort with explicit numeric ranges + scoring rubric. Includes an anti-pattern section: how RICE breaks for compliance-driven work, platform debt, and bet-style features. Cognition only — no scoring CLI.
- [x] **4.4** — `funnel-analysis` skill (Wing 3, tier `senior`): example showing a 5-stage SaaS funnel (visit → signup → activation → paid → retained) with absolute conversion + drop-off rates, plus a worked diagnosis (cohort split, time-decayed attribution caveat, common-mistake list). Channel-agnostic per G2 floor — no Mixpanel/Amplitude/Segment names in cognition body.
- [x] **4.5** — `unit-economics-modeling` skill (Wing 4, tier `senior`): example showing CAC + LTV + payback period + contribution margin for one canonical SaaS, one canonical marketplace, one canonical transactional case. Includes the classic traps (blended-CAC hides channel divergence; LTV with retention < 12 mo is fiction; gross-margin gymnastics hides COGS). Cognition only — no spreadsheet template, the markdown table is the artifact.
- [x] **4.6** — All five skills carry the senior-tier required structure (Context-First lead, `## Related Skills` WHEN / WHEN NOT cross-pointing at the sibling cognition cluster, `## When the agent should load this`, `## Output`). `task lint-skills` green: 146 pass / 0 fail / 290 total. `senior-personas-and-skills-map.md` v3.1 updated to record `dcf-modeling`, `okr-tree-modeling`, `rice-prioritization` placements + reconcile `unit-economics` placeholder → `unit-economics-modeling`.

## Phase 5 — Lint hardening: structural malice check (3 days, parallel to Phase 4)

Locks TO2. Adds a 5-regex structural malice pass to `skill_linter.py`.
Lives in the existing linter, not a separate `skill-security-auditor`
skill (avoids the skill-on-skill-execution issue TO2 flagged).

- [x] **Phase 5** — Structural malice check shipped (phase marker; flips when 5.1–5.5 are all done). Independent of Phase 4 — runs in parallel; only depends on Phase 2 lint scaffolding being in place.
- [x] **5.1** — `scripts/skill_linter.py` extension: new `check_structural_malice(text)` function with 5 regex patterns — (a) credential exfil (`curl|wget` interpolating `${TOKEN}/${KEY}/${SECRET}/...` or `~/.aws/`/`~/.ssh/` paths), (b) arbitrary execution (`eval`/`exec` over network-fetched payload; `bash|sh|zsh <(curl|wget …)`), (c) force-push to protected ref (`git push --force[-with-lease] main|master|prod|production|release`), (d) world-readable secrets path (`chmod 0?[4567]\d{2} .*\.(pem|key|env)`), (e) unbounded subprocess shell injection (`subprocess.*shell=True.*\$\{`). Patterns documented inline. Hooked into `lint_file` for `skill`/`rule`/`command` artifacts; `guideline`/`persona` skipped.
- [x] **5.2** — Linter exit code **3** (distinct from 2 build-fail / 1 strict-warn) when any malice match. `format_text` emits the spec shape `<path>:<line>:malice:<pattern>:<matched>` ahead of the per-result badge block, plus a `, N malice` suffix on the summary line.
- [x] **5.3** — `tests/test_skill_linter_malice.py` — 15 cases: 5 true positives (one per regex), 5 true negatives (legit `rm -f tmp.txt`, `curl https://docs.example.com/...`, `--force-with-lease feature/...`, `chmod 755 scripts/install.sh`, `subprocess.run(['git','status'])`), 1 integration test asserting exit code 3 via `compute_exit_code`, 4 parametrized one-per-pattern smoke tests. All 15 pass.
- [x] **5.4** — `task lint-skills` already invokes the linter; the malice check runs inline via `lint_file`. No separate target. Pattern catalogue is documented inline in the `_MALICE_*` regex comments + the docstring on `check_structural_malice`; the deferred-semantic-check note (PII / prompt-injection → v2) lives in the same comment block.
- [x] **5.5** — `tool-safety` cross-link: `.agent-src.uncompressed/rules/skill-quality.md` § Structural Malice Floor names the 5 patterns, links to `tool-safety.md` for the prose floor, and points at `tests/test_skill_linter_malice.py` for the contract. Additive — no rewrite of `tool-safety.md`.

## Phase 6 — Orchestration mode closure (3 days, follows Phase 3)

Locks TO3. Adds `do-in-worktrees` as 6th mode in the
`subagent-orchestration` skill. State-machine layer only — execution
runtime stays in `finishing-a-development-branch` per TO3 split.

- [x] **Phase 6** — `do-in-worktrees` mode shipped (phase marker; flips when 6.1–6.4 are all done). Depends on Phase 3 (handoff contract defines the worktree boundary clause § 3 that this mode operationalizes).
- [x] **6.1** — `.agent-src.uncompressed/skills/subagent-orchestration/SKILL.md` extension: new `### 6. do-in-worktrees` section under "## The six modes". Three-line definition (when to use, what handoff shape, output artifact), one example chain (W3 launch `positioning` → `messaging-architecture` → `gtm-launch` split across 3 worktrees), one anti-pattern callout (don't use for fast iteration; cost > benefit when each step < 30 min). Format mirrors existing 5 modes. Description frontmatter updated to "six modes". Heading "## The five modes" → "## The six modes".
- [x] **6.2** — `using-git-worktrees` skill cross-link: added one-line WHEN-block entry pointing at `subagent-orchestration` mode 6 as the primary trigger. **No** rewrite of `using-git-worktrees` itself — that skill stays the executor; mode 6 is the trigger surface.
- [x] **6.3** — `docs/contracts/cross-wing-handoff.md` § 3 (Worktree boundary): replaced placeholder "lands in suite-closure Phase 6" with concrete pointer at `subagent-orchestration` mode 6 + executor pointers at `using-git-worktrees` / `finishing-a-development-branch`. Boundary is advisory by default; mode 6 promotes it to mandatory for the chain. Closes the forward-reference loop opened in 3.1.
- [x] **6.4** — `tests/test_lint_handoffs.py` (Phase 3.3): extended with `test_mode_6_worktree_chain_accepted` fixture exercising mode-6 cross-wing chain (W4 `build-buy-partner` → `org-design` via worktree handoff). Validates that the lint script accepts worktree-bounded handoffs as legal compositions — boundary is an orchestration-layer concern, not a graph-shape concern. **8/8 tests pass.**

## ICE sanity check (sequencing validation)

Sequencing locked above by dependency. ICE table sanity-checks the
chain — does **not** re-order it.

| Phase | Impact | Confidence | Effort | Notes |
|---|---|---|---|---|
| 1 Identity | high | high | 1 wk | Single contradiction surface; smallest unit, biggest unblock |
| 2 Authoring | high | high | 3–5 d | Locks shape for all senior-tier work after this point |
| 3 Handoff | high | medium | 1 wk | New contract; first usage in W3/W4 plate-1 will surface gaps |
| 4 Cognition examples | medium | high | 1 wk | Each skill is independent; can ship incrementally |
| 5 Malice lint | medium | medium | 3 d | Regex coverage is best-effort; semantic gap is acknowledged |
| 6 Orchestration | low | high | 3 d | State-machine close-out; no runtime risk |

Sequencing reads correctly: high-impact / high-confidence first
(Phase 1, 2), contract that high-confidence work depends on third
(Phase 3), then medium-impact filler in dependency order (4 ‖ 5,
then 6).

## Exit criteria

The roadmap closes when **all** of the following hold:

- All six phase markers flip to `[x]`.
- `task ci` green on a tree containing the four sibling-roadmap retrofits (1.4, 2.6, 3.4) plus the new contract files (3.1, 6.3) plus the linter extensions (2.4, 3.2, 5.1).
- `agents/contexts/senior-personas-and-skills-map.md` v3.1 published with the IO1 wording alignment + Wing-5 prose deletion.
- Wing 3 plate-1 Block G and Wing 4 plate-1 Block J have started — proves the gate at Phase 1 actually unblocked downstream work.
- One end-to-end cross-wing chain shipped (proposed: W3 H1→H2→H3 launch chain) using mode 6 + handoff contract — proves the seam works in practice, not just in lint.

## Council verdicts (locked, reference only)

The 13 OQs + 2 cross-cutting checks were resolved in
`agents/council-sessions/suite-closure-iter1/responses.json` and
`agents/council-sessions/suite-closure-iter1/responses-cont.json`
(joint Anthropic + GPT-4o, $0.1010 total). Decisions table above
synthesizes the verdicts; raw responses live in those files for
audit trail. **Do not re-debate** the locked decisions inside this
roadmap — re-debate happens in a new council round with its own
session directory.
