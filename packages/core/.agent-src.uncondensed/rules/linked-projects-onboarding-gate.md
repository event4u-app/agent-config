---
type: "auto"
tier: "2b"
alwaysApply: false
description: "IDE-attached sibling repo detected — prompt once to opt it into proactive cross-repo awareness, persist local-only, then surface cross-repo impact on relevant changes"
source: package
triggers:
  - intent: "work across two projects"
  - intent: "sibling repository"
  - keyword: "linked project"
  - keyword: "cross-repo"
  - keyword: "sibling repo"
  - path_prefix: ".idea/modules.xml"
  - path_prefix: ".idea/vcs.xml"
validator_ignore:
  - type: "substring"
    pattern: "scripts/_lib/linked_projects.py"
    reason: "Rule names the detector module as the runtime detection entrypoint."
workspaces:
  - agent-config-maintainer
  - engineering
packs:
  - engineering-base
lifecycle: experimental
trust:
  level: experimental
  confidence: medium
  human_review_required: false
install:
  default: true
  removable: true
---

# Linked-Projects Onboarding Gate

**Iron Law.** When the IDE has attached a sibling repository to this project
and the sibling is not yet recorded in `linked_projects`, prompt the developer
**once** to opt it into scope, persist the choice local-only, and thereafter
proactively flag cross-repo impact — never bulk-include the sibling's files.

This closes the **proactivity gap**: the agent can already read/write a sibling
repo, but it does not *consider* one unless told — and the developer who most
needs cross-repo awareness is precisely the one who won't think to mention the
sibling. Detection reads the relationship the developer already encoded by
attaching the repo in their IDE (zero-knowledge). See
[`cross-repo-linked-projects`](../../docs/guides/cross-repo-linked-projects.md)
and ADR-032.

## When this fires

First substantive turn of a session (and on a new IDE attachment), when a
detected sibling is absent from `linked_projects` in `.agent-settings.local.yml`.
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
never-ask. Persist to `.agent-settings.local.yml` (the gitignored per-machine
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

- Consumer-install detector reachability: the detector lives in
  `scripts/_lib/`; exposing it as an `agent-config` CLI subcommand for consumer
  projects is a follow-up. In this repo and co-located maintainer setups it is
  import-reachable today.
- Multi-agent verification: only Claude Code was empirically validated
  (ADR-032). Cursor / Augment / Copilot behavior is unverified — the manual
  fallback in the guide covers them until tested.

Trigger-set above activates this routing under the `balanced` and `full`
profiles.
