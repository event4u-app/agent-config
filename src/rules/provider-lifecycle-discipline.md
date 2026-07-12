---
type: "auto"
tier: "2a"
description: "Editing an AI video/image/audio adapter — declare lifecycle tier; never default to non-stable"
triggers:
  - keyword: "/video:"
  - keyword: "/image:"
  - keyword: "/audio:"
  - keyword: "ai-video"
  - keyword: "ai-image"
  - keyword: "ai-audio"
  - keyword: "adapter"
  - keyword: "provider"
  - path_prefix: "scripts/ai-video/adapters/"
  - path_prefix: "scripts/ai-image/adapters/"
  - path_prefix: "scripts/media/lib/"
  - path_prefix: "agents/.ai-video.xml"
  - phrase: "lifecycle"
  - phrase: "default provider"
routes_to:
  - "contract:provider-lifecycle"
applies_to_user_types:
  - "creator"
  - "developer"
  - "maintainer"
workspaces: [agent-config-maintainer, engineering, gtm]
packs: [ai-image, ai-video]
---

# Provider Lifecycle Discipline

## Iron Law

```
NEVER DEFAULT TO A NON-STABLE PROVIDER SILENTLY.
SURFACE THE LIFECYCLE TIER. ASK BEFORE RUNNING.
```

Fires whenever a `/video:* / /image:* / /audio:*` surface fires, an adapter under `scripts/ai-video/adapters/` is read or edited, or `agents/templates/.ai-video.xml.example` (or the operator's `agents/.ai-video.xml`) is in play. The contract defines four tiers — `experimental | stable | deprecated | community` — and the agent's obligations per tier.

- **Read the tier before picking** — the `<lifecycle>` element in the provider XML AND the adapter's `Lifecycle:` header comment; a mismatch is a contract violation.
- **Refuse-and-surface on non-stable** — name the tier, emit ONE clarifying question (per [`ask-when-uncertain`](ask-when-uncertain.md)); no silent default.

Body migrated to [`docs/contracts/provider-lifecycle.md § 4–4b`](../../docs/contracts/provider-lifecycle.md#-4--agent-obligations) (per P4 of `road-to-kernel-and-router.md`) — the five enforcement points' detail, agent-side failure modes, day-one state (§ 5), why-agent-in-the-loop rationale.
Trigger-set above activates this routing on demand, independent of the discipline profile (ADR-110).

## See also

- [`docs/contracts/provider-lifecycle.md`](../../docs/contracts/provider-lifecycle.md) — the full tier definitions, promotion / demotion criteria, day-one assignment matrix, and the migrated enforcement detail (§ 4–4b).
- [`src/scripts/media/lib/adapter-contract.md`](../../src/scripts/media/lib/adapter-contract.md) — the four-method shell surface every adapter implements; the tier tag is read alongside this contract.
- [`media-governance-routing`](media-governance-routing.md) — sibling tier-2a rule that surfaces the prompt-side policy layer; this rule covers the provider-side discipline.
- [`ask-when-uncertain`](ask-when-uncertain.md) — the one-question-per-turn discipline the refuse-and-surface path uses.
