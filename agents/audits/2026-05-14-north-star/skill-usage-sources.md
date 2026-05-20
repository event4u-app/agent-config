# Skill Usage Sources — audit (step-2 Phase 1 Step 1)

> Inventory of every place skill activation is observable today.
> Feeds [`step-2-skill-inventory-rationalization.md`](../roadmaps/step-2-skill-inventory-rationalization.md)
> Phase 1 collector design.

## Inventory

| # | Source | Path | Activation signal? | Coverage |
|---|---|---|---|---|
| 1 | Claude Code session jsonl | `~/.claude/projects/<project-slug>/*.jsonl` | **Indirect** — `attachment.type=skill_listing` shows the catalog presented; agent reply text contains the chosen skill name as prose, not a structured field | One project (`-Users-…-agent-config`), one session, ~53 KB, 2026-05-15 onwards |
| 2 | Augment transcript exports | n/a | **Not present** — no transcript export dir exists in this repo or under `~/Library/Application Support/Augment` (checked 2026-05-16) | Zero |
| 3 | `agents/.mcp-telemetry/calls.jsonl` | repo-local | **Indirect** — records MCP tool calls (`tool_name`, `outcome`, `transport`), not skill activations. Useful for cross-correlation but not the primary signal | Live, append-only |
| 4 | `agents/.frugality-baseline.jsonl` · `.density-snapshot.jsonl` · `.augment-budget-history.jsonl` · `.rule-budget-history.jsonl` | repo-local | **No** — these are budget / density metrics, not skill activations | Live, used by `task lint-rule-budget` etc. |
| 5 | `agents/state/*.json` | repo-local | **No** — runtime state per-rule (e.g. `context-hygiene.json`), not skill activation logs | Live, small |
| 6 | `agents/sessions/` | repo-local | **Absent** — directory does not exist | n/a |
| 7 | Council session jsonl (`agents/council-runs/`) | repo-local | **No** — council prompts + responses; orthogonal axis | Live |
| 8 | `agents/.density-snapshot.jsonl` | repo-local | **No** — token-density per artefact, not per-activation | Live |

## Primary signal — Claude Code session jsonl

`~/.claude/projects/<project-slug>/<session-uuid>.jsonl` lines carry
`{ "type": "user" | "assistant" | "attachment" | … }`. Observed types
in the current session:

- `queue-operation` · `assistant` · `user` · `message` · `text`
- `attachment` with `attachment.type ∈ { skill_listing, last-prompt, deferred_tools_delta }`
- `skill_listing` content = the catalog of available skills, **before**
  agent selects one. Format: `\n- <slug>: <description>\n` lines.

**No structured "skill activated" field exists.** Activation must be
inferred from the assistant's reply text — when the agent invokes a
skill it typically writes the slug in prose ("Using `php-service`…",
"Per the `agent-docs-writing` skill…", "Routing via `quality-tools`"),
plus the corresponding file paths (e.g. `.augment/skills/<slug>/SKILL.md`).

### Detection heuristic for the Phase 1 collector

1. **Parse `attachment.type=skill_listing`** to enumerate the slug
   set on offer in this turn.
2. **Scan the next `assistant` message text** for either:
   - Literal slug occurrences from (1) wrapped in backticks
     (`\``<slug>`\``), surrounded by `the `, `via `, `per `, `using `,
     `routing `, `dispatched `, `invoke `, `call ` — high-precision
     anchor set.
   - File path mentions: `.augment/skills/<slug>/SKILL.md`,
     `.claude/skills/<slug>/SKILL.md`,
     `.agent-src/skills/<slug>/SKILL.md`.
3. **Emit one record per (session, turn, activated-slug)** to
   `agents/metrics/skill-usage.jsonl`.

False-positive risk: agent may name a skill it considered but did not
follow. Mitigation: require at least one of {path mention, code-block
fence with skill content, sub-skill citation} in the same turn.

False-negative risk: agent uses a skill silently (no slug in reply).
Mitigation: this is acceptable — silent use is exactly the "skill
content folded into agent baseline" pattern that signals the skill
is doing its job; we still want to count its presence in the listing
attachment as "exposed". Two columns in the report:
`exposures_30d` (listing count) vs `mentions_30d` (reply count).

## Cross-correlation signal — MCP telemetry

`agents/.mcp-telemetry/calls.jsonl` carries `{ tool_name, outcome,
transport, ts }`. Where a skill is **MCP-backed** (e.g. `memory`,
`markitdown`), `tool_name` is a reliable activation proxy. Phase 1
collector should optionally join this dataset on session_id /
timestamp window when the slug maps to a known MCP server.

Known skill → MCP-tool map (from a one-pass grep):

| Skill | MCP server / tool family |
|---|---|
| `memory` (cluster) | `memory_*` (`memory_retrieve_*`, `memory_propose_*`, etc.) |
| `markitdown` | `markitdown_*` |
| `mcp` | meta — manages servers, doesn't itself activate one |

Full map is a Phase 2 byproduct of the candidates table; the Phase 1
collector treats it as opt-in.

## Privacy

The roadmap requires no PII in the emitted dataset. Phase 1 collector:

- Hashes the first 200 chars of the user prompt → `prompt_excerpt_hash` (SHA-256).
- **Never** persists raw assistant or user message bodies.
- `session_id` is the Claude Code session UUID; stable within a
  session, opaque outside. Acceptable.
- `agents/metrics/` stays gitignored until the report is generated;
  the report itself contains aggregate counts only.

## Open questions (do not block Phase 1)

- **Multi-project sessions.** `~/.claude/projects/` carries one dir
  per repo. The collector should scan only the current project's dir
  to keep counts repo-scoped — addressed by `--project-slug` flag.
- **Augment sessions.** No transcript export surface exists yet.
  Track as a follow-up under [`step-4-measurement-and-benchmark.md`](../roadmaps/step-4-measurement-and-benchmark.md)
  Phase 4 (per-tool projection fidelity) — not blocking.
- **Subagent sessions.** Council and subagent runs live in
  `agents/council-runs/` and `agents/state/`. Out of scope for
  Phase 1 (they don't choose skills the same way).

## Done

This document satisfies step-2 Phase 1 Step 1. Phase 1 Step 2
(collector script) consumes it.
