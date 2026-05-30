---
recommended_model: inherit
name: vision-articulation
description: "Use when articulating internal vision — where we're going / why now / why us, founder-mode anchor, distinct from fundraising pitch. Triggers on 'what's our vision', 'why are we doing this'."
status: active
tier: senior
domain: process
context_spine: [org-stage, product, customer-segment]
workspaces:
  - founder
packs:
  - founder-strategy
install:
  removable: true
---

# vision-articulation

## When to use

- An internal anchor is needed — board off-site, all-hands, strategy doc — and the question is *where are we going, why now, why us*. The audience is the team, not investors.
- A founder or strategist is sense-checking whether the current direction still holds, or whether reality has diverged from the stated vision.
- A new hire / new exec needs the founder-mode read of the company — not the fundraise pitch, the durable internal frame.

Do NOT use for outward-facing fundraise pitch (route to Wing-3 `fundraising-narrative` (H7); vision is internal-anchor, fundraising is external-pitch — different audiences, different proof bars), positioning copy / launch narrative (route to Wing-3 `positioning-strategy` / `messaging-architecture`), or roadmap construction (route to `feature-roadmap` workflows; vision constrains roadmaps, doesn't replace them).

## Cognition cluster

- **Mental model 27 — Why now.** Vision without a *why now* is a wishlist. The market shift, technology wave, regulatory change, or demographic inflection that makes the vision *achievable in this window* is the load-bearing claim. See [`mental-models.md`](../../../docs/contracts/mental-models.md) § 27.
- **Mental model 1 — First principles.** Strip the vision to outcomes for a named cohort, not feature lists or company milestones. *"Be the X for Y"* is shape; *"customer C does outcome O 10× faster"* is substance. See `mental-models.md` § 1.
- **Mental model 21 — Second-order thinking.** *"If this vision is realised, what does the world look like in 5 years?"* If the answer is just *"we got bigger"*, the vision isn't load-bearing; if the answer is structural change (workflow shift, market re-shape), it is. See `mental-models.md` § 21.
- **Context-spine — org-stage + product + customer-segment.** Read **org-stage** for vision-horizon (pre-seed = 3-year survival vision; growth = 5–7-year market-shape vision; mature = 10-year). Read **product** for the realistic shipping shape. Read **customer-segment** for the cohort whose outcome anchors the vision.

## Procedure

### Step 0: Identify stance — founder vs operator

Vision-articulation is a founder-mode act, not an operator-mode act (per council Q6). Before starting:

1. Confirm the requester is in founder-stance — they are setting the durable frame, not optimising within an existing frame.
2. If the requester is in operator-stance (planning, executing, refining within a fixed frame), this skill is wrong; route to roadmap / planning skills.

Founder-stance is the precondition; without it the output is mis-shaped.

### Step 1: Frame "where we're going" — cohort + outcome + horizon

One sentence: *"In [horizon], [customer-segment] [does outcome O] [because of structural change S]."*

Anti-patterns to reject:

1. *"We're the [Big Company] of [Vertical]"* — feature-comparison, not cohort outcome. Reject.
2. *"We're building the future of X"* — generic, no cohort named. Reject.
3. *"We're growing to $100M ARR"* — milestone, not vision. Reject.

The sentence must name *who*, *what they do that they can't do today*, *why it matters in [horizon]*.

### Step 2: Construct "why now"

Name 2–3 inflections that make this vision achievable in this window — not next decade, not last decade:

1. **Technology inflection** — capability newly cheap / newly possible (AI, edge compute, new platform).
2. **Market inflection** — buyer behaviour shift, segment opening, incumbent vulnerability (M&A churn, regulatory burden, talent loss).
3. **Demographic / regulatory inflection** — workforce shift, policy change, generational handover.

Each inflection must be *recent* (last 24–36 months) or *imminent* (next 24 months). Inflections from 10 years ago are settled; inflections 10 years out are speculative. The *why now* window is narrow.

### Step 3: Construct "why us"

Name 2–3 reasons this team, not another, can execute the vision. Honesty test:

1. **Unique capability** — composes `competitive-moat-analysis` (P3); cite the moat dimensions where we score strong with evidence.
2. **Unique distribution** — channel, community, partnership we have and competitors structurally can't replicate.
3. **Unique insight** — founder / team origin gives us a read on the cohort that competitors don't have.

If the answer is *"we're hardworking"* or *"we move fast"*, the answer is none. Most teams are. Re-run.

### Step 4: Inversion — what would falsify the vision?

For each load-bearing claim (cohort outcome, why-now inflection, why-us reason), write:

1. *"What evidence in the next 12 months would falsify this?"* — leading signal that the vision is wrong-shaped.
2. *"What change in the world would make this vision obsolete?"* — exogenous shift we're betting against.

A vision that can't be falsified is a slogan. Concrete falsifiers = real vision.

### Step 5: Validate the vision before emitting

Before producing the artifact, verify three things:

1. **Cohort-outcome specificity** — confirm the Step-1 sentence names a specific cohort + specific outcome + specific horizon; generic phrasing fails and must be re-run.
2. **Why-now timestamp** — assert each Step-2 inflection is dated within the recent-24-36-months or imminent-24-months window; un-timestamped inflections are claims, not inflections.
3. **Why-us falsifiability** — check that each Step-3 reason has a named Step-4 falsifier; un-falsifiable reasons are slogans and must be demoted.

All three must pass. If any fails, return to the failing step.

### Step 6: Emit the vision frame

Produce the vision-frame artifact for internal use (board, all-hands, exec onboarding). Hand off to Wing-3 `fundraising-narrative` (H7) if an external pitch derivative is needed — that's a translation, not a copy.

## Related Skills

**WHEN to use this**

- Internal vision articulation for board off-site, all-hands, strategy doc.
- Founder / exec sense-check on vision-vs-reality divergence.
- New-hire / new-exec onboarding to founder-mode read.

**WHEN NOT to use this**

- Outward-facing fundraise pitch — route to Wing-3 [`fundraising-narrative`](../fundraising-narrative/SKILL.md) (H7); vision is internal anchor, fundraising is external pitch.
- Positioning / messaging copy — route to Wing-3 [`positioning-strategy`](../positioning-strategy/SKILL.md) and [`messaging-architecture`](../messaging-architecture/SKILL.md).
- Moat reading — route to [`competitive-moat-analysis`](../competitive-moat-analysis/SKILL.md) (P3); this skill composes P3 for the "why us" frame.
- Roadmap / phase planning — route to roadmap workflows; vision constrains roadmaps, doesn't replace them.

## When the agent should load this

- "What's our vision?"
- "Sense-check our direction — does this still hold?"
- "Draft the vision section for the board off-site."
- "Why now / why us frame for the strategy doc."
- "Wo wollen wir hin und warum jetzt?"

## Output

1. **`vision-frame.md`** — one-sentence vision (cohort + outcome + horizon), three "why now" inflections, three "why us" reasons.
2. **`falsifiers.md`** — leading signals + exogenous shifts that would falsify each load-bearing claim.
3. **`vision-vs-reality.md`** *(optional)* — when used as a sense-check, the delta between stated vision and current trajectory; named divergence points.

## Gotcha

- "Be the X for Y" frames are positioning slogans, not vision. Reject; force cohort-outcome-horizon.
- "Why now" with no timestamp is a claim, not an inflection. Force a date.
- "Why us" answers like *"we're a great team"* mean none. Force unique capability / distribution / insight cited with evidence.
- Vision artifacts that survive zero change in the world over 5 years are slogans. Real visions have falsifiers.

## Do NOT

- Do NOT collapse vision into fundraise pitch — different audiences, different proof bars.
- Do NOT skip the inversion / falsifier step — un-stressed visions are unfalsifiable.
- Do NOT bolt vision onto roadmap milestones — milestones are downstream of vision, not the same thing.

## Runnable example

Series-A vertical SaaS, founder requests vision sense-check for board off-site.

- Step 0 — Stance: founder-mode confirmed (off-site context, setting durable frame).
- Step 1 — Vision: *"In 5 years, mid-size healthcare specialty groups (50–200 providers) deliver patient scheduling with 80 % less administrative load because the workflow is regulation-aware and self-adapting per state."*
- Step 2 — Why now: (a) state-licensure data became machine-readable in the last 24 months (tech inflection); (b) incumbent hospital-focused vendors hit their growth ceiling and are starting to mis-fit specialty groups (market inflection); (c) post-COVID, specialty-group practice owners control admin spend directly (buyer-behaviour shift, last 36 months).
- Step 3 — Why us: (a) founder's clinical-ops background + customer-segment access (unique insight, cited with 12 customer interviews); (b) switching-cost moat from 24-month deployment depth (composes P3, cited evidence); (c) HIPAA + 50-state licensure capability stack (unique capability).
- Step 4 — Falsifiers: (a) incumbent ships specialty-group focused migration tooling = unique-capability claim erodes; (b) state-licensure data becomes opaque again (regulatory rollback) = tech inflection inverts; (c) specialty-group consolidation accelerates so 50–200 cohort shrinks = cohort scope shrinks.
- Step 5 — Validate: cohort + outcome + horizon present; why-now inflections all dated within 24–36 months; why-us reasons each have falsifier. Pass.
- Step 6 — Emit vision-frame for board off-site; flag potential H7 derivative needed for the upcoming Series-B narrative.
