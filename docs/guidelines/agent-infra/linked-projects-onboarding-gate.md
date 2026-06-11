# Linked-Projects Onboarding Gate

> IDE-attached sibling repo detection, one-time opt-in flow, persistence shape, and the cross-repo behavioral directive

_Origin: migrated from `src/rules/linked-projects-onboarding-gate.md` per the P4 pattern of `road-to-kernel-and-router.md`._

**Iron Law.** When the IDE has attached a sibling repository to this project
and the sibling is not yet recorded in `linked_projects`, prompt the developer
**once** to opt it into scope, persist the choice local-only, and thereafter
proactively flag cross-repo impact — never bulk-include the sibling's files.

This closes the **proactivity gap**: the agent can already read/write a sibling
repo, but it does not *consider* one unless told — and the developer who most
needs cross-repo awareness is precisely the one who won't think to mention the
sibling. Detection reads the relationship the developer already encoded by
attaching the repo in their IDE (zero-knowledge). See the cross-repo guide
(`docs/guides/cross-repo-linked-projects.md`) and ADR-032.

## When this fires

First substantive turn of a session (and on a new IDE attachment), when a
detected sibling is absent from `linked_projects` in `.agent-settings.local.yml` (in agents/settings/).
Inert when no sibling is attached, or when every detected sibling already has a
recorded decision (opted-in or declined).

## Detection

Run the detector against the project root:

```bash
python3 -c "from scripts._lib.linked_projects import detect_linked_projects; \
import json,sys; print(json.dumps(detect_linked_projects('.')))"
```

It returns config-attached siblings only (PhpStorm `.idea/modules.xml` +
`vcs.xml`, VS Code `*.code-workspace`) that resolve outside the project, exist,
and are git repos. A sibling above `linked_projects_max_files` (default 20000)
carries `"large": true` — surfaced as awareness only, never excluded.

## Opt-in (one-time per sibling)

For each detected sibling **not** already in `linked_projects`, ask once
(numbered options per `user-interaction`): include it / decline it / always /
never-ask. Persist to `.agent-settings.local.yml` (in agents/settings/) (the gitignored per-machine
layer — never the committed `.agent-settings.yml`):

```yaml
linked_projects:
  - path: /abs/path/to/sibling
    include: true        # false = declined; never re-prompt
```

A declined sibling (`include: false`) is never prompted again.

## Behavioral directive (for each `include: true` sibling)

While that sibling is in scope, the agent:

- **proactively checks cross-repo impact** when a change here may affect it —
  API-contract changes, shared-type / enum drift, renamed routes the sibling
  consumes — and **warns** before finishing;
- **does not bulk-include** the sibling's files in context (passive awareness,
  not implicit inclusion — large repos stay cheap);
- treats out-of-root edits to the sibling as normal work, but the host agent's
  own out-of-root **permission gate still applies** (no silent cross-repo write).

## Kill-switch

This is an experimental, removable rule. If opt-in is consistently declined or
siblings are never cited, remove it — no telemetry, the signal is local.

## Follow-up (not yet shipped)

- Consumer-install detector reachability: ✅ shipped 2026-05-30 — the detector is
  now exposed as `agent-config linked-projects:list` (closes the ADR-032
  follow-up); cross-repo retrieval over opted-in siblings ships as
  `/knowledge:cross-repo`.
- Multi-agent verification: only Claude Code was empirically validated
  (ADR-032). Cursor / Augment / Copilot behavior is unverified — the manual
  fallback in the guide covers them until tested.
