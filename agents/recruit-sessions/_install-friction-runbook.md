# Install-friction study — maintainer runbook (B9)

> Roadmap: `road-to-final-state-and-market-readiness.md` **B9** (feeds Gate C).
> A SEPARATE study from the employee-product recruit sessions (`README.md`,
> `_runbook.md`) — different recruits (external devs), a different task (an
> unaided **wedge install**, timed), and quantitative metrics. It **reuses**
> the shared consent, redaction, scheduling, and payment machinery from
> `README.md` § "Consent + redaction policy" and `_runbook.md` §§ 2–3; do not
> duplicate those here.
>
> What it measures: can an external dev install the wedge and get first value in
> **< 60 s**, unaided, without abandoning. That is the Gate-C signal — not a
> full-toolset usability study.

## What counts as a recruit (B9)

The four shared criteria from `README.md` § "What counts as a recruit" apply
**verbatim** (not on the maintainer team · no prior exposure · owns the task in
real life · consented). The B9 specialisation of "owns the task in real life":

- A working **Laravel or TypeScript developer** who ships real code and already
  uses an AI coding agent (Claude Code, Cursor, …) day-to-day.
- **Not** a developer the maintainer knows personally, and **not** someone who
  has seen the package, its README, or a demo before the session.

Target **n ≥ 3** distinct recruits (the roadmap floor). More is better for the
median; three is the minimum for a non-anecdotal Gate-C read.

## The task — unaided wedge install (timed)

The recruit works on **their own repo** on **their own machine**. The maintainer
gives exactly this brief, then goes silent:

> "Install the `production-validator` wedge from the project's README quickstart
> and use it to check whether a branch of yours is actually done. Talk out loud
> as you go. I'm just watching."

The wedge install is the README quickstart one-liner (do **not** read it to the
recruit — finding it is part of the measurement):

```bash
mkdir -p .claude/agents
curl -fsSL https://raw.githubusercontent.com/event4u-app/agent-config/main/docs/wedge/production-validator/production-validator.md \
  -o .claude/agents/production-validator.md
# then in Claude Code:  @production-validator check this branch is actually done
```

**First value** = `@production-validator` returns its first verdict on the
recruit's own code. The stopwatch runs from "go" to that first verdict.

## Observation rules

- **Unaided.** The maintainer does not point at the README, the command, or the
  `@`-invocation. Silence is the instrument.
- **Intervene only on a total dead-end** (missing prereq, broken network, no
  Claude Code installed) and only after the recruit has been stuck **≥ 3 min** —
  the same floor as the shared `_runbook.md`. Every intervention is logged and
  counts against the session (an install that needed a rescue is **not** a clean
  pass).
- **Abandonment** = the recruit says they would stop if the maintainer were not
  in the room, OR hits the 10-minute cap without first value. Record the minute
  and the blocking friction.

## Per-session capture (copy this block per recruit)

Store raw per-session notes privately with the recording (not in-repo); only the
redacted aggregate lands in `docs/install-friction-report.md`.

```
recruit_id:            R1            # R1 / R2 / R3 — no real names
stack:                 laravel | typescript
time_to_first_value:   NN s          # "go" → first @production-validator verdict; "—" if abandoned
outcome:               completed | completed-with-rescue | abandoned
abandonment_point:     <where + minute, or "n/a">
interventions:         NN            # count; each with a one-line reason
top_friction:          <one line — the single biggest slow-down>
verbatim_quote:        "<redacted, timestamped>"   # the moment that named the friction
```

## Gate-C falsifiability lock

```
MEDIAN time_to_first_value > 60 s  OR  abandonment rate > 20 %  →  THE WEDGE FAILED.
ITERATE ON THE WEDGE INSTALL BEFORE FINALIZING C2. DO NOT SHIP A FAILED WEDGE.
```

- **Abandonment rate** = abandoned ÷ total recruits.
- A `completed-with-rescue` counts as **not** a clean completion for the median
  (record its would-be time, but flag it) — an install that needs the maintainer
  is a friction finding, not a pass.
- Report the honest number even if it fails the gate. A failed gate is a
  finding, not an embarrassment — it names the exact install friction to fix.

## What this study is NOT

- Not a full-toolset usability study — **wedge only** (the `curl` install + first
  `@production-validator` verdict). The full `npx … init` flow is out of scope.
- Not a survey — **observed behaviour**, timed, not self-reported ratings.
- Not a demo, not a beta funnel, not a marketing artefact (same as `README.md`
  § "What a session is not").

## Output

Fill `docs/install-friction-report.md` (median · abandonment · top-3 friction ·
Gate-C verdict) after **all** sessions are run and redacted. That report is the
Gate-C input; B9 is done when it carries real numbers for n ≥ 3 recruits.
