# Reference analysis: obra/superpowers

> Jesse Vincent's MIT-licensed agentic-development methodology, distributed
> as a multi-harness plugin (Claude Code, Codex CLI/App, Cursor, Gemini CLI,
> OpenCode, Copilot CLI, Factory Droid). 14 skills, 4 hooks, 2 helper scripts,
> 440 commits, v5.1.0 (May 2026). The strategic value for our suite is
> **workflow-chain discipline** — a tightly-bound brainstorm → plan → subagent
> → TDD → review → finish loop, plus subagent-prompt externalization that
> our `subagent-orchestration` skill currently inlines.

- **Source:** https://github.com/obra/superpowers
- **Default branch:** `main` (commit-pinned at adoption time)
- **License:** MIT (compatible with our MIT)
- **Stars / forks:** 181k / 16k (fetched 2026-05-06)
- **Created:** ~2025 · **Last release:** v5.1.0, 2026-05-04
- **Languages:** Shell 66.4%, JavaScript 24.8%, HTML 3.3%, Python 2.8%
- **Skill count:** 14 (much smaller than our 136)
- **Hooks:** session-start, hooks.json, hooks-cursor.json, run-hook.cmd
- **Maintainer:** Jesse Vincent + Prime Radiant
- **Fetched:** 2026-05-06 (web + GitHub API)

## TL;DR

### What Superpowers actually is

A **methodology**, not a catalog. The 14 skills implement one mandatory
chain: `brainstorming → using-git-worktrees → writing-plans →
subagent-driven-development | executing-plans → test-driven-development →
requesting-code-review → finishing-a-development-branch`. Each skill
hands off explicitly to the next via `REQUIRED SUB-SKILL` directives.
The framework is opinionated about *how to build software with an
agent*, not about which language or framework to target.

The differentiator vs. our suite: **chain enforcement**. Our skills are
addressable individually (router-driven, intent-keyed); their skills
are addressable only through the chain. A user who just says "fix this
bug" gets pulled through brainstorm → plan → subagent → TDD before any
production code is touched.

### Top 5 things to ADOPT

1. **TDD delete-and-restart Iron Law.** Their `test-driven-development`
   has *"Write code before the test? Delete it. Start over."* as a
   hard rule, plus an extensive anti-rationalization table covering 12
   excuses (vs. our 8). The "keep as reference" trap and the
   sunk-cost-fallacy framing are sharper than our current text.
   Citation: [`skills/test-driven-development/SKILL.md`](https://github.com/obra/superpowers/blob/main/skills/test-driven-development/SKILL.md).
   **Net add:** strengthen our `test-driven-development/SKILL.md`
   anti-rationalizations table + add explicit "Red Flags — STOP and
   Start Over" section.

2. **Subagent prompt externalization.** Their
   `subagent-driven-development` ships three sibling prompt files —
   `implementer-prompt.md`, `spec-reviewer-prompt.md`,
   `code-quality-reviewer-prompt.md` — that the controller dispatches
   verbatim. Our `subagent-orchestration` inlines these prompts in the
   procedure section, which makes them harder to reuse and harder for
   a judge to audit. **Net add:** extract our six-mode subagent prompts
   into sibling .md files under `subagent-orchestration/prompts/`.

3. **Two-stage review (spec then quality).** After the implementer
   subagent finishes, two *separate* reviewer subagents run: first a
   **spec-compliance reviewer** (does the diff match the task spec, no
   under/over-build), then a **code-quality reviewer** (naming, DRY,
   single-responsibility). Our `do-and-judge` mode collapses these into
   one judge. The split makes "approved with quality issues" a real
   intermediate state. **Net add:** add a `do-and-judge-two-stage` mode
   to `subagent-orchestration` (or split the existing mode).

4. **DONE / DONE_WITH_CONCERNS / NEEDS_CONTEXT / BLOCKED status
   taxonomy.** Implementer subagents report one of four statuses, each
   with a defined controller response. Our subagents return free-form
   text. **Net add:** codify the four-status taxonomy in
   `subagent-orchestration` and update the implementer prompt template
   to require it.

5. **Bite-sized 2–5-minute task granularity in plans.** Their
   `writing-plans` mandates that each task step is one action (write
   the failing test · run it to confirm fail · implement · run again ·
   commit), each with **exact file paths, complete code, exact
   commands, expected output**. Their "No Placeholders" section
   forbids "TBD", "implement later", "similar to Task N". Our
   `feature-planning` skill is structural — feature plan + roadmap —
   without this granularity discipline. **Net add:** adopt the
   bite-sized task structure in our `writing-plans`-equivalent
   (likely a new skill `writing-implementation-plans` or extension to
   `feature-planning`).

### Top 3 things to DROP / not adopt

1. **The chain-enforcement model itself.** Their HARD-GATE
   ("Do NOT invoke any implementation skill … until the user has
   approved a design") would be a regression for us. Our work-engine
   is confidence-band-gated, not user-confirmation-gated; that lets
   trivial changes bypass the brainstorm/plan ceremony. Keep our
   gating, harvest the discipline.

2. **Plugin marketplace + sponsorship + Discord wiring.** Out of scope
   for an MIT skill suite. Our distribution is Composer + npm +
   `task generate-tools`; harvesting their marketplace plumbing would
   be wasted effort.

3. **Their `using-superpowers` and `writing-skills` meta-skills.** We
   already have `skill-writing`, `skill-quality` rule, `lint-skills`
   and `skill-management`. Their meta-skills are upstream-equivalents
   of what we already ship, with less governance.

### Skill-by-skill cross-check (14 ↔ event4u/agent-config)

| Superpowers skill | Our equivalent | Verdict |
|---|---|---|
| `brainstorming` | `feature-planning` + `improve-before-implement` rule | partial overlap; harvest their HARD-GATE wording, drop the marketplace ceremony |
| `using-git-worktrees` | `using-git-worktrees` | exact match; no action |
| `writing-plans` | `feature-planning` (structural) | gap: adopt bite-sized 2-5 min task granularity |
| `executing-plans` | (none — `/work` engine inline) | partial: our engine is opt-in autonomous; their batched-with-checkpoints flow is different shape, defer |
| `dispatching-parallel-agents` | `subagent-orchestration § do-in-parallel` | exact match; no action |
| `subagent-driven-development` | `subagent-orchestration § do-and-judge` | gap: extract prompts + add two-stage review |
| `test-driven-development` | `test-driven-development` | gap: harden anti-rationalization + delete-and-restart rule |
| `systematic-debugging` | `systematic-debugging` | exact match; minor wording differences |
| `verification-before-completion` | `verify-before-complete` rule + `verify-completion-evidence` skill | exact match; no action |
| `requesting-code-review` | `requesting-code-review` | exact match; no action |
| `receiving-code-review` | `receiving-code-review` | exact match; no action |
| `finishing-a-development-branch` | `finishing-a-development-branch` | exact match; no action |
| `writing-skills` | `skill-writing` + `skill-quality` rule | we are upstream-stronger; drop |
| `using-superpowers` | (n/a — meta-onboarding) | drop; covered by our `/onboard` |

## Adoption candidates (ICE-scored)

ICE = Impact (1-10) × Confidence (1-10) ÷ Effort (1-10). Higher = better.

| # | Adoption | Impact | Confidence | Effort | ICE |
|---|---|---|---|---|---|
| A | TDD delete-and-restart + anti-rationalization hardening | 8 | 9 | 1 | **72** |
| B | Subagent prompt externalization (6 mode prompts → sibling .md) | 7 | 9 | 3 | **21** |
| C | Two-stage review mode in `subagent-orchestration` | 6 | 7 | 3 | **14** |
| D | Status taxonomy (DONE / DONE_WITH_CONCERNS / NEEDS_CONTEXT / BLOCKED) | 7 | 8 | 2 | **28** |
| E | Bite-sized 2-5 min task granularity in plans | 8 | 8 | 4 | **16** |
| F | HARD-GATE wording in brainstorming/feature-planning | 5 | 6 | 1 | **30** |
| G | Spec-self-review pattern (placeholder/contradiction/scope/ambiguity) | 6 | 7 | 1 | **42** |

**ICE ranking:** A (72) > G (42) > F (30) > D (28) > B (21) > E (16) > C (14).

## Open questions for council

1. **Plate cap.** We cap harvests at 5 adoptions per six-week plate
   (per `road-to-microck-harvest.md`). Above ICE list has 7 candidates
   above threshold. Which 5 ship first? Sonnet vs. GPT-4o split likely.
2. **TDD scope creep.** Our existing TDD skill is 255 lines. Adding
   their full anti-rationalization corpus risks pushing it over the
   400-line sunset trigger. Externalize their anti-pattern list as a
   sibling reference doc, like Microck did with `testing-anti-patterns`?
3. **Subagent prompt format.** Adopt their three-prompt split exactly
   (implementer / spec-reviewer / quality-reviewer), or keep our
   six-mode taxonomy and just externalize each mode's prompt?
4. **HARD-GATE compatibility.** Does the HARD-GATE wording conflict
   with our autonomous-execution rule's trivial-action allowance? Need
   to scope it to "non-trivial implementation" only, otherwise it
   contradicts the work-engine confidence-band gating.

## Council framing

Two-AI debate (anthropic/claude-sonnet-4-5 + openai/gpt-4o), 1 round,
`council_depth: standard` (this is a harvest decision, not architecture
that mutates the kernel — Sonnet's depth-tier mapping puts harvest
roadmaps below the bug-diagnosis / architecture-refactor threshold).

Question to the panel:

> Given the ICE ranking above and our 5-adoption hard-cap per plate,
> which 5 candidates ship in Phase 1? For each, surface one risk we
> haven't named. For the 2 that drop out: argue Phase 2 vs. defer-
> indefinitely. Cite the specific Superpowers file path or our skill
> path you would touch.
