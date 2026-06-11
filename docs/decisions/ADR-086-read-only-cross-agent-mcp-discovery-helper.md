---
adr: 086
status: rejected
date: 2026-06-11
decision: read-only-cross-agent-mcp-discovery-helper
supersedes: —
superseded_by: —
phase: mcp-onboarding · discovery-first
type: structural
---

# ADR-086 — Read-only cross-agent MCP discovery helper (defer auto-install)

## Status

**Rejected at its own Phase-0 gate** · 2026-06-11. The proposal to *build* the
read-only discovery helper was not adopted: the Phase-0 demand gate in
`road-to-mcp-discovery-helper` (which this ADR was pending) resolved to **STOP per
Option C**. The defer-auto-install half of the decision stands (auto-install remains
deferred to a future security-first ADR). Originally proposed 2026-06-10, routed
through the AI council (claude-sonnet-4-5 + gpt-4o, design mode, 2026-06-10 —
converged on the proposal); the build was then rejected at the gate by a second
council round (claude-sonnet-4-5 + gpt-4o, design mode, 2026-06-11 — converged STOP).

**Why rejected (verified at the gate, 2026-06-11):**

- **Existing tooling covers it.** Smithery's CLI already does cross-client *install*
  (read-write — the harder capability) for **5 of our 6 target agents** (Claude Code,
  Cursor, Windsurf, Cline, VS Code/Copilot; verified in `src/config/clients.ts`,
  `VALID_CLIENTS`, 23 clients). The lone gap is **Augment**. A read-only discovery
  tool for the same 5 agents is strictly weaker — this trips ADR-086 Step 2's own
  "if Smithery covers our full set read-write, reassess whether discovery is
  non-duplicative" criterion.
- **No demand signal.** Zero responses to the demand probe (shipped to the CHANGELOG
  `[Unreleased]` notes → GitHub Discussions). ADR-086 made "weak signal → stop" the
  gate condition.
- **Surviving value is doc-shaped, not tool-shaped.** Registry-agnostic coverage is a
  comparison matrix, not a 500-line CLI. Building the CLI would also create sunk-cost
  bias toward reimplementing (rather than wrapping) Smithery in any future phase.

**Verified registry facts (live-checked 2026-06-11, recorded for any future reopen):**
both registries are queryable read-only with **no API key** — official
`GET registry.modelcontextprotocol.io/v0/servers?search=&limit=&cursor=` (200, returns
`server.json` records + `nextCursor`) and Glama
`GET glama.ai/api/mcp/v1/servers?first=&after=` (200; resolves ADR-086's open
"does Glama need a key?" question — it does not).

**Follow-up recommendations (not actioned by the closing roadmap — net-new / external
scope):** contribute Augment support to `smithery-ai/cli` (`VALID_CLIENTS`); optionally
ship a registry coverage-matrix doc (official / Glama / Smithery) to capture the
registry-agnostic value cheaply.

**Reopen criteria:** 5+ demand responses citing a concrete need Smithery cannot serve,
OR Smithery registry-locks / declines Augment support / shuts down. Any reopen is a new
ADR (security-first if it touches auto-install).

## Context

`event4u/agent-config` is a tool-agnostic skill/rule/command suite whose core
competency is **projection**: one canonical source in `src/` is generated into
per-tool trees (`.claude/`, `.cursor/`, `.augment/`, `.windsurfrules`,
`.clinerules/`, `.github/copilot-instructions.md`). Today users wire up MCP
servers manually, separately per agent. The package publishes its own read-only
MCP server (Glama-indexed) but offers no help installing other people's servers.

A deep-dive (2026-06-10, cite-checked) established:

- **An official, vendor-neutral MCP registry exists** —
  `registry.modelcontextprotocol.io`, public API `/v0/servers`, canonical
  `server.json` schema. `server.json` carries `name` (reverse-DNS), `packages[]`
  (`registryType` npm/pypi/oci/mcpb/nuget/cargo, `identifier`, `transport`
  stdio/streamable-http/sse, `runtimeHint`, `packageArguments`,
  `environmentVariables` with `isSecret` flags), `remotes[]`, `repository`. It is
  a **discovery/catalog** spec — it does **not** write per-client config.
- **Glama is a superset** of the official registry (~32k servers, +quality/safety
  scoring, sandbox testing). API `glama.ai/api/mcp/v1/servers/{ns}/{name}` returns
  `environmentVariablesJsonSchema`, `repository`, `spdxLicense`, `tools`. A
  commercial third party; its "score" is not a verified security property.
- **Smithery already does cross-client install** (`smithery install X --client …`)
  — but its coverage of *our* agent set (Augment / Windsurf / Cline / Copilot) is
  **unverified**; only `claude` and `cursor` are confirmed.

The council split the question into two surfaces with opposite risk/value:

| Surface | Risk | Value |
|---|---|---|
| **Discovery** ("which servers exist, what do they need") | low (read-only) | high, undisputed |
| **Installation** ("write config into every agent") | high (secrets, supply-chain, no rollback) | disputed, demand unproven |

Three convergent objections to building auto-install now:

1. **Demand unproven.** No evidence that a meaningful share of users run multiple
   agents *simultaneously* and feel config-sync pain. Measure before building.
2. **Secrets + trust gate absent.** Auto-writing configs that contain API keys
   without a trust model is negligent. The official registry has no central
   vetting; Glama's score may be popularity, not safety.
3. **Kill-switch paradox.** A feature that auto-writes configs has no
   *non-centralized* rollback; a phone-home kill-switch contradicts the package's
   tool-agnostic model. The only safe shape (staging + manual apply) collapses the
   auto-install value.

A fourth concern: MCP config may be **runtime state**, not portable source —
forcing it into `src/` would create user-vs-project split complexity. This stays
open and is explicitly out of scope for the discovery helper.

## Decision

Ship a **read-only, registry-agnostic MCP discovery helper** and **defer**
auto-install (cross-agent config writes) to a future, security-first ADR.

The helper:

- Queries the **official MCP registry** as the primary source and **Glama** as an
  optional enrichment source (quality/safety signals, env-var schema), behind a
  registry-agnostic interface — **no hard coupling to any single registry**.
- Normalizes results to the official `server.json` shape.
- Renders, per matched server: name, description, declared `environmentVariables`
  (marking `isSecret`), supported transports, and the **copy-paste install snippet
  for each supported agent** — the user pastes it (and any secrets) themselves.
- **Writes nothing** to any agent config file. Zero secrets touch disk via the
  tool.

Its adoption is the demand test for whether auto-install is ever worth building.

## Consequences

**Positive**
- Solves the real pain (discovery) at zero security risk; no secrets handling.
- Honors tool-agnosticism — one canonical shape, optional registries, no vendor lock.
- Doubles as a falsifiable demand signal for the deferred auto-install question.
- Small first slice — registry query + normalizer + per-agent snippet renderer.

**Negative / accepted**
- Users still copy-paste per agent (the auto-install toil is *not* eliminated).
- A network dependency on external registries at query time (read-only, cacheable).
- If demand proves high, a second, harder design cycle (trust gate, secret
  handling, rollback) is still required before any auto-write.

**Neutral**
- Whether MCP config belongs in `src/` projection stays an open question, revisited
  only if/when auto-install is reconsidered.

## Alternatives considered

- **A — MCP-config-as-projection on the official spec (auto-write all agents).**
  Rejected *now*: demand unproven, secrets/trust/rollback unsolved. Remains the
  natural successor *if* the discovery helper shows strong adoption — under a new
  security-first ADR.
- **B — Couple to Glama or delegate to Smithery's CLI.** Rejected: coupling a
  tool-agnostic package to a single commercial registry contradicts its own
  portability doctrine; Smithery's coverage of our agent set is unverified and
  would add a third-party runtime dependency.
- **C (pure) — Skip entirely.** Rejected: leaves the low-risk, high-value
  discovery win on the table and forgoes the demand signal.

## References

- AI council convergence, design mode, 2026-06-10 (claude-sonnet-4-5 + gpt-4o):
  Option C with a read-only discovery carve-out; verify Smithery coverage; gate on
  a demand survey.
- Official MCP registry `server.json` schema —
  `static.modelcontextprotocol.io/schemas/.../server.schema.json`.
- `src/skills/mcp/SKILL.md` — existing MCP tool-usage skill.
- `internal/glama/README.md` — the package's own Glama-indexed MCP server (distinct
  concern: we are *listed*, this ADR is about *consuming* registries).
