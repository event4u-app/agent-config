# Reference analysis: ComposioHQ/awesome-claude-skills

> An awesome-list + skill-catalog hybrid (55k ⭐). The list itself is thin; the
> **strategic value** is the external dev-methodology repos it links to —
> `obra/superpowers`, `NeoLabHQ/context-engineering-kit`, and
> `mhattingpete/claude-skills-marketplace`. Composio's own catalog is mostly
> 78 SaaS-app automations (out of scope for us) plus a few high-quality skills
> (`skill-creator`, `mcp-builder`, `webapp-testing`). The real comparison is
> against the **external** skills the list curates.

- **Source:** https://github.com/ComposioHQ/awesome-claude-skills
- **Default branch:** `master`
- **License:** Apache-2.0 (individual skills vary)
- **Description (self):** "A curated list of practical Claude Skills for
  enhancing productivity across Claude.ai, Claude Code, and the Claude API"
- **Fetched:** 2026-04-20
- **Focus:** Full comparison — includes linked repos `obra/superpowers`,
  `NeoLabHQ/context-engineering-kit`, `mhattingpete/claude-skills-marketplace`
- **Analyst:** agent via `/analyze-reference-repo`

## TL;DR

### What this repo actually is

A **curated index** ("awesome list") pointing at ~100 third-party skills, plus
Composio's own ~30-skill catalog (mostly SaaS CRUD via Rube MCP) and the
`connect-apps-plugin` for Composio's product. As a reference for our work it
is mostly a *pointer* to the real prior art:

| Source | What's there | Relevance to us |
|---|---|---|
| `obra/superpowers` | Full dev methodology (TDD, worktrees, subagents, systematic-debug, brainstorm, writing-plans) | **Very high** — this is what "agent acts like a developer" looks like |
| `NeoLabHQ/context-engineering-kit` | 13 research-backed plugins (Reflexion, SDD, SADD, FPF, LLM-as-Judge agents) | **Very high** — arxiv-cited reliability patterns |
| `mhattingpete/claude-skills-marketplace` | Engineering-workflow plugin + **code execution runtime** (90-99% token savings) | **High** — bulk-op pattern + judge-agent split |
| `ComposioHQ/awesome-claude-skills` own skills | `mcp-builder` (deeper than ours), `skill-creator` (similar to ours), `webapp-testing` | **Medium** — one pattern to absorb (mcp-builder depth) |
| 78 Rube-MCP SaaS automations | Gmail/Slack/GitHub/Notion/Jira/… CRUD wrappers | **REJECT** — wrong layer; we do dev tooling, not SaaS ops |

### Top 3 things to ADOPT

1. **TDD Iron-Law skill** — port `obra/superpowers/test-driven-development`.
   Zero overlap with our `pest-testing` (which teaches syntax, not discipline).
   Single biggest leverage point for "agent behaves like a senior developer".
2. **Subagent orchestration pattern (SADD)** — `/do-and-judge`, `/do-in-steps`,
   `/do-competitively` from NeoLab. Ours has no subagent pattern at all; the
   reliability gain (60% → 90%+ for 10-20 changed files) is documented with
   production metrics.
3. **LLM-as-Judge quality gates** — NeoLab's dedicated judge agents
   (bug-hunter, code-quality-reviewer, security-auditor, test-coverage-reviewer).
   Complements our static linters; closes the "plausible-looking slop" gap.

### Top 3 things to ADAPT

1. **Brainstorm → Plan → Implement flow** (superpowers + NeoLab/SDD). Our
   `feature-plan` command is a single step; the proven pattern is a 3-phase
   chain with judge-verification at each boundary.
2. **Reflexion / memorize loop** — NeoLab's `/reflect` + `/memorize` (arxiv
   Agentic Context Engineering, +10.6%). We have `learning-to-rule-or-skill`,
   which captures *repeatable patterns* but doesn't run *post-task reflection*.
3. **MCP-builder depth** — Composio's 4-phase (Research → Impl → Refine →
   Evaluate) with reference files and 10-question eval harness. Our `mcp`
   skill is a usage guide; it doesn't teach creation.

### Top 3 things we ALREADY do better

1. **Multi-tool projection** — 6 tools (Augment, Claude, Cursor, Cline,
   Windsurf, Gemini); superpowers ships 7, but most link-list skills support
   only one. NeoLab supports 4 via `vercel-labs/skills`.
2. **Authoring pipeline** — `.agent-src.uncompressed/` → `.agent-src/` →
   tool projections. None of the references have a compression layer or
   portability linter.
3. **Governance tooling** — `rule-type-governance`, `skill-quality`,
   `size-enforcement`, `check-portability`, `check-references`, 324+ tests.
   Reference side has *none* of this (superpowers has its own linter but no
   size budgets; NeoLab has no linter).

## Comparison matrix

Legend: **ref** columns are the strongest match across the three main external
sources (`sp` = superpowers, `ne` = NeoLab, `mh` = mhattingpete-marketplace,
`co` = Composio own catalog).

| Axis | Best reference | This repo | Label | Notes |
|---|---|---|---|---|
| **TDD discipline** | `sp/test-driven-development` — Iron Law, RED-GREEN-REFACTOR, 12 rationalization rebuttals, verification checklist | `pest-testing` teaches Pest syntax; `verify-before-complete` rule requires evidence but no red-first | **ADOPT** | New skill `test-driven-development` — port the Iron Law verbatim, pair with `verify-before-complete` rule. |
| **Systematic debugging** | `sp/systematic-debugging` — 4-phase root-cause, defense-in-depth, condition-based-waiting | `php-debugging` is tool-specific (Xdebug) | **ADOPT** | New skill `systematic-debugging` — language-agnostic root-cause process. |
| **Subagent orchestration** | `ne/sadd` — `/do-and-judge`, `/do-in-steps`, `/do-in-parallel`, `/do-competitively`, `/judge-with-debate` | **none** | **ADOPT** | New skills + commands. Biggest gap relative to autonomous-agent goal. |
| **LLM-as-Judge agents** | `ne/code-review` — bug-hunter, code-quality-reviewer, contracts-reviewer, security-auditor, test-coverage-reviewer | Our `review-changes` (command-level) uses one pass, no specialized judges | **ADOPT** | Add judge-agent variants invoked from review-changes. |
| **Planning discipline** | `sp/brainstorming` + `sp/writing-plans` + `ne/sdd/plan` (arc42-based, judge-verified) | `feature-plan` (single command), `technical-specification` skill | **ADAPT** | Extend `feature-plan` → brainstorm → plan (with judge) → implement. |
| **Reflexion/memorize** | `ne/reflexion` — `/reflect` + `/memorize` (Self-Refine +8-21%, ACE +10.6%) | `learning-to-rule-or-skill` captures patterns; no post-task reflect loop | **ADAPT** | New command `/reflect` (post-task), keep memorize in the existing skill. |
| **Git worktrees** | `sp/using-git-worktrees` + `ne/git/create-worktree` | **none** | **ADOPT** | New skill `using-git-worktrees` — parallel-work isolation. |
| **Verification gate** | `sp/verification-before-completion` (always-on skill) | `verify-before-complete` (rule, always) | **ALREADY** | Rule is equivalent; no change. Consider a companion *skill* that provides the checklist body. |
| **MCP-builder depth** | `co/mcp-builder` — 4 phases, reference files, eval harness, language guides | `mcp` skill covers usage, not creation | **ADAPT** | Extend `mcp` skill or split into `mcp-usage` + new `mcp-builder`. |
| **Code execution runtime** | `mh/execution-runtime` — FastMCP server, Python bulk-ops, 90-99% token savings | **none** | **UNCLEAR** | Depends on PHP-vs-Python shop; see Open Question 1. |
| **Feature-planning pattern** | `mh/feature-planning` + `mh/plan-implementer` (Haiku agent) | `feature-plan` command | **ADAPT** | Pair with subagent pattern (ADOPT #3). |
| **Marketplace distribution** | `sp` via `claude-plugins-official` + own marketplace; `ne` via own marketplace; `mh` via own | Our `.claude-plugin/marketplace.json` shipped Phase 1 (ec79750) | **ALREADY** | We match. Next step is Phase 2 (Pushy Descriptions). |
| **Research citations** | `ne` cites 13 arxiv papers (Self-Refine, Reflexion, ToT, CoV, MAKER, ACE, LLM-as-Judge…) | Our `road-to-rule-quality-research.md` cites none yet | **ADAPT** | Add a Resources section per-skill where the pattern has a paper. |
| **Skill counts (dev-pattern)** | `sp`: 14 focused; `ne`: ~60 across 13 plugins; `mh`: ~20 | 98 skills (but framework-heavy: Laravel/PHP/Flux…) | **UNCLEAR** | See Open Question 2 (breadth vs. depth). |
| **SaaS-app automations** | `co`: 78 Rube-MCP automations | **none** | **REJECT** | Wrong layer — we do developer tooling, not SaaS CRUD. |
| **HTML visualization skills** | `mh/visual-documentation-plugin` — architecture diagrams, dashboards, timelines | `fe-design` (framework-agnostic) | **REJECT** | Not aligned with code-focused agent goal. |
| **Auto-generated API wrappers** | `co` generates ~hundreds of skills from Composio API | **none** | **REJECT** | Not our business model. |
| **`connect-apps-plugin`** | `co` Composio-specific auth plugin | **none** | **REJECT** | Vendor lock-in; we stay tool-agnostic. |
| **`skill-creator`** | `co` single-file guide with imperative-voice, progressive disclosure, `init_skill.py` + `package_skill.py` | `skill-writing` + `skill-quality` rule + linter | **ALREADY** | Ours is equivalent or stronger (has linter + quality gates). |
| **Skill invocation model** | `sp`: auto-trigger via description matching; `ne`: same | Same | **ALREADY** | Agent Skills standard alignment confirmed. |

## Findings

### ADOPT — 7 items

1. **New skill `test-driven-development`** — port `obra/superpowers` TDD
   guide. Verbatim: Iron Law, RED-GREEN-REFACTOR, anti-rationalization table,
   delete pre-test code rule. Adapt examples to PHP/Pest + JS/Vitest.
   Source: https://github.com/obra/superpowers/blob/main/skills/test-driven-development/SKILL.md
2. **New skill `systematic-debugging`** — port `obra/superpowers` debugging
   guide. 4-phase root-cause, decoupled from language. Complements existing
   `php-debugging`. Source:
   https://github.com/obra/superpowers/tree/main/skills/systematic-debugging
3. **New skill `subagent-orchestration` + 3–5 companion commands** — port
   the SADD pattern. Minimum viable set: `/do-and-judge`, `/do-in-steps`,
   `/judge`. Source:
   https://github.com/NeoLabHQ/context-engineering-kit/tree/master/plugins/sadd
4. **Judge-agent variants for review-changes** — add bug-hunter,
   security-auditor, test-coverage-reviewer as distinct roles (frontmatter +
   system prompt). Source:
   https://github.com/NeoLabHQ/context-engineering-kit/tree/master/plugins/code-review
5. **New skill `using-git-worktrees`** — port superpowers guide. Enables
   parallel-work isolation for long-running tasks. Source:
   https://github.com/obra/superpowers/tree/main/skills/using-git-worktrees
6. **New skill `mcp-builder`** — split our current `mcp` skill. New one
   covers creation (4-phase + eval harness). Source:
   https://github.com/ComposioHQ/awesome-claude-skills/tree/master/mcp-builder
7. **Companion always-on skill for `verify-before-complete`** — rule states
   the law; skill holds the checklist + per-task-type evidence table.
   Source: https://github.com/obra/superpowers/tree/main/skills/verification-before-completion

### ADAPT — 4 items

1. **Extend `feature-plan` to `brainstorm → plan → implement`** — three
   commands, each with a judge gate. Model on `ne/sdd`. Preserve our
   `agents/features/` directory convention.
2. **Add `/reflect` command** — post-task reflection hook. Keep memorization
   in existing `learning-to-rule-or-skill`. Model on
   `ne/reflexion/reflect` + `ne/reflexion/memorize`.
3. **Cite papers in skills that implement research patterns** — add
   `## References` section with arxiv links to TDD, SADD, Reflexion skills.
   Low cost, high credibility.
4. **Project-local agent-settings for subagent model choice** — add
   `subagent_implementer_model` and `subagent_judge_model` keys (default
   Haiku for implementer, Sonnet for judge — per `mh/plan-implementer`).

### REJECT — 4 items

1. **Composio Rube-MCP SaaS automations (78 skills)** — wrong layer; we ship
   developer tooling for code projects, not SaaS CRUD helpers.
2. **`connect-apps-plugin`** — Composio-vendor-specific auth glue.
3. **HTML visualization skills** (`mh/visual-documentation-plugin`) — not
   aligned with code-focused agents; users have better tools (Figma, Miro,
   Mermaid already in our stack).
4. **Auto-generated API-wrapper skills** — the Composio pattern generates
   hundreds of low-quality CRUD skills; conflicts with `skill-quality` rule.

### ALREADY — 6 items

1. **Claude Code marketplace manifest** — shipped Phase 1 (commit ec79750).
2. **Auto-trigger invocation model** — our skills use description-based
   matching like superpowers/NeoLab.
3. **Skill-creator equivalent** — `skill-writing` + `skill-quality` rule +
   `scripts/skill_linter.py` (stronger than Composio's `skill-creator`).
4. **Progressive disclosure** — our compression layer + `.agent-src/` vs
   `.agent-src.uncompressed/` already implements the three-level loading
   Composio describes.
5. **Compression pipeline** — no reference has anything equivalent.
6. **Portability governance** — `check-portability.py` + rules enforce
   project-agnosticism; no reference has this.

### UNCLEAR → RESOLVED

1. **Code execution runtime (`mh/execution-runtime`)** — **Decision 1.a**:
   spike a Node/TS port as a one-day investigation inside the
   autonomous-agent roadmap (Phase 0 exploration). Decide adopt/drop
   after the eval. Python-as-is rejected for our PHP/TS consumer stacks.
2. **Breadth vs. depth of framework-specific skills** — **Decision 2.c**:
   hybrid. Add universal developer-discipline skills in this roadmap;
   park a separate, **optional** follow-up roadmap for trimming the
   framework-specific catalog. Trim is not a blocker for autonomy.

## Proposed roadmap items

New roadmap: **road-to-autonomous-agent.md** in agents/roadmaps/ (to be
drafted after this analysis is reviewed, per Option 3.i chosen by
maintainer).

Phases as decided with maintainer:

| Phase | Name | Scope | Source findings |
|---|---|---|---|
| 0 | Exec-runtime spike | One-day Node/TS port eval; go/no-go gate | UNCLEAR #1 → 1.a |
| 1 | Developer-discipline core | new skills: `test-driven-development`, `systematic-debugging`, `verification-before-completion` (companion to existing rule) | ADOPT #1, #2, #7 |
| 2 | Subagent orchestration | new skill `subagent-orchestration` + `/do-and-judge`, `/do-in-steps`, `/judge` commands + `.agent-settings` keys for model choice (3.d) | ADOPT #3; ADAPT #4 |
| 3 | Specialized judge agents | Split `review-changes` into bug-hunter / security-auditor / test-coverage roles | ADOPT #4 |
| 4 | Planning chain | `/brainstorm`, `/plan`, `/implement` trio with judge gates | ADAPT #1 |
| 5 | Reflection loop | `/reflect` post-task command wired to `learning-to-rule-or-skill` | ADAPT #2 |
| 6 | Parallel-work tooling | new skill `using-git-worktrees` | ADOPT #5 |
| 7 | MCP creation | Split `mcp` skill; add `mcp-builder` with eval harness | ADOPT #6 |
| 8 | Selective citation retrofit | Add `## References` to ~5-10 skills matching published patterns (e.g. `analysis-autonomous-mode`, `review-changes`, `bug-analyzer`) + new skills from Phases 1-7 | ADAPT #3 → 4.c |
| 9 | AGENTS.md synthesis | Distill the autonomous-agent vision into AGENTS.md as the final deliverable | 5.a |

Out of the linear roadmap but linked: **optional** separate roadmap
`road-to-skill-catalog-trim.md` (Decision 2.c) — non-blocking audit of
framework-specific skills for consolidation.

Cross-roadmap ties:

| Source finding | Also lands in | Why |
|---|---|---|
| Judge-agent gate in ADOPT #4 | `road-to-trigger-evals.md` Phase 2 | Judges are natural candidates for rule compliance evals (Problem 2 in `road-to-rule-quality-research.md`). |
| Reflection loop (ADAPT #2) | Existing `skill-improvement-pipeline` skill | `/reflect` → pipeline trigger; close the loop. |

## Maintainer decisions (recorded 2026-04-20)

| # | Topic | Decision | Implication for roadmap |
|---|---|---|---|
| 1 | Execution runtime | **1.a** — spike a Node/TS port, decide after eval | Phase 0 spike; no production commitment yet |
| 2 | Breadth vs. depth | **2.c** — hybrid, universal skills now + **optional** trim roadmap later | Trim audit is a separate, non-blocking roadmap |
| 3 | Judge model pairing | **3.d** — configurable per-project in `.agent-settings`; default one tier up | New settings keys `subagent_implementer_model`, `subagent_judge_model` |
| 4 | Citations scope | **4.c** — selective retrofit of existing skills that match published patterns | ~5-10 skills affected (e.g. `analysis-autonomous-mode`, `review-changes`, `bug-analyzer`) |
| 5 | AGENTS.md synthesis | **5.a** — roadmap first, AGENTS.md second | Roadmap delivers raw material; AGENTS.md distills vision in final phase |
| 6 | Attribution for Phase-1 ports | **6.a** (2026-04-21) — inspired by, not ported from. Write fresh in event4u voice, no verbatim copy from obra/superpowers, no `## References` section, no THIRD-PARTY file. Industry-standard concepts (TDD, root-cause debugging) are not copyrightable | Roadmap Phase 1.1-1.3 rewritten accordingly; `obra/superpowers` reviewed as inspiration only (MIT, checked 2026-04-21) |

## References

- Primary source:
  https://github.com/ComposioHQ/awesome-claude-skills
- External repos feeding this analysis:
  - https://github.com/obra/superpowers — TDD, debugging, plans, worktrees
  - https://github.com/NeoLabHQ/context-engineering-kit — SADD, SDD,
    Reflexion, FPF, judge agents, DDD
  - https://github.com/mhattingpete/claude-skills-marketplace —
    engineering-workflow plugin, code-execution runtime, plan-implementer
    agent
- Composio own catalog highlights:
  - `mcp-builder` —
    https://github.com/ComposioHQ/awesome-claude-skills/tree/master/mcp-builder
  - `skill-creator` —
    https://github.com/ComposioHQ/awesome-claude-skills/tree/master/skill-creator
  - `webapp-testing` —
    https://github.com/ComposioHQ/awesome-claude-skills/tree/master/webapp-testing
- Sibling analysis:
  [`compare-anthropics-skills.md`](compare-anthropics-skills.md),
  [`compare-kdcllc-agents-config.md`](compare-kdcllc-agents-config.md)
- Related roadmaps:
  [`archive/road-to-anthropic-alignment.md`](../roadmaps/archive/road-to-anthropic-alignment.md),
  [`archive/road-to-rule-quality-research.md`](../roadmaps/archive/road-to-rule-quality-research.md),
  [`archive/road-to-trigger-evals.md`](../roadmaps/archive/road-to-trigger-evals.md)
- Command that produced this document:
  [`.agent-src.uncompressed/commands/analyze-reference-repo.md`](../../.agent-src.uncompressed/commands/analyze-reference-repo.md)
