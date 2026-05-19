---
name: release-comms
description: "Use when turning a shipped changelog into a release narrative — value-not-feature framing, audience-segmented surfaces, one source of truth. Triggers on 'announce the release', 'write changelog post'."
status: active
tier: senior
source: package
domain: product
context_spine: [product, team]
recommended_for_user_types: [creator, gtm, founder]
workspaces:
  - gtm
packs:
  - gtm-marketing
lifecycle: active
trust:
  level: professional
  confidence: high
  human_review_required: false
install:
  default: true
  removable: true
---

# release-comms

## When to use

- Release shipping with user-facing change, team about to send feature-list email.
- Changelog draft reads like commit log — engineering-honest, unparseable for user.
- Multiple comms surfaces (in-app, email, social, docs) about to be written by different people from same release.

Do NOT use for incident comms (see `incident-commander`),
deprecation announcements needing legal sign-off, or pre-release
discovery — this skill assumes change is **shipped**.

## Cognition cluster

- **Mental model 16 — Leading vs. lagging indicators.** Release note
  is lagging artifact; leading version = in-app prompt that fired
  before user found change-log. See
  [`docs/contracts/mental-models.md`](../../../docs/contracts/mental-models.md) § 16.
- **Value-not-feature heuristic.** Every paragraph passes *"so the
  user can ___"* completion. Failing rows go back for re-write.

## Procedure

### Step 0: Ground the release

1. Read merged PR list / changelog block / release branch diff. Release = **what**; comms = **so what**. Conflate the two → ship marketing.
2. Read **product** and **team** slots of [context-spine](../../../docs/contracts/context-spine.md) (if consumer filled them) for bounded scope and cadence — surface choice depends on cadence (weekly: in-app + log; quarterly: email + post; major: all four).
3. Identify **single dominant change** the release ships. Three "headliners" reads as three half-announcements.

### Step 1: Audience-segment

1. Three audiences max: **active user**, **at-risk / lapsed user**, **prospect**. More fragments message; fewer hides routing.
2. Per audience, write one sentence: *"After this release, you can …"* completing with user-side verb, not product-side feature.
3. If two audiences end up with same sentence, collapse — segmentation that does not change message = theatre.

### Step 2: Map surfaces to audiences

1. **Changelog** (always) — engineers + power users; truthful, dense, link-heavy. Source of truth — every other surface points back here.
2. **In-app prompt** — active users; ≤ 1 sentence + 1 CTA; fires for users whose past behaviour predicts they'll touch the new path.
3. **Email** — at-risk / lapsed; one headline value, one CTA, one paragraph of context. No feature lists.
4. **Social / blog** — prospect; the **why**, not the **what** — frame against user job (cite [`customer-research`](../customer-research/SKILL.md) if switch-event surfaced).

Cut surfaces aggressively. Weekly release does not need blog post.

### Step 3: Draft each surface from the changelog

1. Open changelog. Per surface, copy dominant change line, then **rewrite verb subject** from "we" to "you".
2. Strip qualifiers ("now", "even better", "lightning-fast"). Noise, not signal.
3. Run *"so the user can ___"* completion on every paragraph. Failing paragraphs cut, not edited.

### Step 4: Truth-check

1. Every claim links back to changelog row or doc URL. Unsourced claim → cut.
2. No tense games — past for shipped, future for coming-soon (and only if date is committed). "Roadmap" lives outside this skill.
3. Names match product surface. In-app says "Reports" and email says "Insights" → user fires lookup tax.

### Step 5: Hand off

1. Produce four artifacts (see `## Output`).
2. Hand to whoever owns send. Do not embed scheduling or A/B test plans here — that is RevOps.

## Related Skills

**WHEN to use this**

- Change is **shipped** and needs to reach existing users.
- Multiple comms surfaces written by different people from same source.
- Team about to default to feature-list email.

**WHEN NOT to use this**

- Production incident comms → [`incident-commander`](../incident-commander/SKILL.md).
- Pre-release discovery / validation → [`customer-research`](../customer-research/SKILL.md).
- Funnel-stage diagnostics post-release → [`funnel-analysis`](../funnel-analysis/SKILL.md).
- Ranking which release to comms next → [`rice-prioritization`](../rice-prioritization/SKILL.md).

## When the agent should load this

- "Write the release notes for sprint 47."
- "We're shipping the new export — how do we announce it?"
- "Draft the changelog email for last week's batch."
- "What's the in-app prompt copy for the redesign?"
- "Turn the merged PR list into something users can read."

## Output

1. **`release-narrative.md`** — single source of truth: dominant change, audiences (1–3), per-audience *"After this release, you can …"* sentence, links to source changelog rows.
2. **`changelog-entry.md`** — engineer-honest, dense, link-heavy block ready to paste into project's changelog.
3. **`comms-pack.md`** — per-surface drafts (in-app prompt, email, optional social/blog), each ≤ surface's hard cap, each pointing back to `changelog-entry.md`.
4. **`comms-checklist.md`** — pre-send checks: every claim sourced, names consistent across surfaces, audience match, "so the user can …" completion passing on every paragraph. Hand-off artifact for senior PO ([`product-owner`](../../personas/product-owner.md)).

## Gotcha

- Default failure mode = feature-list email — written to make engineering feel seen, not to help user.
- Marketing puffery ("revolutionary", "delightful") fails source check; cut on sight.
- Two surfaces using different names for same thing = highest-frequency support-ticket trigger after release.
- Hidden coming-soon claims in past-tense paragraphs erode trust faster than missing the comms entirely.

## Do NOT

- Do NOT promote coming-soon item alongside shipped items — user cannot tell which is which and stops trusting next note.
- Do NOT let long-tail change steal the headline — dominant change earns headline, long tail goes in changelog.
- Do NOT ship surfaces without truth-check pass; unsourced claim survives in social longer than release does.

## Runnable example

Sprint 47 ships a one-click monthly export and three small bug fixes:

- Dominant change: one-click export. Bug fixes go in changelog only.
- Audiences: active user (will use it), at-risk (export friction was churn trigger per [`customer-research`](../customer-research/SKILL.md) evidence-log).
- "After this release, you can pull a board-ready monthly report in one click." (active, at-risk — same sentence ⇒ collapse to one).
- Surfaces: changelog (full), in-app prompt to active users on next month-end, email to at-risk cohort with same sentence and one CTA. No social.
- Truth-check: claim links to export PR; "one click" is literal — verified against shipped UI.
