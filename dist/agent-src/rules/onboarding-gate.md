---
type: "auto"
tier: "1"
description: "First turn with onboarding.onboarded false — instruct dev to run `agent-config setup` first"
triggers:
  - phrase: "first turn"
  - keyword: "onboarding"
  - path_prefix: ".agent-settings.yml"
self_contained: true
workspaces: [agent-config-maintainer, construction, engineering, finance, founder, gtm, legal-review-prep, ops, product, small-business]
packs: [meta]
enforced_by:
  - "hook:onboarding-gate"
# obligation: line 18
obligation_frequency: "per-session"
---

# Onboarding Gate

**Iron Law.** First turn of a project: if `onboarding.onboarded` is
false in `.agent-settings.yml` — the project layer of a cascade that starts
user-global, so check it with `agent-config settings:get onboarding.onboarded`
rather than by opening one file — instruct the developer to run
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

Trigger-set above activates this routing on demand, independent of the discipline profile (ADR-110).
