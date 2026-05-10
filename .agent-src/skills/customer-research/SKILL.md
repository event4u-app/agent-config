---
name: customer-research
description: "Use when shaping a discovery slice — JTBD-framed interview guide, switch-event focus, verbatim quotes not summaries. Triggers on 'talk to users', 'why did they cancel', 'before we build X'."
status: active
tier: senior
source: package
domain: product
context_spine: [product, team]
---

# customer-research

## When to use

- Backlog item fuzzy → no one talked to current user about underlying job in last quarter.
- Churn / refund spike needs switch-event explanation, not feature gap list.
- PO about to write AC for feature unvalidated against real user job.

Do NOT use for quantitative funnel diagnosis (see `funnel-analysis`),
RICE-style ranking (see `rice-prioritization`), or surveying at scale —
this skill is depth-5-to-10 interviews, not statistics.

## Cognition cluster

- **Mental model 2 — Jobs-to-be-Done.** Frames every question against
  the **switch event**: what caused user to fire previous solution? See
  [`docs/contracts/mental-models.md`](../../../docs/contracts/mental-models.md) § 2.
- **Mental model 3 — Pareto principle.** Research week producing 12
  distinct insights usually re-discovers same three. See `mental-models.md` § 3.

## Procedure

### Step 0: Frame the job

1. Write one sentence: *"Users hire \<thing\> to make progress in \<situation\>, when motivated by \<pressure\>, expecting \<outcome\>."* Cannot finish → discovery slice not shaped — stop, route to `po-discovery`.
2. Read **product** slot of [context-spine](../../../docs/contracts/context-spine.md) (if consumer filled it) for bounded scope. Skip if absent — note in brief.
3. Identify **one** competing solution user might fire. Multiple competitors per session blurs switch event.

### Step 1: Recruit the right 5–8

1. Recruit **switchers** (joined last 60 days) and **leavers**
   (cancelled last 60 days). Long-tenure power-users → separate
   bucket — they explain habits, not jobs.
2. 5 min, 8 max. Saturation hits ~6 in tightly-scoped job — Pareto
   cut. Beyond 8 = research theatre.
3. Avoid friends, employees, beta over-talkers — selection bias is the failure mode that survives the AC.

### Step 2: Run the interview

1. Open with **switch event**: *"Walk me through the day you decided to start using \<product\>."* Time, place, trigger, alternative considered.
2. Past behaviour, not hypothetical. Replace *"would you use"* with *"the last time you needed X, what did you do?"*.
3. Capture **quotes**, not summaries. Verbatim quotes survive AC; paraphrases re-interpreted into pre-existing beliefs.
4. Listen for **anxiety / habit** pair — what they feared switching, what habit died.

### Step 3: Code the evidence

1. One quote per insight. Tag each: switch-event, anxiety, habit, expected-outcome, unexpected-outcome.
2. Insight without quote = hypothesis, not finding — mark it.
3. Frequency-rank by distinct interviewees touching insight (≥ 3 = signal; 1 = anecdote).

### Step 4: Hand back

1. Produce three artifacts (see `## Output`).
2. Hand brief to senior PO. Do **not** translate findings into AC inside this skill — that is `refine-ticket`'s job.

## Related Skills

**WHEN to use this**

- Unit of analysis = **real user's switch event**.
- Discovery fuzzy, team about to ship without validation.
- Retention / churn spike needs narrative, not metric.

**WHEN NOT to use this**

- Quantitative drop-off across stages → [`funnel-analysis`](../funnel-analysis/SKILL.md).
- Ranking competing initiatives → [`rice-prioritization`](../rice-prioritization/SKILL.md).
- Reframing fuzzy product ask before user contact → [`po-discovery`](../po-discovery/SKILL.md).
- AC sharpening on already-validated ticket → [`refine-ticket`](../refine-ticket/SKILL.md).

## When the agent should load this

- "We need to talk to users before we build X."
- "Why are people churning at month 2?"
- "Run customer research on the new pricing tier."
- "I keep guessing what the user wants — let's actually ask."
- "Before refining this ticket, do we know the real job?"

## Output

1. **`research-brief.md`** — frame sentence, recruit criteria, target sample, JTBD focal job, competing solutions in scope. Pre-interview artifact.
2. **`evidence-log.md`** — one row per insight: quote · interviewee ID · tag (switch / anxiety / habit / outcome) · frequency. Sorted by frequency desc. Verbatim only.
3. **`switch-event-summary.md`** — narrative of dominant switch event(s), ≥ 3 supporting quotes per claim. Hand-off artifact for [`refine-ticket`](../refine-ticket/SKILL.md) and senior PO ([`product-owner`](../../personas/product-owner.md)).

## Gotcha

- *"Would you use"* contaminates with politeness; ground every question in past behaviour.
- One articulate interviewee swamps evidence-log. Frequency-rank by distinct people, not distinct quotes.
- Tagging too aggressively pre-interview hides surprise findings — leave room for `unexpected-outcome`.
- Research week without ≥ 3 disqualified hypotheses is suspect — research confirming everything asked nothing.

## Do NOT

- Do NOT translate findings into AC inside this skill — hand off to `refine-ticket`.
- Do NOT recruit only happy users; switchers and leavers carry switch-event signal, satisfied users do not.
- Do NOT skip frame sentence. Unframed interview produces 50 quotes about 8 different jobs.

## Runnable example

Pricing-tier churn at month 2:

- Frame: *"Customers hire \<product\> to make progress in \<weekly reporting\>, motivated by \<board cadence\>, expecting \<one-click roll-up\>."*
- Recruit: 6 leavers (cancelled within 30 days of month 2), 2 switchers from competitor C.
- Interview: open with *"Walk me through the day you decided to cancel."* Capture verbatim.
- Output: `evidence-log.md` shows 5 of 8 cite *manual export step* as cancellation trigger — switch-event signal, ≥ 3 frequency. `switch-event-summary.md` recommends senior PO scope discovery slice on export step, not report itself.
