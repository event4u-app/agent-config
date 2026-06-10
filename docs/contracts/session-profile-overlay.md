---
stability: beta
keep-beta-until: 2026-09-02
---

# Session-profile overlay — contract

> **Status:** beta · **Owner:** package maintainer · **Last reviewed:** 2026-06-02
>
> Schema and semantics for the `runtime.active_packs` overlay shipped by the
> `/profile` command cluster. The overlay lets a developer activate a
> profile for the **current session** so only the matching packs'
> commands/skills are the surfaced set, then switch freely without
> persisting the choice. Locked decisions: the session-profile-activation
> roadmap Phase 0. Axis boundary: the
> [ADR-010 addendum](../decisions/ADR-010-profile-pack-preset-boundary.md).

## Decision

The overlay is an **ephemeral, runtime modulation of the `pack` axis** — an
instance of the resolution chain's existing
`… → user/env/runtime overrides` link. It is **not** a fifth axis.

It selects which already-installed packs are *surfaced* this session; it
never installs, never persists, never gates execution.

## On-disk shape

Written to `agents/settings/.agent-settings.local.yml` (gitignored,
deepest-winning cascade layer) — **never** the committed `.agent-settings.yml`.

```yaml
runtime:
  active_packs: [engineering-base, laravel, php]   # expanded closure, sorted
```

- `runtime.active_packs` — a list of installed pack ids: the transitive
  `requires_hint` closure of the activated profile/pack seed set.
- Absent / empty / wrong-type → **no overlay** (full surface).

## Activatable tokens

`/profile activate <name…>` accepts, for each name:

1. a **session-profile alias** from `src/config/discovery/session-profiles.yml`
   (`developer`, `po`, `finance`, `gtm`, `content`) → its seed pack list, or
2. a **raw pack id** from `src/config/discovery/packs.yml` (`laravel`, `php`, …).

Multiple names union their closures. The seed set's transitive
`requires_hint` closure is expanded before writing. **Only installed packs
are activatable** — a not-installed seed pack fails fast (exit 2). Installed
set = the top-level `packs:` block in settings, or the full vocabulary when
no block is present (maintainer repo / base-only install).

## Surface filter (recommendation-bias)

For each `command` / `skill` artefact in `dist/discovery/discovery-manifest.json`:

- **always surfaced** when it is **core-trust** (`trust.level == "core"`) or
  unscoped (no `packs`);
- otherwise **surfaced iff** `packs ∩ active_packs ≠ ∅`;
- **no overlay → everything surfaced.**

Execution is **never gated**: an inactive-pack artefact still runs, with a
one-line "from inactive pack X" notice. Hard execution-gating is deferred
(host-dependent — see
[`session-host-capability-audit`](../../agents/settings/contexts/session-host-capability-audit.md)).

## Lifecycle (locked: option a)

- **Activate / switch / deactivate** are explicit `/profile` sub-commands.
- The overlay **survives an IDE restart** (task-scoped). A new session emits
  a **staleness notice** via the `profile-staleness` `session_start` hook —
  it never silently resets (the registry-refresh Catch-22).
- **Kill-switch:** delete `runtime.active_packs` (or the local file).

## Robustness invariants

- **Fail-open read** — a corrupt / unparseable / schema-invalid overlay is
  ignored; the full surface returns. A misconfigured overlay never hides
  artefacts.
- **Atomic write** — the helper writes via a temp file + `os.replace`, so a
  concurrent reader never sees a half-written overlay.
- **Closure self-heal** — a closure dependency that is not installed is
  dropped from the written set with a note, never blocking activation.
- **Set-only — precedence intentionally undefined.** The overlay is an
  order-independent **union of pack ids**: no precedence, no scalar
  "audience hint", no ordering. `set_overlay` always writes `sorted(set(...))`,
  and the static definitions are frozen at the data layer by
  `scripts/lint_profile_overlay_set_only.py` (aliases resolve only to pack-id
  sets; no profile/pack file declares a scalar `active_packs` or a
  `precedence`/`priority`/`order` key). A future scalar-precedence regression
  fails the build rather than silently re-introducing a precedence concept.

## Reconciliation with the existing `--profile=<id>` install flag

The install/CLI flag `--profile=<minimal|balanced|full>`
(`scripts/install.py`) is a **legacy alias for `rule_loading_tier`** — it
sets the rule-loading cost tier, not an audience profile. The word
"profile" is overloaded across three distinct, orthogonal things; this
command does **not** add a fourth meaning:

| Surface | What it sets | Axis | Persists? |
|---|---|---|---|
| `install --profile=<minimal\|balanced\|full>` | `rule_loading_tier` (cost tier) | rule_loading_tier | yes |
| `profile.id` in settings (`founder`/`developer`/…) | audience identity → default surface + personas ([`profile-system`](profile-system.md)) | profile | yes |
| **`/profile activate <name>`** (this command) | `runtime.active_packs` — which installed packs are *surfaced* this session | pack (runtime overlay) | **no** |

The session overlay answers *which installed packs are surfaced right now?*.
It does **not** change `rule_loading_tier`, does **not** change
`profile.id`, and writes only the gitignored local file. The naming
collision is pre-existing; the overlay deliberately keeps to the `pack`
axis (ADR-010 addendum) so it adds no new axis despite sharing the word.

## Implementation

- Library + CLI: `scripts/config/session_profiles.py`
  (`activate` · `deactivate` · `show` · `surface` · `stale-notice`).
- Aliases: `src/config/discovery/session-profiles.yml`.
- Hook: `scripts/profile_staleness_hook.py` (session_start staleness notice).
- Tests: `tests/test_session_profiles.py`.

## Plain status surface

`/profile show --plain` renders the active-overlay state in plain language for a
**non-technical employee** — "which profile, what it surfaces/hides, why the
agent behaves differently" — over the existing `show` state, with **zero new
overlay logic**.

It is a **deterministic, template-based** render (`session_profiles.format_plain_status`),
**never LLM-generated**: a pure function of the `show` JSON
(`active_packs`, `commands_shown`, `skills_shown`, `hidden_total`). This is a hard
constraint — it removes any hidden-pack-name leak or hallucination surface, and
lets the golden tests pin the output byte-for-byte.

The render says, for an active overlay:

1. the active profile/pack name(s);
2. how many commands + skills you'll **see**;
3. how many items are **hidden** behind packs you haven't turned on (this doubles
   as the "what changed vs the full surface" line);
4. that the overlay **persists across sessions** until `/profile deactivate`.

With no overlay it states the full surface is active.

**Staleness is rendered as persistence, not an age-in-days.** The overlay
(`runtime.active_packs`) carries no timestamp, and adding one would change overlay
semantics — out of scope for this surface. A future age-in-days render is a
separate, semantics-touching change (an overlay set-time), not a plain-render
concern. The session-boundary reminder remains the `stale-notice` hook's job.

## See also

- [`ADR-010 addendum`](../decisions/ADR-010-profile-pack-preset-boundary.md) — overlay ≠ fifth axis.
- [`profile-system`](profile-system.md) — the profile (audience) axis the overlay is reconciled against.
- [`command-clusters`](command-clusters.md) — the `/profile` cluster registration.
- [`session-host-capability-audit`](../../agents/settings/contexts/session-host-capability-audit.md) — why hard-gating + true session-reset are deferred.
