---
stability: beta
keep-beta-until: 2026-08-12
---

# Cost governance dashboard

> **Status:** beta — first draft 2026-05-16 (Phase 2 Item 10 of
> `step-15-product-refinement`).
>
> **Related:** [`config-presets`](config-presets.md) (caps schema) ·
> [`cost-profile-defaults`](cost-profile-defaults.md) (default
> selection) · `scripts/cost/budget.mjs` (existing local-store
> primitive) · `scripts/cost/track.mjs` (session ingest).

The `agent-config cost` subcommand surfaces accumulated spend against
the active preset's caps. Read-only, CLI-first, no UI. Wraps the
existing `scripts/cost/*.mjs` primitives behind a single discoverable
verb so a user can ask "where am I against my budget?" without knowing
the storage layout.

## Surface

```
agent-config cost                       # default: status (this period's spend)
agent-config cost status [--json]       # spend vs caps for daily/weekly/monthly
agent-config cost ingest                # pull latest session.jsonl → local store
agent-config cost history [--period=today|week|month] [--limit=N]
agent-config cost reset --confirm       # truncate sessions.jsonl + budget.json
```

All subcommands are **read-only by default**. `ingest` writes only to
`agents/cost-tracking/sessions.jsonl`. `reset` is destructive and
gated by `--confirm` (Hard-Floor per
[`non-destructive-by-default`](../../dist/agent-src/rules/non-destructive-by-default.md)).

## `cost status` — output contract

Human format:

```
Cost (preset: balanced · profile: developer)

Period       Spent      Cap        Remaining   %   Status
today        $2.43      $10.00     $7.57       24%  ✅
week         $14.20     $40.00     $25.80      36%  ✅
month        $52.10     $150.00    $97.90      35%  ✅

MCP calls:     12 today · 47 this week · 188 this month
Council calls:  1 today ·  3 this week ·  11 this month

Next threshold notification at 75% (week: $30.00).
```

`--json` output schema:

```json
{
  "preset": "balanced",
  "profile": "developer",
  "periods": {
    "today":   {"spent_usd": 2.43,  "cap_usd": 10.00,  "remaining_usd": 7.57,  "pct": 0.243, "status": "ok"},
    "week":    {"spent_usd": 14.20, "cap_usd": 40.00,  "remaining_usd": 25.80, "pct": 0.355, "status": "ok"},
    "month":   {"spent_usd": 52.10, "cap_usd": 150.00, "remaining_usd": 97.90, "pct": 0.347, "status": "ok"}
  },
  "calls": {
    "mcp":     {"today": 12, "week": 47, "month": 188},
    "council": {"today": 1,  "week": 3,  "month": 11}
  },
  "next_threshold": {"period": "week", "pct": 0.75, "trigger_usd": 30.00}
}
```

### Status field

| Value | Trigger | Exit code |
|---|---|---|
| `ok` | `pct < 0.75` | 0 |
| `warn` | `0.75 ≤ pct < 1.0` | 0 |
| `over` | `pct ≥ 1.0` | 1 |

Overall exit = worst-of across the three periods. `--json` always
emits the full object regardless of exit.

## Data sources

| Field | Source |
|---|---|
| `preset` | Active preset id from [`config-presets`](config-presets.md) resolution chain. |
| `cap_usd` | `preset.cost.{daily,weekly,monthly}_max_usd`. |
| `spent_usd` | Sum of `cost_usd` field over `agents/cost-tracking/sessions.jsonl` records inside the period window. |
| `calls.mcp.*` | Sum of `mcp_calls` field in the same records. |
| `calls.council.*` | Count of records whose `kind` is `council`. |
| `next_threshold` | Smallest `(period, pct ∈ preset.notifications.threshold_pct)` tuple where `spent_usd < pct × cap_usd`. |

When the active preset declares no `cost.*` cap (legacy installs),
`cap_usd` is reported as `null` and `status` is `ok`. The tool does
**not** invent a default cap.

## Enforcement vs surfacing

`agent-config cost` is **read-only**. Enforcement (refuse a council
or MCP call that would push spend over a cap) lives at the call site
per the active preset's `cost.enforce` setting (`off`, `advisory`,
`hybrid`, `hard`). This contract does not change enforcement; it only
makes the existing local-store data discoverable.

## Refresh model

`sessions.jsonl` is appended to by the Claude Code session hooks
(see `scripts/cost/track.mjs`). `cost status` reads what's there;
`cost ingest` triggers a one-shot pull from `~/.claude/projects/`.
Users running a non-Claude-Code agent surface call `cost ingest`
manually after a session; users on Claude Code with hooks installed
never need to.

## Validation

`scripts/lint_cost_dashboard.py` (Phase 2 deliverable — not yet
shipped) fails CI on:

- Schema drift in `sessions.jsonl` (missing required fields).
- Preset declaring `cost.*` caps that disagree with this contract's
  expected period grid.
- `cost status --json` output diverging from the schema above.

## What this contract does **not** do

- **Does not** ship a UI. CLI-first, by design.
- **Does not** introduce per-skill or per-command cost attribution
  beyond `kind` (`council` vs other). Per-skill attribution is a
  Phase 3 candidate.
- **Does not** override per-call hard caps from the preset.
- **Does not** roll up across multiple projects. Each project's
  `agents/cost-tracking/` is its own scope.

## See also

- [`config-presets`](config-presets.md) — preset caps + `enforce` semantics
- [`cost-profile-defaults`](cost-profile-defaults.md) — default preset selection
- [`safety-model`](safety-model.md) — `mcp_call_costly` domain
- `scripts/cost/budget.mjs`, `scripts/cost/track.mjs` — wrapped primitives
- `step-15-product-refinement` § Phase 2 Item 10
