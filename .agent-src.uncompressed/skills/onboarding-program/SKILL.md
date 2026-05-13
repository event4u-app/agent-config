---
name: onboarding-program
description: "Use when shaping employee onboarding — time-to-productivity, role-by-role program, mentor pairing, 30/60/90 milestones. Triggers on 'design our onboarding', 'why are new hires ramping slow'."
status: active
tier: senior
source: package
domain: process
context_spine: [org-stage, product, customer-segment]
---

# onboarding-program

## When to use

- A first onboarding program is needed because hires are arriving and ramping is ad-hoc, expensive, and slow.
- An existing program is producing inconsistent ramp times across roles or cohorts and the question is *where the program leaks productivity*.
- A new role family (first sales hire, first designer, first SRE) is being added and the question is *what role-shaped onboarding looks like for this function*.

Do NOT use as a customer-onboarding surface (route to Wing-3 [`onboarding-design`](../onboarding-design/SKILL.md) (H11); this skill is internal-employee, that one is external-customer), as a performance-feedback skill (route to Q4 `perf-feedback-craft`), or for HRIS-onboarding-module configuration.

## Cognition cluster

- **Mental model 1 — First principles.** Strip onboarding to: *what does this person need to know, do, and decide alone before being net-positive?* Most onboarding programs over-index on what's easy to teach (history, slides) and under-index on what's hard (decision rights, who-knows-what, codebase / domain context). See [`mental-models.md`](../../../docs/contracts/mental-models.md) § 1.
- **Mental model 21 — Second-order thinking.** Onboarding is paid for in mentor time. A 4-hour-per-week mentor commitment from a senior person costs more than people realise; mentor capacity is the binding constraint on hiring velocity. Read mentor cost as part of the program, not a free input.
- **Mental model 28 — Inversion.** *"What would make this hire fail in their first 90 days?"* Inversion surfaces the load-bearing risks (unclear scope, no early win, missing tools, no peer relationship). Most onboarding failures trace to one of these four, not to skill gaps.
- **Mental model 26 — Optionality.** A heavy template onboarding preserves *consistency* optionality but forecloses *role-specific* optionality. A pure free-form onboarding preserves customization but forecloses scalability. Pick the trade explicitly per role family.
- **Context-spine — org-stage + product + customer-segment.** Read **org-stage** for what's affordable (10-person co: founder onboards; 50-person co: managers + buddies; 150+: dedicated onboarding owner). Read **product** for domain complexity (deep regulated domain = longer ramp). Read **customer-segment** for which roles need customer-context immersion early.

## Cross-wing handoff

- Composed downstream of Q1 `org-design` — onboarding shape follows team structure; onboarding without a clear team home is broken from day one.
- Composed downstream of Q2 `comp-banding` — level + scope expectations from comp banding anchor the ramp expectations.
- Hands off to Q4 `perf-feedback-craft` for the first 30 / 60 / 90 feedback checkpoint shape.
- Distinct from Wing-3 H11 `onboarding-design` (customer onboarding) — different audience, different proof bar.

## Procedure

### Step 0: Identify role-family and ramp definition

Before designing the program, name:

1. *What role family is in scope?* (eng IC, eng manager, PM, design, sales AE, sales SDR, CS, ops, finance). Onboarding shape varies sharply by family.
2. *What does "ramped" mean for this family?* — define net-positive in concrete behavior: an eng IC ships a PR alone by week 4 and owns a workstream by week 12; an AE books N qualified meetings by week 4 and closes a deal by quarter end. Adjective-only definitions ("getting up to speed") fail the bar.
3. *What's the realistic time-to-ramp benchmark?* — typically 30 / 60 / 90 days for individual contributors; 6 months for managers; 6–12 months for senior leaders. Compare proposed program length to benchmark.

A program with no concrete ramped-definition is unfalsifiable.

### Step 1: Map what the role needs to know, do, decide alone

For the role family, enumerate three buckets:

1. **Know** — domain context (industry, regulation, product), system context (codebase tour, dataflow, ops), people context (who owns what, who decides what). Force concrete artifacts (which doc, which repo, which dashboard) — not abstract topics.
2. **Do** — first owned task, first reviewed task, first solo task, first shipped task. Sequence from low-risk to medium-risk; arrange to produce one demonstrable early win in week 1–2.
3. **Decide alone** — what kind of decision can this person make without consulting? Spell out the boundary; the absence of this is the #1 cause of slow ramp.

Most onboarding programs cover Know well, Do partially, Decide-alone almost never. The last bucket is the leverage point.

### Step 2: Design 30 / 60 / 90 milestones

For each milestone, name:

1. **30-day** — Know complete; first owned task shipped; named buddy and named manager 1:1 cadence locked.
2. **60-day** — Owns a workstream segment; has produced one visible artifact for the team; has had at least one feedback checkpoint (composes Q4).
3. **90-day** — Net-positive on standalone contribution; named scope for next quarter; has built one cross-team relationship.

Each milestone needs an objective check (shipped artifact, behavior observed) — not "feels good" attestation.

### Step 3: Pair the mentor / buddy / manager triad

Three roles, distinct purposes:

1. **Manager** — sets scope, removes blockers, runs 1:1 cadence (weekly first 90 days, biweekly after).
2. **Buddy** — peer-level, week-1 to week-12, low-friction questions, social onboarding. Buddy is not a mentor; mixing the role overloads the buddy.
3. **Mentor** *(optional, role-dependent)* — senior in the craft, monthly cadence, growth-focused. Reserved for higher-stakes hires (senior eng, manager, first-in-role).

Mentor / buddy capacity is the binding constraint; if there are no available buddies, hiring should pause, not push through.

### Step 4: Build the early-win path

Inversion: *"what makes this hire feel they made the wrong choice in week 2?"* — usually: no tools, no clarity, no peer, no early demonstrable win.

1. Pre-day-1: laptop / accounts / access provisioned. Verified by the manager before day 1, not assumed.
2. Day 1–5: orientation, codebase / domain tour, 1:1s with named peers, manager 1:1 scheduled out for 90 days.
3. Week 2–4: first owned task — selected to be shippable, visible, low-risk, but real. Not a synthetic onboarding-only task; a real one.
4. Week 4–6: first feedback checkpoint; explicit acknowledgement of one thing going well + one thing to adjust.

The early-win path is the #1 driver of 12-month retention for new hires.

### Step 5: Validate the program before emitting

Before producing the artifact, verify three things:

1. **Ramp-definition concreteness** — confirm Step 0 named net-positive in concrete behavior; adjective-only definitions fail and must be re-run.
2. **Decide-alone coverage** — assert Step 1's third bucket is non-empty; decide-alone gaps are the canonical ramp-slowing failure mode.
3. **Mentor capacity check** — verify the buddy / mentor commitments fit within available mentor capacity for the cohort size; overbooked mentors collapse onboarding silently.

All three must pass. If any fails, return to the failing step.

### Step 6: Emit the onboarding program

Produce the onboarding-program artifact for the role-family owner (engineering lead, sales lead, design lead) and people partner. The artifact frames the ramped definition, the Know/Do/Decide map, the 30/60/90 milestones, the triad assignments, and the early-win path.

## Related Skills

**WHEN to use this**

- First-pass internal-employee onboarding program design.
- Role-family-specific onboarding (first sales hire, first SRE, first designer).
- Existing program audit when ramp times are inconsistent or long.

**WHEN NOT to use this**

- Customer onboarding — route to Wing-3 [`onboarding-design`](../onboarding-design/SKILL.md) (H11); different audience entirely.
- Performance / feedback design — route to [`perf-feedback-craft`](../perf-feedback-craft/SKILL.md) (Q4); Q3 composes Q4 at milestone checkpoints, doesn't replace it.
- Org structure decisions — route to [`org-design`](../org-design/SKILL.md) (Q1).
- Compensation banding — route to [`comp-banding`](../comp-banding/SKILL.md) (Q2).

## When the agent should load this

- "Design our onboarding."
- "Why are new hires ramping slow?"
- "What does the first 90 days look like for a sales AE?"
- "Set up a buddy program."
- "Wie bauen wir das Onboarding für Engineering auf?"

## Output

1. **`ramp-definition.md`** — role-family × concrete ramped-definition × benchmark time-to-ramp.
2. **`know-do-decide-map.md`** — three buckets with concrete artifacts and decide-alone boundary.
3. **`milestones-30-60-90.md`** — milestone × objective check × feedback checkpoint.
4. **`triad-assignment.md`** — manager / buddy / mentor mapping with capacity check.
5. **`early-win-path.md`** — pre-day-1 through week-6 sequence with named first owned task pattern.

## Gotcha

- "Read these 40 docs" is a placebo onboarding. Force know-by-doing.
- Buddy ≠ mentor. Overloading the buddy with growth conversations collapses the role.
- Decide-alone boundaries unwritten = stalled ramps. The single biggest leverage point most programs miss.
- Synthetic onboarding tasks teach less than real tasks selected for low risk. Resist the urge to manufacture training-only work.

## Do NOT

- Do NOT skip the ramped-definition step; un-defined ramp is unfalsifiable.
- Do NOT assign onboarding to an already-overloaded buddy; the program looks great on paper and fails in week 3.
- Do NOT confuse this with customer onboarding (H11); the two operate on different proof bars.

## Runnable example

Series-A SaaS hires its first dedicated SRE, no prior SRE onboarding shape.

- Step 0 — Role family: senior SRE. Ramped means: on-call alone by week 12, owns one production reliability workstream by month 6, has shipped one runbook and one alert-quality improvement by month 3.
- Step 1 — Know: prod architecture doc, incident-response runbooks, last 6 months of incidents. Do: shadow on-call weeks 1–2, secondary on-call weeks 3–6, primary on-call by week 12. Decide-alone: page severity, can declare incident, can deploy hotfix during business hours; cannot make architecture changes alone before month 4.
- Step 2 — Milestones: 30-day Know complete + first runbook PR shipped; 60-day secondary on-call + alert-quality artifact produced; 90-day primary on-call + first standalone reliability initiative scoped.
- Step 3 — Triad: manager = VP Eng (weekly 1:1); buddy = senior backend engineer (peer, week 1–12); mentor = none initially (no other SREs in-house; consider external mentor at month 6).
- Step 4 — Early win: first runbook PR for a known-rough incident scenario; shippable in week 2, visible to whole eng team.
- Step 5 — Validate: ramped definition concrete; decide-alone boundary explicit; buddy commitment is 2h/week which fits the backend engineer's current load. Pass.
- Step 6 — Emit onboarding program for SRE role family; flag to revisit at month 6 once second SRE is hired (mentor capacity will exist then).
