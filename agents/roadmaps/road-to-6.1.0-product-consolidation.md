---
status: active
complexity: structural
parent_roadmap: road-to-6.0.0-d-structural-restructure
---

# Road to 6.1.0 — Product consolidation (behavioral cuts after the structural break)

> Draft until 6.0.0 ships — the ONLY gate is the dependency (you cannot
> consolidate the renamed surface before it is renamed). **No telemetry wait.**
> This roadmap holds everything the
> [`6.0.0-D scope-line rule`](archive/road-to-6.0.0-d-structural-restructure.md) put in
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
- [ ] **Step 5b:** `feature-plan` ← `{feature-explore, feature-roadmap}` — merge
  <!-- DEFERRED to follow-up PR (council 2026-06-05): both members declined to fold without standalone-usage evidence; revisit when usage data shows how often feature/explore runs standalone. -->
  **decision deferred here from 6.0-D Step 13b**: `feature-explore` is `feature-plan`'s
  first phase (a subset, not a >95% duplicate) and `feature-roadmap` is its
  downstream "make it a roadmap" branch, so the council guardrail forbade
  merge-then-unmerge on an untested assumption. 6.0-D moved all three as flat
  commands; decide the fold (and whether `--roadmap` becomes a flag on
  `feature-plan`) here, with aliases kept. Evidence:
  [`command-classification-6.0.0-d.md` § Step 13b](../reports/command-classification-6.0.0-d.md).

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
- [ ] **Step 7:** Convert the `[-]`-marked leaf skill-candidates from
  [`command-classification-6.0.0-d.md`](../reports/command-classification-6.0.0-d.md)
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
- [ ] **Step 8:** Remove (not merge) what the maintainer confirms is dead:
  separate `security` / `performance` review commands (fold into `review`
  lenses), stack-variant duplicates, commands the team never uses. The maintainer's
  call (the team knows its usage) — no telemetry window. Drop the 6.0.0-D
  deprecation aliases once the grace period elapses.

## Phase 6: The Flows layer (the headline)

<!-- Steps 8b + 9 DEFERRED to follow-up PR (council 2026-06-05): the flows layer is the HIGH-risk new abstraction and lands LAST, only once the orchestrator layer is proven stable. src/flows/*.yaml stubs already exist (6.0-D Step 15b); the schema + resolver are their own PR. -->
- [ ] **Step 8b:** **Define the flow schema** (feedback-5 — so flows are real
  artefacts, not labels). Author `src/schemas/flow.schema.json` for the
  `src/flows/<flow>.yaml` files scaffolded in 6.0-D Step 15b:

  ```yaml
  flow: implementation
  entry_points: [ticket-implement, work, feature-dev]
  default_path:  [implement, review, fix, commit, pr]
  skills:        [code-review, testing, git-workflow]
  ```

  Validate-on-load; lint that every `entry_point` is a real command and every
  `skill` exists. This is what turns the worksheet's `·_flow:` tags into a
  first-class layer.
- [ ] **Step 9:** Make the implicit flow explicit: `Profile → Pack → Flow →
  Command → Skill → Rule`. A Flow names a multi-command journey (e.g.
  "implementation flow" = ticket-implement · work · review · fix · commit · pr)
  the user enters without seeing the parts. **Raw input already exists**: every
  command in
  [`command-classification-6.0.0-d.md`](../reports/command-classification-6.0.0-d.md)
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

- [ ] No capability lost — every removed command's behavior reachable via a skill.
- [ ] Every cut traces to a maintainer decision (the team's known usage), with
  an alias/restore path — never a silent guess. Telemetry, if present, only
  corroborates; it is never a wait-gate.
- [ ] Flows layer specified (its own ADR) with the 5 headline flows named.
