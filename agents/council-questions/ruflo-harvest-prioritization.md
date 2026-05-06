# Council question — Ruflo harvest prioritization

## Context

`event4u/agent-config` is a governed multi-department skill suite (134
skills, 55 rules, ~63 commands) with a project-agnostic floor
(`augment-portability`), Sunset Policy (>400 lines → split or
authoritative-link), Hard-Cap of 5 adoptions per 6-week phase, and an
**active `road-to-mcp-server.md` roadmap** already in Phase 1
(stdio MCP server in Python, prompts/list + prompts/get only). The
user asked to deep-scan `ruvnet/ruflo` (a Claude Code plugin
marketplace + 33 plugins + 110+ skills + an MCP HTTP/stdio bridge),
focused on what informs our MCP roadmap or fills a real gap.

## What Ruflo actually is

A **Claude-Code-plugin marketplace**, not a stack-agnostic skill set.
Architecture (verified from harvest):

- 33 plugins, each with `plugin.json` + `marketplace.json` +
  `skills/<name>/SKILL.md` + optional `commands/`, `agents/`, `docs/adrs/`.
- 110+ SKILL.md files, **almost every one wired to
  `mcp__claude-flow__*` MCP tools** (`memory_*`, `agentdb_*`, `neural_*`,
  `hooks_*`, `aidefence_*`, `embeddings_*`). Outside Ruflo's runtime
  these tools do not exist.
- An MCP-bridge in `src/mcp-bridge/`: a thin stdio kernel
  (`mcp-stdio-kernel.js`, ~250 LOC) that forwards JSON-RPC over HTTP
  to an Express bridge, signed with HMAC (`CRYPTO_SEG`).

## Cross-checked against existing suite

| Existing | Overlap with Ruflo |
|---|---|
| `road-to-mcp-server.md` (active, Phase 1 P1.A1–A7) | Ruflo's stdio-kernel pattern is a direct reference for our Phase 4 (Tools) wire-up; their HMAC-signed bridge is a reference for D4 (allowlist) |
| `mcp` skill (catalog of Sentry/Jira/GitHub MCP tools) | No semantic overlap — ours catalogs *external* MCPs we consume, Ruflo's bridge *exposes* tools |
| `test-driven-development` skill | Partial overlap with Ruflo's `tdd-workflow` (London-school, mock-first); SPARC's gated AC + pseudocode phase is **net-new** content if we wanted it |
| `set-cost-profile` command | Sets a profile only; Ruflo's `cost-tracker` actually meters spend — net-new capability |
| No ADR skill anywhere | Ruflo's `adr-create` is net-new |

## In-scope Ruflo candidates (after dropping MCP-tool-coupled noise)

ICE = Impact (1–10) · Confidence (1–10) · Ease (1–10), threshold:
`≥ 200` = Phase 1, `100–199` = Phase 2 backlog, `< 100` = drop.
Impact discounted: most consumer projects don't need formal ADRs or
cost metering, but every project benefits from a sharper MCP roadmap.

### Tier S — likely Phase-1 ADOPT

| # | Candidate | Source path in Ruflo | Sunset | I·C·E | Score |
|---|---|---|---|---|---|
| 1 | **MCP-bridge pattern reference** — extract `mcp-stdio-kernel.js` (~250 LOC) + tool-registration loop as a **guideline** under `docs/guidelines/agent-infra/`, cited from new Phase-5 steps in `road-to-mcp-server.md` | `src/mcp-bridge/mcp-stdio-kernel.js` + `ruflo/docs/TOOLS.md` | clean (<400 if scoped to the kernel; full bridge gets authoritative-link) | 9·9·6 | **486** |
| 2 | **`adr-create` skill** — net-new ADR-NNN sequential numbering + standard template + AgentDB-free variant (drop the `mcp__claude-flow__agentdb_*` calls, keep methodology + Markdown template) | `plugins/ruflo-adr/skills/adr-create/SKILL.md` | clean (~60 lines pre-MCP-strip; ~120 post-strip with template) | 7·8·8 | **448** |
| 3 | **`cost-tracker` script port** — fork `track.mjs` + `budget.mjs` as standalone Node scripts under `scripts/cost/`, swap the MCP `memory_store` write for local JSONL append; tie to `set-cost-profile` via a new `/cost:report` command | `plugins/ruflo-cost-tracker/scripts/{track,budget}.mjs` | clean — scripts stay outside `.agent-src/`, only the command + skill go in | 6·8·6 | **288** |

### Tier A — Phase-2 backlog (debate item for council)

| # | Candidate | I·C·E | Score | Reason for backlog |
|---|---|---|---|---|
| 4 | **SPARC methodology** as a guideline (`docs/guidelines/agent-infra/sparc-methodology.md`) — gated 5-phase workflow (Spec → Pseudo → Arch → Refine → Complete), cited optionally from `test-driven-development` and `feature/plan` | 5·6·7 | **210** | Real overlap with `test-driven-development`; could either *enhance* TDD (cite SPARC as a heavier alternative) or stand alone. **Council: enhance TDD or stand alone?** |

### Tier C — DROP (with one-line rationale)

- `tdd-workflow` skill — shallower than our `test-driven-development`; full subset.
- `pii-detect`, `safety-scan` — entirely depend on `mcp__claude-flow__aidefence_*` MCP tools that don't exist outside Ruflo.
- `observe-trace` — depends on Ruflo's `memory_*` + `agentdb_*` namespaces; even the CLI fallback is `claude-flow`-scoped.
- `validate-plugin`, `create-plugin` — Ruflo plugin format (`plugin.json` + `marketplace.json`), not the Agent-Skills open standard our package targets; replicating would diverge our skill format from the open standard. Our `skill-writing` + `command-writing` already cover the Agent-Skills standard.
- `test-gaps` — `mcp__claude-flow__hooks_worker-dispatch`-coupled.
- ~30 other plugin skills (neural-train, swarm-spawn, dna-analyzer, financial trading, IoT, etc.) — out-of-suite-identity.

## Council question

Three clusters. **One vote per cluster.**

### Cluster 1 — MCP-bridge pattern (Phase-1 P1)

**Q1.** Is the MCP-bridge **pattern reference** more valuable as
- (a) a **new guideline** (`docs/guidelines/agent-infra/mcp-stdio-bridge.md`) that the existing `road-to-mcp-server.md` Phase 4 cites, or
- (b) a **direct addition** of a Phase 5 ("HTTP transport variant") to `road-to-mcp-server.md`, or
- (c) **defer** until Phase 1 of the existing roadmap (stdio-only Python server) ships, then revisit?

Pick (a), (b), or (c). One sentence justification.

### Cluster 2 — ADR-create scope (Phase-1 P2)

**Q2.** Should our `adr-create` skill
- (a) ship **methodology-only** (template + numbering + index file, zero memory/AgentDB integration), or
- (b) include a **lightweight project-local ADR index** (a `docs/adr/INDEX.md` regenerated by a small script), or
- (c) include a **search-by-topic** capability via grep (no vector DB), or
- (d) all of the above?

Pick the highest-leverage subset. One sentence justification.

### Cluster 3 — SPARC fate (Phase-2 backlog vs. drop)

**Q3.** Given we already have `test-driven-development`:
- (a) **Adopt SPARC as a separate guideline** (heavier alternative to TDD, used for cross-cutting features), or
- (b) **Cite SPARC inside `test-driven-development`** as an optional escalation when AC count > 5 or architecture impact is non-trivial, or
- (c) **Drop SPARC entirely** — TDD covers our needs, SPARC adds ceremony.

Pick (a), (b), or (c). One sentence justification.

## Out-of-scope (do NOT vote on)

- Ruflo's plugin marketplace concept — incompatible with Agent-Skills standard.
- Ruflo's `mcp__claude-flow__*` runtime — out of suite identity.
- Cost-tracker beyond Tier-S adoption — Tier S is locked.
- All Tier-C drops — locked.

## Output format requested

For each cluster, return:

```yaml
cluster: 1
choice: a|b|c
justification: <one sentence>
risk_flag: <one phrase if any, else "none">
```

Then a final synthesis section: any **net-new candidate** the council
sees that isn't in the table above, **or** any explicit objection to a
Tier-S item.
