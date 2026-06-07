---
stability: beta
keep-beta-until: 2026-08-14
---

# Config Presets — Contract

> **Status:** beta · **Owner:** package maintainer · **Last reviewed:** 2026-05-16
>
> Schema and semantics for the **Config Preset** axis introduced in
> step-15 Phase 1 item 4. Records the **Cost Enforcement** model
> (Council v3 action #3 prerequisite) so the preset loader can ship.
> Boundary against `profile.id`, `pack.id`, and `rule_loading_tier`:
> [`ADR-010`](../decisions/ADR-010-profile-pack-preset-boundary.md).

## Decision

A **preset** owns governance knobs that the user wants to tune as a
bundle, not individually. Three seed presets ship; users can declare
their own under `.agent-src.uncondensed/presets/<id>.yml`.

| `preset.id` | Stance | Typical user |
|---|---|---|
| `fast` | Lowest friction; widest autonomy; loosest cost caps | Solo founder, throw-away prototype, exploration |
| **`balanced`** *(default)* | Moderate friction; per-task autonomy; sensible cost caps | Day-to-day work; default for any new install |
| `strict` | Highest friction; ask-by-default; tight cost caps; block-on-risk | Production paths, regulated work, shared trunks |

Profile-aware overlay: `developer + strict` ≠ `founder + strict` — the
profile selects which knob in the preset is read first (e.g. `developer`
reads `block_on_risk.code_paths`, `founder` reads `block_on_risk.financial_paths`).

## Preset shape

```yaml
preset:
  id: balanced
  autonomy:
    default: auto              # on | off | auto (see autonomous-execution rule)
    trivial_suppress: true
  confidence:
    min_band: medium           # low | medium | high — block plan if below
    require_evidence: false
  risk:
    block_on: [security, prod_data]
    ask_on: [bulk_delete, schema_change]
  council:
    auto_consult: false
    cap_per_consult_usd: 0.50
  mcp:
    per_call_max_usd: 0.10
    per_session_max_usd: 2.00
  cost:
    daily_max_usd: 10.00
    weekly_max_usd: 50.00
    monthly_max_usd: 150.00
    enforce: hybrid            # see Cost Enforcement section
  notifications:
    threshold_pct: [50, 75, 90, 100]
```

## Cost Enforcement

*Hybrid model* — recorded as the Phase 1 prerequisite per Council v3
action #3. Two enforcement surfaces, one decision per call.

### Hard enforcement (preset loader, blocking)

The preset loader **refuses to dispatch** any council or MCP call whose
*estimated* cost exceeds the active preset's per-call ceiling. The
estimate is read from the model adapter (`council_cli.py estimate` for
council; the MCP tool manifest for MCP). The block is raised **before**
the network call. There is no override flag — the user must change the
preset, override `cost.per_call_max_usd` in `.agent-settings.yml`, or
pass `--preset=fast` on the CLI.

```
PRE-CALL CEILING IS HARD.
NO RUNTIME OVERRIDE. NO "JUST THIS ONCE" FLAG.
EXCEED → REFUSE → SURFACE THE CEILING + THE OVERRIDE PATH.
```

Applies to:

- AI Council consults (`scripts/council_cli.py run`).
- MCP tool calls dispatched through the universal dispatcher
  ([`hook-architecture-v1`](hook-architecture-v1.md)).
- Any future skill that reads `preset.cost.per_call_max_usd`.

### Advisory dashboard (retroactive, non-blocking)

`agent-config cost` (Phase 2 item 10) surfaces daily / weekly / monthly
spend against the active preset's caps. The dashboard **does not**
block — it warns at the thresholds in `preset.notifications.threshold_pct`
(default `50 / 75 / 90 / 100`). At 100 %, the dashboard prints a hard
warning; the next session start re-checks the cap against the running
total before dispatching the next paid call.

The advisory layer's role is **awareness**, not enforcement. Enforcement
is exclusively the per-call ceiling above; retroactive blocking would
turn a session unrecoverably hostile mid-task.

### What the loader does **not** do

- It does **not** estimate cost for unpaid local model calls
  (`ollama`, local llama.cpp). These bypass both surfaces.
- It does **not** estimate cost for non-LLM tool calls (file reads,
  shell commands, MCP-static-resource fetches). The per-call ceiling
  targets paid token spend.
- It does **not** override the Hard Floor in
  [`non-destructive-by-default`](../../dist/agent-src/rules/non-destructive-by-default.md)
  — a preset cannot lift the universal safety floor.

## Resolution chain

Reads happen in this order; last writer wins for any single knob:

1. `pack.preset_id` (if pack active) → set `preset.id`.
2. `profile.preset_id` → set `preset.id` (if not already set by pack).
3. `preset.<id>.yml` → fill all knobs.
4. `.agent-settings.yml` user keys under `preset:` → override per-knob.
5. Environment variables (`AGENT_CONFIG_PRESET_COST_DAILY_MAX_USD=…`)
   → override per-knob.
6. Runtime CLI flags (`--preset-cost-per-call-max-usd=…`) → override
   per-knob, single session.

Per [`ADR-010`](../decisions/ADR-010-profile-pack-preset-boundary.md),
no other axis may write preset-owned knobs.

## Drift detection

`task lint-config-schema` (added in Phase 1) hard-fails when:

- A pack YAML or profile YAML names a preset-owned knob.
- A preset YAML names a knob outside this contract.
- The three seed presets diverge from the documented stances above.

## Non-goals

- This contract does **not** define profiles, packs, or `rule_loading_tier`.
  See the corresponding contracts.
- It does **not** ship a UI. CLI-first (`agent-config cost`,
  `agent-config preset set <id>`).
- It does **not** auto-migrate existing installs. Without a preset,
  the loader falls back to current per-knob defaults (`balanced`-equivalent).
