---
recommended_model: inherit
name: hiring-loop-design
description: "Use when shaping an engineering hiring loop — stages, take-home vs live, calibration, bar-raiser, signal-vs-noise audit. Triggers on 'design our interview loop', 'audit our hiring bar'."
status: active
tier: senior
domain: process
context_spine: [org-stage, product, customer-segment]
workspaces:
  - ops
packs:
  - ops-people
trust:
  level: professional
install:
  removable: true
---

# hiring-loop-design

## When to use

- A first engineering hiring loop is being designed (early-stage co, first dedicated EM, first PM hire) and the question is *what stages, in what order, with what signal each*.
- An existing loop is producing inconsistent outcomes (high false-positive rate, high false-negative rate, long time-to-hire) and the question is *which stage to fix*.
- A new role family inside engineering is opening (first staff IC, first SRE, first ML eng) and the question is *what does the loop look like for this archetype*.

Do NOT use this for non-engineering hiring as the primary surface (sales / GTM hiring is a different loop shape entirely), as a sourcing / recruiting-pipeline skill (separate surface area), or for applicant-tracking-system configuration.

## Cognition cluster

- **Mental model 1 — First principles.** Strip hiring to: *what signal does each stage produce that no other stage can produce?* Stages that duplicate signal waste candidate-time and interviewer-time. The strongest loops have one stage per signal, not five stages probing the same thing. See [`mental-models.md`](../../../docs/contracts/mental-models.md) § 1.
- **Mental model 28 — Inversion.** *"What would make a great hire withdraw from this loop?"* — usually: 7+ stages, take-home > 6 hours, no role-context conversation, long calendar gaps, no senior-IC time, no offer-narrative. Inversion surfaces the canonical withdrawal causes; great candidates have options and use them.
- **Mental model 21 — Second-order thinking.** A loose bar at L4 produces a chain: weaker L4 → harder L5 calibration → erodes ladder credibility → ICs leave. A single accept-the-no-vote ripples for 2+ years. The cost of a wrong hire dwarfs the cost of a missed hire; bar discipline is a multi-year compounding decision.
- **Mental model — Base rates.** Most signals in interviews are noise; the most-confident signal-claim is usually the most-overfit to one observation. Calibrate against the base rate: *"out of 10 candidates who passed this stage with this signal, how many succeeded at 12 months?"* If unknown, the stage is unfalsifiable.
- **Context-spine — org-stage + product + customer-segment.** Read **org-stage** for what's affordable (pre-seed: 3-stage loop, fast; growth: 5-stage with calibration; late: 5–6 with bar-raiser). Read **product** for what behaviors matter (deep-systems = system-design heavier; consumer = velocity + judgment heavier; regulated = ethics + judgment heavier). Read **customer-segment** for stakeholder-management exposure needed.

## Cross-wing handoff

- Composed downstream of Q1 `org-design` — the role-family shape determines the loop shape; hiring without a clear role definition is broken from stage 1.
- Composed downstream of Q4 `perf-feedback-craft` — the calibration session is structurally a feedback exchange about a candidate; Q4's SBI + ladder-of-inference apply.
- Hands off to Q3 `onboarding-program` — the loop's signal evidence becomes the day-1 ramp-evidence base.
- Hands off to Q2 `comp-banding` for the offer construction step.

## Procedure

### Step 0: Define the role-shape before designing the loop

For the role being hired, name:

1. **Level** — L3 / L4 / L5 / L6 / staff / principal. Levels matter because signal evidence changes per level (L4 needs strong execution signal; L6 needs leverage / system-design signal).
2. **Archetype** — IC-builder / IC-strategist / IC-system-designer / manager / staff-multiplier. Same level, different archetype = different loop shape.
3. **First-90-day deliverable** — what should this person ship by day 90. Concrete enough to design loop signals against.

A loop designed without a role definition produces noise. Force the role definition step.

### Step 1: Map signal needs to stages

For the role from Step 0, enumerate the signals that need direct evidence:

1. **Coding / craft** — for IC roles. Live coding, take-home, or pair-programming.
2. **System design** — for L5+. Two-hour bounded-scope problem.
3. **Domain judgment** — for senior roles. Behavioral case with context-specific tradeoffs.
4. **Communication / stakeholder** — for any role. Cross-functional collaboration exercise.
5. **Leadership / multiplier** *(L6+)* — narrative of past leverage, mentoring decisions, ladder reasoning.
6. **Values fit** — explicitly NOT culture fit. Concrete questions about handling pressure / disagreement / failure.

One signal per stage. If two stages probe the same signal, kill one.

### Step 2: Pick the stage shape per signal

For each signal, pick the lightest-touch stage that produces the signal cleanly:

1. **Recruiter / role-context call** *(30 min)* — role + company + light values. NOT a screen.
2. **Hiring-manager screen** *(45 min)* — judgment + role-fit + reverse-context. Required.
3. **Coding signal** — choose: (a) take-home ≤ 3 hours with explicit time-cap (most candidate-respectful for senior); (b) live coding 60 min (for L3–L4, faster signal); (c) pair-programming 90 min (best signal but heavy on interviewer time).
4. **System design** *(2 hours, L5+)* — bounded scope; rubric set in advance.
5. **Behavioral / domain judgment** *(45–60 min)* — structured by signal area; SBI-anchored prompts.
6. **Leadership / values** *(45–60 min)* — narratives + specific past-decision probes.
7. **Bar-raiser / cross-team** *(45 min, L5+)* — perspective from outside the hiring team to check ladder consistency.

Take-home > 6 hours = candidate-hostile and produces survivorship-biased pools (only those with no other options finish). Keep ≤ 3 hours or skip.

### Step 3: Design the rubric per stage

Each stage gets a written rubric before the first interview runs:

1. **Signal target** — what behavior demonstrates the signal at this level.
2. **Anti-signal** — what behavior fails the signal (named, not inferred).
3. **Strong-no-hire / no-hire / hire / strong-hire** — four-band scoring, not 5-band (5-band collapses to "3" for everything).
4. **Evidence anchor** — what the interviewer writes down to support the rating; rating without evidence = inadmissible.

Loops without rubrics produce gut-feel hires and hidden bias. Force rubrics before the loop opens.

### Step 4: Calibration session shape

For every offer-eligible candidate, run a calibration session before sending offer:

1. **All interviewers attend** — synchronous or async-with-deadline.
2. **Evidence-first reading** — each interviewer reads their rubric + evidence aloud (or shares the doc) before opinions are stated.
3. **Bar-raiser veto** *(L5+)* — bar-raiser can no-hire even when the team votes yes; reverse is not true (team can no-hire over bar-raiser yes).
4. **Decision** — strong-hire if all four bands are hire-or-above, no single strong-no; gray-zone = no-hire by default (the cost of a wrong hire dwarfs the cost of a missed hire).

A loop without calibration loosens; the bar erodes by 5% per quarter without explicit recalibration cycles.

### Step 5: Validate the loop design before opening it

Before running the first candidate through, inspect three things:

1. **Signal-stage mapping check** — confirm Step 1's signals each map to exactly one stage from Step 2; duplicate-signal stages fail and must be merged or dropped.
2. **Rubric completeness** — assert every stage in Step 3 has a written rubric with signal + anti-signal + four-band scoring + evidence anchor; missing rubrics fail.
3. **Candidate-time check** — verify total candidate hours ≤ 8 (5 interview hours + 3 take-home); loops exceeding 8 hours produce survivorship bias and erode top-of-funnel.

All three must pass. If any fails, return to the failing step.

### Step 6: Emit the hiring-loop design

Produce the loop-design artifact for the hiring team. The artifact contains the role-shape, the stage-signal map, the per-stage rubrics, the calibration shape, and the candidate-time budget. The first three candidates after the loop opens trigger a retrospective check (signal-vs-actual review).

## Related Skills

**WHEN to use this**

- New engineering role family being opened.
- First-pass hiring loop design.
- Audit of an existing loop with inconsistent outcomes.
- Calibration / bar-raiser design.

**WHEN NOT to use this**

- Non-engineering hiring loops (GTM / sales / ops) — different loop shape; out of scope here.
- Role / level decisions independent of hiring — route to [`comp-banding`](../comp-banding/SKILL.md) (Q2) for ladder design.
- Feedback shape — route to [`perf-feedback-craft`](../perf-feedback-craft/SKILL.md) (Q4); S2 composes Q4 at the calibration session.
- Onboarding after hire — route to [`onboarding-program`](../onboarding-program/SKILL.md) (Q3).

## When the agent should load this

- "Design our interview loop."
- "Audit our hiring bar."
- "Should we use a take-home?"
- "Why are we mis-hiring at L5?"
- "Wie sieht unser Hiring-Loop für Staff Engineer aus?"

## Output

1. **`role-shape.md`** — level + archetype + first-90-day deliverable definition.
2. **`stage-signal-map.md`** — signal-needed × stage × time-budget × interviewer pool.
3. **`per-stage-rubrics.md`** — signal + anti-signal + four-band scoring + evidence anchor per stage.
4. **`calibration-shape.md`** — session format + bar-raiser rules + gray-zone default.
5. **`candidate-time-budget.md`** — total candidate hours + take-home cap + scheduling shape.

## Gotcha

- "Culture fit" is a known bias-amplifier; use "values fit" with concrete questions about pressure / disagreement / failure.
- Take-home longer than 3 hours = survivorship bias in your funnel; you get only those with no other options.
- Loops that go above 5 onsite hours produce candidate withdrawal; great candidates have options.
- A no-rubric loop produces "felt good in the room" hires that don't replicate.
- Gray-zone calibration default must be no-hire; cost of false-positive dwarfs cost of false-negative.

## Do NOT

- Do NOT design a loop without a written role-shape; un-defined roles produce un-falsifiable signals.
- Do NOT score on 5-band scales; everything collapses to "3" and the rubric becomes decorative.
- Do NOT skip calibration on a "we all agree" basis; the disagreements are where the signal lives.

## Runnable example

Series-B SaaS opens its first staff-IC role; current loop is L4-shaped (45-min coding + 60-min behavioral + offer) and last two staff-level offers churned at 9 months.

- Step 0 — Role-shape: L6 staff IC, archetype = system-designer with multiplier impact. First-90-day deliverable: scope and own one cross-team platform initiative.
- Step 1 — Signal needs: system design (L6 anchor), domain judgment, leadership / multiplier, coding sanity-check, values fit. Five signals.
- Step 2 — Loop: recruiter call (30) + HM screen (45) + system design (120) + domain judgment behavioral (60) + leadership narrative (60) + bar-raiser (45) + light coding sanity-check (60). Total candidate time: 7 hours + 0 take-home = 7 hours. Within 8-hour budget.
- Step 3 — Rubrics drafted per stage; system-design rubric anchored to "drove three nontrivial architecture decisions with explicit tradeoffs" not "designed a great system".
- Step 4 — Calibration: all 7 interviewers + bar-raiser; evidence-first; gray-zone defaults to no-hire; bar-raiser can veto.
- Step 5 — Validate: signal-stage 1:1 mapping (no duplication); rubrics complete; 7 hours fits the 8-hour budget. Pass.
- Step 6 — Emit loop; first three candidates trigger retrospective; review whether system-design rubric is calibrated to actual L6 staff behavior or diverging toward L5.
