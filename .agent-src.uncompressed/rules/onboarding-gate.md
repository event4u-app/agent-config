---
type: "auto"
tier: "1"
description: "First turn of a conversation on a project — check onboarding.onboarded in .agent-settings.yml; when false, prompt the user to run /onboard before executing any other request"
source: package
triggers:
  - phrase: "first turn"
  - keyword: "onboarding"
  - path_prefix: ".agent-settings.yml"
routes_to:
  - "command:onboard"
---

# Onboarding Gate

**Iron Law.** First turn of a project: if `onboarding.onboarded` is false, prompt `/onboard` before executing any other request.

Body migrated to `command:onboard` (per P4 of `road-to-kernel-and-router.md`).
Trigger-set above activates this routing under the `balanced` and `full` profiles.
