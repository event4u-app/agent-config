# Maintainer Dev Mode (`AGENT_CONFIG_DEV_MODE=1`)

**Audience.** Maintainers of `@event4u/agent-config` working **inside**
the package repo. Consumers never see this flag; consumer installs
land in `~/.event4u/agent-config/` per [ADR-020](../decisions/ADR-020-global-only-consumer-scope.md).

**Status.** Forward-looking — the gate ships in Phase 3 of the
`road-to-global-only-install` roadmap. This document is the
canonical reference once Phase 3 lands.

## Why the flag exists

Phase 3 of `road-to-global-only-install` flips `SCOPE_SUPPORT` so that
**every** consumer scope on `scripts/install.py` is global. The
package repo itself is structurally identical to a consumer repo
(same `.augment/`, `.claude/`, `.cursor/` projection layout) which
means maintainer dev-installs would otherwise be blocked by the same
gate.

`AGENT_CONFIG_DEV_MODE=1` is the explicit, audit-visible opt-out.
With the flag set, the installer:

1. Allows project-scope writes back into the repo tree (so a
   maintainer can run `task dev:install-global` and iterate on the
   working copy).
2. **Skips** writing `agents/.event4u-bridge.yml` into the package
   repo (per `consumer-bridge § Writer contract`). The repo is the
   source, not a consumer of itself.
3. Treats `~/.event4u/agent-config/` as a peer install — touches are
   limited to the working-copy projection.

Without the flag, `scripts/install.py` refuses to write anywhere
under the repo tree and points at this document.

## When to set it

Set the flag for these workflows, and **only** these:

- `task dev:install-global` — refresh the user-scope projection from the working tree.
- `task dev:install:gui` — iterate the unified Setup-Wizard / Installer-GUI before merge.
- `task dev:setup` / `task dev:setup:dry-run` — exercise the onboarding wizard.
- `task release` rehearsal — verify the published shape matches the dev shape.

Do **not** set it for:

- Consumer project work (the flag is undefined behaviour outside this repo).
- CI runs on the package itself (CI uses the flag transparently via the dev tasks above; bare runs MUST NOT export it).
- Production maintainer machines that also consume the package as a user (set per-shell, not in `~/.zshrc`).

## How to set it

Per-command (preferred):

```bash
AGENT_CONFIG_DEV_MODE=1 task dev:install-global
```

Per-shell session:

```bash
export AGENT_CONFIG_DEV_MODE=1
task dev:install:gui
unset AGENT_CONFIG_DEV_MODE
```

The `unset` discipline matters: a stale `=1` in your shell environment
is the most common way a project-scope write sneaks into a consumer
repo. Future work (`agent-config doctor`, Phase 5.4) will warn when
the flag is set outside the package repo.

## Safety properties

- **Audit-visible.** Every install run logs whether the flag was set
  at the top of the transaction log.
- **No silent fallback.** If `scripts/install.py` detects the
  package repo signature (presence of `.agent-src.uncompressed/` plus
  `dist/router.json`) and the flag is **not** set, the install
  refuses with a one-line error pointing here.
- **Not for consumers.** Setting the flag in a consumer project is
  defined as undefined behaviour. The installer will not actively
  refuse (because it cannot distinguish a misconfigured shell from a
  legitimate vendored maintainer install), but it will print a single
  warning line on every run.

## Interaction with the bridge marker

Per [`consumer-bridge`](../contracts/consumer-bridge.md), the bridge
marker is the in-repo pointer to the global root. Under
`AGENT_CONFIG_DEV_MODE=1`:

- The marker is **not** written into the package repo — the repo's
  `agents/` directory is the project surface, not a consumer surface.
- A pre-existing marker in the package repo is treated as stale and
  removed on the next dev install (with an audit log line).
- Consumer adapters reading the marker from inside the package repo
  during local development should expand `global_root` against the
  current user's `$HOME` per the reader contract — same as in a
  consumer repo.

## References

- [ADR-020](../decisions/ADR-020-global-only-consumer-scope.md) — the global-only decision.
- [`consumer-bridge`](../contracts/consumer-bridge.md) — bridge marker schema.
- [`road-to-global-only-install`](../../agents/roadmaps/road-to-global-only-install.md) — Phase 3 SCOPE_SUPPORT flip + Phase 5 migration order.
- [`taskfiles/dev.yml`](../../taskfiles/dev.yml) — `dev:install-global`, `dev:install:gui`, `dev:setup` task entries.
