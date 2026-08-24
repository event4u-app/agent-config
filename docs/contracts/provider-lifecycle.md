---
stability: beta
keep-beta-until: 2026-08-15
---

# Provider Lifecycle — AI Video / Image / Audio Adapter Tiers

> **Status:** active · **Stability:** beta · **Owner:** universal-platform-refinement Phase 3
> · **Linter:** none (declarative contract; enforced agent-in-the-loop via [`provider-lifecycle-discipline`](../../dist/agent-src/rules/provider-lifecycle-discipline.md))
> · **Source-of-truth template:** [`agents/templates/.ai-video.xml.example`](../../agents/templates/.ai-video.xml.example)

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
   `agents/reference/ai-video/smoke-traces/<provider>.md` with timestamp,
   model id, and **redacted** response shape.
2. **Secret-redaction confirmation** — the captured trace, re-read
   through `scripts/media/lib/redact.sh`, shows zero residual
   key fragments.
3. **Contract conformance** — the adapter's four-method shell
   surface (`submit / poll / fetch / dry-run` *or* `run / dry-run`)
   matches `scripts/media/lib/adapter-contract.md` verbatim.

A maintainer flipping the tier in `agents/templates/.ai-video.xml.example`
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
   `agents/templates/.ai-video.xml.example` (or the operator's
   `agents/.ai-video.xml`). This applies to every resolution path —
   `--provider <id>`, `<default-video-provider>` /
   `<default-image-provider>`, or a skill's default. A **mismatch
   between the two sources is a contract violation** and MUST be
   surfaced before running.
2. **Refuse-and-surface** if the operator's resolved default is a
   non-`stable` tier — name the tier and the path to this contract
   document, then emit one clarifying question (per
   [`ask-when-uncertain`](../../.augment/rules/ask-when-uncertain.md)):
   either pick a `stable` provider, or confirm the non-stable run.
   No silent default. No "I'll just try it".
3. **Record** in the run summary which tier the chosen adapter
   carries — the summary line after every `/video:*` / `/image:*` /
   `/audio:*` run names the chosen provider AND its tier. This is the
   audit log entry the agent-in-the-loop model rests on.
4. **Never auto-promote.** Promotion is the maintainer's call. The
   agent MAY draft a promotion checklist (per
   [§ 2 — Promotion path](#-2--promotion-path)) for maintainer
   review, but the tier-flip commit is human-authored.

The agent never picks `deprecated` silently. If a successor is
declared, the agent surfaces "X is deprecated; successor: Y" before
running — even with confirmation.

### § 4a — Failure modes (agent-side violations)

_Origin: migrated from `src/rules/provider-lifecycle-discipline.md` per the P4 pattern of `road-to-kernel-and-router.md`. The rule keeps the Iron Law and the read-tier / refuse-and-surface one-liners; the detail lives here._

- Running `/video:scene` against the `<default-video-provider>` without reading the lifecycle tag first → violation.
- Picking a `community` provider because it was named in the prompt, without surfacing the tier → violation.
- Editing an adapter and leaving its header `Lifecycle:` comment out of sync with `agents/templates/.ai-video.xml.example` → violation (CI does not catch this; the agent must).
- Auto-promoting an adapter from `experimental` to `stable` because "dry-run worked" → violation. Promotion requires a maintainer-captured real-API smoke trace under `agents/reference/ai-video/smoke-traces/`.

### § 4b — Why agent-in-the-loop, not a Python gate

A Python pre-run gate enumerating tier-by-command rules would either be too coarse (`experimental → block`, breaking day-to-day dev iteration) or too detailed (per-command tier matrix, drifting from reality on every new provider). The agent reading the tag at run time, surfacing the tier, and asking is the correct enforcement surface: the model that picked the provider is the model that surfaces the obligation, and the human is the policy decision point.

The CI guarantee is structural reachability — the linter would fail if a provider was declared in `agents/templates/.ai-video.xml.example` without a lifecycle tag (extension planned). It does not enforce the runtime obligation; the agent does.

## § 5 — Day-one assignment

> **Superseded as a tier list — this section is a historical record, not the
> current tiers.** It states the assignment on the day this contract landed,
> and per-adapter promotions since are authoritative. `higgsfield` is `stable`,
> promoted 2026-06-10 and recorded in
> [`ADR-056`](../decisions/ADR-056-unvalidated-video-adapters-disposition.md);
> its header at `src/scripts/ai-video/adapters/higgsfield.sh:15` and its
> `<lifecycle>` element in `agents/templates/.ai-video.xml.example` are the two
> surfaces § 4 obliges to agree, and they are the pair to read for a live tier.
> The rows below are left unedited on purpose: a historical record that gets
> quietly updated stops being one. They are also deliberately **not** an input
> to the parity pass in `src/scripts/lint_media_policy_linkage.ts` — a table
> describing day one must not be able to fail a check about today.

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
entries in `agents/templates/.ai-video.xml.example` remain unchanged
(`openai-images` and `gemini-veo`). The tier tag does not change
defaults; it changes whether the agent silently honours them.

## § 6 — Versioning

Tier rename or new tier is breaking (linter and adapter headers
both flip); promotion / demotion of an individual adapter is not
breaking. The Day-One Assignment table above is the per-release
snapshot — older snapshots live in git history, not in this file.

## See also

- [`provider-lifecycle-discipline`](../../dist/agent-src/rules/provider-lifecycle-discipline.md) — the tier-2 routing rule that surfaces this contract when a provider is touched.
- [`scripts/media/lib/adapter-contract.md`](../../src/scripts/media/lib/adapter-contract.md) — the four-method shell contract every adapter implements.
- [`agents/templates/.ai-video.xml.example`](../../agents/templates/.ai-video.xml.example) — operator-facing provider configuration template (carries the tier tag inline).
- [`agents/settings/policies/media/README.md`](../../agents/settings/policies/media/README.md) — the agent-in-the-loop enforcement model this contract participates in.
