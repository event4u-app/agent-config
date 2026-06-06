---
type: "auto"
tier: "1"
description: "First turn — if onboarding.onboarded is false in .agent-settings.yml, instruct dev to run `agent-config setup` before any request"
triggers:
  - phrase: "first turn"
  - keyword: "onboarding"
  - path_prefix: ".agent-settings.yml"
workspaces:
  - agent-config-maintainer
packs:
  - meta
---

# Onboarding Gate

**Iron Law.** First turn of project: if `onboarding.onboarded` is false in `.agent-settings.yml`, instruct dev to run `agent-config setup` in terminal before any other request. Wizard writes `onboarding.onboarded: true` on `Finish` → rule silenced after.

`agent-config setup` boots local TypeScript server (Fastify on `127.0.0.1`), opens browser wizard at `/#/wizard`. No chat-side skill — legacy `/onboard` and its `onboard:finish` bridge have been retired; browser wizard is sole onboarding surface.

Cloud surfaces without settings file stay inert: rule does not fire when `.agent-settings.yml` absent → headless / read-only contexts (Cloudflare MCP, doc preview, CI) never see prompt.

Trigger-set above activates routing under `balanced` and `full` profiles.
