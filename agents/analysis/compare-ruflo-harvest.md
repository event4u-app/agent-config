# Ruflo harvest — comparison and adoption plan

**Source:** `ruvnet/ruflo` (commit SHA captured in /tmp/ruflo-harvest/ruflo.sha during harvest)
**Scope:** 33 plugins · 110+ skills · 1 MCP-bridge component · 1 marketplace
**Council:** claude-sonnet-4-5 + gpt-4o · 1 round · $0.0546 actual
**Date:** 2026-05-06

## Suite identity check

`event4u/agent-config` is a governed multi-department skill suite with a
project-agnostic floor. Ruflo is a Claude-Code plugin marketplace whose
plugins are **deeply wired to a `mcp__claude-flow__*` MCP-tool runtime**
that does not exist outside Ruflo. Most Ruflo skills are unrunnable
outside Ruflo — adopting them as-is would silently break.

**Adoption rule applied:** copy-paste only what is **portable** (pattern,
methodology, or pure-runtime script with no MCP-tool dependency). Cite
upstream for everything else.

## What was scanned

| Asset | Count | Verdict |
|---|---|---|
| Plugins (`plugins/<name>/`) | 33 | 4 in-scope after dependency scrub |
| Skills (`plugins/*/skills/<name>/SKILL.md`) | 110+ | most coupled to `mcp__claude-flow__*`, dropped |
| MCP-bridge (`src/mcp-bridge/`) | 1 stdio-kernel + 1 HTTP bridge | kernel pattern in-scope; HTTP bridge deferred |
| Marketplace (`marketplace.json`) | 1 | format diverges from Agent-Skills standard, dropped |
| Agents (`*/agents/<name>.md`) | ~30 | runtime-coupled, dropped |

## Cross-checks against existing suite

| Existing surface | Ruflo overlap | Decision |
|---|---|---|
| `road-to-mcp-server.md` (active, Phase 1) | MCP-bridge stdio-kernel pattern | **adopt as guideline** — informs Phase 4 |
| `mcp` skill (consumer-side MCP catalog) | none — different direction | no action |
| `test-driven-development` skill | SPARC methodology; `tdd-workflow` skill (shallower) | **cite SPARC inline as escalation; drop tdd-workflow** |
| `set-cost-profile` command | `cost-tracker` (track + budget) | **port scripts to local JSONL** |
| No ADR skill | `adr-create` skill | **adopt methodology + INDEX regen** |
| `skill-writing` + `command-writing` | `validate-plugin` + `create-plugin` | drop — Ruflo plugin format diverges from Agent-Skills standard |

## Council synthesis

Both members independently voted **defer the HTTP-bridge** (Cluster 1 → c).
Sonnet then surfaced the load-bearing primitive the artefact missed:
**Ruflo's HMAC `CRYPTO_SEG` signing pattern** is a reference implementation
for `road-to-mcp-server.md` Phase 4 D4 (allowlist of blessed consumers) —
ICE 504, higher than the bridge itself. Adopted as net-new candidate.

Cluster 2 split: Sonnet (b) lightweight INDEX, GPT-4o (a) methodology-only.
Sonnet's "40% value loss without index" argument accepted — Phase-1 ships
methodology + INDEX regen (small Python script).

Cluster 3 unanimous (b): cite SPARC inside `test-driven-development` as
**escalation trigger** when AC count >5 OR cross-cutting impact, preserving
TDD as the default. Standalone SPARC guideline rejected (would be ignored).

## Phase-1 plate (3 of 5 Hard-Cap slots)

| # | Adoption | Path | Sunset | Lines | Effort |
|---|---|---|---|---|---|
| 1 | **`adr-create` skill + `adr-index` regen script** | `.agent-src.uncompressed/skills/adr-create/` + `scripts/adr/` | clean (≤120 lines per skill) | ~120 + ~50 | 0.5 d |
| 2 | **`cost-track` + `cost-budget` scripts** + `/cost:report` command | `scripts/cost/{track,budget}.mjs` + `.agent-src.uncompressed/commands/cost-report.md` | scripts outside `.agent-src/`; command ≤120 lines | ~250 (scripts) + ~80 (cmd) | 1.0 d |
| 3 | **`mcp-hmac-auth` guideline** | `docs/guidelines/agent-infra/mcp-request-signing.md` | clean (≤150 lines) | ~150 | 0.5 d |

**Suite-integration step (P1.4)** runs all gates: `task sync`, `task generate-tools`, `task ci`.

## Deferred-with-trigger (Phase 2, gated)

| # | Adoption | Trigger to reopen |
|---|---|---|
| P2.1 | **MCP HTTP-bridge pattern** as Phase-5 of `road-to-mcp-server.md` | Phase 1 of `road-to-mcp-server` ships **AND** ≥1 consumer surfaces a real HTTP-MCP use case (browser client, remote agent) |
| P2.2 | **SPARC escalation citation** patched into `test-driven-development` | After P1.1 (ADR) ships + at least one feature has documented AC count >5 |

## Phase-3 governance (cross-cut)

| # | Action | Purpose |
|---|---|---|
| P3.1 | Add **"Defer-with-trigger" ICE tier** to `agents/contexts/harvest-policy.md` (or create) | Sonnet's meta-process recommendation: codify the third bucket between "adopt now" and "drop", so future harvests have a place for "adopt when prerequisite X ships" |
| P3.2 | **Sunset audit** on Ruflo-derived artifacts | After Phase 1 has been live one cycle: verify `adr-create` ≤200 lines, `mcp-request-signing.md` ≤200, scripts still work |

## Drops (one-line rationale)

- `tdd-workflow` (shallower than ours), `pii-detect` / `safety-scan` (require `aidefence` MCP namespace), `observe-trace` (requires Ruflo memory + agentdb), `validate-plugin` / `create-plugin` (different format standard), `test-gaps` (`hooks_worker-dispatch` coupling), `sparc-spec` / `sparc-implement` skills standalone (rejected by council Cluster 3), all neural / swarm / DNA / financial / IoT / local-LLM / browser-automation plugins (out of suite identity).

## Provenance

- Council Q: `agents/council-questions/ruflo-harvest-prioritization.md`
- Council A: `agents/council-responses/ruflo-harvest-prioritization.json`
- Source SHA: see `/tmp/ruflo-harvest/ruflo.sha` (harvest workspace, not committed)
- Specific Ruflo files referenced (with paths in upstream tree):
  - `src/mcp-bridge/mcp-stdio-kernel.js` (stdio + HMAC pattern)
  - `plugins/ruflo-adr/skills/adr-create/SKILL.md` (ADR methodology)
  - `plugins/ruflo-cost-tracker/scripts/{track,budget}.mjs` (cost scripts)
  - `plugins/ruflo-sparc/skills/{sparc-spec,sparc-implement}/SKILL.md` (referenced for escalation citation only)
