# Golden transcript — slot NN: <slug>

- **Task family:** <ambiguous-discovery | multi-stage-impl | verification | cross-run-calibration>
- **Host strength:** <standard | strong-reasoning> (agent self-assessed, table-free)
- **Host model:** <e.g. gpt-4o-mini | claude-sonnet-4-6 | claude-opus-4-8>
- **Variant:** <baseline (no RDP) | treatment (RDP on)>
- **Date / rater:** <YYYY-MM-DD / name>

## Prompt

<the exact task prompt, copied from the matching trigger-fixtures.json row where applicable>

## Transcript (verbatim)

<paste the full host-model session: response + any notes-file writes + tool calls>

## Token accounting

- input / output / total tokens: <n / n / n>
- (treatment only) overhead vs the baseline slot: <±n tokens, ±%>

## Rubric score (0–3 each)

| dim | score | evidence (quote the transcript line) |
|---|---|---|
| 1 notes-first adherence |  |  |
| 2 grounding |  |  |
| 3 premature-solution avoidance |  |  |
| 4 coherence / re-grounded summary |  |  |

- **mean:** <x.x / 3>
- **reasoning_extraction refusal seen?** <yes/no — yes is a hard fail>
- **notes:** <anything the raw scores miss>
