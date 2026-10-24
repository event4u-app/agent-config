<!-- evidence-type: analysis -->

# A closed acceptance list for the pin renewal and item 4

AI council, 2026-10-24, the twenty-ninth round that day.

| Field | Value |
|---|---|
| Seats | anthropic/claude-sonnet-4-5 + openai/codex-default |
| Mode | design, 2 rounds with peer review |
| Transport | CLI |
| Cost | `$0.00` |
| Present | **2/2** on the second run |

**Why this round.** Attempt 4 on the renewal target changed strategy under the
fix-loop bound. It asked the council to fix a closed bar, not to give a renewal
verdict. The prompt is committed verbatim beside this file as
`gate-classification-renewal-acceptance-20261024.question.md`.

**Why it ran twice.** On the first run, anthropic's safety classifier blocked
its answer. That reply was 452 characters and carried no verdict, so the round
was degraded and not converged. The unchanged question was run once more, and
both seats answered.

## Where the seats converge

| Question | anthropic | openai | Converged |
|---|---|---|---|
| Q2. Wiring | whole-file hashes, plus a separate review of non-Phase-7 changes | whole-file hashes, plus a separately hashed review of the non-Phase-7 diff; transitively included Taskfiles enumerated | **whole-file pins, plus a hashed review of non-Phase-7 changes** |
| Q3. Split | A may renew separately but does not advance 7.1 | A may be attested separately, but *"permits no 7.1 state transition and no final renewal"* | **A may be reviewed alone; renewal is atomic over A+B+C** |
| Q4. Truth table for the two multi-mode branches | required for 7.1 | required for 7.1 | **required for 7.1** |
| The 104 aggregated-exit branches | 7.2 | 7.2, *"unless a concrete error is found"* | **not a 7.1 requirement** |
| Q5. Owner-reserved | deferring runtime evidence *"may be"*, depending on what Option A assumed | *"Deferring runtime precedence … would lower the owner's existing floor and is owner-reserved"* | **nothing is deferred, so nothing goes to the owner** |
| Q1. Closed list | A1–A7 | A1–A8 | **openai's A1–A8**, the stricter list, which covers anthropic's A1–A7 |

On Q1, openai's list covers every one of anthropic's items:

- anthropic's predicate documentation and exclusivity proof sit in A2;
- its truth table is A4;
- its whole-file wiring is A5;
- its promotion verification is A6;
- its rollback test is A8.

openai's A1 (the revision-16 diff manifest) is kept because it is the stricter
reading. anthropic had held that manifest to be an audit convenience.

**The closed list (A1–A8).** Nothing else blocks the renewal unless it names an
error or demonstrates a coverage defect (item 7).

| ID | Check | Pass condition |
|---|---|---|
| A1 | diff manifest | The complete revision-16-to-candidate diff of every pinned input, each one assigned to unit A, B or C; none omitted |
| A2 | classifier partition | Every class predicate is evaluated for all 49 aspects without the recorded class as an oracle; exactly one winner after the declared precedence |
| A3 | grounds provenance | Every structured field changed since revision 16 links to reviewed source evidence |
| A4 | mode truth table | Both multi-mode branches executed under default, `--strict`, `--list` where accepted, combinations, conflicts and order permutations; selected row, report and exit asserted |
| A5 | whole-file wiring pins | Whole workflow and Taskfile files pinned, transitively included Taskfiles enumerated, plus a hashed review of every non-Phase-7 change since revision 16 |
| A6 | candidate promotion | The full renewal suite runs on the exact candidate tree; its identity is recorded; promotion is rejected if any byte changes afterwards |
| A7 | mutation matrix | Isolated mutations each fail their gate: D46 behaviour, a grounds effect, classifier precedence, multi-mode dispatch, wiring, a pin. No validator takes actual and expected from the same field |
| A8 | atomic rollback | No mixed-version promotion; a documented command restores the pinned revision-16 set and its evidence without regeneration |
