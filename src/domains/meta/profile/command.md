---
model_tier: medium
name: profile
pack: meta
tier: 2
visibility: internal
description: Session-profile orchestrator — activate / deactivate / show the active packs for this session (recommendation-bias surface filter, no persistence)
cluster: profile
type: orchestrator
suggestion:
  eligible: true
  trigger_description: "activate a profile for this session, switch to the laravel/po/finance surface, show which packs are active, deactivate the profile"
  trigger_context: "user wants to narrow the surfaced commands/skills to one audience for the current session without changing committed config"
workspaces:
  - agent-config-maintainer
packs:
  - meta
---

# /profile

Top-level orchestrator for the `/profile` family. Activates a **session
profile** — an ephemeral `runtime.active_packs` overlay that biases which
commands/skills are *surfaced* this session, without persisting anything
to committed config.

The overlay is a runtime modulation of the existing `pack` axis, **not** a
fifth axis (ADR-010 addendum, 2026-06-02). It is written to
`.agent-settings.local.yml` (in `agents/settings/`, gitignored, deepest
layer), never the committed `.agent-settings.yml`.

## Sub-commands

| Sub-command | Routes to | Purpose |
|---|---|---|
| `/profile activate <name…>` | `commands/profile/activate.md` | Surface only the named profile/pack closure + core artefacts |
| `/profile deactivate [name…]` | `commands/profile/deactivate.md` | Clear the overlay (or drop named packs) → full surface returns |
| `/profile show` | `commands/profile/show.md` | Active packs + surfaced/hidden counts (observability) |

`<name>` is a session-profile alias (`developer`, `po`, `finance`, `gtm`,
`content`) from `config/discovery/session-profiles.yml` **or** a raw pack
id from `config/discovery/packs.yml` (`laravel`, `php`, …). Multiple names
union their closures: `/profile activate laravel po`.

## Key facts (locked in Phase 0)

- **Recommendation-bias only.** Activation filters the *surfaced* set
  (`/help` + `<available_skills>`); execution is **never gated** — an
  inactive-pack command still runs, with a one-line notice.
- **Explicit deactivation.** The overlay survives an IDE restart; clear it
  with `/profile deactivate`. A new session emits a staleness *notice*
  (never a silent reset — the registry-refresh Catch-22, see
  `agents/settings/contexts/session-host-capability-audit.md`).
- **Fail-open.** A corrupt overlay is ignored → the full surface returns.
- **Kill-switch.** Delete `runtime.active_packs` from the local file (or
  the file itself) to reset.

## Dispatch

1. Parse `/profile <sub-command> [args]`.
2. Look up the sub-command above; load that file and follow its
   `## Instructions` verbatim with the remaining args.
3. Bare `/profile` (no sub-command) → run `/profile show`.
4. Unknown sub-command → print the table and ask which the user meant.

## See also

- [`mode`](mode.md) — the persist-to-disk precedent this command deliberately avoids.
- [`docs/decisions/ADR-010-profile-pack-preset-boundary.md`](../../docs/decisions/ADR-010-profile-pack-preset-boundary.md) — axis boundary + overlay addendum.
- [`docs/contracts/session-profile-overlay.md`](../../docs/contracts/session-profile-overlay.md) — overlay schema + surface-filter contract.
