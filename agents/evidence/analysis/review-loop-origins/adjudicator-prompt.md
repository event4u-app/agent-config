<!-- evidence-type: analysis -->

<!-- Sent verbatim from the line after this comment. Reader prompts were followed by the subject history from `./scripts-run src/scripts/review_loop_census --reader-input 10`. -->

# Settle disagreements between two readers' origin classes

Two independent readers classified the findings of one review loop by origin,
using the instructions quoted under "Reader instructions". They disagree on
the rounds listed under "Disputed rounds". Read the round history yourself and
give your own classification for those rounds only, using the same classes,
the same precedence and the same output shape. You may agree with either
reader, with neither, or with parts of both; the readers' replies are evidence,
not answers.

Answer with one JSON object and nothing else, holding only the disputed rounds
(and `round1_findings`, which you also settle):

```json
{"subject": "<slug>", "round1_findings": 0,
 "rounds": [{"round": 3, "visible": true,
   "findings": [{"id": "3.1", "summary": "<at most 12 words>", "severity": "medium", "class": "re-raised"}]}]}
```

---

