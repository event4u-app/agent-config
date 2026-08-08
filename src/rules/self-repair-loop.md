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
# obligation: line 31
obligation_frequency: "per-turn"
---

# Self-Repair Loop

A defect in how the agent behaved is a defect in **agent-config**, not in the
user's project. The user should not have to file it, and the next user should
not meet it again. Two intake paths produce one queue: the user says so, or a
deterministic detector fires at turn end (`self_repair_hook.ts`).

## The Iron Law

```
AN OBSERVED DEFECT IN THE AGENT'S OWN BEHAVIOUR IS QUEUED AND FIXED — NEVER SHRUGGED OFF.
THE DEFECT BELONGS TO AGENT-CONFIG. NEVER "FIX" IT BY EDITING THE USER'S PROJECT.
CORRECT THE TURN OPENLY IN FRONT OF THE USER. NEVER RE-RUN IT SILENTLY TO HIDE THE MISS.
THE OUTWARD STEP — PUSH, PR, ISSUE — NEEDS THE USER'S WORD THIS TURN. NO EXCEPTION.
```

## When the queue line appears

The hook injects `<self-repair-queue>` at prompt time when records are open.
Treat it as work, not as a notification:

1. **Read the record** — `agent-config self-repair:status`, then the newest
   entry under `agents/runtime/self-repair/`.
2. **Find the surface that failed.** Name the rule, skill, gate, or missing
   carrier that allowed the behaviour. A defect with no named surface is an
   apology, not a fix.
3. **Author the fix against agent-config** — in the checkout if one exists, so
   the release can be a pull request; otherwise the report alone becomes an
   issue.
4. **Offer the release.** `agent-config self-repair:release <fingerprint>`
   publishes; running it is the user's decision, per
   [`non-destructive-by-default`](non-destructive-by-default.md). `--dry-run`
   shows the route and body without touching the network.

## Correct openly, never silently

When the user reports the defect, redo the task the way it should have been
done — in the same turn, visibly, saying what changed. When a detector found it
after the fact, say so at the next opportunity and correct it.

What is forbidden is the hidden version: re-running the turn behind the user's
back so the miss never surfaces. That mechanism — `attempt → critic →
re-attempt` — was built, benchmarked and falsified under ADR-106 (capability
Δ = 0, McNemar p = 1.0; council verdict TERMINAL), and the same verdict names
the replacement: refine the rules on the failure tail. A queued record IS that
refinement. Hiding the miss also destroys the only signal the loop runs on.

## What the detectors do NOT do

They do not "check that every rule was followed". Most obligations in this
suite are model-carried and unobservable from a transcript; a detector that
guessed at them would manufacture defects and flood the queue with noise the
maintainer then has to triage. The shipped set is small, deterministic, and
covers classes the conformance audits actually measured. Extending it means
adding a detector that can be shown to fire on a real recorded failure and to
stay silent on its near-miss — never a heuristic that "probably" catches more.

## Privacy — fail-closed by construction

A record carries a defect class, a capture-sanitized evidence span, and a
counter. It has **no field** that can hold a prompt, a file body, or a project
path. Before anything leaves the machine the record passes the audited privacy
floor; a refusal downgrades it to local-only rather than scrubbing it into
publishable shape. Same principle as
[`domain-safety-pii`](domain-safety-pii.md) § Surface 2: a type that cannot
carry a secret needs no scrubber that might fail.

## When NOT to fire

- The user is criticising the **code**, not the agent's conduct — that is
  ordinary work.
- The defect is already an open record with the same fingerprint; the hook
  increments it, and one report per defect is the point.
- A one-off caused by information the agent could not have had. Note it, do
  not queue it.

## Enforcement — stated honestly

The hook is `fail_closed: false` and always exits 0: it records, it never
gates. Blocking a turn-end on a heuristic is the failure mode the
enforcement-projection null warns about, and an advisory recorder is the
strongest honest form. So detection is hook-carried, the analysis and the fix
are model-carried, and only the privacy gate and the route choice are
deterministic. No part of this rule claims that a defect *will* be caught —
only that a caught one is never dropped.

## See also

- [`non-destructive-by-default`](non-destructive-by-default.md) — the Hard Floor the release step obeys.
- [`skill-improvement-pipeline`](../skills/skill-improvement-pipeline/SKILL.md) — the sibling loop for capability gaps rather than defects.
- [`upstream-contribute`](../skills/upstream-contribute/SKILL.md) — the manual path this automates.
- [`council-availability`](council-availability.md) — the defect class that motivated the first detector.
