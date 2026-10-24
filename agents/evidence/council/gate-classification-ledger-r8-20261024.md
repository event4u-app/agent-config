<!-- evidence-type: analysis -->

# Discovery is independent; the mapping was not

AI council, 2026-10-24, the thirteenth round that day, run twice on the same
prompt. anthropic/claude-sonnet-4-5 + openai/codex-default, design mode, 2
rounds with peer review, CLI transport, `$0.00`. **Both attempts DEGRADED at
1/2.** The anthropic seat returned an empty answer each time, and the second
attempt's pre-run probe already read that seat as absent. So this record
carries **two independent single-seat readings from openai, not
convergence**. The prompt is committed verbatim beside this file as
`gate-classification-ledger-r8-20261024.question.md`.

## The two openai readings agree

- Attempt 1: Q1 *no, but it is close* (0.90), Q2 *no*. *"The branch enumeration
  is independent; the semantic decision about which branches count as
  assertions is not."*
- Attempt 2: Q1 *no* (0.94), Q2 *no* (0.93). *"The machine proves that every
  branch has a label, not that the label is true."*

**Missing item, both readings:** an independently reproduced semantic judgment
of the branch mapping, by branch id. It matters most for the 92 branches the
ledger author put in non-assertion categories. Both say it is **not
owner-reserved**.

## Further must-fix items (attempt 2, consistent with attempt 1)

- Pin the imported helpers. The per-file pins covered none of them.
- Bind the proof artifacts by digest: inventory, mapping, reconciler.
- `R10.f` says *always*, while C5 is skipped without git. `R11.a` says
  *always*, while links outside the repository are skipped.
- The *kill switch* was a detector without an enforcement point. 7.2 needs a
  fail-closed entry condition.

Five of round 12's six defects are accepted as resolved. The sixth, the
categories as a trust boundary, is the mapping question above.

## Applied in revision 9

- An independent mapping review by a separate session: 182 agree, 12 disagree,
  4 unsure. All 12 disagreements are adopted, and the reconciler fails on any
  disagreement that is not. The review found that the author had swapped two
  composite rows. It also showed that `R1.c` asserts nothing, so `R1.c` is
  withdrawn.
- A helper closure digest over 51 files, recomputed on every run.
- Artifact pins.
- Corrected applicability on `R4.a`, `R10.f` and `R11.a`.
- A reproducible execution script.
- 7.2's fail-closed entry condition, written into the step.

The independence is another session of the same model, not another provider.
