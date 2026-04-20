# Roadmap: Road to Autonomous Agent

> Reach a level where the agent **acts** like a senior developer — not just
> *thinks* like one — by absorbing developer-discipline skills, subagent
> orchestration, and self-verification patterns from state-of-the-art
> references, so human intervention per task approaches zero.

## Prerequisites

- [ ] Read [`agents/analysis/compare-composiohq-awesome-claude-skills.md`](../analysis/compare-composiohq-awesome-claude-skills.md)
- [ ] Maintainer decisions recorded (1.a, 2.c, 3.d, 4.c, 5.a)
- [ ] Phase 1 of [`road-to-anthropic-alignment.md`](road-to-anthropic-alignment.md) shipped (commit ec79750 — marketplace manifest canonical)
- [ ] [`archive/road-to-rule-quality-research.md`](archive/road-to-rule-quality-research.md) archived 2026-04-20; feasibility verdicts in [`agents/analysis/rule-quality-eval-feasibility.md`](../analysis/rule-quality-eval-feasibility.md)
- [ ] [`road-to-trigger-evals.md`](road-to-trigger-evals.md) Phase 1 PoC available before Phase 2 of this roadmap

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

- [ ] Read `mhattingpete/claude-skills-marketplace/execution-runtime` README + skill files
- [ ] Sketch a minimal Node/TS port: FastMCP-compatible server + `bulk-edit` tool that accepts (pattern, replacement, glob) and returns diff summary
- [ ] Benchmark against three representative bulk operations in this repo:
  - [ ] Rename all occurrences of a frontmatter key across `.agent-src.uncompressed/skills/*.md`
  - [ ] Replace a backtick-skill-reference pattern across 20+ analysis/roadmap docs
  - [ ] Prepend a `## References` section to 5 target skills
- [ ] Measure token cost: session-only path vs spike-runtime path
- [ ] Record findings in `agents/analysis/spike-exec-runtime.md` (new file, ≤80 lines)
- [ ] **Gate:** Go if ≥70% token savings on 2+ of 3 benchmarks AND ≤150 LOC to maintain. Drop otherwise.

**On go:** open a separate `road-to-exec-runtime.md` for productionization.
Do not inline the runtime build into this roadmap.

## Phase 1: Developer-discipline core

> Three new skills. Biggest single leverage point on autonomy.
> Adopt verbatim where possible; adapt only examples.

### 1.1 `test-driven-development`

- [ ] Copy `obra/superpowers/skills/test-driven-development/SKILL.md` as starting point (preserve license attribution)
- [ ] Keep the Iron Law verbatim: *"No production code without a failing test first."*
- [ ] Keep the RED → GREEN → REFACTOR state machine and the anti-rationalization table
- [ ] Adapt examples to project-agnostic pseudocode + one PHP/Pest + one JS/Vitest snippet
- [ ] Frontmatter `description` uses imperative voice (see `skill-quality` rule)
- [ ] Add `## References` section citing the source commit + Beck 2002 ("Test-Driven Development: By Example")
- [ ] Linter passes: `python3 scripts/skill_linter.py .agent-src.uncompressed/skills/test-driven-development/SKILL.md`

### 1.2 `systematic-debugging`

- [ ] Port `obra/superpowers/skills/systematic-debugging` — 4 phases: reproduce → isolate → hypothesize → verify
- [ ] Language-agnostic (no Xdebug/PHP specifics — those stay in existing `php-debugging`)
- [ ] Add a `## When NOT to use` section pointing at `php-debugging` for Xdebug-specific paths
- [ ] Include a condition-based-waiting pattern (avoid `sleep()` in debug scripts)
- [ ] `## References` cites `obra/superpowers` + Zeller 2005 ("Why Programs Fail")

### 1.3 `verification-before-completion` (companion skill)

- [ ] Existing rule `verify-before-complete` states the law — the new skill holds the *checklist body*
- [ ] Frontmatter activates when the agent is about to claim completion (description pattern)
- [ ] Mirror the per-task-type evidence table from the existing rule into the skill (single source of truth = skill; rule references skill)
- [ ] Update rule to cite the companion skill instead of duplicating the table
- [ ] Add linter check to `scripts/check_references.py`: rule and skill must stay in sync

### 1.4 Phase-1 acceptance

- [ ] All three skills present in `.agent-src.uncompressed/skills/`
- [ ] `task sync` regenerates `.agent-src/` without diff drift
- [ ] `task lint-skills` green
- [ ] `task test` + `task check-refs` + `task check-portability` green
- [ ] One real ticket completed using the new TDD skill, recorded as evidence in the PR

## Phase 2: Subagent orchestration

> Depends on: Phase 1 complete · Phase 1 of `road-to-trigger-evals.md`
> (judge-ability evals reuse this infrastructure).

### 2.1 `.agent-settings` keys (Decision 3.d)

- [ ] Add to template `.agent-settings`:
  - [ ] `subagent_implementer_model` (default: same as session)
  - [ ] `subagent_judge_model` (default: **one tier up** — Opus if session=Sonnet, Sonnet if session=Haiku)
  - [ ] `subagent_max_parallel` (default: 3)
- [ ] Update `scripts/install.py` / `install.sh` to seed defaults
- [ ] Document in `.augment/contexts/` (new context file `subagent-configuration.md`, ≤60 lines)

### 2.2 New skill `subagent-orchestration`

- [ ] Port `NeoLabHQ/context-engineering-kit/plugins/sadd` orchestration pattern
- [ ] Describe the five orchestration modes as reference material: do-and-judge, do-in-steps, do-in-parallel, do-competitively, judge-with-debate
- [ ] Each mode has a short decision-table: when to use, when not to use, model pairing
- [ ] Explicit link to `.agent-settings` keys above
- [ ] Size budget: ≤180 lines uncompressed

### 2.3 Minimum viable command set

- [ ] `/do-and-judge` — implementer → judge → apply-or-revise loop (max 2 revisions, then hand off)
- [ ] `/do-in-steps` — split plan into N steps, judge between each
- [ ] `/judge` — standalone judge invocation (no implementer); useful on existing diffs
- [ ] Each command ≤80 lines; all cite the new skill subagent-orchestration

### 2.4 Phase-2 acceptance

- [ ] One existing command (e.g. `/commit`) optionally wrappable in `/do-and-judge`
- [ ] `.agent-settings` migration tested on a fresh consumer install (`tests/test_install.sh`)
- [ ] Cross-roadmap tie confirmed: judge outputs feed into `road-to-trigger-evals.md` Problem 2 PoC

## Phase 3: Specialized judge agents

> Depends on: Phase 2 complete · Decision 4.c (selective citation retrofit)

### 3.1 Split `review-changes`

- [ ] Audit current `review-changes` command (location: `.agent-src.uncompressed/commands/review-changes.md`)
- [ ] Extract four judge roles as **sub-skills** (not standalone commands):
  - [ ] `judge-bug-hunter` — functional correctness, edge cases, null-safety
  - [ ] `judge-security-auditor` — authz, injection, secrets, unsafe deserialization
  - [ ] `judge-test-coverage` — missing assertions, coverage gaps, over-mocking
  - [ ] `judge-code-quality` — naming, SRP, DRY, consistency with codebase conventions
- [ ] `review-changes` command dispatches to all four sequentially (or in parallel via `/do-in-parallel` from Phase 2)
- [ ] Each judge skill has a frontmatter system-prompt-style opening ("You are a judge specialized in …")

### 3.2 Phase-3 acceptance

- [ ] Running `/review-changes` on a real diff produces four distinct reports
- [ ] Judge model defaults to `subagent_judge_model` from Phase 2.1
- [ ] Citation added: `judge-bug-hunter` `## References` links to LLM-as-Judge paper (arxiv.org/abs/2306.05685)
- [ ] Existing users unaffected: old `review-changes` invocation still works (backward compatible)

## Phase 4: Planning chain

> Depends on: Phase 3 complete (judges are gates between stages)

### 4.1 Three-command chain

- [ ] `/brainstorm` — explore solution space, output ≥3 candidate approaches with trade-offs
  - Judge gate: `judge-code-quality` ensures no dominated options
- [ ] `/plan` — pick an approach, produce a step-by-step plan in `agents/plans/{slug}.md`
  - Judge gate: `judge-bug-hunter` checks for missing error cases
- [ ] `/implement` — execute a plan; wraps `/do-in-steps` with the plan as step source
  - Judge gate: per-step, inherited from `/do-in-steps`

### 4.2 Integration with existing `/feature-plan`

- [ ] Do NOT delete existing `/feature-plan` command — it targets a different audience (human-readable product plans in `agents/features/`)
- [ ] The new `/plan` command targets `agents/plans/` (technical, step-granular)
- [ ] Add cross-reference block in both files clarifying the split

### 4.3 Phase-4 acceptance

- [ ] One real feature taken through brainstorm → plan → implement with judge gates
- [ ] PR description includes the generated plan as collapsible detail


## Phase 5: Reflection loop

> Depends on: Phase 4 complete. Closes the autonomy loop by feeding
> learnings back into the skill/rule catalog.

### 5.1 `/reflect` command

- [ ] Post-task command; triggered manually or by `/do-and-judge` on success
- [ ] Prompts: what went well, what went wrong, what pattern generalizes
- [ ] Stores output in `agents/reflections/{date}-{slug}.md` (ephemeral)
- [ ] Max 60 lines; no model call > session model (cost discipline)

### 5.2 Wire into existing `learning-to-rule-or-skill`

- [ ] `/reflect` output becomes the input for `learning-to-rule-or-skill`
- [ ] Pipeline path: `/reflect` → manual review → `learning-to-rule-or-skill` → rule or skill draft → PR
- [ ] Preserve manual review step — no auto-commit of rules/skills
- [ ] Add explicit "this is not `/memorize`" note — we deliberately keep the human-in-the-loop gate

### 5.3 Phase-5 acceptance

- [ ] One real task uses `/reflect` and produces a learning that lands as a rule or skill PR
- [ ] `skill-improvement-pipeline` skill updated to document the new entry path

## Phase 6: Parallel-work tooling

> Depends on: nothing in this roadmap — can run any time after Phase 1.
> Independent utility skill.

### 6.1 New skill `using-git-worktrees`

- [ ] Port `obra/superpowers/skills/using-git-worktrees`
- [ ] Adapt to the multi-tool reality: mention Augment Code, Claude Code, Cursor working in parallel worktrees
- [ ] Include the "when NOT to worktree" section (small fixes, linear branches)
- [ ] Size budget: ≤120 lines

### 6.2 Phase-6 acceptance

- [ ] Skill linter passes
- [ ] One real multi-worktree scenario documented in `agents/contexts/` as case study

## Phase 7: MCP creation depth

> Depends on: nothing in this roadmap. Independent.

### 7.1 Split existing `mcp` skill

- [ ] Current `mcp` skill covers usage (clients, tools, capabilities)
- [ ] Rename to `mcp-usage`
- [ ] Add new skill `mcp-builder` — 4 phases: scaffold, define tools, implement, ship
- [ ] Include eval harness template (mirrors Composio's): golden-input/expected-output table

### 7.2 Language guides

- [ ] Node/TS guide (primary — matches our TS consumers)
- [ ] Python guide (reference only — upstream FastMCP)
- [ ] PHP guide marked "experimental" — no first-party PHP MCP SDK yet

### 7.3 Phase-7 acceptance

- [ ] Both skills independently invocable
- [ ] One consumer project successfully uses `mcp-builder` to scaffold a server

## Phase 8: Selective citation retrofit (Decision 4.c)

> Depends on: Phases 1-7 complete. Low-cost, high-credibility pass.

### 8.1 Target list

- [ ] `analysis-autonomous-mode` → Self-Refine (arxiv.org/abs/2303.17651)
- [ ] `review-changes` → LLM-as-Judge (arxiv.org/abs/2306.05685)
- [ ] `bug-analyzer` → Chain-of-Verification (arxiv.org/abs/2309.11495)
- [ ] `skill-improvement-pipeline` → Reflexion (arxiv.org/abs/2303.11366)
- [ ] `adversarial-review` → Tree-of-Thoughts (arxiv.org/abs/2305.10601)
- [ ] `sequential-thinking` → Chain-of-Thought (arxiv.org/abs/2201.11903)
- [ ] New skills from Phases 1-7 that cite sources already in their frontmatter

### 8.2 Retrofit template

- [ ] Add a `## References` section near the end of each target skill
- [ ] Format: short label + arxiv link + one-line relevance note
- [ ] Do not change skill behavior — citation only

### 8.3 Phase-8 acceptance

- [ ] All target skills retrofitted; linter green
- [ ] Total line-count increase ≤10 lines per skill

## Phase 9: AGENTS.md synthesis

> Depends on: all prior phases complete. Final deliverable — distills the
> vision into the entry point consumers actually read.

### 9.1 Update consumer-facing template

- [ ] File: `.agent-src.uncompressed/templates/AGENTS.md`
- [ ] Add a new section "What this agent does for you" that lists the 10 north-star criteria in user-facing language
- [ ] Link to this roadmap's North Star section
- [ ] Keep the template line budget ≤220 lines total

### 9.2 Update this repo's root `AGENTS.md`

- [ ] Reference this roadmap in the "Contributing" section
- [ ] Do NOT duplicate the north-star list in the package AGENTS.md — link to the template

### 9.3 Phase-9 acceptance

- [ ] Both files green on `task lint-readme`-equivalent check (or add a new linter for AGENTS.md template)
- [ ] Diff on a fresh consumer install surfaces the new section without regressions

## Cross-roadmap ties

| Dependency | Target roadmap | Nature |
|---|---|---|
| Judge-agent gate (Phase 2-3) | [`road-to-trigger-evals.md`](road-to-trigger-evals.md) Phase 2 | Judges are natural evaluators for trigger evals |
| Judge quality research | [`archive/road-to-rule-quality-research.md`](archive/road-to-rule-quality-research.md) Problem 2 (verdict: conditional go) | Judges on always-rules is the research PoC |
| Marketplace distribution of new skills | [`road-to-anthropic-alignment.md`](road-to-anthropic-alignment.md) | Every new skill must land in `.claude-plugin/marketplace.json` |
| Trim audit (optional) | `road-to-skill-catalog-trim.md` (future, Decision 2.c) | Non-blocking; opens after Phase 1 proves new skills ship clean |

## Acceptance Criteria (roadmap-level)

- [ ] All 10 north-star criteria demonstrably met on one end-to-end reference task
- [ ] `task ci` green on every phase commit
- [ ] `task lint-skills` green across all new skills
- [ ] No broken references (`task check-refs`)
- [ ] No project-specific leakage (`task check-portability`)
- [ ] Marketplace manifest updated for every new skill
- [ ] AGENTS.md template reflects the final vision

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
- Sibling roadmaps: [`road-to-anthropic-alignment.md`](road-to-anthropic-alignment.md), [`road-to-trigger-evals.md`](road-to-trigger-evals.md), [`archive/road-to-rule-quality-research.md`](archive/road-to-rule-quality-research.md), [`road-to-drafting-protocol.md`](road-to-drafting-protocol.md)
- Reference repos: `obra/superpowers`, `NeoLabHQ/context-engineering-kit`, `mhattingpete/claude-skills-marketplace`
