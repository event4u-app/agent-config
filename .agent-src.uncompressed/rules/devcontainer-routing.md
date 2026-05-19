---
type: "auto"
tier: "3"
description: "Wiring DevContainers or GitHub Codespaces — devcontainer.json, images, VS Code features, port forwarding — route to the devcontainer skill"
source: package
triggers:
  - keyword: "devcontainer"
  - keyword: "codespaces"
  - keyword: "codespace"
  - phrase: "devcontainer.json"
routes_to:
  - "skill:devcontainer"
workspaces:
  - agent-config-maintainer
packs:
  - meta
lifecycle: active
trust:
  level: core
  confidence: high
  human_review_required: false
install:
  default: true
  removable: false
---

# Devcontainer Routing

**Iron Law.** Wiring the dev environment itself (DevContainers, Codespaces, `devcontainer.json`, VS Code features) → load the `devcontainer` skill, not `copilot-config` (which tunes the Copilot AI on top).

Body migrated to `skill:devcontainer`. Disambiguates the devcontainer ↔ copilot-config cluster head per [`adr-architectural-consensus-mechanism`](../../docs/contracts/adr-architectural-consensus-mechanism.md).
Trigger-set above activates this routing under the `balanced` and `full` profiles.
