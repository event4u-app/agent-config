# Reference analysis: anthropics/skills

> Anthropic's own skills repository — the canonical reference implementation
> of the `agentskills.io` standard and the source of every skills pattern we
> inherit. What's in here that we don't already have?

- **Source:** https://github.com/anthropics/skills
- **Fetched commit:** `main` @ 2026-04-20 (repo last updated 2026-04-20T07:23:57Z)
- **Focus:** full
- **Analyst:** agent via `/analyze-reference-repo`

## TL;DR

**Top 3 to ADOPT / ADAPT:**

1. **Claude Code Plugin Marketplace** — add `.claude-plugin/marketplace.json`
   so Claude Code users can pull our skills via `/plugin marketplace add
   event4u/agent-config`. New distribution channel, trivial cost.
2. **"Pushy description" triggering pattern** — `skill-creator` SKILL.md
   makes explicit that Claude undertriggers polite descriptions. Actionable
   rewrite across our existing skills.
3. **Skill trigger eval loop (lean adaptation)** — the idea from `skill-creator`'s
   description-optimization: run N prompts, measure trigger rate, iterate the
   description. Our 95+ skills have zero empirical trigger data today.

**Top 3 to REJECT:**

1. `.skill` file packaging — no audience signal for single-skill distribution.
2. HTML eval viewer (`generate_review.py`) — too much UI for a package like ours.
3. Subagent-orchestrated parallel test runs — Claude Code infrastructure specific,
   not portable to our CI.

**Top 3 we ALREADY do (often better):**

1. Progressive disclosure with `scripts/` / `references/` / `assets/` — exact same
   shape, already enforced by our `skill-quality` rule.
2. Size budget <500 lines — we already have `size-enforcement` rule with finer
   budgets per artifact type.
3. Domain-organized skills (`references/aws.md`, `references/gcp.md`) — we do this
   in `laravel-*`, `project-analysis-*`, and the framework-specific analysis skills.

## Comparison matrix

| Axis | anthropics/skills | event4u/agent-config | Label | Notes |
|---|---|---|---|---|
| Distribution | Claude Code Plugin Marketplace (`marketplace.json`) + individual skill `.skill` bundles | Composer + npm package per consumer project, `task generate-tools` projects to `.claude/.cursor/.clinerules/.windsurfrules` | **ADOPT (partial)** | Add marketplace.json. `.skill` bundles REJECT — no signal. |
| Scope | Skill content only. No rules, no commands, no guidelines. | Skills + rules + commands + guidelines + templates + contexts. | ALREADY better | Reference is narrow-purpose by design. |
| Skill model | `SKILL.md` with `name` + `description` frontmatter. `<500 lines` body. Optional `scripts/`, `references/`, `assets/`. | Same structure. Stricter governance (size-enforcement rule, skill-quality rule, linter). | ALREADY | We codify what they only suggest. |
| Rule model | **No rules.** Repo only ships skills. | 31 rules with trigger descriptions, governance, portability linter. | ALREADY | Different product. |
| Installer | None. Skills installed via Claude Code `/plugin install`, Claude.ai UI, or API. | `scripts/install.sh` + Python bridge, idempotent, per-project. | ALREADY | Different distribution model. |
| Multi-tool | Claude Code + Claude.ai + Claude API only. | Six tools (Augment, Claude Code, Cursor, Cline, Windsurf, Gemini CLI) via symlinks/concatenation. | ALREADY better | Broader reach. |
| MCP | `skills/mcp-builder` (a skill for building MCP servers). No config generation. | `skills/mcp` skill + shipped `mcp.json` generator (see `archive/road-to-mcp.md`). | DONE | Complementary angle. |
| Governance | No linters. Disclaimer: "demonstration and educational purposes only." | `skill_linter.py`, `check_portability.py`, `check_references.py`, `readme_linter.py`, 324 pytest tests, task ci pipeline. | ALREADY much better | We take quality seriously. |
| External sources | N/A | N/A (both out of scope) | ALREADY | Matched decision. |
| CI | Nothing visible in the listing. | GitHub Actions with sync-check, consistency, check-portability, lint-skills, pytest, lint-readme. | ALREADY | We have a real pipeline. |
| Docs | README + spec/ (points to agentskills.io) + template/ (4-line SKILL.md). | README + CONTRIBUTING + AGENTS.md + docs/architecture.md + docs/development.md + docs/observability.md + skills-catalog + llms.txt + per-skill SKILL.md. | ALREADY better | Multi-layered. |
| **Eval / benchmark** | **`skill-creator` with full eval loop: test cases, baseline vs with-skill runs, assertion grading, description optimization via Claude API, benchmark viewer HTML.** | **None.** Skills trust human intuition for triggers. | **ADAPT (lean)** | Highest-value new pattern. |
| Triggering pattern | "Pushy description" explicit in skill-creator: avoid undertriggering by being explicit about when to trigger. | Some of our skills are pushy, many aren't. No guideline documents this. | **ADOPT as rule update** | Small effort, broad impact. |
| Template | 4-line minimal template. | More structured template with conventions baked in. | ALREADY | Ours is more actionable. |
| Community | Apache 2.0 (most) + source-available (docx/pdf/pptx/xlsx). Anthropic-maintained, not community-driven. | MIT. Private organization but portable package. | ALREADY | Different model. |

## Findings

### ADOPT

**1. Claude Code Plugin Marketplace (`marketplace.json`)**

Source: https://github.com/anthropics/skills/blob/main/.claude-plugin/marketplace.json

The repo ships a single JSON file that makes it a subscribable marketplace for
Claude Code. Users run `/plugin marketplace add anthropics/skills` and can then
install curated plugin bundles (`document-skills`, `example-skills`, `claude-api`).
Each bundle groups related skills under one installable unit.

Shape:

```json
{
  "name": "<marketplace-name>",
  "owner": { "name": "...", "email": "..." },
  "metadata": { "description": "...", "version": "..." },
  "plugins": [
    {
      "name": "<plugin-name>",
      "description": "...",
      "source": "./",
      "strict": false,
      "skills": ["./skills/name1", "./skills/name2"]
    }
  ]
}
```

For us: our skills live at `.agent-src/skills/<name>/`. A marketplace file
pointing to `./.agent-src/skills/<name>` should work. Value: a new distribution
channel for Claude Code users who want our agent-infrastructure skills
(skill-writing, skill-reviewer, etc.) without cloning the package into a
project. Cost: one JSON file, one CI validation task, one README paragraph.

**2. "Pushy description" triggering pattern**

Source: skill-creator SKILL.md, section "Write the SKILL.md":
> "Claude has a tendency to 'undertrigger' skills — to not use them when they'd be
> useful. To combat this, please make the skill descriptions a little bit 'pushy'.
> So for instance, instead of 'How to build a simple fast dashboard...', you might
> write 'How to build a simple fast dashboard... **Make sure to use this skill
> whenever the user mentions dashboards, data visualization, internal metrics, or
> wants to display any kind of company data, even if they don't explicitly ask for
> a dashboard.**'"

For us: a significant portion of our skill descriptions is terse. Updating the
`skill-quality` rule with this pattern and auditing ~15 of our worst-performing
(terse, polite) descriptions is a small effort with broad activation impact
across Claude Code sessions.

### ADAPT

**3. Skill trigger eval system**

Source: skill-creator SKILL.md, section "Description Optimization":
> "Create 20 eval queries — a mix of should-trigger and should-not-trigger...
> `python -m scripts.run_loop --eval-set ... --skill-path ... --max-iterations 5`...
> splits the eval set into 60% train and 40% held-out test, evaluates the current
> description (running each query 3 times to get a reliable trigger rate)..."

For us: we have 95+ skills whose descriptions are crafted by hand. Trigger
accuracy is assumed, never measured. A lean adaptation (no HTML viewer, no
subagents, just a Python script that calls Claude API with each query and checks
whether the skill appears in the chosen path) would:

- Catch undertriggering and overtriggering empirically
- Provide a quality gate for new skills
- Make our "skill-quality" rule enforceable in CI

Not a small effort (~300-500 LoC + Claude API budget), but genuinely differentiating.
REJECTED elements of their workflow: the HTML viewer (CLI JSON report suffices),
subagent orchestration (not portable), packaging (`.skill` files).

### REJECT

**4. `.skill` file packaging (`package_skill.py`)**

Source: skill-creator SKILL.md, section "Package and Present".

Packages a single skill directory into a `.skill` archive for individual
distribution. Our skills ship as part of the event4u/agent-config package and
don't need to be distributable as standalone archives. No demand signal.

**5. Subagent-based eval orchestration**

Source: skill-creator SKILL.md, section "Running and evaluating test cases".

Spawns Claude Code subagents in parallel for with-skill vs baseline runs.
Specific to Claude Code's runtime. Not applicable to our CI (we have no
subagents, and if we did, baseline-vs-skill A/B is a luxury we don't need
for triggering evals — trigger rate is a single-call measurement).

**6. Full HTML eval viewer**

Source: skill-creator `eval-viewer/generate_review.py` referenced throughout.

Renders outputs + benchmark + feedback collection as HTML. Worthwhile for their
creative skills (docx, pptx outputs need visual inspection). Our skills produce
code and text. CLI output is sufficient.

**7. Blind comparison system**

Source: skill-creator SKILL.md, section "Advanced: Blind comparison".

Rigorous A/B between two skill versions via an independent judge agent.
Overkill for our scale — we iterate on skill content through human review,
not automated arbitration.

**Revised 2026-04-20: the interactive drafting front-end (originally lumped
into this REJECT section) was reclassified to ADAPT.** See
[`road-to-drafting-protocol.md`](../roadmaps/road-to-drafting-protocol.md).
The valuable part is **Understand / Research / Draft** with numbered-option
prompts at every step — agent proposes, human decides. The part that stays
REJECT is the Claude→Claude auto-rewrite loop (`run_loop.py`), the blind
judge agent, and `.skill` packaging. Distinguishing the two is the whole point.

### ALREADY

- **Progressive disclosure with three levels** (metadata → body → bundled). Our
  skill-quality rule codifies this. Same `scripts/` / `references/` / `assets/`
  directories, same semantics.
- **<500 lines per SKILL.md**. Our `size-enforcement` rule has finer-grained
  budgets per artifact type (skills, rules, commands, guidelines).
- **Domain-organized skills** (`references/aws.md`, `references/gcp.md`). We do
  this in `laravel-*` (horizon, pulse, reverb, pennant, middleware, notifications,
  scheduling, validation, mail), `project-analysis-*` (laravel, symfony, nextjs,
  react, node-express, zend-laminas), and more.
- **Anatomy of a Skill** diagram. Standard structure, already followed.
- **`## Related Skills` composition pattern**. We use `## Related` with the same
  semantics; see any of our SKILL.md files.
- **Skills spec alignment**. Their `spec/agent-skills-spec.md` points to
  agentskills.io — so does the standard we follow.

### UNCLEAR

- **Model-ID-aware description optimization.** Their `run_loop.py` takes
  `--model <id>` so the trigger test uses the exact model powering the session.
  Interesting nuance: if we build a trigger eval, matching the target model
  matters. Defer this decision until the PoC in `road-to-trigger-evals.md`.

## Proposed roadmap items

Three roadmaps, split by scope:

- **[`agents/roadmaps/road-to-anthropic-alignment.md`](../roadmaps/road-to-anthropic-alignment.md)**
  — Phase 1 (Claude Code Plugin Marketplace, v1.7.0) + Phase 2 ("pushy
  description" pattern in `skill-quality` rule, v1.7.1).
- **[`agents/roadmaps/road-to-trigger-evals.md`](../roadmaps/road-to-trigger-evals.md)**
  — empirical trigger measurement (v1.8.0, gated PoC → bounded rollout).
- **[`agents/roadmaps/road-to-drafting-protocol.md`](../roadmaps/road-to-drafting-protocol.md)**
  — Understand → Research → Draft protocol for skill/rule/command/guideline
  creation (v1.8.0 rule + v1.8.1 writing skills). Agent proposes, human decides.

## Open questions for the maintainer

1. Do we want a Claude Code marketplace presence, or is our consumer audience
   exclusively project-installers? (If yes → Phase 1.)
2. Will we commit Claude API credits for running trigger evals in CI, or
   local-only? (Affects Phase 3 scope.)
3. Which initial plugin bundle for the marketplace? Proposal:
   `agent-infrastructure` (skill-writing, skill-reviewer, agent-docs-writing,
   learning-to-rule-or-skill, override-management, analysis-skill-router).
   One bundle, not five — stay minimal until demand signals otherwise.

## Appendix: fetch log

11 fetches total (cap: 40).

1. `/repos/anthropics/skills` (metadata)
2. `/repos/anthropics/skills/contents` (top-level listing)
3. `README.md`
4. `/repos/anthropics/skills/contents/.claude-plugin`
5. `/repos/anthropics/skills/contents/spec`
6. `/repos/anthropics/skills/contents/template`
7. `/repos/anthropics/skills/contents/skills` (skill bundle listing)
8. `.claude-plugin/marketplace.json`
9. `spec/agent-skills-spec.md` (1-line redirect to agentskills.io)
10. `template/SKILL.md` (4-line minimal template)
11. `skills/skill-creator/SKILL.md` (the eval-driven meta-skill)

No clone, no execute, no credentials used.

## Related

- Command that produced this document:
  [`.agent-src.uncompressed/commands/analyze-reference-repo.md`](../../.agent-src.uncompressed/commands/analyze-reference-repo.md)
- Active roadmaps: [`road-to-anthropic-alignment.md`](../roadmaps/road-to-anthropic-alignment.md),
  [`road-to-trigger-evals.md`](../roadmaps/road-to-trigger-evals.md),
  [`road-to-drafting-protocol.md`](../roadmaps/road-to-drafting-protocol.md).
- Archived roadmaps:
  [`archive/road-to-9.md`](../roadmaps/archive/road-to-9.md),
  [`archive/road-to-mcp.md`](../roadmaps/archive/road-to-mcp.md).
- Previous analyses: [`compare-kdcllc-agents-config.md`](compare-kdcllc-agents-config.md).
