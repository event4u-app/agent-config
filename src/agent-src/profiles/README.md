# Profiles

Seed profiles for the [profile system](../../docs/contracts/profile-system.md).
Each profile answers *who is the user?* — audience identity that
selects the default skill/command surface, README entry-paragraph,
and persona pre-selection. Boundary against `preset.id`, `pack.id`,
and `rule_loading_tier` lives in
[ADR-010](../../docs/decisions/ADR-010-profile-pack-preset-boundary.md).

## Seed set (v2.x — fixed)

| `profile.id` | Audience | Default preset |
|---|---|---|
| `founder` | Solo / early-stage founder | `fast` |
| `developer` | IC engineer | `balanced` |
| `content_creator` | Writers, ghostwriters, marketers | `balanced` |
| `agency` | Multi-client delivery shop | `strict` |
| `finance` | CFO / fractional finance / FP&A | `strict` |
| `ops` | RevOps, support, SRE-adjacent | `strict` |

Adding a seventh seed profile requires an ADR. User-defined project-local
profiles (any `<id>.yml` not in the seed list above) are allowed without
an ADR but MUST match the schema enforced by `task lint-config-schema`.

## Not the command views

`src/profiles/*.yaml` carries the same six ids as **command views** — the
curated command set `agent-config commands ls --profile <id>` renders. Its
`packs:` list names the packs whose commands `--expanded` adds; the `packs:`
list here names capability packs for scoped projection. Same key, different
vocabulary, so the two lists are not expected to match. Which tree owns the
"who" axis is an open maintainer decision.

## See also

- [`src/profiles/README.md`](../../profiles/README.md) — the command views.
- [`docs/contracts/profile-system.md`](../../docs/contracts/profile-system.md) — schema and loader contract.
- [`docs/contracts/config-presets.md`](../../docs/contracts/config-presets.md) — preset axis.
- [`scripts/config/profiles.ts`](../../scripts/config/profiles.ts) — loader.
