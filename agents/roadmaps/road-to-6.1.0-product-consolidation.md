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

## Phase 1: Interactive-merge contract (the gate for every merge here)

- [ ] **Step 1:** Ship the non-interactive contract every merged command depends
  on: detect a non-TTY (CI) reliably, honor `--yes` / `--json` / explicit flags,
  fall back to a safe default without hanging. Council: interactive prompts that
  block CI are "provably wrong for CI/CD" — no interactive merge ships without it.

## Phase 2: Interactive command merges

- [ ] **Step 2:** `fix-pr-comments` ← `{fix-pr-bot-comments, fix-pr-developer-comments}`:
  detect new/unanswered comments, ask "fix bot / human / both?"; improved
  detection dedupes by comment id + reply marker so already-answered comments are
  never retried.
- [ ] **Step 3:** `analytics` ← `{analytics-show, analytics-prune}`: show is the
  default; prune is behind an explicit confirm/flag (destructive, never silent).
- [ ] **Step 4:** `judge` ← `{judge-solo, judge-on-diff, judge-steps}`: auto-detect
  the mode (diff → on-diff, plan → steps, else solo) with a confirm; fall back to
  an explicit prompt if detection confidence < 90%.
- [ ] **Step 5:** `tests` create-vs-run disambiguation; `override` create-vs-edit.
  Each merge ships only with the Phase-1 non-interactive escape.
- [ ] **Step 5b:** `feature-plan` ← `{feature-explore, feature-roadmap}` — merge
  **decision deferred here from 6.0-D Step 13b**: `feature-explore` is `feature-plan`'s
  first phase (a subset, not a >95% duplicate) and `feature-roadmap` is its
  downstream "make it a roadmap" branch, so the council guardrail forbade
  merge-then-unmerge on an untested assumption. 6.0-D moved all three as flat
  commands; decide the fold (and whether `--roadmap` becomes a flag on
  `feature-plan`) here, with aliases kept. Evidence:
  [`command-classification-6.0.0-d.md` § Step 13b](../reports/command-classification-6.0.0-d.md).

## Phase 3: Stack-adaptive engineering commands (resolver)

- [ ] **Step 6:** Build the toolchain resolver: `test-run` / `test-create` /
  `quality-fix` / `review-changes` / `work` DETECT the consumer's stack (phpunit /
  pest / playwright / vitest / jest / …) and run the right tool — no per-stack
  command explosion. Monorepo guard: default to FAST tests, `--include-slow` /
  `--include-e2e` opt-in. Per-stack commands captured in an auto-generated project
  config. Only genuine PHP-space commands stay PHP-locked.

## Phase 4: Command → skill conversions (the [-] leaves)

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

- [ ] **Step 8:** Remove (not merge) what the maintainer confirms is dead:
  separate `security` / `performance` review commands (fold into `review`
  lenses), stack-variant duplicates, commands the team never uses. The maintainer's
  call (the team knows its usage) — no telemetry window. Drop the 6.0.0-D
  deprecation aliases once the grace period elapses.

## Phase 6: The Flows layer (the headline)

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

- [ ] Every merged command works non-interactively (CI-safe); proven by a CI test.
- [ ] Stack-adaptive `test`/`quality`/`review` run the right toolchain on a PHP,
  a JS/TS, and a polyglot fixture; `--php`/flag narrows.
- [ ] No capability lost — every removed command's behavior reachable via a skill.
- [ ] Every cut traces to a maintainer decision (the team's known usage), with
  an alias/restore path — never a silent guess. Telemetry, if present, only
  corroborates; it is never a wait-gate.
- [ ] Flows layer specified (its own ADR) with the 5 headline flows named.
