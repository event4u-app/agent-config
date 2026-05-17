---
type: "auto"
tier: "2a"
description: "When editing an AI video/image/audio adapter — declare lifecycle tier (experimental | stable | deprecated | community); never default to non-stable"
source: package
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
  - path_prefix: "agents/.ai-video.xml"
  - phrase: "lifecycle"
  - phrase: "default provider"
routes_to:
  - "contract:provider-lifecycle"
applies_to_user_types:
  - "creator"
  - "developer"
  - "maintainer"
---

# Provider Lifecycle Discipline

## Iron Law

```
NEVER DEFAULT TO A NON-STABLE PROVIDER SILENTLY.
SURFACE THE LIFECYCLE TIER. ASK BEFORE RUNNING.
```

This rule routes the agent to [`docs/contracts/provider-lifecycle.md`](../docs/contracts/provider-lifecycle.md) whenever a `/video:* / /image:* / /audio:*` surface fires, an adapter under `scripts/ai-video/adapters/` is read or edited, or `agents/.ai-video.xml.example` (or the operator's `agents/.ai-video.xml`) is in play. The contract defines four tiers — `experimental | stable | deprecated | community` — and the agent's obligations per tier.

## What this rule enforces

1. **Read the tier before picking.** When the agent resolves a provider (from `--provider <id>`, from `<default-video-provider>` / `<default-image-provider>`, or from a skill's default), it MUST read both:
   - the `<lifecycle>` element under `<provider id="…">` in `agents/.ai-video.xml.example` (or the operator's `.ai-video.xml`), and
   - the `Lifecycle:` header comment in `scripts/ai-video/adapters/<id>.sh`.
   Mismatch between the two is a contract violation and MUST be surfaced before running.

2. **Refuse-and-surface on non-stable.** If the resolved default is `experimental`, `deprecated`, or `community`, the agent surfaces the tier and the path to the contract, then emits **one** clarifying question (per [`ask-when-uncertain`](ask-when-uncertain.md)): either confirm the non-stable run, or pick a `stable` provider. No silent default. No "I'll just try it".

3. **Refuse `deprecated` without naming the successor.** A `deprecated` adapter's header comment records the successor; the agent surfaces "X is deprecated; successor: Y" before any run, even with confirmation.

4. **Record the tier in the run summary.** The summary line emitted after every `/video:* / /image:* / /audio:*` run names the chosen provider AND its tier. This is the audit-log entry the agent-in-the-loop enforcement model rests on.

5. **Promotion is the maintainer's call.** The agent never auto-promotes `experimental → stable`. It MAY draft a promotion checklist (see [`docs/contracts/provider-lifecycle.md § 2`](../docs/contracts/provider-lifecycle.md#-2--promotion-path)) for maintainer review, but the tier-flip commit is human-authored.

## Failure modes — what counts as a violation

- Running `/video:scene` against the `<default-video-provider>` without reading the lifecycle tag first → violation.
- Picking a `community` provider because it was named in the prompt, without surfacing the tier → violation.
- Editing an adapter and leaving its header `Lifecycle:` comment out of sync with `agents/.ai-video.xml.example` → violation (CI does not catch this; the agent must).
- Auto-promoting an adapter from `experimental` to `stable` because "dry-run worked" → violation. Promotion requires a maintainer-captured real-API smoke trace under `agents/ai-video/smoke-traces/`.

## Day-one state

All five shipped adapters (`openai-images`, `gemini-veo`, `kling`, `higgsfield`, `sora`) ship as `experimental`. This means **every** default `/video:* / /image:*` run today triggers the refuse-and-surface path. That is intentional — it is the conservative-by-construction posture the contract argues for. As maintainers capture smoke traces and flip individual adapters to `stable`, the friction reduces per-adapter.

## Why agent-in-the-loop, not Python gate

A Python pre-run gate enumerating tier-by-command rules would either be too coarse (`experimental → block`, breaking day-to-day dev iteration) or too detailed (per-command tier matrix, drifting from reality on every new provider). The agent reading the tag at run time, surfacing the tier, and asking is the correct enforcement surface: the model that picked the provider is the model that surfaces the obligation, and the human is the policy decision point.

The CI guarantee is structural reachability — the linter would fail if a provider was declared in `agents/.ai-video.xml.example` without a lifecycle tag (extension planned). It does not enforce the runtime obligation; the agent does.

## See also

- [`docs/contracts/provider-lifecycle.md`](../docs/contracts/provider-lifecycle.md) — the full tier definitions, promotion / demotion criteria, and day-one assignment matrix.
- [`scripts/ai-video/lib/adapter-contract.md`](../../scripts/ai-video/lib/adapter-contract.md) — the four-method shell surface every adapter implements; the tier tag is read alongside this contract.
- [`media-governance-routing`](media-governance-routing.md) — sibling tier-2a rule that surfaces the prompt-side policy layer; this rule covers the provider-side discipline.
- [`ask-when-uncertain`](ask-when-uncertain.md) — the one-question-per-turn discipline the refuse-and-surface path uses.
