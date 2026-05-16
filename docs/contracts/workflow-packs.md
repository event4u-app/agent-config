---
stability: beta
keep-beta-until: 2026-08-12
---

# Workflow packs

> **Status:** beta — first draft 2026-05-16 (Phase 2 Item 7 of
> `step-15-product-refinement`).

A **workflow pack** bundles a `(profile + preset + command-set +
skill-allowlist)` combination into a single YAML so a user can adopt
the full opinionated stance for their role without picking five
independent settings.

Packs do **not** introduce new commands, skills, or rules. They are
a **composition contract** — every reference must resolve to an
existing artefact that has already passed its own contract / linter
gates.

## Schema

```yaml
# .agent-src.uncompressed/packs/<pack-id>.yml
pack:
  id: <pack-id>                      # kebab-case, file name without .yml
  audience:
    label: "<human-readable>"
    one_liner: "<= 120 chars, what the pack does for the user>"
  composition:
    profile_id: <profile.id>         # MUST exist in profiles/
    preset_id: <preset.id>           # MUST exist in presets/
  surface:
    commands_allowed:                # ≤ 12 — slash-command names without leading slash
      - <command>
    skills_allowed:                  # ≤ 15 — skill IDs from skills-catalog
      - <skill>
    personas:                        # ≤ 4 — persona IDs from personas/
      - <persona>
  rationale:                         # why this combination, not free-form notes
    why_this_profile: "<one paragraph>"
    why_this_preset: "<one paragraph>"
    why_these_commands: "<one paragraph>"
```

### Field semantics

| Field | Type | Required | Notes |
|---|---|:-:|---|
| `pack.id` | string | yes | Matches file stem. No collision with `profile.id` or `preset.id`. |
| `composition.profile_id` | string | yes | Override applied to the chain documented in [`profile-system`](profile-system.md). Pack-supplied id wins over `.agent-settings.yml` only when the user explicitly opts in via `/onboard --pack <id>`. |
| `composition.preset_id` | string | yes | Override applied to the chain documented in [`config-presets`](config-presets.md). Same opt-in semantics. |
| `surface.commands_allowed` | list[string] | yes | Cap = **12**. Items must appear in [`command-clusters`](command-clusters.md). The pack does **not** disable other commands — the cap is for the wizard's first-screen rendering, not enforcement. |
| `surface.skills_allowed` | list[string] | yes | Cap = **15**. Items must appear in `docs/skills-catalog.md`. Same render-only semantics. |
| `surface.personas` | list[string] | yes | Cap = **4**. Items must appear in `.agent-src.uncompressed/personas/`. |
| `rationale.*` | string | yes | Forces every pack to justify its composition in plain prose; reviewed at PR time, not at runtime. |

## Resolution chain

Packs are an **opt-in layer above the profile + preset chain**. The
loader at `scripts/config/packs.py` (Phase 2 deliverable — not yet
shipped) reads the pack iff:

1. `--pack <id>` flag passed to `/onboard` or `agent-config init`, **or**
2. `pack.id` set in `.agent-settings.yml` (written by `/onboard --pack`).

When a pack is active:

- `composition.profile_id` is passed to `profiles.load()` as
  `pack_profile_id` (already wired — see `scripts/config/profiles.py`).
- `composition.preset_id` is passed to `presets.load()` analogously.
- `surface.*` lists override the rendered command / skill lists in
  `/onboard` and in the README "Six entry paths" surface **for the
  duration of the active pack only**.

Removing a pack (`/onboard --pack none`) reverts to the underlying
profile + preset defaults; **no data is lost**.

## Validation

`scripts/lint_packs.py` (Phase 2 deliverable — not yet shipped) fails
CI on:

- Missing required field.
- `profile_id` / `preset_id` / `commands_allowed` / `skills_allowed`
  / `personas` referencing an artefact that does not exist.
- Cap violation (commands > 12, skills > 15, personas > 4).
- `pack.id` collision with another pack, profile, or preset id.

Until the linter lands, packs are reviewed by hand at PR time against
this schema.

## What packs do **not** do

- **Do not** declare new commands. Use [`command-clusters`](command-clusters.md).
- **Do not** modify rules. Use the kernel-rule edit process.
- **Do not** override safety floors. Domain-safety rules
  (`.agent-src.uncompressed/rules/domain-safety-*.md`) apply
  unconditionally — packs cannot widen the deny-list.
- **Do not** ship telemetry or usage hints. Packs are pure composition.

## Seed packs

Three packs ship at Phase 2 Item 7 close:

| Pack id | Profile | Preset | One-liner |
|---|---|---|---|
| `founder-mvp` | `founder` | `fast` | Ship the MVP and the pitch deck in the same week. |
| `content-engine` | `content_creator` | `balanced` | Editorial calendar, brand voice, and ghostwriter on one loop. |
| `agency-delivery` | `agency` | `strict` | Multi-client refine → estimate → deliver with audit-grade trace. |

Each pack lives at `.agent-src.uncompressed/packs/<id>.yml` and is
covered by the validation rules above.

## See also

- [`profile-system`](profile-system.md) — profile axis (audience defaults)
- [`config-presets`](config-presets.md) — preset axis (risk appetite)
- [`command-clusters`](command-clusters.md) — verb axis (invocation)
- [`command-taxonomy`](command-taxonomy.md) — discoverability axis
- `step-15-product-refinement` § Phase 2 Item 7
