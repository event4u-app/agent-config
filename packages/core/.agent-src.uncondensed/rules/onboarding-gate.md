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

**Iron Law.** First turn of a project: if `onboarding.onboarded` is
false in `.agent-settings.yml`, instruct the developer to run
`agent-config setup` in their terminal before executing any other
request. The wizard writes `onboarding.onboarded: true` on `Finish`,
which silences this rule for subsequent turns.

`agent-config setup` boots the local TypeScript server (Fastify on
`127.0.0.1`) and opens the browser wizard at `/#/wizard`. The chat
side has no equivalent skill — the legacy `/onboard` skill and its
`onboard:finish` bridge have been retired; the browser wizard is the
sole onboarding surface.

Cloud surfaces without a settings file stay inert: the rule does not
fire when `.agent-settings.yml` is absent, so headless / read-only
contexts (Cloudflare MCP, doc preview, CI) never see the prompt.

Trigger-set above activates this routing under the `balanced` and
`full` profiles.
