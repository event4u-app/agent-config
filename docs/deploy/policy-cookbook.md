# Policy cookbook — internal AI OS

> **Status**: 🚧 **skeleton**. Phase 3 of
> [`road-to-internal-ai-os-deployment.md`](../../agents/roadmaps/road-to-internal-ai-os-deployment.md)
> is **not yet implemented**. This file documents the **shape** that
> central org policy will take so operators can review the contract
> before code lands. Every section below is normative-once-shipped.
>
> Open design questions live in
> [`agents/tmp/council-question-central-policy.md`](../../agents/tmp/council-question-central-policy.md).

## Audience

An admin at a deploying organization who needs to set org-wide floors
(and ceilings) that individual users cannot escape.

## File location (planned)

```text
/etc/event4u/policy.yaml          # inside the container
${POLICY_PATH:-./policy.yaml}      # bind-mounted from the host
```

The file is the source of truth. A future admin UI generates this
file, never the other way around.

## Inheritance model (planned)

```text
default → org policy → user settings
                   ↑           ↑
                   |           └── user-only knobs (preferred name,
                   |               IDE, bot icon)
                   └── shared knobs (autonomy ceiling, redaction
                       allowlist, provider allowlist, cost cap) —
                       org wins; user cannot escape upward.
```

## Schema sketch (planned)

```yaml
# /etc/event4u/policy.yaml — example, not yet enforced.
version: 1

autonomy:
  ceiling: review                   # never | review | apply-low | apply-medium
  user_can_lower: true

redaction:
  allowlist_paths: []               # paths users are allowed to disable redaction for
  block_paths:                      # paths where redaction is mandatory
    - "**/secrets/**"
    - "**/credentials/**"

providers:
  allowlist:
    - openai
    - anthropic
  cost_cap_usd_per_day_per_user: 25
  cost_cap_usd_per_day_total: 500

audit:
  retention_days: 90
  include_read_actions: false       # only state-changing requests by default
```

## Recipes (planned)

### Lock autonomy at "review" for all users

```yaml
autonomy:
  ceiling: review
  user_can_lower: false
```

### Cap monthly spend per user

```yaml
providers:
  cost_cap_usd_per_day_per_user: 5      # ≈ $150/mo at max
```

### Restrict providers to those with EU data residency

```yaml
providers:
  allowlist:
    - anthropic-eu
    - mistral
```

### Mandate redaction for `infrastructure/`

```yaml
redaction:
  block_paths:
    - "infrastructure/**"
```

## Hot reload (planned)

The server will watch `POLICY_PATH` and apply changes within ~2 s
without a restart. Sessions are not invalidated; only new
permissions checks see the new policy. A `policy_reloaded` audit
event lands on each successful reload.

## Versioning (planned)

Operators are expected to check `policy.yaml` into their **own** git
repo (separate from this project) and mount it read-only into the
container. `version: 1` is the only currently-defined schema version;
breaking changes will bump the version + ship a migrator.

## What's not yet here

- Schema is not validated by the running server.
- Hot-reload is not wired.
- Admin UI does not exist.
- Audit log table does not exist.

All of the above land in Phase 3. Until then, per-user
`.agent-settings.yml` is the only enforcement surface.

## Cross-references

- 🚧 Reserved ADR slot: `docs/decisions/ADR-023-central-policy.md`.
- Council question: [`agents/tmp/council-question-central-policy.md`](../../agents/tmp/council-question-central-policy.md).
- Env contract: [`env-vars.md`](env-vars.md) (`POLICY_PATH`).
- Quickstart: [`quickstart.md`](quickstart.md).
