# Connector setup — internal AI OS

> **Status**: 🚧 **skeleton**. Phase 5 of
> [`road-to-internal-ai-os-deployment.md`](../../agents/roadmaps/road-to-internal-ai-os-deployment.md)
> is **not yet implemented**. Phase 5 is contingent on Phase 2 (SSO)
> and Phase 3 (central policy) shipping first.
>
> Open design questions live in
> [`agents/tmp/council-question-connector-scope.md`](../../agents/tmp/council-question-connector-scope.md).

## Audience

An admin at a deploying organization who wants the AI OS to read
tickets / PRs / Slack threads to ground its plans in the org's actual
state of work.

## Launch set (planned)

| Connector | Read | Write | OAuth shape |
|---|---|---|---|
| Linear | v1 | v2 (gated) | per-org app install |
| GitHub | v1 | v2 (gated) | GitHub App (per-org) |
| Jira Cloud | v1 | v2 (gated) | per-user OAuth |
| Slack | v1 | v2 (gated) | per-org app install |
| Notion | v1 | — | per-user OAuth |

**v1** = read-only · **v2** = write paths, each behind explicit org
policy gate (see [`policy-cookbook.md`](policy-cookbook.md) →
`connectors.write_enabled`).

## OAuth contract (planned)

Each connector lands one of two shapes:

### Per-org app install

Admin installs the app once at the org level. Every authenticated
user inherits read access. Best for Linear / GitHub / Slack where
the data is org-shared.

### Per-user OAuth

Each engineer authorizes their own account. The wizard surfaces a
per-user "Connect Jira" / "Connect Notion" panel. Best where data is
user-scoped or per-user permission boundaries matter.

## Token storage (planned)

OAuth tokens land in Postgres encrypted with the deployment's
`SESSION_SECRET` derivative. Rotation happens automatically on
refresh-token success. A `connector_token_rotated` audit event lands
on each rotation.

## Rate limits & cost (planned)

| Connector | Cost model | Default cache TTL |
|---|---|---|
| Linear | Free, generous quota | 5 min for tickets, 1 min for comments |
| GitHub | 5,000 / hr per token | 10 min for PRs, 2 min for reviews |
| Jira Cloud | 10 / sec per app | 5 min |
| Slack | Tier 2 (~20 / min) | 1 min for threads |
| Notion | 3 / sec per integration | 10 min |

The wizard surfaces per-connector cost in the admin panel; user-facing
flows hide it.

## Setup walkthrough (planned)

### Linear

```text
1. Admin → Linear workspace settings → API → OAuth applications.
2. Create app, set redirect URI to https://your.host/oauth/linear/callback.
3. Copy client_id + client_secret into the AI OS admin panel.
4. Authorize once at the org level.
```

### GitHub

```text
1. Admin → org settings → Developer settings → GitHub Apps → New.
2. Permissions: read on Issues, Pull Requests, Contents, Metadata.
3. Install on selected repos (or all).
4. Copy app_id + private_key into the AI OS admin panel.
```

### Jira Cloud

```text
🚧 Per-user OAuth flow; each engineer connects on first use.
```

### Slack

```text
1. Admin → Slack app directory → Create app → from manifest.
2. Manifest ships at packages/core/deploy/connectors/slack.manifest.yml
   (does not yet exist).
3. Install in workspace, copy bot token + signing secret.
```

### Notion

```text
🚧 Per-user OAuth flow.
```

## Hard-Floor caveats

- OAuth token storage → **security-sensitive**, human-reviewed PR.
- Write paths (v2) → **explicit org-policy gate** before merge.
- Third-party data caching → cross-tenant isolation review before
  merge (a stray cache-key collision exposes org A's data to org B).

## What's not yet here

- No connector code exists in the repo.
- No OAuth callback routes are registered.
- No admin panel for connector management.
- No token-storage schema.

All of the above land in Phase 5, contingent on Phases 2 + 3.

## Cross-references

- 🚧 Reserved ADR slot: `docs/decisions/ADR-025-connector-scope.md`.
- Council question: [`agents/tmp/council-question-connector-scope.md`](../../agents/tmp/council-question-connector-scope.md).
- Quickstart: [`quickstart.md`](quickstart.md).
- Policy cookbook: [`policy-cookbook.md`](policy-cookbook.md).
