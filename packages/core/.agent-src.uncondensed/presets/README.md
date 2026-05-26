# Presets

Seed presets for the [preset system](../../docs/contracts/config-presets.md).
Each preset bundles governance knobs (autonomy / confidence / risk /
council / mcp / cost / notifications) so the user picks a stance, not
a dozen individual values. Boundary against `profile.id`, `pack.id`,
and `cost_profile` lives in
[ADR-010](../../docs/decisions/ADR-010-profile-pack-preset-boundary.md).

## Seed set (v2.x — fixed)

| `preset.id` | Stance | Typical user |
|---|---|---|
| `fast` | Lowest friction, widest autonomy | Solo founder, prototype, exploration |
| `balanced` *(default)* | Moderate friction, per-task autonomy | Day-to-day work |
| `strict` | Highest friction, ask-by-default | Production paths, regulated work, shared trunks |

Adding a fourth seed preset requires an ADR. User-defined project-local
presets (any `<id>.yml` not in the seed list above) are allowed without
an ADR but MUST match the schema enforced by `task lint-config-schema`.

## See also

- [`docs/contracts/config-presets.md`](../../docs/contracts/config-presets.md) — schema, cost enforcement, resolution chain.
- [`docs/contracts/profile-system.md`](../../docs/contracts/profile-system.md) — profile axis.
- [`scripts/config/presets.py`](../../scripts/config/presets.py) — loader.
