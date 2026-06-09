---
adr: 079
status: accepted
date: 2026-06-09
decision: workspace-host-picker
supersedes: —
superseded_by: —
phase: employee-product Phase 8 (road-to-employee-product-and-external-proof)
type: structural
---

# ADR-079 — WorkspacePage host picker (v1)

## Status

**Accepted** · 2026-06-09. Design + a focused tie-break converged via AI-council
(claude-sonnet-4-5 + gpt-4o, design mode, 2026-06-09). **Reverses the v0
deferral** in [`ADR-075`](ADR-075-workspace-gui-drive.md) (which hard-coded
`host: 'claude-code'` "until real usage / if users demand it"): the backend now
drives all three Tier-1 hosts (ADR-072), so surfacing the choice is the
anticipated v1.

## Context

ADR-075 deferred a host picker citing "host ids ≠ model names (confusing), an
N×M test matrix, an unrequested feature." With codex + gemini drive configs
merged, the picker is the natural v1. This ADR confirms the reversal and
addresses the UX concern the deferral raised.

## Decision

| # | Question | Verdict | Rationale |
|---|---|---|---|
| 1 | Labels | **Friendly label + id**: `Claude Code (claude-code)`, `Codex (codex)`, `Gemini (gemini)`. | Resolves the "ids are confusing" concern without hiding the id the backend uses. |
| 2 | Placement | **Global header `<select>`** (one host per session) — **tie-break decision**. | Round 2 split (global vs per-task); the tie-break converged on global: v0 was already session-global, zero data on per-task switching, per-task + sessionStorage has the *same* stickiness with more UI repetition. |
| 3 | Persistence | Default `claude-code`; persist in **`sessionStorage`** (per-session), not `localStorage`. | Cross-session stickiness without usage data is speculative ("spooky action"); session scope matches the picker's session-global model. |
| 4 | Options | The **three Tier-1 hosts** only. | The inbox is already the automatic degrade when a CLI is absent — a manual inbox option is redundant chrome. |
| 5 | Availability | A new **`GET /workspace/hosts`** returns each Tier-1 host's `cli_present`; the picker **disables an uninstalled host** with a "not installed" note. **Fail open** — no availability data → all hosts selectable. | The council's hardest hit: a "dumb" picker lets a user pick an absent host and waste a launch that only degrades to the inbox. The probe is side-effect-free (`shutil.which`), no API spend. |

No feature flag: the picker **defaults to `claude-code`**, exactly v0's
behaviour, so the safe fallback is the default itself.

## Surface

- `GET /api/v1/workspace/hosts` → `{ hosts: [{ id, cli_present, effective_tier }] }`
  (Tier-1 only, via `workspace_hosts.py list`). Fail-open to `[]`.
- `WorkspacePage`: a header `HostPicker` `<select>` (friendly labels, absent
  hosts disabled) → `setSelectedHost` persists to `sessionStorage`; `launch()`
  sends `selectedHost`. Continuation still resumes the session's recorded host
  (unchanged).

## Consequences

- An employee can run a task on Codex or Gemini, not just Claude Code, and sees
  which hosts are actually installed before picking.
- Availability + host fetches are **non-critical** in `load()` — a failure
  degrades to "all hosts enabled" / empty, never blocks the page.
- Continuation (ADR-076) is unaffected — it always resumes the host recorded on
  the session's turns, regardless of the current picker value.

## Alternatives considered

- **Per-task picker** — rejected at tie-break: same stickiness as the global
  select with more per-launch chrome; no evidence for per-task host variance.
- **localStorage persistence** — rejected: cross-session stickiness is
  speculative without usage data.
- **Manual "inbox hand-off" option** — rejected: redundant with the automatic
  absent-CLI degrade.
- **Dumb picker (no availability)** — rejected: wastes a launch on an absent
  host; the cheap `which` probe avoids the first-run friction.

## Deferred to v1+ (debt)

Live availability polling (re-probe without a reload), a model-tier hint per
host, and per-task host override (only if usage shows real per-task variance).

## References

- [`ADR-075`](ADR-075-workspace-gui-drive.md) — the v0 deferral this reverses.
- [`ADR-072`](ADR-072-codex-gemini-drive-configs.md) — the codex/gemini drive configs that make the choice meaningful.
- [`ADR-068`](ADR-068-host-tier-detection.md) — `workspace_hosts.py` detection the `/hosts` endpoint reuses.
