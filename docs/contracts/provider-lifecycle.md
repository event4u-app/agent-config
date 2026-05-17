---
stability: beta
keep-beta-until: 2026-08-17
---

# Provider Lifecycle — AI Video / Image / Audio Adapter Tiers

> **Status:** active · **Stability:** beta · **Owner:** universal-platform-refinement Phase 3
> · **Linter:** none (declarative contract; enforced agent-in-the-loop via [`provider-lifecycle-discipline`](../../.agent-src/rules/provider-lifecycle-discipline.md))
> · **Source-of-truth template:** [`agents/.ai-video.xml.example`](../../agents/.ai-video.xml.example)

Locks the lifecycle tagging used on every adapter under
`scripts/ai-video/adapters/` (and future `scripts/ai-image/`,
`scripts/ai-audio/` peers). The tag is declarative — it tells the
agent what the maintainer's confidence in the adapter is, so the
agent can refuse to *default* to an under-validated provider without
the human noticing.

## § 1 — Tiers

| Tier | Meaning | Default-eligibility |
|---|---|---|
| `stable` | Maintainer-validated against a real API run at least once; dry-run output matches the documented contract; secret-redaction confirmed on a live response | **Yes** — `/video:*` / `/image:*` / `/audio:*` commands may default to a `stable` adapter |
| `experimental` | Adapter shipped; structural shape matches the contract; **no real-API smoke run by a maintainer yet** | **No** — must be invoked explicitly (`--provider <id>`), never silently the default |
| `deprecated` | Replaced by a successor; kept for one release window so consumer scripts can migrate | **No** — refusal-and-surface: the agent names the successor before running |
| `community` | Contributed externally; maintained on a best-effort basis; behaviour outside the maintainer's smoke-test matrix | **No** — explicit opt-in only; the agent surfaces "community-tier provider" in the run summary |

## § 2 — Promotion path

`experimental → stable` requires three checkmarks on the same commit
(or on a tightly-scoped follow-up commit referencing the original):

1. **Real-API smoke run** — at least one live `submit / poll / fetch`
   cycle (or `run` for sync adapters) against the documented
   `default-model`, captured under
   `agents/ai-video/smoke-traces/<provider>.md` with timestamp,
   model id, and **redacted** response shape.
2. **Secret-redaction confirmation** — the captured trace, re-read
   through `scripts/ai-video/lib/redact.sh`, shows zero residual
   key fragments.
3. **Contract conformance** — the adapter's four-method shell
   surface (`submit / poll / fetch / dry-run` *or* `run / dry-run`)
   matches `scripts/ai-video/lib/adapter-contract.md` verbatim.

A maintainer flipping the tier in `agents/.ai-video.xml.example`
**and** the adapter header comment is the promotion event. There is
no separate registry — the example file is the registry.

## § 3 — Demotion criteria

`stable → experimental` (or `stable → deprecated`) on any of:

- **Provider API contract drift** that breaks the adapter against
  the documented `default-model` for ≥ 7 calendar days without a
  maintainer fix.
- **Auth-flow change** that invalidates the redaction matchers in
  `lib/redact.sh` until the matchers are extended.
- **Successor adapter declared** (use `deprecated`, not
  `experimental`, and record the successor in the header comment).

Demotion is the maintainer's call; the rule does not auto-demote.

## § 4 — Agent obligations

When the agent picks a provider for a `/video:*` / `/image:*` /
`/audio:*` run, it MUST:

1. **Read** the `provider_lifecycle` tag from the adapter's header
   comment **and** the matching `<provider id="…">` block in
   `agents/.ai-video.xml.example` (or the operator's
   `agents/.ai-video.xml`).
2. **Refuse-and-surface** if the operator's resolved default is a
   non-`stable` tier — name the tier and the path to this contract
   document, then emit one clarifying question (per
   [`ask-when-uncertain`](../../.augment/rules/ask-when-uncertain.md)):
   either pick a `stable` provider, or confirm the non-stable run.
3. **Record** in the run summary which tier the chosen adapter
   carries — this is the audit log entry the agent-in-the-loop
   model rests on.

The agent never picks `deprecated` silently. If a successor is
declared, the agent surfaces "X is deprecated; successor: Y" before
running.

## § 5 — Day-one assignment

The five shipped adapters carry the following tiers on the day
this contract lands (PR `universal-platform-refinement`):

| Adapter | Kind | Tier | Rationale |
|---|---|---|---|
| `openai-images` | image | `experimental` | Structural shape conformant; no maintainer real-API smoke captured yet |
| `gemini-veo` | video | `experimental` | Default video provider; no real-API smoke captured yet |
| `kling` | video | `experimental` | Async contract conformant; no maintainer real-API smoke captured yet |
| `higgsfield` | image+video | `experimental` | Capability-discovery path conformant; no real-API smoke captured yet |
| `sora` | video | `experimental` | Structural-prompt path conformant; no real-API smoke captured yet |

**All five start as `experimental` on day one.** The promotion to
`stable` happens per-adapter, on the commit that records the first
real-API smoke trace. This is conservative by construction: a
`/video:*` run today resolves to a default that is `experimental`,
so the agent surfaces the tier and asks before proceeding — the
human is the policy decision point.

The `<default-image-provider>` and `<default-video-provider>`
entries in `agents/.ai-video.xml.example` remain unchanged
(`openai-images` and `gemini-veo`). The tier tag does not change
defaults; it changes whether the agent silently honours them.

## § 6 — Versioning

Tier rename or new tier is breaking (linter and adapter headers
both flip); promotion / demotion of an individual adapter is not
breaking. The Day-One Assignment table above is the per-release
snapshot — older snapshots live in git history, not in this file.

## See also

- [`provider-lifecycle-discipline`](../../.agent-src/rules/provider-lifecycle-discipline.md) — the tier-2 routing rule that surfaces this contract when a provider is touched.
- [`scripts/ai-video/lib/adapter-contract.md`](../../scripts/ai-video/lib/adapter-contract.md) — the four-method shell contract every adapter implements.
- [`agents/.ai-video.xml.example`](../../agents/.ai-video.xml.example) — operator-facing provider configuration template (carries the tier tag inline).
- [`agents/policies/media/README.md`](../../agents/policies/media/README.md) — the agent-in-the-loop enforcement model this contract participates in.
