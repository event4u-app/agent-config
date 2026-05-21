---
adr: 008
status: proposed
date: 2026-05-12
decision: committed-installed-tools-manifest-separate-from-settings
supersedes: —
superseded_by: —
phase: v2.x · post-global-first-install
---

# ADR-008 — Installed-Tools Manifest

## Status

**Proposed** · 2026-05-12 · pending implementation in Phase 3 of
[`road-to-global-first-install`](../../agents/roadmaps/road-to-global-first-install.md).

Originates from user ask (Matze, 2026-05-12): "Sollten wir auf
Projektebene festhalten, welche Agents wir initialisiert haben, damit
bei jedem Sync das Verzeichnis aktualisiert werden kann?" Validated
through AI Council Round 1 (claude-sonnet-4-5 + gpt-4o, $0.0298 actual,
both converged on "yes, separate file"). Council session:
[`agents/runtime/council/sessions/2026-05-12-project-settings-and-v1-v2/`](../../agents/runtime/council/sessions/2026-05-12-project-settings-and-v1-v2/). <!-- council-ref-allowed: ADR decision trace -->

## Context

After ADR-007 (global-first install), each developer's AI tooling
lives in user-scope paths (`~/.claude/`, `~/.augment/`, …). A project
no longer carries the AI config in its tree — except for tools with
`workspace > global` precedence (Windsurf, Cline, Gemini-when-project-
wins) that **must** keep a project-local bridge.

**Resulting gap:** a project has no committed record of which AI
tools it expects. A new team member cloning the repo cannot tell
whether the codebase was built with Claude Code, Windsurf, both, or
five others. Onboarding is "ask the team lead, hope they remember".

**Two related but orthogonal problems:**

1. **Bill of materials** — "Which AIs does this project use?"
2. **Settings hierarchy** — "How do agents behave in this project?"

Today, `.agent-project-settings.yml` (committed) answers #2 (personas,
quality tools, locked keys). #1 is unanswered.

### What we considered

| Option | Verdict |
|---|---|
| **A.** Add `installed_tools` block to `.agent-project-settings.yml` | **Rejected** — mixes behaviour with bill-of-materials, creates a "god file" that every sync command must parse and partially ignore. Settings ≠ manifest. |
| **B.** Put manifest at root: `.agent-installed-tools.lock` | Rejected — root is already crowded with 10+ AI dotfiles; adding another worsens it. |
| **C.** Separate manifest at `agents/installed-tools.lock` | **Accepted** — co-located with project-shared agent docs; clear name; clear job. |
| **D.** Skip — let team docs / README describe the tool set | Rejected — README drifts, no machine-readable contract, no drift detection. |

Council (Sonnet): _"Settings (user prefs, locked keys, override paths)
≠ Manifest (which tools exist). Mixing them creates a god file."_ Both
members converged on a separate file; the location split (Sonnet
favoured `installed-tools.lock`, GPT-4o favoured
`.project-settings.yml`) resolved in favour of Sonnet on the
separation-of-concerns argument.

## Decision

**Adopt option C.** Ship `agents/installed-tools.lock` as the
committed, schema-versioned bill-of-materials for AI tooling.

### Schema (v1)

```yaml
schema_version: 1
agent_config_version: "2.x.y"   # version that wrote the file last
tools:
  - name: claude-code            # matches scripts/install.py _VALID_TOOLS
    scope: global                # one of: global, project
    bridge_marker: ~/.claude/PROJECT_MANAGED_BY_AGENT_CONFIG
    installed_at: "2026-05-12"
  - name: windsurf
    scope: project               # workspace > global → must live in repo
    bridge_marker: .windsurf/PROJECT_MANAGED_BY_AGENT_CONFIG
    installed_at: "2026-05-12"
```

**Fields:**

- `schema_version` — integer; bump on breaking schema changes.
- `agent_config_version` — last package version that wrote the file.
- `tools[]` — append-on-init order; not alphabetised (preserves
  installation history for forensics).
- `tools[].name` — must match `_VALID_TOOLS` in `scripts/install.py`.
- `tools[].scope` — `global` (user-home install) or `project`
  (workspace-wins tools that need a local bridge).
- `tools[].bridge_marker` — path to the marker file the installer
  drops to claim ownership. `validate` checks this file exists.
- `tools[].installed_at` — ISO date; informational only.

### Lifecycle

1. `init --ai <name>` — adds an entry (idempotent). Existing entry
   for same tool with **same scope** is a no-op. Existing entry with
   **different scope** refuses without `--force` (loud warning:
   "tool X is committed as scope=global; you are about to change it
   to project").
2. `sync` — reads the lock file, replays every listed tool's install
   (skip if marker present, install if missing). Used by new team
   members.
3. `validate` — read-only drift check. Exit 1 if any listed marker
   is missing or scope mismatches the file system. **No auto-fix.**
4. Manual edit — discouraged. Lock file is machine-managed; humans
   edit via CLI subcommands.

### Relationship to `.agent-project-settings.yml`

| File | Owner | Scope | Example keys |
|---|---|---|---|
| `agents/installed-tools.lock` | this ADR | bill of materials | `tools[]`, `scope`, `bridge_marker` |
| `.agent-project-settings.yml` | layered-settings system | behaviour | `personas.default`, `quality.php.tools`, `locked_keys` |

Both committed, both have a single job, never overlap.

## Consequences

### Positive

- Onboarding: `git clone` + `npx @event4u/agent-config sync` brings
  every team member's AI tooling to parity.
- Drift detection: `validate` catches "team lead added Windsurf but
  forgot to commit the lock-file update".
- Forensics: install order preserved in `tools[]` order; `installed_at`
  pins approximate timestamps.
- Separation of concerns: behaviour settings stay clean; manifest
  stays focused.

### Negative

- New committed file = one more thing to keep in sync with reality.
  Mitigated by **machine-written-only** rule and `validate` CI hook.
- Scope migration (tool moves between `global` and `project`) needs
  documented playbook in `installed-tools-manifest.md` (Phase 3.5).
- Single-developer projects gain little — the manifest is overhead
  until a second developer joins. Mitigation: file is optional;
  commands work without it (empty manifest = empty install).

### Neutral

- File lives under `agents/`, not at repo root — consistent with
  Matze's preference and council Sonnet's argument that root is
  already crowded.

## Implementation Plan

Tracked as Phase 3 of `road-to-global-first-install` (steps 3.1–3.5).
Ships in a v2.x minor release **after** Phase 2 lands. Out of scope
for this ADR.

## References

- [`ADR-007`](ADR-007-agent-discovery-scopes.md) — global-first install (this ADR depends on it).
- [`agents/roadmaps/road-to-global-first-install.md`](../../agents/roadmaps/road-to-global-first-install.md) Phase 3.
- [`agents/runtime/council/sessions/2026-05-12-project-settings-and-v1-v2/`](../../agents/runtime/council/sessions/2026-05-12-project-settings-and-v1-v2/) — full council transcripts. <!-- council-ref-allowed: ADR decision trace -->
- [`docs/guidelines/agent-infra/layered-settings.md`](../guidelines/agent-infra/layered-settings.md) — the existing 4-layer settings precedence; this ADR adds a parallel file outside that hierarchy.
