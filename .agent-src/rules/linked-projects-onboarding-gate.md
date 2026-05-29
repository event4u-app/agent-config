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

**Iron Law.** IDE attached a sibling repo and it is not yet in `linked_projects` → prompt developer **once** to opt in, persist local-only, then proactively flag cross-repo impact — never bulk-include the sibling's files.

Closes the **proactivity gap**: agent can already read/write a sibling, but does not *consider* one unless told — and the developer who most needs cross-repo awareness won't think to mention the sibling. Detection reads the relationship already encoded by attaching the repo in the IDE (zero-knowledge). See [`cross-repo-linked-projects`](../../docs/guides/cross-repo-linked-projects.md), ADR-032.

## When this fires

First substantive turn (and on new IDE attachment), when a detected sibling is absent from `linked_projects` in `.agent-settings.local.yml`. Inert when no sibling attached or every detected sibling already decided (opted-in or declined).

## Detection

Run the detector against project root:

```bash
python3 -c "from scripts._lib.linked_projects import detect_linked_projects; \
import json; print(json.dumps(detect_linked_projects('.')))"
```

Returns config-attached siblings only (PhpStorm `.idea/modules.xml` + `vcs.xml`, VS Code `*.code-workspace`) resolving outside the project, existing, git repos. A sibling above `linked_projects_max_files` (default 20000) carries `"large": true` — awareness only, never excluded.

## Opt-in (one-time per sibling)

For each detected sibling **not** already in `linked_projects`, ask once (numbered options per `user-interaction`): include / decline / always / never-ask. Persist to `.agent-settings.local.yml` (gitignored per-machine layer — never committed `.agent-settings.yml`):

```yaml
linked_projects:
  - path: /abs/path/to/sibling
    include: true        # false = declined; never re-prompt
```

Declined sibling (`include: false`) never prompted again.

## Behavioral directive (each `include: true` sibling)

- **proactively check cross-repo impact** when a change here may affect it — API-contract changes, shared-type / enum drift, renamed routes the sibling consumes — and **warn** before finishing;
- **do not bulk-include** the sibling's files (passive awareness, not implicit inclusion — large repos stay cheap);
- out-of-root edits are normal work, but the host agent's own out-of-root **permission gate still applies** (no silent cross-repo write).

## Kill-switch

Experimental, removable rule. If opt-in consistently declined or siblings never cited, remove it — no telemetry, signal is local.

## Follow-up (not yet shipped)

- Consumer-install detector reachability: detector lives in `scripts/_lib/`; exposing it as an `agent-config` CLI subcommand for consumers is a follow-up. Import-reachable in this repo / co-located maintainer setups today.
- Multi-agent verification: only Claude Code empirically validated (ADR-032). Cursor / Augment / Copilot unverified — manual fallback in the guide covers them until tested.

Trigger-set above activates this routing under the `balanced` and `full` profiles.
