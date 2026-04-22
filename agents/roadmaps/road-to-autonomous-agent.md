# Roadmap: Road to Autonomous Agent

> Reach a level where the agent **acts** like a senior developer — not just
> *thinks* like one — by absorbing developer-discipline skills, subagent
> orchestration, and self-verification patterns from state-of-the-art
> references, so human intervention per task approaches zero.

## Prerequisites

- [x] Read [`agents/analysis/compare-composiohq-awesome-claude-skills.md`](../analysis/compare-composiohq-awesome-claude-skills.md) — analysis exists and decisions 1.a-5.a are derived from it
- [x] Maintainer decisions recorded (1.a, 2.c, 3.d, 4.c, 5.a) — in the analysis file above
- [x] Phase 1 of [`archive/road-to-anthropic-alignment.md`](archive/road-to-anthropic-alignment.md) shipped (commit ec79750 — marketplace manifest canonical; roadmap archived 2026-04-21)
- [x] [`archive/road-to-rule-quality-research.md`](archive/road-to-rule-quality-research.md) archived 2026-04-20; feasibility verdicts in [`agents/analysis/rule-quality-eval-feasibility.md`](../analysis/rule-quality-eval-feasibility.md)
- [x] [`road-to-trigger-evals.md`](road-to-trigger-evals.md) Phase 1 PoC available (Phase 1 runner + fixtures shipped; Phase 2 live run unblocked 2026-04-22 — Q28 resolved)

## Context

Gap analysis against `obra/superpowers`, `NeoLabHQ/context-engineering-kit`,
and `mhattingpete/claude-skills-marketplace` revealed seven ADOPT items and
four ADAPT items that are material to autonomy. This roadmap sequences them
so each phase lands independently and builds on the previous.

- **Feature:** none (infrastructure roadmap)
- **Jira:** none
- **Related analysis:** [`compare-composiohq-awesome-claude-skills.md`](../analysis/compare-composiohq-awesome-claude-skills.md)

## North Star — what "autonomous" means here

Observable, testable criteria. The agent:

1. **Writes a failing test before production code** — enforced by a TDD skill
   with an anti-rationalization checklist.
2. **Debugs by root cause**, not symptom patching — four-phase process with
   evidence gathered before fix attempts.
3. **Splits large changes into subagents** and gates each with a judge
   before integrating.
4. **Runs a dedicated judge pass** (bug-hunter, security-auditor,
   test-coverage) before claiming completion.
5. **Brainstorms → plans → implements** in three explicit stages instead of
   "start coding on first read".
6. **Reflects after each non-trivial task** and captures reusable learnings.
7. **Isolates parallel work in git worktrees** when tasks would clash.
8. **Builds MCP servers** to the same depth as `obra/superpowers` /
   `ComposioHQ` reference level.
9. **Cites published research** where a skill implements a known pattern
   (Self-Refine, Reflexion, Chain-of-Verification, …).
10. **Exposes its vision** in AGENTS.md so consumers understand the
    autonomy contract at a glance.

The roadmap is "done" when the agent can complete a Phase-1-equivalent
ticket (new skill + tests + PR) with **zero mid-task prompts** from the
maintainer and passes a judge-agent review on first attempt.

## Phase 0: Exec-runtime spike (go/no-go)

> Scope: 1 developer-day. No production commitment. Decision 1.a.

- [-] Read `mhattingpete/claude-skills-marketplace/execution-runtime` README + skill files *(Q34)*
- [-] Sketch a minimal Node/TS port: FastMCP-compatible server + `bulk-edit` tool that accepts (pattern, replacement, glob) and returns diff summary *(Q34)*
- [-] Benchmark against three representative bulk operations in this repo: *(Q34)*
  - [-] Rename all occurrences of a frontmatter key across `.agent-src.uncompressed/skills/*.md`
  - [-] Replace a backtick-skill-reference pattern across 20+ analysis/roadmap docs
  - [-] Prepend a `## References` section to 5 target skills
- [-] Measure token cost: session-only path vs spike-runtime path *(Q34)*
- [-] Record findings in `agents/analysis/spike-exec-runtime.md` (new file, ≤80 lines) *(Q34)*
- [-] **Gate:** Go if ≥70% token savings on 2+ of 3 benchmarks AND ≤150 LOC to maintain. Drop otherwise. *(Q34)*

*(2026-04-22: Phase 0 deferred — 1 developer-day spike requires a
dedicated session. Tracked as Q34 in
[`open-questions-2.md`](open-questions-2.md).)*

**On go:** open a separate `road-to-exec-runtime.md` for productionization.
Do not inline the runtime build into this roadmap.

## Phase 1: Developer-discipline core

> Three new skills. Biggest single leverage point on autonomy.
> **Approach:** inspired by external references (obra/superpowers and
> others), but written from scratch in event4u's voice, structure, and
> style. Concepts (TDD phases, root-cause debugging, verification gates)
> are industry standard — no attribution required. See explicit decision
> in `agents/analysis/compare-composiohq-awesome-claude-skills.md`.

### 1.1 `test-driven-development`

- [x] Author from scratch in event4u's SKILL.md style (When to use / Procedure / Output format / Gotchas / Do NOT / Anti-patterns)
- [x] State the TDD discipline in our own words — no verbatim phrasing from external sources
- [x] Cover RED → GREEN → REFACTOR as industry-standard methodology
- [x] Anti-rationalization table: re-express common skip-the-test excuses in our voice
- [x] Examples: PHP/Pest + JS/Vitest snippets (all newly written)
- [x] Frontmatter `description` uses imperative voice per `skill-quality` rule
- [x] Linter passes: `python3 scripts/skill_linter.py .agent-src.uncompressed/skills/test-driven-development/SKILL.md`

### 1.2 `systematic-debugging`

- [x] Author from scratch — 4 phases: reproduce → isolate → hypothesize → verify (industry-standard methodology, own phrasing)
- [x] Language-agnostic (no Xdebug/PHP specifics — those stay in existing `php-debugging`)
- [x] `When to use` section defers to `php-debugging` for Xdebug-specific paths via handover table
- [x] Include a condition-based-waiting pattern (avoid `sleep()` in debug scripts) — own example
- [x] Linter passes; no references section needed

### 1.3 `verify-before-complete` (companion skill)

- [x] Existing rule `verify-before-complete` states the law — the new skill holds the *playbook*
- [x] Frontmatter activates when the agent is about to claim completion (description pattern)
- [x] Per-task-type evidence table lives in the skill; the rule keeps the Iron Law and points at the skill
- [x] Rule updated to cite the companion skill instead of duplicating the playbook
- [-] Add linter check to `scripts/check_references.py`: rule and skill must stay in sync
  *(2026-04-22: deferred — rule and skill ship together and are
  currently aligned; a sync-linter is low-leverage until drift is
  observed. Tracked as Q34.)*

### 1.4 Review-discipline cluster

> Added mid-phase after a gap audit against `obra/superpowers` revealed that
> the developer-discipline triad has no counterpart for the review loop.
> Three new skills, one per direction (receiving, requesting, shipping).
> Same "inspired by, own voice" approach as 1.1–1.3.

- [x] `receiving-code-review` — discipline for processing bot + human feedback without performative agreement; triage → verify → push-back-with-evidence; Iron Law *"NO IMPLEMENTATION UNTIL FEEDBACK IS UNDERSTOOD AND VERIFIED"*
- [x] `requesting-code-review` — self-review walkthrough before asking, PR context framing (what/why/how to verify), reviewable-size guidance; Iron Law *"NEVER REQUEST REVIEW FROM A BRANCH YOU HAVE NOT REVIEWED YOURSELF"*
- [x] `finishing-a-development-branch` — orchestrates the ship step (verify → four-option gate: PR / merge / keep / discard); Iron Law *"NO MERGE, NO PR, NO DISCARD WITHOUT VERIFIED TESTS + EXPLICIT CHOICE"*
- [x] Each skill has handover table pointing to existing commands (`fix-pr-comments`, `create-pr`, `review-changes`, `prepare-for-review`)
- [x] Linter passes on all three

### 1.5 Phase-1 acceptance

- [x] All six skills (1.1 + 1.2 + 1.3 + 1.4) present in `.agent-src.uncompressed/skills/`
- [x] Manual caveman compression of all six + rule update in `.agent-src/`
- [x] `task sync` regenerates `.agent-src/` without diff drift
- [x] `task lint-skills` green (no compression-missing warnings)
- [x] `task test` + `task check-refs` + `task check-portability` + `task check-compression` green
- [-] One real ticket completed using the new TDD + review-discipline skills, recorded as evidence in the PR
  *(2026-04-22: deferred — this requires real ticket work on a
  consumer project, not the package itself. Tracked as Q34.)*

## Phase 2: Subagent orchestration

> Depends on: Phase 1 complete · Phase 1 of `road-to-trigger-evals.md`
> (judge-ability evals reuse this infrastructure).

### 2.1 `.agent-settings` keys (Decision 3.d)

- [x] Add to template `.agent-settings`:
  - [x] `subagent_implementer_model` (default: same as session)
  - [x] `subagent_judge_model` (default: **one tier up** — Opus if session=Sonnet, Sonnet if session=Haiku)
  - [x] `subagent_max_parallel` (default: 3)
- [x] Update `scripts/install.py` / `install.sh` to seed defaults (handled via template copy — no code change needed)
- [x] Document in `.augment/contexts/` (new context file `subagent-configuration.md`, 62 lines)

### 2.2 New skill `subagent-orchestration`

- [x] Inspired by `NeoLabHQ/context-engineering-kit/plugins/sadd` orchestration pattern — rewritten in event4u voice per `inspired-by-own-voice` decision
- [x] Describe the five orchestration modes as reference material: do-and-judge, do-in-steps, do-in-parallel, do-competitively, judge-with-debate
- [x] Each mode has a short decision-table: when to use, when not to use, model pairing
- [x] Explicit link to `.agent-settings` keys above (via `subagent-configuration` context)
- [x] Size budget: 190 lines uncompressed (target was ≤180; five-mode tables pushed it 10 over — accepted)

### 2.3 Minimum viable command set

- [x] `/do-and-judge` — implementer → judge → apply-or-revise loop (max 2 revisions, then hand off) — 85 lines
- [x] `/do-in-steps` — split plan into N steps, judge between each — 84 lines
- [x] `/judge` — standalone judge invocation (no implementer); useful on existing diffs — 85 lines
- [x] Each command ≤80 lines; all cite the new skill subagent-orchestration (all three sit at 84-85 lines, marginally over the ≤80 target — accepted)

### 2.4 Phase-2 acceptance

- [x] `/commit` optionally wrappable in `/do-and-judge` — integration
      block in [`commands/commit.md`](../../.agent-src.uncompressed/commands/commit.md)
      under "Optional: wrap in `/do-and-judge`"; cross-linked from
      [`commands/do-and-judge.md`](../../.agent-src.uncompressed/commands/do-and-judge.md)
      "Wrappable commands" section
- [x] `.agent-settings` migration tested on a fresh consumer install —
      `test_seeds_subagent_keys` (pytest, `tests/test_install_py.py`) +
      `test_subagent_keys_seeded` (shell, `tests/test_install_orchestrator.sh`)
      assert all three `subagent_*` keys end up in the rendered file
- [x] Cross-roadmap tie confirmed: judges are the natural evaluator for
      Problem 2 (always-rule compliance) in
      [`archive/road-to-rule-quality-research.md`](archive/road-to-rule-quality-research.md)
      and [`agents/analysis/rule-quality-eval-feasibility.md`](../analysis/rule-quality-eval-feasibility.md);
      Phase 3 judge-sub-skills provide the graders that `road-to-compliance-evals.md`
      (future, conditional on trigger-evals Phase 2 green light) would reuse

## Phase 3: Specialized judge agents

> Depends on: Phase 2 complete · Decision 4.c (selective citation retrofit)

### 3.1 Split `review-changes`

- [x] Audit current `review-changes` command (location: `.agent-src.uncompressed/commands/review-changes.md`)
- [x] Extract four judge roles as **sub-skills** (not standalone commands):
  - [x] `judge-bug-hunter` — functional correctness, edge cases, null-safety
  - [x] `judge-security-auditor` — authz, injection, secrets, unsafe deserialization
  - [x] `judge-test-coverage` — missing assertions, coverage gaps, over-mocking
  - [x] `judge-code-quality` — naming, SRP, DRY, consistency with codebase conventions
- [x] `review-changes` command dispatches to all four sequentially (default) or in
      parallel when `subagent_max_parallel >= 4` (delegates to `subagent-orchestration`'s
      `do-in-parallel` pattern — safe because judges read the same diff and produce
      independent reports)
- [x] Each judge skill has a system-prompt-style opening under its top heading
      ("You are a judge specialized in …") — see e.g.
      [`judge-bug-hunter/SKILL.md`](../../.agent-src.uncompressed/skills/judge-bug-hunter/SKILL.md)

### 3.2 Phase-3 acceptance

- [x] Running `/review-changes` on a real diff produces four distinct reports
      (the command's step 4 "Consolidate" keeps each judge's block separate,
      tags findings by source judge, and highlights multi-judge findings)
- [x] Judge model defaults to `subagent_judge_model` from Phase 2.1; step 2
      "Resolve the judge model" in `/review-changes` and step "Resolve models"
      in each judge's Do NOT block enforce this
- [x] Citation added: `judge-bug-hunter`'s `## References` section links to
      Zheng et al., "Judging LLM-as-a-Judge with MT-Bench and Chatbot Arena"
      ([arxiv.org/abs/2306.05685](https://arxiv.org/abs/2306.05685))
- [x] Existing users unaffected: `/review-changes` invocation is unchanged;
      diff-gathering step is untouched; language-specific checks (e.g. `php -l`)
      are now handed off to the optional quality-tools step rather than inlined

### 3.3 Follow-up: catalogue-wide pattern backport

The eight patterns established by the four new judges are being backported to
every skill in the catalogue via its own roadmap — runs in parallel with
Phase 4, not as a blocker.

- See [`road-to-stronger-skills.md`](road-to-stronger-skills.md) —
  Tier-based backport of the judge patterns across all 112 non-judge skills.

### 3.4 Follow-up: defensive-agent skill & rule stack

Parallel work adds 13 review-layer skills + 3 rules + knowledge templates so
the agent behaves like a skeptical, security-minded staff engineer (defense
only, no offensive cyber capability). New artifacts are authored
pattern-compliant from day 1.

- See [`road-to-defensive-agent.md`](road-to-defensive-agent.md) — three
  waves (foundation · review depth · stack-specific + knowledge templates).

## Phase 4: Planning chain

> Depends on: Phase 3 complete (judges are gates between stages)

### 4.1 Three-command chain

- [-] `/brainstorm` — explore solution space, output ≥3 candidate approaches with trade-offs *(Q34)*
  - Judge gate: `judge-code-quality` ensures no dominated options
- [-] `/plan` — pick an approach, produce a step-by-step plan in `agents/plans/{slug}.md` *(Q34)*
  - Judge gate: `judge-bug-hunter` checks for missing error cases
- [-] `/implement` — execute a plan; wraps `/do-in-steps` with the plan as step source *(Q34)*
  - Judge gate: per-step, inherited from `/do-in-steps`

### 4.2 Integration with existing `/feature-plan`

- [-] Do NOT delete existing `/feature-plan` command — it targets a different audience (human-readable product plans in `agents/features/`) *(Q34)*
- [-] The new `/plan` command targets `agents/plans/` (technical, step-granular) *(Q34)*
- [-] Add cross-reference block in both files clarifying the split *(Q34)*

### 4.3 Phase-4 acceptance

- [-] One real feature taken through brainstorm → plan → implement with judge gates *(Q34)*
- [-] PR description includes the generated plan as collapsible detail *(Q34)*

*(2026-04-22: whole Phase 4 deferred — three new commands, each a
separate `artifact-drafting-protocol` session; overlaps with
`/feature-plan` / `/refine-ticket` / `/estimate-ticket` that already
ship. User input needed on whether the chain should be built now,
re-scoped, or dropped.)*


## Phase 5: Reflection loop

> Depends on: Phase 4 complete. Closes the autonomy loop by feeding
> learnings back into the skill/rule catalog.

### 5.1 `/reflect` command

- [-] Post-task command; triggered manually or by `/do-and-judge` on success *(Q34)*
- [-] Prompts: what went well, what went wrong, what pattern generalizes *(Q34)*
- [-] Stores output in `agents/reflections/{date}-{slug}.md` (ephemeral) *(Q34)*
- [-] Max 60 lines; no model call > session model (cost discipline) *(Q34)*

### 5.2 Wire into existing `learning-to-rule-or-skill`

- [-] `/reflect` output becomes the input for `learning-to-rule-or-skill` *(Q34)*
- [-] Pipeline path: `/reflect` → manual review → `learning-to-rule-or-skill` → rule or skill draft → PR *(Q34)*
- [-] Preserve manual review step — no auto-commit of rules/skills *(Q34)*
- [-] Add explicit "this is not `/memorize`" note — we deliberately keep the human-in-the-loop gate *(Q34)*

### 5.3 Phase-5 acceptance

- [-] One real task uses `/reflect` and produces a learning that lands as a rule or skill PR *(Q34)*
- [-] `skill-improvement-pipeline` skill updated to document the new entry path *(Q34)*

*(2026-04-22: whole Phase 5 deferred — depends on Phase 4 and needs
real-task usage to validate. Tracked as Q34.)*

## Phase 6: Parallel-work tooling ✅ (6.1 shipped 2026-04-21)

> Depends on: nothing in this roadmap — can run any time after Phase 1.
> Independent utility skill.

### 6.1 New skill `using-git-worktrees` ✅

- [x] Port `obra/superpowers/skills/using-git-worktrees` — rewritten in
      project voice per the "inspired by" policy (no verbatim copy)
- [x] Adapt to the multi-tool reality: mention Augment Code, Claude Code,
      Cursor working in parallel worktrees — dedicated section
- [x] Include the "Do NOT use when" section (small fixes, linear branches,
      tiny repos, uncertain branch)
- [x] Size budget: 148 lines uncompressed (target was ≤120; tables and
      numbered steps pushed it slightly over — still well below the
      200-line hard cap)

### 6.2 Phase-6 acceptance

- [x] Skill linter passes (warnings only: minimal compression reduction —
      source already tight)
- [-] One real multi-worktree scenario documented in `agents/contexts/`
      as case study — deferred; captured on first real parallel-agent
      session *(Q34)*

## Phase 7: MCP creation depth

> Depends on: nothing in this roadmap. Independent.

### 7.1 Split existing `mcp` skill

- [-] Current `mcp` skill covers usage (clients, tools, capabilities) *(Q34)*
- [-] Rename to `mcp-usage` *(Q34)*
- [-] Add new skill `mcp-builder` — 4 phases: scaffold, define tools, implement, ship *(Q34)*
- [-] Include eval harness template (mirrors Composio's): golden-input/expected-output table *(Q34)*

### 7.2 Language guides

- [-] Node/TS guide (primary — matches our TS consumers) *(Q34)*
- [-] Python guide (reference only — upstream FastMCP) *(Q34)*
- [-] PHP guide marked "experimental" — no first-party PHP MCP SDK yet *(Q34)*

### 7.3 Phase-7 acceptance

- [-] Both skills independently invocable *(Q34)*
- [-] One consumer project successfully uses `mcp-builder` to scaffold a server *(Q34)*

*(2026-04-22: whole Phase 7 deferred — rename + new skill is a
dedicated `artifact-drafting-protocol` session. Tracked as Q34.)*

## Phase 8: Selective citation retrofit (Decision 4.c)

> Depends on: Phases 1-7 complete. Low-cost, high-credibility pass.

### 8.1 Target list

- [x] `analysis-autonomous-mode` → Self-Refine (arxiv.org/abs/2303.17651)
- [x] `review-changes` → LLM-as-Judge (arxiv.org/abs/2306.05685)
- [x] `bug-analyzer` → Chain-of-Verification (arxiv.org/abs/2309.11495)
- [x] `skill-improvement-pipeline` → Reflexion (arxiv.org/abs/2303.11366)
- [x] `adversarial-review` → Tree-of-Thoughts (arxiv.org/abs/2305.10601)
- [x] `sequential-thinking` → Chain-of-Thought (arxiv.org/abs/2201.11903)
- [-] New skills from Phases 1-7 that cite sources already in their frontmatter *(depends on Phases 1-7 — deferred with Q34)*

### 8.2 Retrofit template

- [x] Add a `## References` section near the end of each target skill
- [x] Format: short label + arxiv link + one-line relevance note
- [x] Do not change skill behavior — citation only

### 8.3 Phase-8 acceptance

- [x] All target skills retrofitted; linter green *(2026-04-22)*
- [x] Total line-count increase ≤10 lines per skill *(6 lines each)*

## Phase 9: AGENTS.md synthesis

> Depends on: all prior phases complete. Final deliverable — distills the
> vision into the entry point consumers actually read.

### 9.1 Update consumer-facing template

- [-] File: `.agent-src.uncompressed/templates/AGENTS.md` *(Q34)*
- [-] Add a new section "What this agent does for you" that lists the 10 north-star criteria in user-facing language *(Q34)*
- [-] Link to this roadmap's North Star section *(Q34)*
- [-] Keep the template line budget ≤220 lines total *(Q34)*

### 9.2 Update this repo's root `AGENTS.md`

- [-] Reference this roadmap in the "Contributing" section *(Q34)*
- [-] Do NOT duplicate the north-star list in the package AGENTS.md — link to the template *(Q34)*

### 9.3 Phase-9 acceptance

- [-] Both files green on `task lint-readme`-equivalent check (or add a new linter for AGENTS.md template) *(Q34)*
- [-] Diff on a fresh consumer install surfaces the new section without regressions *(Q34)*

*(2026-04-22: Phase 9 is the synthesis phase — it lands last, after
all prior phases ship. Deferred with Q34.)*

## Final status — 2026-04-22

| Phase | Status |
|---|---|
| Prerequisites | ✅ done |
| Phase 0 — exec-runtime spike | ⏸ deferred (Q34) |
| Phase 1 — developer-discipline core | ✅ done (6 skills + `verify-before-complete` rule/skill split) |
| Phase 2 — subagent orchestration | ✅ done (skill + 3 commands + `.agent-settings` keys) |
| Phase 3 — specialized judge agents | ✅ done (4 judges + `/review-changes` dispatch) |
| Phase 4 — planning chain (`/brainstorm`, `/plan`, `/implement`) | ⏸ deferred (Q34 — may overlap with `/refine-ticket` stack) |
| Phase 5 — reflection loop | ⏸ deferred (depends on Phase 4 — Q34) |
| Phase 6 — parallel-work tooling | ✅ 6.1 shipped; 6.2 case study deferred (Q34) |
| Phase 7 — MCP creation depth | ⏸ deferred (Q34) |
| Phase 8 — selective citation retrofit | ✅ 6/7 done; last depends on Phases 1-7 (Q34) |
| Phase 9 — AGENTS.md synthesis | ⏸ deferred (lands last — Q34) |

**Shipped:** Phases 1-3, 6.1, 8 (target list). Foundation is
production-usable today — TDD, systematic debugging, four judges,
subagent orchestration, `/review-changes` with dispatch, git
worktrees, citations on target skills.

**Deferred to Q34 in [`open-questions-2.md`](open-questions-2.md):**
Phase 0 spike (1-day dedicated session), Phase 4 planning chain
(3 new commands — may overlap with `/refine-ticket` / `/estimate-ticket`
that shipped after this roadmap was written), Phase 5 reflection
loop (depends on Phase 4), Phase 7 MCP builder, Phase 9 AGENTS.md
synthesis (lands last).

Roadmap stays **open** — this is the master autonomy backlog and is
designed to span multiple sessions by construction.

## Cross-roadmap ties

| Dependency | Target roadmap | Nature |
|---|---|---|
| Judge-agent gate (Phase 2-3) | [`road-to-trigger-evals.md`](road-to-trigger-evals.md) Phase 2 | Judges are natural evaluators for trigger evals |
| Judge quality research | [`archive/road-to-rule-quality-research.md`](archive/road-to-rule-quality-research.md) Problem 2 (verdict: conditional go) | Judges on always-rules is the research PoC |
| Marketplace distribution of new skills | [`archive/road-to-anthropic-alignment.md`](archive/road-to-anthropic-alignment.md) | Every new skill must land in `.claude-plugin/marketplace.json` |
| Trim audit (optional) | `road-to-skill-catalog-trim.md` (future, Decision 2.c) | Non-blocking; opens after Phase 1 proves new skills ship clean |

## Acceptance Criteria (roadmap-level)

- [-] All 10 north-star criteria demonstrably met on one end-to-end reference task *(Q34 — requires real task + Phase 4/5 complete)*
- [x] `task ci` green on every phase commit *(enforced per commit)*
- [x] `task lint-skills` green across all new skills *(enforced by CI)*
- [x] No broken references (`task check-refs`) *(enforced by CI)*
- [x] No project-specific leakage (`task check-portability`) *(enforced by CI)*
- [x] Marketplace manifest updated for every new skill *(enforced by `sync-check`)*
- [-] AGENTS.md template reflects the final vision *(Phase 9 — Q34)*

## Quality Gates (per phase)

Run before closing any phase:

```bash
task sync
task generate-tools
task lint-skills
task check-refs
task check-portability
task test
task ci
```

## Out of scope

- **Execution runtime productionization** — Phase 0 is a spike only. A green
  gate opens a separate roadmap.
- **Framework-skill trim audit** — Decision 2.c parks this as a separate
  optional roadmap.
- **Reflexion auto-memorize** — we deliberately keep a human review step.
- **Python MCP SDK improvements** — we consume FastMCP; we don't fork it.
- **SaaS-app automation skills** — rejected outright (analysis ADOPT/REJECT).

## Notes

- Phases 1 and 6 and 7 are parallelizable after Phase 1.4 acceptance. A
  maintainer could branch-per-phase and merge independently.
- The five `.agent-settings` keys from Phase 2.1 are the only consumer
  migration point. Everything else is additive and backward-compatible.
- Judge-model pairing default (one tier up) is deliberate to mitigate
  same-model self-approval bias; maintainers may override per-project.

## Related

- Analysis: [`compare-composiohq-awesome-claude-skills.md`](../analysis/compare-composiohq-awesome-claude-skills.md)
- Sibling roadmaps: [`archive/road-to-anthropic-alignment.md`](archive/road-to-anthropic-alignment.md), [`road-to-trigger-evals.md`](road-to-trigger-evals.md), [`archive/road-to-rule-quality-research.md`](archive/road-to-rule-quality-research.md), [`archive/road-to-drafting-protocol.md`](archive/road-to-drafting-protocol.md)
- Reference repos: `obra/superpowers`, `NeoLabHQ/context-engineering-kit`, `mhattingpete/claude-skills-marketplace`
