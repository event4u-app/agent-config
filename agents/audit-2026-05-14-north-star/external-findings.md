# External Findings — Senior-Dev Benchmark

**Date:** 2026-05-14
**Author:** matze4u (autonomous synthesis pass)
**Scope:** Deep-dive of 4 external repos in the same problem space; what they
do that `event4u/agent-config` does not — at the level of files, scripts,
schemas, enforcement, measurement. No README-only takes.

Repos surveyed:

| Repo | Stars-class | Shape | Primary lens |
|---|---|---|---|
| [`JuliusBrussee/caveman`](https://github.com/JuliusBrussee/caveman) | viral | 7 skills, 1 idea | Token economy — measured |
| [`ruvnet/ruflo`](https://github.com/ruvnet/ruflo) | active | 30+ plugins | Swarm orchestration + cost attribution |
| [`GammaLabTechnologies/harmonist`](https://github.com/GammaLabTechnologies/harmonist) | active | 186 agents, 16 categories | Schema-driven agent registry + mechanical enforcement |
| [`anthropics/knowledge-work-plugins`](https://github.com/anthropics/knowledge-work-plugins) | official | 1 plugin per role | Standalone + connector enrichment |

---

## 1. Caveman — what we should steal

| Pattern | What it is | Why it matters | Our delta |
|---|---|---|---|
| **Measured token reduction** | `benchmarks/run.py` with reproducible 10-prompt corpus; published table (avg 65 %, range 22–87 %) | Trust comes from numbers, not claims | We have **zero** measured output / context numbers. `caveman.speak_scope` exists but is opt-in scope, default `off`, no telemetry, no per-run delta. |
| **Intensity ladder** | `lite` / `full` / `ultra` / `wenyan-{lite,full,ultra}` — six levels, all documented with side-by-side examples | One knob the user actually turns | We have `caveman.speak_scope` as a single flag. No ladder. No `/caveman ultra` analog. |
| **`caveman-compress` memory file rewrite** | Compresses CLAUDE.md in place, keeps `<FILE>.original.md` backup, ~46 % input-token savings per session forever | One-shot work, lifetime payoff; structurally honest about what it touches | Our compression pipeline (`.agent-src.uncompressed` → `.agent-src`) measures bytes between two trees the **agent never reads**. Per `feedback/02`, this is wrong-boundary measurement. |
| **Auto-clarity carve-outs** | Disable caveman speak on security warnings, destructive ops, multi-step sequences where omitted conjunctions risk misread | Compression that knows when to stop | We have no such switchback rule. If `caveman.speak_scope=on`, it applies everywhere. |
| **Statusline integration** | Lifetime tokens saved on the IDE status bar, updated from session jsonl | Constant feedback loop | We have no observable telemetry surface. |
| **Honest disclaimer** | README states "caveman only affects output tokens — thinking/reasoning tokens untouched" | Don't oversell | Our `token-efficiency` rule is vaguer about what it does NOT do. |

**Read-across:** caveman is a one-trick repo done exceptionally well. We do
14 things — and none of them have a benchmark table.

---

## 2. Ruflo — what we should steal

| Pattern | What it is | Why it matters | Our delta |
|---|---|---|---|
| **Cost-tracker plugin** | Real model pricing (Haiku/Sonnet/Opus per 1M, separated input/output/cache-read/cache-write), 50/75/90/100 % budget ladder with hard stop at 100 % | The package preaches token economy but can't say what a session costs | We have **no cost surface**. `set-cost-profile` chooses profile but produces no $-attribution. |
| **Auto-capture from session jsonl** | `cost-track` reads Claude Code's own log, no manual tracking | Telemetry that doesn't depend on the agent volunteering | Our `agent-status` skill counts messages, not tokens, not dollars. |
| **Measured-vs-claimed disclaimer** | Every percentage claim in cost-tracker README is tagged "claimed upstream, not yet verified in this repo" | Honesty about what's bench-validated vs marketing | Our roadmap headers (`step-1-` etc.) claim outcomes without a verification protocol. The council session feedback already flagged this (F2 / U1). |
| **Smoke test as contract** | Every plugin: `bash scripts/smoke.sh` with declared baseline (e.g. `44 passed, 0 failed`). CI runs it on every PR touching the plugin. | The plugin can be re-validated by anyone in 30 seconds | We run `task ci` but per-tier (kernel / router / schema / skills) smoke contracts don't exist. `task lint-skills` is structural, not behavioural. |
| **Per-plugin ADR directory** | Every plugin: `docs/adrs/0001-*.md`, `0002-*.md`. Architecture decisions co-located with code. | New contributor sees *why* this plugin exists in 3 minutes | We have `.augment/contracts/` and `docs/contracts/` but ADR coverage is partial; many sub-systems have no ADR. |
| **Namespace contract** | `<plugin-stem>-<intent>` kebab-case, reserved names listed (`pattern`, `claude-memories`, `default`). | Plugin collision becomes impossible | Our naming has conventions but no enforced contract. |
| **Topology choices in swarm** | `hierarchical / mesh / hierarchical-mesh / ring / star / adaptive` with anti-drift defaults (hierarchical, 6–8 agents, raft consensus) | Coordination shape is a first-class config knob | We have `subagent-orchestration` skill with 7 modes but no per-mode topology guidance comparable. |
| **MCP-tool count + source line refs** | "12 tools, sourced at `agent-tools.ts:182, 287, …`" | The reader can verify the claim | Our README counts skills / rules / commands but cites no source-of-truth file. |

**Read-across:** ruflo measures everything and tags every claim with
provenance. We measure structure, not behaviour.

---

## 3. Harmonist — what we should steal

| Pattern | What it is | Why it matters | Our delta |
|---|---|---|---|
| **Schema-driven registry** | `agents/SCHEMA.md` defines 8 required + ~10 optional frontmatter fields; `scripts/migrate_schema.py` rolls files forward; `agents/index.json` is **generated** from frontmatter | Adding an agent = create a file; routing updates automatically | Our `router.json` is hand-curated. Skill frontmatter is checked structurally but not against a versioned schema. |
| **Schema versioning + migration registry** | `CURRENT_SCHEMA_VERSION = "2"`; `MIGRATIONS[("1","2")] = _upgrade_v1_to_v2`; never delete old upgrade fns | Breaking changes possible without breaking old forks | We have no schema version concept. Additive edits only — meaning we cannot retire a field without manual sweep across 208 skills. |
| **Model tier hint** | Every agent declares `model: fast \| inherit \| reasoning` | Agent runtime picks the right cost class without orchestrator hard-coding | Our skills have no model-tier metadata. Subagent orchestration reads `.agent-settings.yml` profile, but the skill itself does not declare its complexity class. |
| **`distinguishes_from` + `disambiguation`** | Agents declare which slugs they're confused with + a one-line tie-breaker | Solves the "two skills match same trigger" problem at the schema level | We rely on description trigger matching. `auto-rules-overlap.json` detects collisions; nothing inside the skill resolves them. The triad (`project-analysis-*`, `universal-project-analysis`, `analysis-skill-router`) is exactly this anti-pattern. |
| **`## Deep Reference` cut-point** | Long persona body split at `## Deep Reference` header; everything above is essentials (< 80 lines, always loaded); everything below is on-demand | Persona token cost stays bounded | Our skills are loaded whole. The 25 largest SKILL.md files burn context every time. |
| **MANDATORY RULE + Cursor hooks** | `AGENTS.md` declares hard rules; `.cursor/hooks/` enforces them: stop gate checks reviewer invoked, qa-verifier invoked, session-handoff.md updated; `loop_limit: 3` | Iron Law that the runtime cannot drift past | Our Iron Laws are agent-side rules. Mechanical enforcement exists only via linter (release-time) and golden outcomes (test-time). No live runtime hook. |
| **`AGENT: <slug>` marker contract** | Every subagent invocation's first line MUST be `AGENT: <slug>`; hooks verify | The orchestrator can audit which reviewer ran from the transcript | Our subagent invocations have no such marker. |
| **PROJECT PRECEDENCE preamble** | Every subagent call gets injected: invariants + modules + platform snippet from project AGENTS.md, generated by `scripts/project_context.py` | The persona sees the project's hard rules before the task — no generic-default drift | We have project-specific rules under `.augment/rules/` but the preamble injection is not formalized into subagent invocations. |
| **Domain vocabulary filter** | Controlled list of `domains:` values; routing filters by `domains ⊆ (project_domains ∪ {all})` — irrelevant specialists hidden from a project | The user never sees "WeChat specialist" on a Berlin-bookkeeping repo | Our `step-6-user-types-axis` roadmap heads in this direction but predates Harmonist's exact mechanism. |
| **Memory CLI as only write path** | `python3 .cursor/memory/memory.py append --kind state --status done` validates against `memory/SCHEMA.md`; direct hand-edits must still pass `validate.py` | Free-form markdown memory cannot rot | Our MCP memory has schema validation (B1 trust score) but no CLI parity for offline / pre-MCP users. |
| **Correlation IDs** | `<session_id>-<task_seq>` generated at session start by the hook; LLM never invents one | Every memory entry, decision, pattern is joinable across sessions | We have no correlation-id concept. |

**Read-across:** harmonist treats agent registry the way a database team
treats migrations. We treat it as additive markdown.

---

## 4. Knowledge-Work-Plugins — what we should steal

| Pattern | What it is | Why it matters | Our delta |
|---|---|---|---|
| **One plugin per role** | `engineering/`, `product-management/`, `design/` — each ~6 commands + ~6–10 skills, all in one folder | A user installs the plugin for their job, not for individual skills | Our `personas:` axis is similar in spirit but invoked at runtime; no install-time bundling. |
| **"Standalone + Supercharged"** | Every command works without integration. MCP connectors are enrichment, not requirement. README has a `Standalone / Supercharged With` table per command. | Adoption ramp: zero-config working version → connector-rich version | Our skills assume the agent has access to Augment / memory / network. No documented fallback table. |
| **Settings file pattern** | `.claude/settings.local.json` with `{ name, title, team, company, techStack, defaultBranch, deployProcess }` — plugin prompts interactively if missing | Personalization without ghostwriter complexity | Our `step-3-agent-user-persona` + `step-4-ghostwriter` are richer but heavier. The simple-settings on-ramp is missing. |
| **CONNECTORS.md per plugin** | Documents exactly which MCP connectors enrich which command | Honest connector-coverage matrix | We have no equivalent surface. |

**Read-across:** anthropics ships the **minimum viable agentic plugin**.
Domain-focused, two-mode (standalone / connected), settings-light.
We ship a framework. Adoption story is harder.

---

## 5. Composite scorecard — `agent-config` vs the field

Honesty pass. `+` = we're ahead; `=` = on par; `–` = behind.

| Axis | vs Caveman | vs Ruflo | vs Harmonist | vs KW-Plugins |
|---|:-:|:-:|:-:|:-:|
| Iron Law rigor (kernel + tier-1/tier-2) | + | + | + | + |
| Compression / token economy — measurement | – | – | = | = |
| Cost attribution / budget alerts | = | – | = | = |
| Schema-driven agent registry + migrations | + | = | – | = |
| Mechanical enforcement (runtime hooks) | = | = | – | = |
| Model-tier metadata on skills | = | = | – | = |
| `## Deep Reference` cut-points | = | = | – | = |
| `distinguishes_from` / disambiguation | = | = | – | = |
| Per-plugin / per-tier smoke contract | = | – | = | = |
| ADR co-location with code | = | – | = | = |
| Multi-tool projection breadth | + | + | + | + |
| Persona system (review lens count + depth) | + | + | + | + |
| Roadmap-driven work flow | + | + | + | + |
| Memory system (MCP, trust score, contradictions) | + | = | + | + |
| Standalone-plus-connector adoption ramp | = | = | = | – |
| Observable telemetry (output / cost / selection) | – | – | – | – |
| Public benchmark with reproduction script | – | – | = | = |
| One-line install / one-liner positioning | – | = | = | – |

Hot read:

- We are clearly best-in-class on **governance** (Iron Laws, persona depth,
  memory trust, multi-tool projection).
- We are clearly behind on **measurement** (no benchmark corpus, no cost
  surface, no selection-accuracy number, no telemetry).
- We are clearly behind on **mechanical enforcement** (Iron Laws are
  agent-side rules; no runtime hook gating the stop event).
- We are clearly behind on **on-ramp simplicity** (KW-plugins reaches a
  working state in one install + one settings file; we require
  `.agent-settings.yml` + onboarding + persona compose).

These four gaps are the North Star inputs.

---

## 6. Net new patterns to import (ordered by leverage)

1. **Schema-driven skill / rule registry** (harmonist). Generate `router.json`,
   `index.json`, ownership tables from frontmatter. Add `schema_version`,
   `model_tier`, `distinguishes_from`, `disambiguation`. Migration registry.
   **Leverage:** unblocks every other improvement.
2. **Measured benchmark corpus** (caveman + ruflo). 10-prompt golden set.
   `task bench` produces output-token, context-token, cost, selection-accuracy
   numbers. CI publishes drift. **Leverage:** ends the "is this getting
   better?" question.
3. **Cost / budget surface** (ruflo). Auto-capture from Claude Code jsonl.
   50/75/90/100 ladder. `cost-report` skill. **Leverage:** turns the
   `cost_profile` setting from advice into accountability.
4. **`## Deep Reference` cut-point** (harmonist). Apply to 25 largest skills.
   `scripts/extract_essentials.py` + thin converter. **Leverage:** kernel /
   tier-1 budget compliance without losing depth.
5. **`AGENT: <slug>` + PROJECT PRECEDENCE preamble** (harmonist). First
   line of every subagent prompt. Hook verifies the reviewer ran.
   **Leverage:** review gates stop being agent-side opt-in.
6. **Auto-clarity carve-outs** (caveman). When `caveman.speak_scope=on`,
   disable for security / destructive / multi-step. **Leverage:** removes the
   "compression bit me on a destructive op" risk that currently keeps the
   flag off by default.
7. **Plugin-style role bundles** (KW-plugins). `personas/engineer.yml`,
   `personas/product-owner.yml` as composable install bundles (skills +
   rules + commands). **Leverage:** competes on the KW-plugins on-ramp axis
   without abandoning our framework strength.
8. **Standalone / supercharged table per skill** (KW-plugins). Frontmatter
   declares `enrichment:` (memory / network / connectors). Linter renders
   the table. **Leverage:** honest coverage matrix; no over-promise.

The North Star plan (`north-star-plan.md`) maps these to roadmap steps and
priority, after the internal audit (`internal-audit.md`) names the
internal pain points each one closes.
