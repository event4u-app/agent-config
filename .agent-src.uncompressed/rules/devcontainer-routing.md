---
type: "auto"
tier: "3"
description: "When wiring DevContainers or GitHub Codespaces — devcontainer.json, container images, VS Code features, port forwarding — route to the devcontainer skill"
source: package
triggers:
  - keyword: "devcontainer"
  - keyword: "codespaces"
  - keyword: "codespace"
  - phrase: "devcontainer.json"
routes_to:
  - "skill:devcontainer"
---

# Devcontainer Routing

**Iron Law.** Wiring the dev environment itself (DevContainers, Codespaces, `devcontainer.json`, VS Code features) → load the `devcontainer` skill, not `copilot-config` (which tunes the Copilot AI on top).

Body migrated to `skill:devcontainer`. Disambiguates the devcontainer ↔ copilot-config cluster head per [`adr-architectural-consensus-mechanism`](../../docs/contracts/adr-architectural-consensus-mechanism.md).
Trigger-set above activates this routing under the `balanced` and `full` profiles.
