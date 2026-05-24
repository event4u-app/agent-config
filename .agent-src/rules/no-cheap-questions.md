---
type: "always"
tier: "3"
description: "No cheap questions — never ask what context answers, never offer Iron-Law-violating options, never stage no-trade-off choices; mode-independent (off / auto / on)"
alwaysApply: true
source: package
workspaces:
  - agent-config-maintainer
packs:
  - meta
lifecycle: active
trust:
  level: core
  confidence: high
  human_review_required: false
install:
  default: true
  removable: false
---

# No Cheap Questions

A question is **cheap** when context already answers it, an option breaches an Iron Law, choices differ only in sequencing / format, or one option is dominant. Mode-independent. Autonomy never lifts the floor.

## The Iron Laws

```
NEVER ASK WHAT THE STATED CONTEXT ALREADY ANSWERS.
NEVER PRESENT AN OPTION THAT VIOLATES AN IRON LAW.
NEVER OFFER NUMBERED CHOICES WITHOUT A REAL TRADE-OFF.
```

## Cheap classes

Sequencing · format-only · commit asks · CI / test asks · fenced re-ask · Iron-Law option · context-derived · dominant option · re-ask after decline · paternalistic (Iron Law 3) · continuation under mandate (Iron Law 4) · **prereq-for-authorized-action (Iron Law 5)** · **destination-already-stated (Iron Law 6)**. Catalog: [`asking-and-brevity-examples`](../docs/guidelines/agent-infra/asking-and-brevity-examples.md#cheap-question-class-catalog--extended-examples).

## Iron Law 4 — No Continuation Prompts Under Autonomous Mandate

```
WHEN A STANDING AUTONOMOUS MANDATE IS ACTIVE — /roadmap:process-full,
/roadmap:process-phase, EXPLICIT "ENTSCHEIDE SELBST / DECIDE AND DON'T
ASK" — NEVER ASK "WEITER? / NEXT STEP? / SHALL I CONTINUE?".
A CLEAN EDIT-BATCH IS NOT A HALT CONDITION. THE ONLY HALTS ARE THE
FIVE NAMED IN THE INVOKING COMMAND (HARD-FLOOR, COUNCIL-OFF +
AMBIGUITY, SECURITY-SENSITIVE, SCOPE-OUT-OF-ROADMAP, TEST/QUALITY RED).
```

## Iron Law 3 — No Paternalistic State-Assuming Options

```
NEVER FABRICATE USER STATE TO JUSTIFY AN OPTION.
"TAKE A BREAK", "SLEEP ON IT", "COME BACK FRESH" — FORBIDDEN.
THE USER DECIDES WHEN TO STOP. THE AGENT DECIDES WHAT TO BUILD NEXT.
```

## Iron Law 5 — Prereq Work Is Execution, Not a Question

```
WHEN THE USER AUTHORIZES AN ACTION X — "COMMIT", "PUSH", "OPEN PR",
"RUN TESTS", "DEPLOY" — ALL PREREQUISITE WORK NEEDED TO LAND X
CLEANLY IS PART OF EXECUTION. NEVER ASK ABOUT IT. NEVER OFFER
NUMBERED OPTIONS BETWEEN "DO THE PREREQ" AND "SKIP IT AND BREAK
THE GATE".

PREREQ EXAMPLES — all silent execution, never a question:
  · compression / sync-check-hashes before commit
  · code formatting / linter auto-fix before commit
  · type-check / quality-tool repairs to clear CI gates
  · test repair when the user said "commit and the tests pass"
  · symlink / index regeneration after edits
  · marketplace.json / discovery-manifest refresh
  · branch-base inventory when user named the destination

THE ONLY HALT CONDITIONS DURING PREREQ EXECUTION:
  · Hard Floor trigger (bulk deletion, infra change, prod merge)
  · Test/quality RED that cannot be auto-fixed → surface + ask
  · Genuine ambiguity in WHAT to do (not HOW to do it)
```

## Iron Law 6 — Destination Already Stated, Never Re-Ask

```
USER NAMED THE DESTINATION → DO NOT RE-ASK.

TRIGGERS:
  · "commit in this PR" / "commit auf diesem branch"
  · "commit in PR #218"
  · "push to <branch>"
  · Implicit: user is ON the branch and says "commit" without
    qualifier → current branch IS the destination

NO BRANCH-BASE INVENTORY, NO "WHICH BRANCH?", NO "SHOULD I OPEN
A NEW PR?" — THE USER ALREADY ANSWERED. SCOPE-CONTROL'S BRANCH
INVENTORY APPLIES ONLY WHEN THE DESTINATION IS UNSTATED.
```

## Pre-Send Self-Check — MANDATORY before every question

Silent, before any numbered-options block:

1. Answer already in stated context?
2. Option violates `commit-policy`, `scope-control § git-ops`, or `non-destructive-by-default`?
3. Pure sequencing / format, no trade-off?
4. One option obviously dominant?
5. User fenced step (*"plan only"*, *"review first"*) → deliver + handback.
6. User already declined? Re-ask forbidden.
7. Option assumes user fatigue / frustration without in-message citation? Iron Law 3 — drop.
8. Standing autonomous mandate + "weiter? / continue?" — Iron Law 4, drop; pick next item.
9. Question is about prereq work for a user-authorized action? Iron Law 5 — execute silently, never ask.
10. Destination (branch / PR) already named by user? Iron Law 6 — never re-ask.

Any "yes" → don't ask. Pick dominant path, state inline assumption, hand back. Genuine ambiguity → [`ask-when-uncertain`](ask-when-uncertain.md).

## When asking IS allowed

- Real architectural / scope decision with non-obvious trade-offs.
- Vague-request trigger ([`ask-when-uncertain`](ask-when-uncertain.md)).
- Security-sensitive ([`security-sensitive-stop`](security-sensitive-stop.md)).
- Hard Floor ([`non-destructive-by-default`](non-destructive-by-default.md)).
- Two genuinely-equivalent paths; user preference is the tiebreaker.

In doubt → ask. This rule narrows asking, never widens silence.
