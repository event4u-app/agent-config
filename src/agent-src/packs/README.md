# Workflow packs

Seed packs that bundle `(profile + preset + command-set +
skill-allowlist + personas)` into a single opinionated stance. A
user adopts a pack instead of picking five independent settings.

**Schema:** [`docs/contracts/workflow-packs.md`](../../docs/contracts/workflow-packs.md).

## Shipped packs

| Pack id | Profile | Preset | One-liner |
|---|---|---|---|
| [`founder-mvp`](founder-mvp.yml) | `founder` | `fast` | Ship the MVP and the pitch deck in the same week. |
| [`content-engine`](content-engine.yml) | `content_creator` | `balanced` | Editorial calendar, brand voice, and ghostwriter on one loop. |
| [`agency-delivery`](agency-delivery.yml) | `agency` | `strict` | Multi-client refine → estimate → deliver with audit-grade trace. |

## Activation

```bash
# Adopt a pack at install time:
npx @event4u/agent-config init --pack founder-mvp

# Adopt a pack later (writes pack.id to .agent-settings.yml):
agent-config onboard --pack content-engine

# Revert to the underlying profile + preset defaults:
agent-config onboard --pack none
```

Packs are an **opt-in layer above the profile + preset chain**.
Removing a pack reverts cleanly; no data is lost.

## Constraints (enforced by the schema, not runtime)

- `commands_allowed` ≤ 12, `skills_allowed` ≤ 15, `personas` ≤ 4.
- Every referenced command / skill / persona / profile / preset
  MUST resolve to an existing artefact.
- Packs cannot widen safety floors. Domain-safety rules apply
  unconditionally.

## Adding a pack

1. Pick a `<pack-id>` that does not collide with any profile or preset id.
2. Copy one of the shipped packs as a template.
3. Fill in `rationale.*` — every pack must justify its composition in
   plain prose.
4. Add the row to the table above.
5. Open a PR; reviewer validates against the schema by hand until
   `scripts/lint_packs.py` lands.
