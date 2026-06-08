---
adr: 068
status: accepted
date: 2026-06-08
decision: host-tier-detection
supersedes: —
superseded_by: —
phase: employee-product Phase 8 (road-to-employee-product-and-external-proof)
type: structural
---

# ADR-068 — Host-agent tier detection (v0)

## Status

**Accepted** · 2026-06-08. Design converged via AI-council (claude-sonnet-4-5 +
gpt-4o, design mode, 2026-06-08), with one verdict reversed on review (see H3).

## Context

The workspace shells out to a host agent per ADR-023; `host-agent-protocol.md`
is the source-of-truth inventory + tier matrix (Tier 1 = CLI-drivable: Claude
Code / Codex / Gemini; Tier 3 = observe-only → inbox hand-off: Augment / Cursor
/ Cline / Windsurf). Nothing detected a host's tier — `launch` took a free-text
`host` string and recorded a session blindly. The **Tier-1 drive loop**
(`claude -p …` turn loop) is unbuilt and stays so.

## Decision

### H1 — code map mirroring the contract + consistency test
`workspace_hosts.py HOST_INVENTORY = {id: {tier, cli}}` mirrors the contract's
inventory table. `tests/test_workspace_hosts.py::test_inventory_matches_contract_tiers`
parses the contract table and asserts every tier agrees — so the human-readable
contract stays canonical without fragile **runtime** markdown parsing (the
parsing lives in the test, not the hot path).

### H2 — effective tier = inventory tier capped by CLI presence
`effective_tier = 1 iff (inventory_tier == 1 and shutil.which(cli)) else 3`.
A Tier-1 host whose CLI is missing demotes to Tier 3 (the contract's fail-closed
rule). Detection is **deterministic and side-effect-free** — PATH probe only, it
**never spawns** a host CLI (a test asserts no `subprocess.run`/`Popen`). A
`--version` probe (vs PATH-only) is v1 debt.

### H3 — launch reports the tier; it does NOT drive (council verdict reversed)
The design first proposed a Tier-1 `{tier:1, mode:'session-recorded'}` branch.
**Rejected on review** as a phantom state — recording a Tier-1 "launch" that
cannot execute is dead telemetry with no rollback. Instead `launch` resolves the
effective tier and **reports** it (`effective_tier`, `cli_present`, `known`,
`mode`) alongside the recorded session; `mode` is honest —
`tier1-drive-pending` (drivable, drive unbuilt) or `handoff` (use the inbox).

**Scope honesty:** the council assumed `launch` could auto-route Tier-3 to the
inbox. It cannot in v0 — `launch` has only `role`+`task`, not a *rendered*
prompt, and the prompt renderer is unbuilt. So `launch` **reports** the tier;
the actual hand-off stays the explicit `POST /api/v1/workspace/inbox` (which
takes a caller-rendered prompt + skill pre-render, ADR-065/066). Auto-routing
`launch → inbox` is deferred to when the prompt renderer lands.

### Unknown host — fail-soft in-process, fail-loud at the CLI
`detect(host_id)` returns `known: false, effective_tier: 3` for an unregistered
id (so `launch` never 500s on a host string), while the `detect` **CLI exits
non-zero** on an unknown id (so tooling / tests catch typos). `local` (the
legacy `launch` default) is unregistered → Tier-3 hand-off, `known: false`.

### H4 — single PR
Detector + `launch` tier-reporting + the contract-consistency test + cross-
runtime tests, one PR. No dead code (a detector with no caller has no
integration proof).

## Consequences

- `launch` now tells the caller whether a host is CLI-drivable or needs the
  hand-off — the seam the UI/caller uses to pick the path.
- No phantom Tier-1 sessions; no fabricated drive.
- Plaintext, no cryptography dependency; detection is always-on (harmless —
  read-only PATH probe).

### Deferred (v1 debt)
- `--version` probe instead of PATH-only presence.
- A generated inventory manifest (vs the hand-maintained map + consistency test).
- Detection circuit-breaker / error-rate metrics.
- `launch → inbox` auto-routing (awaits the prompt renderer).
- The Tier-1 drive loop itself (ADR-023 Tier-1 conversation surface).

## References

- ADR-023 — host-agent protocol (tier definitions).
- ADR-065/066 — the Tier-3 inbox hand-off + skill pre-render this reports toward.
- Contract: [`docs/contracts/host-agent-protocol.md`](../contracts/host-agent-protocol.md).
- `src/cli/python/workspace_hosts.py`, `src/server/routes/workspace.ts`.
