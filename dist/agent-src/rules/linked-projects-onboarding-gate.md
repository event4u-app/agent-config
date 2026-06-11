---
type: "auto"
tier: "2b"
alwaysApply: false
description: "IDE-attached sibling repo detected — prompt once to opt it into proactive cross-repo awareness, persist local-only, then surface cross-repo impact on relevant changes"
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
routes_to:
  - "guideline:agent-infra/linked-projects-onboarding-gate"
workspaces:
  - agent-config-maintainer
  - engineering
packs:
  - engineering-base
lifecycle: experimental
trust:
  level: experimental
  confidence: medium
install:
  removable: true
---

# Linked-Projects Onboarding Gate

**Iron Law.** When the IDE has attached a sibling repository to this project and the sibling is not yet recorded in `linked_projects`, prompt the developer **once** to opt it into scope, persist the choice local-only, and thereafter proactively flag cross-repo impact — never bulk-include the sibling's files.

Body migrated to `guideline:agent-infra/linked-projects-onboarding-gate` (per the P4 pattern of `road-to-kernel-and-router.md`) — detection command, opt-in flow, persistence shape, behavioral directive, kill-switch. See also the cross-repo guide (`docs/guides/cross-repo-linked-projects.md`) and ADR-032.
Trigger-set above activates this routing under the `balanced` and `full` profiles.
