---
demo_for: ask-when-uncertain
layer: pattern-memory
prose_delta:
  rule_chars_before: 3893
  rule_chars_after: 4267
  measured_at: phase-3.3-cross-link-landing
  note: "+374 chars from the Examples cross-link block; future prose-pruning rounds (out of scope for Phase 3) will pull pattern prose from the rule into this demo and drive the after-count below the before-count."
---

# ask-when-uncertain — Pattern Memory

> Wrong / right / why demos for the `ask-when-uncertain` Iron Law
> (one question per turn, vague-request must ask). Linked from
> [`ask-when-uncertain`](../../.agent-src.uncompressed/rules/ask-when-uncertain.md)
> § Examples. Outcome baseline at
> [`tests/golden/outcomes/ask_when_uncertain.json`](../../tests/golden/outcomes/ask_when_uncertain.json).

## Demo 1 — Vague request, multi-question stack

### Wrong shape

```
User: improve this

Agent:
1. Should I optimize for readability or speed?
2. Refactor the function signature?
3. Add tests too?
4. Run PHPStan after?

Reply with a, b, c, d so I can pick.
```

**Failure mode:** four `?` aimed at the user, structured-answer
demand (`a, b, c, d`), no triage. Iron Law breach: a turn with a
question has *exactly one*. Compound thinking load — answer to Q1
reframes Q2.

### Right shape

```
User: improve this

Agent: Welche Achse soll "improve" treffen?

1. Lesbarkeit (Naming, Funktions-Splits)
2. Performance (Allokationen, N+1)
3. Robustheit (Error-Handling, Edge Cases)

Dann lege ich los.
```

### Why it works

Single `?`, numbered options without compound asks, picks the
question whose answer reframes everything downstream. The follow-up
("tests? PHPStan?") rides on the next turn — its framing depends on
the answer here.

## Demo 2 — Drive-by execution on a vague trigger

### Wrong shape

```
User: clean up this file

Agent: [edits 12 files, removes 200 lines, reformats imports,
extracts 3 helpers, renames 5 variables]
Done.
```

**Failure mode:** "clean up" is a vague-request trigger
(`ask-when-uncertain` § Vague-request triggers). MUST-ask before
touching code. Without scope, the diff is a guess at the user's
intent.

### Right shape

```
User: clean up this file

Agent: Was bedeutet "clean up" hier?

1. Toten Code raus
2. Format / Imports sortieren
3. Refactor (Funktionen splitten)

Pick one — sonst ist der Diff Raten.
```

### Why it works

Names the trigger explicitly ("vague-request"), surfaces the three
canonical interpretations from the rule's trigger table, and
declines to act without scope. The cost of asking once << cost of
ripping through 12 files in the wrong direction.

## Demo 3 — Stacked questions inside a handoff

### Wrong shape

```
Agent: Bevor ich die Roadmap übergebe:

- Welcher Branch?
- Soll ich PRs erwähnen?
- Welches Modell für die Fortsetzung?
- Soll ich .agent-chat-history zitieren?

Antworte als 1, 2, 3, 4.
```

**Failure mode:** four-question handoff block. Per § Ordering &
handoff: handoff questions ride LAST, after domain clarifications,
folded into the handoff prompt itself — not as a parallel quiz.

### Right shape

```
Agent: [delivers the handoff prompt with sensible defaults filled
in: current branch, PR link present if open, model
recommendation per `model-recommendation`, history reference
auto-included]

Welche der vier Defaults soll ich vor dem Übergeben anpassen?
```

### Why it works

Defaults absorb three of the four "questions"; the remaining
question is the only one that genuinely needs user input — and it's
phrased so a one-word answer ("PR link" / "model" / "passt") closes
the loop.
