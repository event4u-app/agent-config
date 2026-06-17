<!-- analyzed: 2026-05-29 | commit: 57588489 | files: 0 -->
# Competitive Positioning — continuedev/continue vs agent-config

> Date: 2026-05-29 · Method: `competitive-positioning` skill · Evidence: deep-dive
> of `continuedev/continue` (≈40 source files fetched) + this package's
> `scripts/condense.py` projection generator and validators.

## Frame

- **agent-config (ours):** a *governed single-source-of-truth* —
  `.agent-src.uncondensed/` condensed and projected into many AI tools
  (`.claude/`, `.cursor/`, `.clinerules`, `.windsurfrules`, `GEMINI.md`
  via `scripts/condense.py --generate-tools`). Segment: a maintainer/team
  standardizing AI behavior across projects.
- **Continue:** a *runtime assistant* (IDE + `cn` CLI), configured per-repo
  via `.continue/`. Segment: developers wanting an open-source Copilot.

**First-principles read:** different outcomes. Continue *is* the assistant;
we are the authoring/governance layer that feeds assistants. Continue is
therefore more a **projection target** than a competitor — its rules system
is a *consumer* of the artifact type we produce.

## Axes

1. Rules format & frontmatter
2. Rule-type classification
3. Prompts / slash commands
4. Agents / sub-agents
5. MCP config
6. Source-of-truth / condensation / multi-tool projection
7. Validation & testing

## Verdict table

| Axis | Ours | Theirs | Verdict | Adopt? | Rationale |
|---|---|---|---|---|---|
| Rules format | Markdown+frontmatter source, projected | `.continue/rules/*.md`, markdown+frontmatter | parity | no | Already have; our Cursor `.mdc` emitter is near-identical |
| Rule-type classification | Explicit `always`/`auto` + trigger-sets + `dist/router.json` | Auto-inferred from `globs`/`description`/`alwaysApply` (`packages/config-yaml/src/markdown/getRuleType.ts`) | theirs simpler, ours more governed | no (low) | Auto-inference would only be a lint hint; our model is intentionally explicit |
| Prompts / commands | `commands/` → `.claude`/`.cursor/commands` | `.continue/prompts/*.prompt` + slash | parity | no | Equivalent mechanics |
| Agents | Personas + `subagent-orchestration` | `.continue/agents/*.md` with `tools:`+`rules:` refs | different models | pattern (low) | Declarative agent-with-tools file is clean, but no gap for us |
| MCP config | `scripts/mcp_render.py` + `tool_registry.py` | `mcpServers: uses/with/override` in `config.yaml` | theirs more composable | yes (low-med) | `uses/with/override` composition is a good pattern for our MCP render |
| **Source-of-truth / multi-tool projection** | One source → N tools, condensation hashes, kernel/router, framework-neutrality linter | `.continue/` only, no condensation, no multi-target | **we win clearly** | no | Our core — see invariant |
| Validation & testing | Python linters (frontmatter, hashes, refs, leakage, skill_linter); binary pass/fail | Zod schema + **severity tiers** (fatal/warn, `core/config/validation.ts`) + roundtrip tests + `cn` validate | theirs more granular | yes (low) | Severity tiers + roundtrip test are pure internal improvements |

## Invariant (strategic moat)

**Multi-tool projection / condensation.** Inversion: "what would make us lose
this axis?" → collapse to a single tool target and drop the source/output
split. We never would. This is a moat, not a feature.

## Adoption queue (by cost-to-close)

1. **Severity tiers in our linters** (fatal vs. warning, pattern from
   `core/config/validation.ts`) — low cost, exit cost ~0 (internal refactor).
2. **Roundtrip test** (source frontmatter → projection → parse-back ==
   identical) — low-med cost, exit ~0.
3. **`.continue/` projection target** — low-med (mirrors the `.cursor/*.mdc`
   emitter in `scripts/condense.py`, gated by `_tool_active("continue")`),
   **but gated on real Continue usage**.
4. **`uses/with/override` MCP composition** — watch, defer.

## Unknowns (not collapsed to parity)

- Whether Continue Hub `uses:` blocks would let us **publish agent-config as a
  hub package** (distribution angle) — not inspected.
- Whether `.continue/rules` supports `@ruleName` manual-invoke at the
  granularity we would project — not inspected deeply.
- **Whether Continue is actually used in our projects** — the load-bearing
  fact for queue item 3.

## Decision (2026-05-29)

User chose: adopt queue items 1 + 2 (no Continue dependency); record as ADR;
defer item 3 (`.continue/` target) until Continue is in real use; item 4
(MCP composition) → watch. See `docs/decisions/ADR-031-*`.
