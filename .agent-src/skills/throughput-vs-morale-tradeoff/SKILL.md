---
name: throughput-vs-morale-tradeoff
description: "Use when balancing eng-team velocity vs quality vs burnout — on-call load, focus fragmentation, reorg shock. Triggers on 'team is burning out', 'why is velocity dropping'."
status: active
tier: senior
source: package
domain: process
context_spine: [org-stage, product, customer-segment]
workspaces:
  - ops
packs:
  - ops-people
lifecycle: active
trust:
  level: professional
  confidence: high
  human_review_required: false
install:
  default: true
  removable: true
---

# throughput-vs-morale-tradeoff

## When to use

- An engineering team's velocity is dropping (or about to) and the question is *which lever to pull* — scope, on-call, focus-time, team-shape — and *which lever costs more morale than it returns*.
- Burnout signals are surfacing (cancelled 1:1s, slipped commitments, attrition risk, low Slack-volume) and the question is *which load to take off the team before someone leaves*.
- A reorg, growth push, or major deadline is being planned and the question is *what's the throughput-vs-morale trade* before the decision is made, not after.

Do NOT use this for individual performance issues (route to Q4 `perf-feedback-craft` or S1 `one-on-one-cadence`), as a hiring-rate skill (route to S2 `hiring-loop-design`), or for team-velocity-tracking-platform configuration.

## Cognition cluster

- **Mental model — Theory of constraints.** Team throughput has one binding constraint at a time — usually code review queue, single-threaded role, on-call load, or focus-fragmentation. Identifying the constraint with file:line precision is the most leveraged hour an EM spends in a quarter; lifting non-constraint loads produces zero throughput gain. See [`mental-models.md`](../../../docs/contracts/mental-models.md).
- **Mental model 21 — Second-order thinking.** Throughput borrowed from morale always compounds back. A two-quarter sprint to a deadline costs three-to-four quarters of slower hiring (reputation), slower velocity (post-burnout shape), and senior-IC attrition. Compute the round-trip, not just the deadline.
- **Mental model 28 — Inversion.** *"What would make this team silently disengage by quarter-end?"* — usually: chronic on-call without recovery, focus-fragmentation > 4 context-switches / day, reorg-shock without re-shape time, leadership-promised-relief that doesn't arrive. Inversion surfaces the 4 canonical morale-collapse causes.
- **Mental model — Base rates.** A team running at 80% utilization has zero slack for incidents; this is the base rate, not a worst case. A team running at 90% utilization for two quarters has 50%+ attrition base rate. Most EMs over-estimate sustainable utilization by 20 percentage points.
- **Context-spine — org-stage + product + customer-segment.** Read **org-stage** for what's feasible (10-person co: high tolerance for surge; 50-person: pattern-establishing matters; 150+: well-established burn-rate signals). Read **product** for incident-load shape (consumer high-traffic = heavier on-call; deep-domain = lower volume / higher severity). Read **customer-segment** for SLA-driven on-call obligations.

## Cross-wing handoff

- Composed by T4 `engineering-manager` persona; specializes the throughput / morale conversation for engineering teams.
- Hands off to Q4 `perf-feedback-craft` when team-level morale signals trigger individual feedback exchanges.
- Hands off to Q1 `org-design` when the binding constraint is structural (team boundary, single-threaded role, span-of-control).
- Hands off to O3 `runway-cognition` when the throughput-vs-morale trade is being driven by runway pressure — finance owns the runway pressure, EM owns whether the team can absorb the response.

## Procedure

### Step 0: Diagnose the binding constraint, not the symptoms

Symptoms (slipped commitment, missed deadline, attrition signal) point at constraints; force the diagnosis before reacting:

1. **Code-review queue** — PRs waiting > 24h on average. Throughput bound by review, not by writing code.
2. **Single-threaded role** — one person owns N critical workstreams; vacation / sickness collapses progress.
3. **On-call load** — primary on-call shift > 1 in 6 weeks for the same person, or > 50% of weeks with paging; on-call exhaustion is invisible until departures.
4. **Focus fragmentation** — > 4 context switches / day, or < 3 hours of contiguous focus time / day. Producing systems work in 30-minute windows is a known anti-pattern.
5. **Scope volatility** — > 30% scope change mid-cycle; team velocity drops because half the work in progress becomes throwaway.
6. **Reorg / role-change shock** — new manager, new team boundaries, or new role within 90 days; 3–6 months of degraded throughput is the baseline.

A team running on multiple constraints simultaneously is in burnout shape; pick the binding one first.

### Step 1: Size the current throughput / morale state

For the team in scope, gather:

1. **Sustained utilization** — % of capacity allocated to committed work; > 80% = no slack; > 90% for > 2 quarters = attrition base rate triggers.
2. **On-call distribution** — shifts per person per quarter; pages per shift; recovery time after high-page shifts.
3. **Morale signals** — cancellation rate of optional meetings, 1:1 cadence health, Slack-volume changes, vacation usage. Each signal is noisy alone; three or more co-occurring = pattern.
4. **Throughput trend** — committed-vs-delivered ratio over last 6 cycles. Single-cycle miss = noise; three-cycle decline = pattern.

Without measurement, the trade is being made on vibes; force the read.

### Step 2: Inspect the proposed lever before pulling it

For each candidate lever to lift the constraint, run an inspect step before committing:

1. **Scope reduction** — what gets deferred, by whom, with what stakeholder communication. Reduces load cleanly; cost = scope conversation with PM / stakeholders.
2. **Hiring** — only relevant if hiring lead-time < timeline; cost = onboarding tax (Q3) on existing team.
3. **On-call rotation reshape** — wider rotation, better runbooks, page-quality work. Cost = upfront engineering investment.
4. **Focus-protection** — meeting-free days, no-Slack windows, makers-vs-managers calendaring. Cost = manager-communication overhead.
5. **Reorg / boundary reshape** — Q1 territory; cost = 3–6 months of degraded throughput before settling.

The cheapest-looking lever (just push harder for 6 weeks) is the most expensive in second-order terms.

### Step 3: Map the round-trip cost honestly

For the chosen lever, name the round-trip:

1. **Q1 cost / benefit** — immediate impact.
2. **Q2 cost / benefit** — settling impact.
3. **Q3+ cost / benefit** — compounding impact (attrition base rate, hiring reputation, internal trust).

Pushing harder for 6 weeks looks like a + in Q1 but is usually – in Q2 + Q3 + Q4 once attrition + slower hiring + reputation effects ripple. Forcing the round-trip honest is the most-skipped step.

### Step 4: Lock the recovery shape, not just the surge shape

Throughput borrowed from morale must be paid back; the recovery is part of the design, not an afterthought:

1. **Recovery window** — minimum 4 weeks of reduced-load work after a 6-week sprint; 8 weeks after a quarter-long sprint.
2. **No-overlap rule** — recovery from sprint A cannot run during sprint B; sequential, not parallel.
3. **Recovery-shape clarity** — what does "reduced load" mean concretely (e.g., 20% allocation to tech-debt, 0 on-call shifts for the 2 people who carried most pages, explicit no-deadline-commits in the recovery window).
4. **Manager-visible recovery** — recovery is named, scheduled, and protected; recoveries that exist only in the manager's head do not happen.

Sprints without recovery are extraction; the team learns that "sprint" means "permanent state" and morale collapses.

### Step 5: Validate the throughput / morale plan before announcing

Before communicating the plan to the team, inspect three things:

1. **Constraint named with precision** — confirm Step 0 named exactly one binding constraint with file:line / person:role specificity; multi-constraint or vague reads fail and must be re-diagnosed.
2. **Round-trip honest** — assert Step 3's Q2+ cost is sized in attrition-base-rate and throughput-recovery-time terms; missing round-trip means the plan over-claims and must be re-sized.
3. **Recovery shape locked** — verify Step 4's recovery window is named, scheduled, and on the calendar before the surge starts; recovery promised after surge launches almost never lands.

All three must pass. If any fails, return to the failing step.

### Step 6: Emit the throughput / morale plan

Produce the plan artifact for the EM + their VP / leadership chain + a team-facing version. The leadership artifact contains the diagnosis + lever + round-trip + recovery shape. The team-facing version names the surge + when it ends + what recovery looks like + how morale signals will be monitored during the surge.

## Related Skills

**WHEN to use this**

- Velocity drops, missed commitments, surfacing burnout signals.
- Pre-decision read on a planned sprint / deadline / reorg.
- Annual capacity / on-call shape planning.
- Post-incident retrospective when team load was a contributing factor.

**WHEN NOT to use this**

- Individual performance issues — route to [`perf-feedback-craft`](../perf-feedback-craft/SKILL.md) (Q4) or [`one-on-one-cadence`](../one-on-one-cadence/SKILL.md) (S1).
- Hiring-loop / role-family design — route to [`hiring-loop-design`](../hiring-loop-design/SKILL.md) (S2).
- Org-shape / team-boundary decisions — route to [`org-design`](../org-design/SKILL.md) (Q1).
- Runway-pressure-driven scope conversation — route to [`runway-cognition`](../runway-cognition/SKILL.md) (O3) for the upstream finance read.

## When the agent should load this

- "Team is burning out."
- "Why is velocity dropping?"
- "Should we push harder this quarter?"
- "On-call is killing the team."
- "Wie balanciere ich Tempo und Moral?"

## Output

1. **`constraint-diagnosis.md`** — named binding constraint with file:line / person:role specificity.
2. **`current-state-sizing.md`** — sustained utilization, on-call distribution, morale signals, throughput trend.
3. **`lever-comparison.md`** — candidate levers × immediate cost / benefit × round-trip cost / benefit.
4. **`recovery-shape.md`** — recovery window + reduced-load definition + no-overlap rule + calendar-locked dates.
5. **`team-facing-plan.md`** — surge scope + end date + recovery shape + morale-signal monitoring during surge.

## Gotcha

- "We can push harder for 6 weeks" is the most expensive sentence an EM says. Round-trip cost is 3–4 quarters.
- 80% sustained utilization has zero slack for incidents; teams at 90% for two quarters have base-rate 50%+ attrition.
- A surge without a calendar-locked recovery is extraction. The team learns the word "sprint" means "permanent state".
- Multi-constraint reads are usually under-diagnosed; press for the binding one, even if multiple feel binding.
- "Morale" in EMs' heads is usually 30–60 days behind reality; lagging-indicator decisions are the canonical mis-shape.

## Do NOT

- Do NOT pull a throughput lever without sizing the round-trip cost; first-order math always favors pulling, second-order math often doesn't.
- Do NOT promise recovery after the surge ends; schedule it before the surge starts or it doesn't happen.
- Do NOT confuse this with individual-performance work; team-level constraints have team-level fixes.

## Runnable example

Series-B SaaS eng team (8 engineers), velocity has dropped 30% over 3 cycles, two senior ICs hinting at leaving, on-call has been heavy.

- Step 0 — Constraint diagnosis: 2 of 8 engineers are doing 60% of on-call (specialty domain knowledge); single-threaded-role + on-call-load both binding. Binding-most: on-call distribution.
- Step 1 — Current state: 88% sustained utilization (no slack), 4-in-6-week primary on-call for the 2 specialists, vacation usage near zero for those 2, throughput trend declining 3 cycles. Pattern is unambiguous.
- Step 2 — Lever comparison: (a) push-harder = + 0 throughput, very negative round-trip; (b) widen on-call rotation requires 6 weeks of runbook + onboarding work for 3 other engineers; (c) defer Q3 scope by 20% — clean immediate relief; (d) hire — lead-time 3-6 months, doesn't help this cycle.
- Step 3 — Round-trip: lever (b) + (c) combined: Q1 = -10% throughput on current scope (runbook investment + deferred scope) but + 0 on roadmap (defer absorbed); Q2 = + 15% throughput (wider on-call + recovered ICs); Q3+ = + retention base rate (specialists no longer at exhaustion).
- Step 4 — Recovery shape: 6 weeks of reduced load for the 2 specialists (no primary on-call, 20% tech-debt allocation) starting week 1 of Q3. Calendar-locked, communicated.
- Step 5 — Validate: binding constraint named with person-specificity; round-trip sized in attrition + Q2 / Q3 throughput terms; recovery on calendar before plan announced. Pass.
- Step 6 — Emit leadership plan (diagnosis + (b)+(c) lever + round-trip + recovery) and team-facing plan (Q3 scope-defer + on-call reshape + named recovery window for the 2 specialists).
