---
stability: beta
keep-beta-until: 2026-08-14
---

# Profile System — Contract

> **Status:** beta · **Owner:** package maintainer · **Last reviewed:** 2026-05-16
>
> Schema and semantics for the **Profile** axis introduced in step-15
> Phase 1 item 1. Profile answers *who is the user?* — audience
> taxonomy that selects the default skill/command surface, README
> entry-paragraph, and persona pre-selection. Boundary against
> `preset.id`, `pack.id`, and `cost_profile`:
> [`ADR-010`](../decisions/ADR-010-profile-pack-preset-boundary.md).

## Decision

A **profile** declares the user's audience identity. Six seed profiles
ship; users can declare their own under
`.agent-src.uncondensed/profiles/<id>.yml`.

| `profile.id` | Audience | README entry-paragraph | Default `preset.id` |
|---|---|---|---|
| `founder` | Solo / early-stage founder; wears every hat | "Ship the company, not the codebase" | `fast` |
| `developer` | IC engineer; primary day-to-day user today | "Pair with a senior reviewer that never sleeps" | `balanced` |
| `content_creator` | Writers, ghostwriters, marketers | "Your voice, my hands" | `balanced` |
| `agency` | Multi-client delivery shop | "Same playbook across every client repo" | `strict` |
| `finance` | CFO / fractional finance / FP&A | "Forecasts and memos with the receipts attached" | `strict` |
| `ops` | RevOps, support, SRE-adjacent | "Procedures that get followed, not skipped" | `strict` |

The seed set is **fixed for v2.x**. Adding a seventh profile requires
an ADR — the contract surface that ships in the wizard
(`/onboard` role-selection) treats this set as exhaustive.

## Profile shape

```yaml
profile:
  id: developer
  audience:
    label: "IC engineer"
    readme_anchor: "developer"          # selects README first-screen block
  defaults:
    preset_id: balanced                  # may be overridden by .agent-settings.yml
    personas: [reviewer, security]       # pre-selected persona ids
    skills_hint: [developer-like-execution, verify-before-complete, minimal-safe-diff]
  surface:
    commands_hint: [work, implement-ticket, review-changes, fix]
    docs_first_pointer: "docs/getting-started-by-role.md#developer"
```

Per [ADR-010](../decisions/ADR-010-profile-pack-preset-boundary.md), a
profile **MAY** set `defaults.preset_id` but **MAY NOT** set any
preset-owned knob directly. The lint task (`task lint-config-schema`)
enforces this.

## Loader contract

The Phase 1 loader lives at `scripts/config/profiles.py`. Resolution
chain (last writer wins):

1. `pack.profile_id` (if pack active) → `profile.id`.
2. `.agent-settings.yml` top-level `profile:` block → `profile.id`
   and any user overrides for `audience` / `defaults` / `surface`.
3. Environment variable `AGENT_CONFIG_PROFILE_ID` → `profile.id`.
4. Runtime CLI flag `--profile=<id>` → `profile.id`, single session.

If no profile resolves, the loader **does not pick a default
silently** — it falls back to `developer` only when
`.agent-settings.yml` is missing entirely (fresh install before
`/onboard`). With a settings file present but no `profile:` block,
the loader raises a structured warning pointing to `/onboard`.

```
RATIONALE: a silent default would hide the "I never picked an audience"
state from the wizard, breaking the council v3 observation that audience
choice must be a deliberate act of the user, not an agent inference.
```

## Resolution outcome

After the loader runs, the session has:

```python
{
  "id": "developer",
  "audience": {"label": "IC engineer", "readme_anchor": "developer"},
  "preset_id": "balanced",
  "personas": ["reviewer", "security"],
  "skills_hint": ["developer-like-execution", ...],
  "commands_hint": ["work", "implement-ticket", ...],
  "source": "user-settings | env | runtime | pack | default",
}
```

The `source` field is mandatory and feeds the
`/agent-config explain`
command (Phase 1 item 3).

## User-defined profiles

A consumer project MAY ship a custom profile under
`.agent-src.uncondensed/profiles/<id>.yml`. Constraints:

- `id` MUST be unique across seed + user-defined profiles.
- Shape MUST match the seed contract above (audience / defaults / surface).
- `defaults.preset_id` MUST reference an existing preset
  ([`config-presets.md`](config-presets.md)).
- The lint task hard-fails on schema violations.

User-defined profiles do **not** require an ADR — they are project-local.
Only changes to the **seed set** require an ADR.

## Drift detection

`task lint-config-schema` (added in Phase 1) hard-fails when:

- A profile YAML names a preset-owned knob (cost cap, autonomy,
  confidence, risk).
- A profile YAML references a non-existent `preset_id`.
- The seed-profile count diverges from this contract's table.
- `defaults.personas` references a persona id that does not exist
  under `.agent-src.uncondensed/personas/`.

## Non-goals

- This contract does **not** define preset knobs. See
  [`config-presets.md`](config-presets.md).
- It does **not** define packs. See `workflow-packs.md` (Phase 2 item 7).
- It does **not** override `cost_profile`. The rule-tier loader keeps
  its independent axis per
  [`cost-profile-defaults.md`](cost-profile-defaults.md).
- It does **not** ship a UI. Profile selection happens in `/onboard`
  (step-15 Phase 1 item 2).

## See also

- [`ADR-010`](../decisions/ADR-010-profile-pack-preset-boundary.md) — axis boundary.
- [`config-presets.md`](config-presets.md) — preset knobs.
- [`cost-profile-defaults.md`](cost-profile-defaults.md) — rule-tier axis (orthogonal).
- `step-15-product-refinement` — Phase 1 item 1.
