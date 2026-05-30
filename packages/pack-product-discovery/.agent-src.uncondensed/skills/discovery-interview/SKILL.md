---
model_tier: inherit
name: discovery-interview
description: "Use when running discovery interviews — question-bank build, bias audit, insight extraction. Triggers on 'audit my guide', 'extract insights from transcript', 'is my hypothesis falsifiable'."
status: active
tier: senior
domain: product
context_spine: [product]
recommended_for_user_types: [consultant, founder]
workspaces:
  - product
packs:
  - product-discovery
trust:
  level: professional
install:
  default: false
  removable: true
---

# discovery-interview

## When to use

- A discovery slice has been framed (`customer-research` ran), but the interview guide is still rough or untested.
- A transcript exists and the team needs structured insight extraction, not narrative summary.
- An interview round produced surprising findings; a bias audit is needed before the team acts on them.

Do NOT use for the upstream framing of the discovery slice (frame
sentence, recruit criteria, JTBD focal job) — that is
[`customer-research`](../customer-research/SKILL.md). Do NOT use for
quantitative survey design or scale-bound research.

## Cognition cluster

- **Mental model 22 — Data-informed, not data-driven.** Interview
  data is signal at low N; treat it as evidence to reason with, not
  a vote count. See
  [`docs/contracts/mental-models.md`](../../../docs/contracts/mental-models.md) § 22.
- **Mental model 15 — Signal vs noise.** A vivid quote from one
  articulate user can swamp three muted but consistent signals;
  frequency-rank by distinct people, never by quote count. See
  `mental-models.md` § 15.
- **Mental model 28 — Eisenhower matrix.** Sort post-interview
  insights into urgent / important quadrants so the team acts on
  high-importance signals, not the loudest ones. See
  `mental-models.md` § 28.
- **Product context-spine slot.** Read **product** for the focal job
  + competitor names; do **not** re-derive these inside this skill.
  See [`context-spine`](../../../docs/contracts/context-spine.md).

## Procedure

### 1. Build the question bank

1. Anchor on the **switch event** from `customer-research`. The
   first question is always *"Walk me through the day you decided
   to ..."* — never *"would you ..."*.
2. Three layers:
   - **Past behaviour** (what did you do? when? alternative considered?)
   - **Anxiety / habit** (what feared in switching? what habit died?)
   - **Outcome** (what changed for you? expected? unexpected?)
3. Cap at 8 open questions per 45-min slot. Beyond that, the
   interview becomes a survey delivered in person.

### 2. Audit the bank for bias

Before running, inspect each question and review the bank against the
four common biases:

- **Leading** — *"Don't you think X is annoying?"* → rewrite as past
  behaviour.
- **Hypothetical** — *"Would you use Y?"* → replace with *"Last
  time you needed Y, what did you do?"*.
- **Confirmation** — every question presupposes the team's hypothesis
  is correct. At least two questions must be able to **disconfirm** it.
- **Recall ceiling** — questions that ask for events ≥ 90 days back
  produce confabulation; bound the timeframe.

A bank that survives the audit unchanged is suspect — re-read.

### 3. Run-time discipline

1. Open with the switch event. Stay silent for 8 seconds after the
   user finishes; the second answer is usually the truer one.
2. Capture verbatim, not paraphrase. *"It made me anxious"* is data;
   *"the user expressed concern"* is interpretation.
3. Probe with *"tell me more about X"* on any anxiety / habit
   mention; do not switch topics until the thread is exhausted.

### 4. Extract insights

For each transcript:

1. One quote per insight. Tag: switch / anxiety / habit /
   expected-outcome / unexpected-outcome / disconfirmation.
2. Frequency-rank by distinct interviewees (≥ 3 = signal; 1 = anecdote).
3. Mark **disconfirmations** explicitly — these are the most
   valuable rows, because they are the cheapest to ignore.

### 5. Hand back

Produce the three artifacts (see `## Output`); hand the disconfirmation
log to whoever owns the original hypothesis.

## Related Skills

**WHEN to use this**

- The discovery slice is framed and the interview guide / transcript
  is the unit of work.
- A round of interviews ran and the insights need structured extraction
  (frequency-ranked, bias-audited, disconfirmations highlighted).

**WHEN NOT to use this**

- The slice itself is unframed — start with
  [`customer-research`](../customer-research/SKILL.md); this skill
  inherits its frame, never re-derives it.
- The signal needs to come from existing artefacts (issues, PRs, errors)
  rather than a live interview — route to [`voc-extract`](../voc-extract/SKILL.md).
- Insights translate into AC for a ticket — hand off to
  [`refine-ticket`](../refine-ticket/SKILL.md).
- The output is a quantitative funnel — route to
  [`funnel-analysis`](../funnel-analysis/SKILL.md).

## When the agent should load this

- "Hilf mir den Interview-Leitfaden auditieren."
- "Welche Fragen sind biased?"
- "Extract die Insights aus diesem Transkript."
- "Wir haben 6 Interviews geführt — was ist Signal, was ist Anekdote?"
- "Ist meine Hypothese widerlegbar mit dem aktuellen Frageset?"

## Output

1. **`question-bank.md`** — 8 open questions, each tagged
   past-behaviour / anxiety-habit / outcome; bias-audit notes per
   rewritten question.
2. **`insight-log.md`** — one row per insight: quote · interviewee
   ID · tag · distinct-people frequency. Sorted descending. Verbatim.
3. **`disconfirmation-log.md`** — each row names the original
   hypothesis, the interview-derived disconfirmation, and the named
   owner who must respond before the team acts on the round.

## Gotcha

- A bank that survived the audit unchanged is rare; usually means
  the audit was rushed, not that the bank was perfect.
- One articulate interviewee biases insight-extraction toward their
  vocabulary — frequency-rank by people, not quotes.
- Disconfirmations are the cheapest insight to ignore and the most
  valuable to act on; the log exists so they survive the round.

## Do NOT

- Do NOT re-derive the frame inside this skill — read the **product**
  spine slot or hand back to `customer-research`.
- Do NOT translate insights into AC inside this skill — that is
  `refine-ticket`.
- Do NOT collapse disconfirmations into "we also heard X" prose;
  they earn their own log.
