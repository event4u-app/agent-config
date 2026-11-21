<!-- evidence-type: analysis -->

<!-- Sent verbatim from the line after this comment. Reader prompts were followed by the subject history from `./scripts-run src/scripts/review_loop_census --reader-input 10`. -->

# Classify the findings of one review loop by origin

You are one of two independent readers. Below is the recorded round history of
one review loop from a repository that ships rules, skills and hooks for AI
coding agents. The loop is either a council ratification (two model seats,
"anthropic" and "openai", review a change round after round; the packet for
round N usually describes what round N-1 found and how it was fixed) or a
completion review (one fresh reviewer per round; each round's findings table
is listed under "Round N" with an id `R<round>.<row>`, a severity and the text).

Task: for every round N from 2 upward, list each finding that round N raised
for the first time, and give it exactly one origin class:

- `fix-introduced` — the finding is about something the fix made after round
  N-1 changed or added (a defect in, or caused by, that fix).
- `re-raised` — the finding restates a point an earlier round already raised
  and that was answered or dismissed.
- `single-seat` — raised by one seat or reviewer only, medium or low severity,
  and neither of the above.
- `other` — anything else.

When more than one fits, take the first in the order above. Severity is one of
`critical`, `high`, `medium`, `low`, or `unknown` when the text does not say.
For a ratification packet, attribute each finding to the round that raised it
(a packet for round N that says "Round N-1 and what changed" describes round
N-1's findings). If the history does not show a round's findings at all, mark
that round `"visible": false` with an empty list; a round shown to have found
nothing is `"visible": true` with an empty list. Also give the number of
round-1 findings.

Answer with one JSON object and nothing else:

```json
{"subject": "<slug>", "round1_findings": 0,
 "rounds": [{"round": 2, "visible": true,
   "findings": [{"id": "2.1", "summary": "<at most 12 words>", "severity": "medium", "class": "fix-introduced"}]}]}
```

Use ids `<round>.<n>`; for a completion review, use the `R<round>.<row>` id
shown in the history instead.

---

