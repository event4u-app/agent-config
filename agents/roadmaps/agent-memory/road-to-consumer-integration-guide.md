# Spec: Consumer integration guide

> **Spec for `agent-memory`, authored from `agent-config`.**
> Describes the **contract between the two packages** from the
> perspective of a consumer repository.
> See [`README.md`](README.md) for the ownership split.

## Status

Draft. The `feat/hybrid-agent-memory` branch in `agent-config` (local
only, not on origin at time of writing) already wires a `postinstall`
hook — this spec formalises what the final integration should look
like end-to-end.

## Prerequisites

- `agent-memory` published at `@event4u/agent-memory`
- `agent-config` published at `@event4u/agent-config`
- [`road-to-promotion-flow.md`](road-to-promotion-flow.md) and
  [`road-to-decay-calibration.md`](road-to-decay-calibration.md) agreed
- Consumer can run PostgreSQL 15+ with `pgvector` extension locally
  or in a shared dev environment

## Vision

A consumer installs **one** of two packages and gets a sensible
default:

- Install `@event4u/agent-config` alone → governance + behaviour,
  memory disabled, no database dependency
- Install both → governance + persistent project memory, trust-scored
  retrieval, cross-session continuity

The consumer chooses. `agent-memory` is an **optional companion**,
not a hidden dependency.

## Non-goals

- **No** auto-install of a database. Consumers provision their own
  PostgreSQL + pgvector; the packages document the requirement but do
  not provision infra
- **No** agent-config feature that **hard-requires** agent-memory.
  Every integration point degrades gracefully when memory is absent
- **No** silent data collection. Everything agent-memory stores lives
  on infrastructure the consumer controls

## Install paths

### Path A — `agent-config` only (baseline)

```bash
npm install -D @event4u/agent-config
# postinstall runs scripts/install.sh which copies .augment/, .claude/, etc.
```

Result:
- Skills, rules, commands, guidelines available to agents
- Memory-using skills detect `agent-memory` absent → fall back to the
  "no memory" path (explicit message in output)
- `.agent-project-settings.memory.enabled` defaults to `false`

### Path B — `agent-config` + `agent-memory` (full integration)

```bash
npm install -D @event4u/agent-config @event4u/agent-memory
# agent-memory's postinstall pulls agent-config's install.sh
# agent-config's install.sh detects agent-memory and wires CLI/MCP access
```

Result:
- Everything from Path A, plus
- `agent-memory` CLI on `PATH` (e.g. via `npx agent-memory`)
- MCP server entry published to the agent host config (Augment, Claude,
  Cursor, etc.)
- `.agent-project-settings.memory.enabled` defaults to `true`
- Consumer is prompted to confirm or edit the PostgreSQL connection
  details and decay defaults

### Path C — agent-memory only (not supported)

agent-memory's `postinstall` calls `agent-config`'s installer, so this
path is always equivalent to Path B. Documenting it explicitly avoids
confusion.

## Install mechanism per stack

Orthogonal to Paths A/B: **how** the installer fires on each
dependency update. Both paths share this section.

| Consumer stack | Trigger on install/update | Status |
|---|---|---|
| **npm / pnpm / yarn** | `postinstall` in `package.json` runs `scripts/postinstall.sh` automatically | ✅ Shipped |
| **Composer (PHP)** | `composer.json` has `bin: [bin/install.php]` — consumer runs `php vendor/bin/install.php` once; no automatic re-run on `composer update` | ⚠️ Gap — manual only |
| **Composer + npm** | npm side auto-runs; composer side still manual unless hooks are registered | Same gap as Composer-only |

### Gap: Composer `post-install-cmd` / `post-update-cmd` hooks

Salvaged from the superseded `feat/hybrid-agent-memory` branch, adapted
to the current installer chain. A Composer package cannot inject hooks
into a consumer's `composer.json` from its own side — the consumer has
to add them. We ship a one-shot script that does this idempotently.

**Script** (to add as a follow-up PR): `scripts/register-composer-hooks.sh`

- Consumer invokes **once**, after first install:
  ```bash
  php vendor/bin/install.php              # initial sync
  bash vendor/event4u/agent-config/scripts/register-composer-hooks.sh
  ```
- Appends to the consumer's `composer.json`:
  ```json
  "scripts": {
    "post-install-cmd": ["@php vendor/bin/install.php --quiet"],
    "post-update-cmd":  ["@php vendor/bin/install.php --quiet"]
  }
  ```
- Uses the `@php` composer idiom — picks the PHP binary Composer
  itself runs on, no hard-coded path.
- Invokes `bin/install.php` (the orchestrator wrapper), **not**
  `scripts/install.sh` — so bridges (`.agent-settings`, Augment JSONs)
  stay in sync too.
- **Idempotent.** Detects existing `agent-config/bin/install.php`
  entries and skips. Handles string-vs-array script values.
- **JSON tool fallback chain** (for parsing/writing `composer.json`):
  `php` → `jq` → `python3`. PHP is guaranteed in a Composer
  environment; the others are fallbacks for unusual setups. Node is
  **not** on the chain — we must not require it for PHP-only
  consumers.
- Writes back with `JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES` so
  the diff stays human-reviewable.

Consumers who prefer manual control skip the script and edit
`composer.json` by hand — the documentation includes the snippet
verbatim.

**Phase placement:** ships after the baseline installer is stable,
before `@event4u/agent-memory` lands. It is a Path-A concern first;
Path B inherits it automatically.

## Feature detection in `agent-config`

`agent-config` ships a helper (one script, shell + python) that
returns a known result for every agent session:

```
memory_status: present | absent | misconfigured
  present      → agent-memory responds to health() within 2s
  absent       → package not installed or not on PATH
  misconfigured → installed but health() returns error (typically DB)
```

Skills and commands that optionally consume memory branch on this
value. Branch semantics are defined per skill in the integration
roadmap; here the **contract** is: a clean `absent` path must exist
for every memory-aware skill.

## Access surface

Salvaged from the superseded `feat/hybrid-agent-memory` ADR: **CLI
is the V1 primary contract; MCP wraps the CLI in a later phase.**
Consumers on older agent hosts without MCP support stay on CLI and
get the full feature set.

| Access method | Use case | V1? |
|---|---|---|
| **CLI** | Everything — scripts, CI, IDE agents via shell, hygiene jobs (`agent-memory prune`, `agent-memory health`) | Yes — primary contract, fully testable in isolation |
| **MCP server** | Structured tool access for IDE agents that support MCP (Augment, Claude, Cursor, Windsurf) | Phase 7 of `agent-memory` — **wraps** CLI, never exposes new surface |
| **Library import** | Only for tooling inside `agent-memory` itself | Not a stable contract for consumers |
| **REST** | Remote multi-machine setups | V2 only |

Skills shipped by `agent-config` call **CLI first**, upgrade to **MCP**
when the host advertises it. `absent` mode uses the file fallback (see
`road-to-agent-memory-integration.md`). No skill hard-requires MCP.

## Prerequisites the consumer must meet

- PostgreSQL 15+ reachable from the developer workstation and CI
- `pgvector` extension enabled on the database used
- Connection string stored in an env var that
  `.agent-project-settings` references by **name**, not value
- Minimum disk budget: 500 MB per consumer for the first year of
  usage (upper bound; see `agent-memory` docs for real numbers)

`agent-memory` is expected to publish a reference `docker-compose.yml`
snippet for local dev and a CI job template. `agent-config`
documentation links to those; it does not maintain a second copy.

## Upgrade path

- `@event4u/agent-config` upgrades that change skill behaviour around
  memory must be **non-breaking** for Path A consumers
- `@event4u/agent-memory` upgrades that change the API surface
  consumed by `agent-config` must bump both versions together — a
  compatibility matrix is published in the `agent-memory` README and
  checked on install

## Open questions (decided in `agent-memory` repo)

- **Named peer dependency** vs. **runtime probe**. Does `agent-config`
  declare `agent-memory` as an `optionalDependencies` entry, or only
  probe for its presence at runtime? Proposal: **optional peer**,
  probe is the fallback.
- **Bootstrap seed memory.** On first install of Path B, should
  agent-memory seed any starter entries (e.g. "project has multi-tenant
  guard" from an initial scan)? Proposal: **no**; every entry comes
  from explicit promotion.
- **Multi-repo / monorepo scoping.** Does one database serve a
  monorepo, or do sub-apps get separate schemas? Proposal: **one
  database, namespaced by consumer hash**; sub-apps use tags.

## See also

- [`road-to-promotion-flow.md`](road-to-promotion-flow.md) — the API
  shape consumers call into
- [`../road-to-agent-memory-integration.md`](../road-to-agent-memory-integration.md) —
  agent-config side: which commands / rules / skills produce and
  consume memory
- [`../road-to-project-memory.md`](../road-to-project-memory.md) —
  `.agent-project-settings.memory` schema the consumer fills in
