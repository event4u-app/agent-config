# Council Question — `event4u/agent-config` v2.10.0 Direction

You are reviewing a **public, single-author, open-source agent-config
package** for AI coding tools (Augment, Claude Code, Cursor, Windsurf,
Cline). Version 2.10.0. Maintainer: solo. Goal: lift it to a
"senior-developer-bar" framework.

## Package facts (verified at audit time)

- **Skills**: 208 (markdown SKILL.md files)
- **Rules**: 61 (9 always-loaded kernel + tier-1 + tier-2 routed)
- **Commands**: ~50 (slash-command files)
- **Personas**: 11 review-lens cast (6 core + 5 specialist)
- **Python scripts**: 217 in `scripts/`
- **Multi-tool projection**: `.agent-src.uncompressed/` is source of truth;
  generated → `.agent-src/`, `.augment/`, `.claude/`, `.cursor/`,
  `.clinerules/`, `.windsurfrules`
- **Roadmaps active**: 5 (155 steps, 0 done)
- **Linter status**: `task lint-skills` produces 91 WARN; `task ci` exits 0
- **Test layer**: golden outcomes exist for ~6 always-loaded rules;
  zero skill-layer behavioural tests
- **Telemetry**: no measured token saving, no cost surface, no
  selection-accuracy %, no projection-fidelity %
- **Iron Law enforcement**: agent-side (rule text). No runtime stop-hook.

## Comparable repos surveyed (objective patterns)

1. **`JuliusBrussee/caveman`** — token-compression repo. Ships
   `benchmarks/run.py` with 10-prompt corpus + reproducible measurement.
   Six-level intensity ladder. Auto-clarity carve-outs on
   destructive / security / multi-step. Lifetime tokens-saved on
   statusline.
2. **`ruvnet/ruflo`** — 30+ plugin suite. Cost-tracker plugin reads
   Claude Code's session jsonl, applies real per-model pricing
   (input / output / cache-read / cache-write), enforces 50/75/90/100
   budget ladder. Per-plugin ADR directories. Smoke contracts.
3. **`GammaLabTechnologies/harmonist`** — 186 schema-driven agents.
   `agents/SCHEMA.md` defines 8 required + ~10 optional frontmatter <!-- ref-ignore -->
   fields. `schema_version`, `model_tier`, `distinguishes_from`,
   `disambiguation`. Migration registry (`MIGRATIONS[("1","2")]`).
   `## Deep Reference` cut-point splits essentials from on-demand body.
   Cursor `.cursor/hooks/stop.json` enforces subagent invocation
   mechanically. `AGENT: <slug>` marker contract on every subagent call.
4. **`anthropics/knowledge-work-plugins`** — one plugin per role
   (engineering, PM, design). "Standalone / Supercharged" table per
   command — works without connectors, enriched with them. Simple
   `.claude/settings.local.json` with `{ name, team, techStack, … }`.

## The package's open council findings (R3 verdict, 2026-05-14)

13 verified findings, all `accept` or `accept-with-modification`. Headlines:

- F2 / U1: "Compression" pipeline naming + wrong-boundary measurement.
- F5 / D2: 6.3 % router coverage; selection-accuracy protocol locked
  but not implemented.
- F6 / U3: 55 sequential CI tasks, no tiering, time-ratio metric.
- N1 / U2: 91 linter WARN, CI exit 0 — linter is diagnostic, not a gate.
- U5: Cross-tool projection fidelity unmeasured (byte-diff ≠
  behaviour-fidelity).
- F1 / D3: Single-author repo; CONTRIBUTING gaps.
- F7 / U4: Roadmap commitment-vs-delivery history not tracked.

Full feedback at `agents/council-sessions/2026-05-14-v2-analysis/feedback/`.

## Your task

Treat the package facts above as ground truth. Treat the comparable-repo
patterns as objective options. You have **not** seen the host's analysis
or proposed plan.

Answer these four questions independently. Be brutal where the facts
warrant it; be specific where you propose action.

### Q1 — Six-month direction

What are the **top 3–5 highest-leverage improvements** this package
should ship in the next 6 months to reach "senior-developer-bar"?
Order by leverage (most consequential first). For each:

- One-sentence claim of the improvement.
- Which package fact or pattern it closes.
- Estimated effort class (S / M / L) — small = 1 PR, medium = 1 sprint,
  large = multi-sprint.
- Why it ranks where you put it.

### Q2 — Measurement-vs-enforcement priority

Should the package prioritise **measurement** (benchmark corpus,
selection-accuracy, cost surface) **before** **mechanical enforcement**
(runtime stop-hooks, `AGENT: <slug>` marker, CI strict mode), or
**alongside**, or **after**? Defend your sequencing.

### Q3 — Compression default

Caveman ships token-compression default on, with carve-outs. Our
`caveman.speak_scope` ships default off. Should the default flip to
on (with caveman-style carve-outs for security / destructive /
multi-step), stay off until measured, or be removed entirely as a
feature? What evidence would make the answer change?

### Q4 — Schema rigor (harmonist-style)

Harmonist's schema rigor (`schema_version`, `model_tier`,
`distinguishes_from`, `disambiguation`, `## Deep Reference`,
migration registry) is the heaviest single import on the table.
Worth it for a 208-skill package, or over-engineering given our
governance is already strong? If "worth it": where does it pay off
first? If "not worth it": what would change your mind?

## Output expectation

Plain markdown. No preamble. No "as an AI". Numbered answers Q1–Q4.
If a question is malformed or impossible to answer from the facts
given, say so under that question and continue.
