---
type: "auto"
tier: "2a"
description: "An observed defect in the agent's own behaviour becomes a queued record and a fix against agent-config — never a silent shrug"
triggers:
  - keyword: "self-repair"
  - keyword: "self-repair-queue"
  - phrase: "nicht richtig gearbeitet"
  - phrase: "du hast das falsch"
  - phrase: "you ignored the rule"
  - phrase: "that was wrong"
self_contained: true
workspaces: [agent-config-maintainer, construction, engineering, finance, founder, gtm, legal-review-prep, ops, product, small-business]
packs: [meta]
enforced_by:
  - "hook:self-repair"
# obligation: line 28
obligation_frequency: "per-turn"
---

# Self-Repair Loop

A defect in how the agent behaved is a defect in **agent-config**, not in the
user's project. The user should not have to file it, and the next user should
not meet it again. Two intake paths fill one queue: the user says so
(`user_prompt_submit`), or a deterministic detector fires at turn end (`stop`).

## The Iron Law

```
AN OBSERVED DEFECT IN THE AGENT'S OWN BEHAVIOUR IS QUEUED AND FIXED — NEVER SHRUGGED OFF.
THE DEFECT BELONGS TO AGENT-CONFIG. NEVER "FIX" IT BY EDITING THE USER'S PROJECT.
CORRECT THE TURN OPENLY IN FRONT OF THE USER. NEVER RE-RUN IT SILENTLY TO HIDE THE MISS.
THE OUTWARD STEP — PUSH, PR, ISSUE — NEEDS THE USER'S WORD THIS TURN. NO EXCEPTION.
```

## When the queue line appears

`<self-repair-queue>` is injected at prompt time while records are open. It is
work, not a notification:

1. **Read it** — `agent-config self-repair:status`, then the newest record
   under `agents/runtime/self-repair/`.
2. **Name the surface that failed** — the rule, skill, gate, or missing carrier
   that allowed the behaviour. A defect with no named surface is an apology,
   not a fix.
3. **Author the fix against agent-config** — in a checkout if one exists, so
   the release can be a pull request; otherwise the report alone becomes an
   issue.
4. **Offer the release** — `agent-config self-repair:release <fingerprint>`;
   `--dry-run` shows route and body without touching the network. Running it is
   the user's call, per
   [`non-destructive-by-default`](non-destructive-by-default.md).

## Correct openly, never silently

Reported by the user → redo the task properly in the same turn, visibly, saying
what changed. Found by a detector → say so at the next opportunity and correct
it. Forbidden is the hidden version: re-running the turn so the miss never
surfaces. That mechanism (`attempt → critic → re-attempt`) was benchmarked and
falsified under ADR-106 — capability Δ = 0, council verdict TERMINAL — and the
same verdict names the replacement lever: refine the rules on the failure tail,
which is what a queued record feeds. Hiding the miss also destroys the only
signal the loop runs on.

## What the detectors do NOT do

They do not check that every rule was followed. Most obligations here are
model-carried and unobservable from a transcript; guessing at them would
manufacture defects and flood the queue. A new detector must fire on a real
recorded failure **and** stay silent on its near-miss.

## Privacy — fail-closed by construction

A record carries a class, a sanitized evidence span and a counter, and has **no
field** that can hold a prompt, a file body, or a project path. It passes the
audited privacy floor before leaving the machine; a refusal downgrades it to
local-only rather than scrubbing it into publishable shape — the same principle
as [`domain-safety-pii`](domain-safety-pii.md) § Surface 2.

## When NOT to fire

The user is criticising the **code**, not the agent's conduct; the fingerprint
is already an open record (the hook increments it); or a one-off caused by
information the agent could not have had — note it, do not queue it.

## Enforcement

The hook is `fail_closed: false` and always exits 0: it records, it never
gates — blocking a turn-end on a heuristic is the failure mode the
enforcement-projection null warns about. Detection is hook-carried, analysis and
fix model-carried; only the privacy gate and route choice are deterministic.
Nothing claims a defect *will* be caught — only that a caught one is not dropped.
Whether the hook is bound at all on this host is `agent-config hooks:status`; on
a host with no matching slot the detection half does not run and only the
model-carried half remains.

## See also

- [`non-destructive-by-default`](non-destructive-by-default.md) — the Hard Floor the release step obeys.
- [`skill-improvement-pipeline`](../skills/skill-improvement-pipeline/SKILL.md) — the sibling loop for capability gaps.
- [`upstream-contribute`](../skills/upstream-contribute/SKILL.md) — the manual path this automates.
- [`council-availability`](council-availability.md) — the defect class that motivated the first detector.
