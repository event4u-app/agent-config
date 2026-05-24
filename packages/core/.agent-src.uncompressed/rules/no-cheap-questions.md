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

Cheap = context answers it, option breaches an Iron Law, choices differ only in sequencing / format, or one option dominates. Mode-independent; autonomy never lifts the floor.

## The Iron Laws

```
NEVER ASK WHAT CONTEXT ANSWERS.
NEVER OFFER AN IRON-LAW-VIOLATING OPTION.
NEVER NUMBER CHOICES WITHOUT A REAL TRADE-OFF.
```

Cheap-class catalog + IL 3 (no paternalistic state-assuming options): [`cheap-question-mechanics § cheap classes`](../contexts/execution/cheap-question-mechanics.md#cheap-classes--full-catalog).

## Iron Law 4 — No Continuation Prompts Under Autonomous Mandate

```
STANDING AUTONOMOUS MANDATE ACTIVE → NEVER ASK
"WEITER? / NEXT STEP? / SHALL I CONTINUE?".
A CLEAN EDIT-BATCH IS NOT A HALT CONDITION.
```

Mandate triggers + halt list: [`cheap-question-mechanics § Iron Law 4`](../contexts/execution/cheap-question-mechanics.md#iron-law-4--halt-conditions-under-autonomous-mandate).

## Iron Law 5 — Prereq Work Is Execution, Not a Question

```
USER AUTHORIZES X ("COMMIT" / "PUSH" / "OPEN PR" / "DEPLOY")
→ ALL PREREQ WORK IS EXECUTION. NEVER ASK, NEVER OFFER
"DO THE PREREQ" vs "SKIP AND BREAK THE GATE".
```

Prereq catalog + halt conditions: [`cheap-question-mechanics § Iron Law 5`](../contexts/execution/cheap-question-mechanics.md#iron-law-5--prereq-examples-silent-execution-never-a-question).

## Iron Law 6 — Destination Already Stated, Never Re-Ask

```
USER NAMED THE DESTINATION → DO NOT RE-ASK.
NO BRANCH-BASE INVENTORY, NO "WHICH BRANCH?", NO "NEW PR?".
```

Triggers + scope-control interaction: [`cheap-question-mechanics § Iron Law 6`](../contexts/execution/cheap-question-mechanics.md#iron-law-6--destination-triggers-never-re-ask).

## Pre-Send Self-Check — MANDATORY before every question

Silent, before any numbered-options block. Any "yes" → don't ask:

1. Answer in stated context?
2. Option violates `commit-policy` / `scope-control § git-ops` / `non-destructive-by-default`?
3. Pure sequencing / format, no trade-off?
4. One option obviously dominant?
5. User fenced step (*"plan only"*, *"review first"*) → deliver + handback.
6. User already declined? Re-ask forbidden.
7. Assumes user fatigue / frustration without citation? IL 3.
8. Mandate active + "weiter? / continue?" — IL 4, pick next item.
9. Prereq for user-authorized action? IL 5, execute silently.
10. Destination (branch / PR) already named? IL 6, never re-ask.

Pick dominant path, state inline assumption, hand back. Genuine ambiguity → [`ask-when-uncertain`](ask-when-uncertain.md).

In doubt → ask. This rule narrows asking, never widens silence. When asking IS allowed: [`cheap-question-mechanics § when-asking-is-allowed`](../contexts/execution/cheap-question-mechanics.md#when-asking-is-allowed).
