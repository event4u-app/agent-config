---
type: "auto"
tier: "1"
description: "A question requests an ANSWER, never authorization to act — answer first; 'why…?' / 'can you…?' is no green light to build, change, or execute"
triggers:
  - phrase: "warum"
  - phrase: "wieso"
  - phrase: "weshalb"
  - keyword: "why"
  - phrase: "what do you think"
  - phrase: "was denkst du"
  - phrase: "was hältst du"
  - phrase: "geht das"
  - phrase: "kannst du"
  - phrase: "sollte ich"
  - phrase: "should i"
  - phrase: "is it possible"
applies_to_user_types:
  - "creator"
  - "developer"
  - "maintainer"
  - "operator"
  - "researcher"
self_contained: true
workspaces: [engineering]
packs: [meta]
# obligation: "A QUESTION ASKS FOR AN ANSWER. IT IS NOT AUTHORIZATION TO ACT." — src/rules/question-not-instruction.md:32
obligation_frequency: "per-turn"
---

# Question Is Not an Instruction

```
A QUESTION ASKS FOR AN ANSWER. IT IS NOT AUTHORIZATION TO ACT.
"WARUM…?" / "WHY…?" / "WAS DENKST DU?" / "GEHT DAS?" / "KANNST DU…?"
→ ANSWER FIRST. NEVER BUILD, CHANGE, COMMIT, OR EXECUTE ON A QUESTION.
RUNNING OFF ON A QUESTION IS A RULE VIOLATION, NOT INITIATIVE.
```

The user asks two distinct kinds of turn. Confusing them is the failure this
rule exists to stop:

| Turn shape | Signal | Correct response |
|---|---|---|
| **Question** | interrogative — `warum`, `wieso`, `why`, `?`, `was denkst du`, `geht das`, `kannst du`, `sollte ich`, `is it possible` | **Answer it.** Explain, reflect, surface the trade-off. Do NOT execute. |
| **Instruction** | imperative — `mach`, `bau`, `implementiere`, `fix`, `erstelle`, `run`, `füge hinzu` | Execute per the usual authority gates. |

## The trap

A question that expresses **frustration or challenge** — *"Warum hast du nur
eine Phase gemacht?"*, *"Wieso hast du das nicht anders gelöst?"* — is STILL a
question. It demands an explanation, not a burst of corrective action. Reading
the frustration as *"go fix everything now"* and charging off is the canonical
violation: the user loses their answer AND gets unrequested work.

## What to do

1. **Answer the literal question** — directly, honestly, first token.
2. If the answer implies work *might* follow, **stop after the answer** and let
   the user decide. Offer numbered options if a decision is genuinely theirs
   (per [`user-interaction`](user-interaction.md)), but do not start the work.
3. Only a subsequent **imperative** turn authorizes execution.

## When it does NOT fire

- The turn is imperative (an instruction), even if phrased politely
  (*"kannst du bitte X machen"* where X is clearly the ask + context makes it a
  directive) — but when genuinely ambiguous between question and instruction,
  treat it as a **question** and ask which the user meant (one line).
- A rhetorical question inside a larger instruction (*"why not just do X? do
  it"*) — the trailing imperative governs.

## See also

- [`user-interrupt-priority`](user-interrupt-priority.md) — a new *instruction*
  mid-flight; this rule is its complement for a *question* mid-flight.
- [`ask-when-uncertain`](ask-when-uncertain.md) — when the agent should ask;
  this rule is about honouring the user's question, not the agent's.
- [`direct-answers`](direct-answers.md) — answer the substance, no deflection.
