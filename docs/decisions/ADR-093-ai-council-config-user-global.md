---
adr: 093
status: accepted
date: 2026-06-13
decision: ai-council-config-user-global
supersedes: —
superseded_by: 104
phase: ai-council-config-relocation
type: structural
---

# ADR-093 — Relocate the AI-council config to the user-global namespace

## Status

**Accepted** · 2026-06-13. **Partially superseded by
[ADR-104](ADR-104-ai-council-config-global-only.md)** (2026-06-22): the
user-global relocation stands, but the project-local override this ADR
*kept* (precedence rule 2 in § Decision) is removed — the council is now
**global-only** and never searches the project tree.

Maintainer directive (standing, restated): the council is a per-developer
facility and must be configured once, globally, not re-declared per
project.

## Context

The council config (`.ai-council.yml`) was a **project-tracked** file at
`agents/settings/.ai-council.yml`, checked into this repository (it held the
maintainer's enabled members + `file:`/`env:` key references). Resolution was
anchored on the project root (`council_cli.py:AI_COUNCIL_FILE = REPO_ROOT /
"agents" / "settings" / ".ai-council.yml"`; `cmd_doctor.py` recomputed the
same path).

Three defects followed from the project-tracked layout:

1. **Per-project, not per-developer.** A single developer who wants the
   council everywhere had to drop the file into every project — exactly the
   opposite of "configure once".
2. **Commit / leak risk.** The config sat in the tracked tree of a public
   package; only the `file:`/`env:` indirection (raw keys are refused by
   `_validate_api_key_ref`) kept secrets out.
3. **Silent unavailability.** On any surface without a project copy — cloud /
   headless / a fresh checkout / a different worktree — resolution found
   nothing and the council refused with "ai_council.enabled is false", even
   when the developer had set it up. The raw API keys already lived in the
   user-global namespace (`~/.event4u/agent-config/<provider>.key`, resolved
   by `resolve_api_key`); only the config that points at them did not.

The user-global namespace helper (`scripts/_lib/user_global_paths.py`,
`event4u_root()` → `~/.event4u/agent-config/`, with the legacy
`~/.config/agent-config/` read-fallback) already underpinned key resolution,
so the config had a natural home there.

## Decision

**The council config is user-global by default.** A single
`resolve_config_path(project_root)` in `scripts/ai_council/config.py` is the
one place that decides which file is read, with this precedence
(first match wins):

1. `$AI_COUNCIL_CONFIG` — explicit absolute path (tests / power users);
   honoured even when absent, so typos surface as "create it here".
2. Project-local `<project_root>/agents/settings/.ai-council.yml` — a
   consumer project that deliberately checks in its own config; overrides
   the user-global file for that project only.
3. User-global `~/.event4u/agent-config/settings/.ai-council.yml` (legacy
   `~/.config/agent-config/` read-fallback) — the canonical default.

When none exists, the resolver returns the user-global write target so
callers' `.exists()` gate and "create it at …" messaging both point at the
global location.

`council_cli.py` and `cmd_doctor.py` both route through this resolver. The
tracked `agents/settings/.ai-council.yml` is removed from the repository; the
documented shape ships as `agents/templates/.ai-council.yml.example` to copy
from. The maintainer's live config now lives at
`~/.event4u/agent-config/settings/.ai-council.yml`.

Project-local override is **kept** (not removed) so a consumer team can still
pin a shared council config in their own repo — but it is no longer the
default, and this package no longer ships one in its tracked tree.

## Consequences

- The council now resolves from the user-global file in every project,
  worktree, and CWD — verified: a worktree with no project copy resolves
  `~/.event4u/agent-config/settings/.ai-council.yml` and reports `members=2`.
- No council config can be silently committed to this (or any consumer)
  public repo by default.
- `doctor council-cli` now names the user-global path in its
  "no council config" / "config invalid" messaging.
- The test suite is made hermetic via `EVENT4U_CONFIG_HOME` sandboxing so
  it never reads the developer's real global config (it otherwise would,
  now that "no project file" falls through to global).
- **Not done here (follow-up):** auto-scaffolding the global file from the
  example template during `agent-config` install/setup. Resolution +
  manual/templated placement satisfy "the package always uses it"; an
  installer step that writes the example to the global path when absent is
  a nice-to-have tracked separately to keep `install.py` out of this diff.

## Alternatives

- **Global always wins, ignore project files.** Rejected — it would break a
  consumer team's legitimately checked-in shared council config. Removing
  this package's tracked copy already gives the maintainer global-everywhere
  behaviour without taking the override away.
- **Keep the file project-tracked, just gitignore it.** Rejected — still
  per-project, still absent on fresh/cloud surfaces; does not deliver
  "configure once per user".

## References

- Contract: [`docs/contracts/ai-council-config.md`](../contracts/ai-council-config.md) § File location.
- `scripts/ai_council/config.py:resolve_config_path` — the resolver.
- `scripts/_lib/user_global_paths.py` — user-global namespace + legacy fallback.
- `agents/templates/.ai-council.yml.example` — the documented shape to copy.
