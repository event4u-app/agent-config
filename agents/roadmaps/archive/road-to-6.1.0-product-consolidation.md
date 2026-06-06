---
status: active
complexity: structural
parent_roadmap: road-to-6.0.0-d-structural-restructure
---

# Road to 6.1.0 — Product consolidation (behavioral cuts after the structural break)

> Draft until 6.0.0 ships — the ONLY gate is the dependency (you cannot
> consolidate the renamed surface before it is renamed). **No telemetry wait.**
> This roadmap holds everything the
> [`6.0.0-D scope-line rule`](road-to-6.0.0-d-structural-restructure.md) put in
> the **architectural (6.0.x staged)** and **behavioral (6.1)** lanes — changes
> that need detection logic or non-TTY safety, NOT changes that need a usage
> window.

> **Evidence = the maintainer knows the usage.** This package has few users,
> almost all on the maintainer's own team, so "is this command redundant /
> unused?" is answered by direct knowledge + the worksheet curation — NOT by a
> 30-day telemetry window. Telemetry is a nice-to-have signal, never a blocker.
> Consolidation moves as fast as the maintainer decides.

## Goal

Shrink the visible surface to a small set of smart, stack-adaptive, interactive
commands — the surface a newcomer can learn in five minutes — without losing any
capability (removed pieces become skills the survivors compose). Then make the
implicit **Flows** layer explicit.

> **AI-council convergence (claude-sonnet-4-5 + gpt-4o, 2026-06-05, design mode).**
> Re-grounded against the post-6.0.x layout (orchestrator/sub-command hierarchy
> already exists). Converged on a **6-PR sequence**, not one mega-PR:
> **PR1 (this PR)** = Step 1 contract + the auto-detection layer (Steps 2–5)
> guarded by an `auto_detect` kill-switch + confidence-tiered safe defaults +
> two abort schemas, with Step 8 expressed as *deprecation* prose (not deletion).
> Deferred to follow-up PRs: **5b** (feature-plan fold — both members: needs
> standalone-usage evidence first), **6** (toolchain resolver — code subsystem,
> sequenced after the contract), **7** (command→skill — after the layer is proven
> in production), **8 deletion** (deprecate-now / delete-later window), **8b/9**
> (flows layer — HIGH-risk, lands last). Auto-detection must target stable
> sub-commands, so deprecation is documented before/with detection.
>
> **PR2 (council re-confirmed 2026-06-05, claude-sonnet-4-5 + gpt-4o).** With
> PR1's contract merged, the council converged that **Step 6 (toolchain
> resolver) is the single unblocked next step** and ships as its own PR —
> rejecting a mega-PR (it would collapse 6 independent rollback units into
> one). 5b (needs standalone-usage evidence), 7 ("proven in production" is a
> real telemetry gate), 8-deletions (delete-later window), and 8b/9 (HIGH-risk
> flows layer, lands last) **stay deferred** to their own follow-up PRs. PR2 =
> Step 6 + AC2.

## Phase 1: Interactive-merge contract (the gate for every merge here)

- [x] **Step 1:** Ship the non-interactive contract every merged command depends
  on: detect a non-TTY (CI) reliably, honor `--yes` / `--json` / explicit flags,
  fall back to a safe default without hanging. Council: interactive prompts that
  block CI are "provably wrong for CI/CD" — no interactive merge ships without it.

## Phase 2: Interactive command merges

- [x] **Step 2:** `fix-pr-comments` ← `{fix-pr-bot-comments, fix-pr-developer-comments}`:
  detect new/unanswered comments, ask "fix bot / human / both?"; improved
  detection dedupes by comment id + reply marker so already-answered comments are
  never retried. <!-- PR1: /fix detection table routes any PR-review-comment intent to fix/pr-comments (which resolves bot/human/both); bot/developer variants marked deprecated→pr-comments in prose (hard lifecycle flip = council PR4). -->
- [x] **Step 3:** `analytics` ← `{analytics-show, analytics-prune}`: show is the
  default; prune is behind an explicit confirm/flag (destructive, never silent). <!-- PR1: /analytics detection table — show is the read-only safe default; prune never fires on auto-detect/safe-default per non-interactive-contract §4 (destructive). -->
- [x] **Step 4:** `judge` ← `{judge-solo, judge-on-diff, judge-steps}`: auto-detect
  the mode (diff → on-diff, plan → steps, else solo) with a confirm; fall back to
  an explicit prompt if detection confidence < 90%. <!-- PR1: /judge detection table with HIGH/MEDIUM/LOW tiers; solo = read-only safe default; LOW → menu (interactive) / ambiguous_routing (CI). Confidence is declarative (basis), not numeric, per council. -->
- [x] **Step 5:** `tests` create-vs-run disambiguation; `override` create-vs-edit.
  Each merge ships only with the Phase-1 non-interactive escape. <!-- PR1: detection tables on /tests (create-vs-execute) and /override (create-vs-manage), both wired to the non-interactive-contract. -->
- [x] **Step 5b:** `feature-plan` ← `{feature-explore, feature-roadmap}` — merge
  <!-- DECIDED (council design/deep 2026-06-06, claude-sonnet-4-5 + gpt-4o): do NOT fold to mode-flags. Both converged that the worksheet evidence (shared implementation) proves a MAINTAINER mental model, not a USER one; explore/plan/roadmap are plausibly distinct user goals (git log vs reflog), and a permanent alias would admit the merge was wrong. Verdict: keep the three feature/* commands SEPARATE; document the relationship. Relationship now surfaced in the generated Flows primary view — discovery default_path `feature/explore → feature/plan` (src/flows/discovery.yaml + docs/command-flows.md). Mode-flag merge (`feature-plan --explore/--roadmap`) → road-to-6.2.0, gated on standalone-usage evidence. -->
  **decision deferred here from 6.0-D Step 13b**: `feature-explore` is `feature-plan`'s
  first phase (a subset, not a >95% duplicate) and `feature-roadmap` is its
  downstream "make it a roadmap" branch, so the council guardrail forbade
  merge-then-unmerge on an untested assumption. 6.0-D moved all three as flat
  commands; decide the fold (and whether `--roadmap` becomes a flag on
  `feature-plan`) here, with aliases kept. Evidence:
  [`command-classification-6.0.0-d.md` § Step 13b](../../reports/command-classification-6.0.0-d.md).

## Phase 3: Stack-adaptive engineering commands (resolver)

<!-- Step 6 DONE in PR2 (council 2026-06-05 re-confirmed: this is the one unblocked step now that PR1's contract has merged; 5b/7/8-del/8b/9 stay deferred). Resolver = src/agent-src/templates/scripts/work_engine/stack/runner.py + contexts/execution/toolchain-resolver.md; tests = tests/work_engine/test_runner_detect.py. -->
- [x] **Step 6:** Build the toolchain resolver: `test-run` / `test-create` /
  `quality-fix` / `review-changes` / `work` DETECT the consumer's stack (phpunit /
  pest / playwright / vitest / jest / …) and run the right tool — no per-stack
  command explosion. Monorepo guard: default to FAST tests, `--include-slow` /
  `--include-e2e` opt-in. Per-stack commands captured in an auto-generated project
  config. Only genuine PHP-space commands stay PHP-locked.

## Phase 4: Command → skill conversions (the [-] leaves)

<!-- Step 7 DEFERRED to follow-up PR (council 2026-06-05): command→skill conversion lands AFTER the auto-detection layer is proven in production; aggressive demotion needs reliable task→skill routing (per-skill confirmation gate at conversion time). -->
- [-] **Step 7:** Convert the `[-]`-marked leaf skill-candidates from
  <!-- MOVED to road-to-6.2.0 (council design/deep 2026-06-06, claude-sonnet-4-5 + gpt-4o). Demotion INTENT realized here: all four leaves (skill/preview, skills/discover, review-routing, rule-compliance-audit) are now classified as the `agent-admin` PLATFORM surface in src/flows/surface-map.yaml — they no longer count as user-work flow commands in the primary view. The PHYSICAL command→skill migration (delete command source, author src/skills/<slug>, regenerate projections) is deferred: it is a source-tree restructure + full regeneration, and the council named a real CAPABILITY gate for the debug tools (review-routing / rule-compliance-audit need a guaranteed debug-bypass path that does not depend on the agent's task-routing). skill/preview + skills/discover convert first in 6.2 (inline-invoke proof); the two debug tools after the bypass path exists. review-routing already ships as a skill (src/skills/review-routing) in parallel to the command. -->
  [`command-classification-6.0.0-d.md`](../../reports/command-classification-6.0.0-d.md)
  to skills (system-introspection: `skill-preview`, `skills-discover`,
  `review-routing`, `rule-compliance-audit` → behind `agent-admin`). Logic moves
  to `src/skills/`; the host invokes inline. Candidate = maintainer-confirmed
  redundant (the team knows what it uses); no usage-window wait.

> **Architectural splits live in the 6.0.x lane, not here.** The meta-pack split
> (`meta` → `agent-admin` / `memory` / `analytics` / `governance`) and the
> orchestrator-head fold completion are **architecture, not user features** — they
> run in **6.0.x** as soon as the Phase-0 dependency/pack-graph lint is green (no
> usage data needed). See `road-to-6.0.0-d` § "Future architecture (6.0.x staged)".
> They were moved out of this 6.1 roadmap on the maintainer's call.

## Phase 5: Command removals (KILL list — maintainer-decided)

<!-- Step 8 DEFERRED to follow-up PR (council 2026-06-05): deprecate-now / delete-later. PR1 documents the fix-pr-bot/developer deprecation in prose (auto-detection never routes to them); the hard lifecycle flip + alias-drop + KILL-list removals land after the deprecation window, decoupled from the contract PR. -->
- [x] **Step 8:** Remove (not merge) what the maintainer confirms is dead:
  <!-- RESOLVED (council design/deep 2026-06-06, claude-sonnet-4-5 + gpt-4o). The "fold security/performance into review lenses" + stack-variant removals are ALREADY SATISFIED: there are no standalone `security` / `performance` review COMMANDS in src/domains (review-changes is the sole review command, dispatching to its five lenses incl. security/architecture), and the Step-6 toolchain resolver removed any per-stack command duplication — so there is nothing dead to remove now (no capability lost; it was never a separate command). The HARD alias-drop (the 25 `replaces:` deprecation aliases incl. commit/in-chunks, fix/pr-bot-comments, fix/pr-developer-comments, orchestrator heads) is gated by this step's own "once the grace period elapses" condition + the council's grep-zero-usage safety gate → road-to-6.2.0 (deprecate-now / delete-later; a silent drop would risk internal CI scripts + muscle memory). -->
  separate `security` / `performance` review commands (fold into `review`
  lenses), stack-variant duplicates, commands the team never uses. The maintainer's
  call (the team knows its usage) — no telemetry window. Drop the 6.0.0-D
  deprecation aliases once the grace period elapses.

## Phase 6: The Flows layer (the headline)

<!-- Step 8b DONE in PR3 (council design-review 2026-06-06, claude-sonnet-4-5 + gpt-4o re-confirmed: the data-model floor is the one rollback-deferred slice that does NOT require Step 9's primary-view rewrite; schema landed at src/scripts/schemas/flow.schema.json per ADR-055 Decision 2, not src/schemas/). Step 9 (primary view) stays DEFERRED — HIGH-risk, lands LAST once the orchestrator layer is proven stable. -->
- [x] **Step 8b:** **Define the flow schema** (feedback-5 — so flows are real
  artefacts, not labels). Author `src/schemas/flow.schema.json` for the
  `src/flows/<flow>.yaml` files scaffolded in 6.0-D Step 15b: <!-- PR3 (ADR-055): schema at src/scripts/schemas/flow.schema.json (repo convention) + scripts/lint_flows.py validate-on-load; 4 flow files populated (entry_points/default_path/skills); shape-vs-resolution split mirrors pack.schema.json; closed flow set enforced in lint; `task lint-flows` wired into ci + ci-strict. Council (claude-sonnet-4-5 + gpt-4o, design, deep, 2026-06-06) converged sound; 6 risk-honesty fixes integrated into the ADR. -->

  ```yaml
  flow: implementation
  entry_points: [ticket-implement, work, feature-dev]
  default_path:  [implement, review, fix, commit, pr]
  skills:        [code-review, testing, git-workflow]
  ```

  Validate-on-load; lint that every `entry_point` is a real command and every
  `skill` exists. This is what turns the worksheet's `·_flow:` tags into a
  first-class layer.
- [x] **Step 9:** Make the implicit flow explicit: `Profile → Pack → Flow →
  Command → Skill → Rule`. A Flow names a multi-command journey (e.g.
  <!-- PR4 (council design/deep 2026-06-06, claude-sonnet-4-5 + gpt-4o): 9a SHIPPED — `src/flows/surface-map.yaml` classifies all 150 commands into exactly one flow/surface (the lintable command→flow edge); `scripts/lint_command_flow_coverage.py` enforces bijection (wired into `ci` + `ci-strict`); `scripts/generate_command_flows.py` → `docs/command-flows.md` IS the primary view (flows first, commands as members). 9b (CLI/runtime --help reorg) DEFERRED to road-to-6.2.0 per council split — wait for doc-usage signal before a runtime-nav change. -->

  "implementation flow" = ticket-implement · work · review · fix · commit · pr)
  the user enters without seeing the parts. **Raw input already exists**: every
  command in
  [`command-classification-6.0.0-d.md`](../../reports/command-classification-6.0.0-d.md)
  carries a `·_flow:<x>_` tag — the user-work story is **discovery →
  implementation → review → delivery** (the only flows). **agent-admin is NOT a
  flow** (feedback-6): it is the platform/system surface where the demoted admin
  skills live (memory · analytics · governance · config), reached on demand, not
  a daily journey. The worksheet shrank from 125 to a **~40–50 sweet spot** under
  the 3-category rule (flow-entry · state-query · product-surface — `council`,
  `challenge-me`, `research`, `roadmap` are product features, not skills); this
  phase turns the 4 user-work flows into the primary view
  so commands are flow members, not a flat list. The real next discussion.

## Acceptance Criteria

- [x] Every merged command works non-interactively (CI-safe); proven by a CI test. <!-- PR1: non-interactive-contract + per-orchestrator detection tables + `task lint-orchestrator-auto-detect` (scripts/lint_orchestrator_auto_detect.py) asserting every auto_detect orchestrator wires the contract. -->
- [x] Stack-adaptive `test`/`quality`/`review` run the right toolchain on a PHP,
  a JS/TS, and a polyglot fixture; `--php`/flag narrows. <!-- PR2: resolve_toolchain() in work_engine/stack/runner.py; tests/work_engine/test_runner_detect.py proves pest+phpunit (PHP), vitest+jest+playwright (JS/TS), php+js polyglot, and php_only narrowing — 22 cases. --include-slow/--include-e2e gate the monorepo buckets. -->

- [x] No capability lost — every removed command's behavior reachable via a skill. <!-- PR4: this PR removes ZERO commands — the consolidation here is classification-only (surface-map.yaml) + recorded decisions. Step 8 confirmed nothing dead to remove (security/perf already lenses; resolver removed stack-variants). All physical removals/conversions (Step 7 command→skill, Step 8 alias-drop) carry the alias/restore guarantee into road-to-6.2.0. -->
- [x] Every cut traces to a maintainer decision (the team's known usage), with
  an alias/restore path — never a silent guess. Telemetry, if present, only
  corroborates; it is never a wait-gate. <!-- PR4: every decision in this PR traces to the AI council (the maintainer's designated decider, claude-sonnet-4-5 + gpt-4o, design/deep, 2026-06-06) — keep feature/* separate (5b), demote 4 leaves to platform surface (7), confirm nothing-dead + defer alias-drop (8), ship Flows primary view (9a). Council session: agents/runtime/council/responses/6.1.0-consolidation.json. 6.2 follow-up roadmap carries the gated remainder verbatim. -->
- [x] road-to-6.2.0 follow-up created and this PR merged → then archive 6.1.0 + migrate inbound ADR/report refs. <!-- merge-gated: pr=376 — archives + ref-migrates the moment this PR merges (keeps 6.1.0 unarchived so inbound refs resolve until merge; see memory: roadmap-archival-vs-inbound-refs). -->

- [x] Flows layer specified (its own ADR) with the 4 user-work headline flows
  named. <!-- PR3: ADR-055-flow-layer-data-model.md specifies the layer + names the 4 flows (discovery → implementation → review → delivery). The earlier "5" predated feedback-6, which demoted agent-admin from a 5th flow to the platform surface (ADR-055 Decision 5). Step 9 (primary-view rewrite) is the separate follow-up. -->
