# council-blind-review — Phase-2 A/B re-run test

> Scope: `road-to-council-blind-review.md` Phase 2. 10 already-decided
> council questions re-run in two arms (2026-07-28), council members
> anthropic/claude-sonnet-4-5 + openai/gpt-4o, `council:run` path, same
> models and budgets in both arms.

## Arms

- **Arm a (current protocol):** plain `council:run` — attributed responses,
  no stances, no chairman fields.
- **Arm b (Ü1+Ü2+Ü3):** `council:run --blind-chairman --stances
  --chairman-fields` — stance-assigned deliberation (deterministic
  question-hash rotation incl. the ablated-context outsider seat), blind
  A–E render with post-verdict de-anonymization map, mandatory
  collective-blind-spot + one-line-verdict sections.

## Structural discovery (material for the roadmap)

With the current TWO-member council, a **member chairman is impossible**:
both members deliberate, and `select_chairman` hard-enforces
generator-cannot-self-judge (a deliberated member always falls back to
host — `chairman.ts`). The Ü1 member-chairman path is therefore dead code
at member count 2; it becomes live only when a third member is configured.

**Consequence for the A/B synthesis step:** the "chairman" in both arms is
a FRESH, ISOLATED synthesizer session (sonnet subagent, artifact-only
input — no session history, no identities beyond what the artifact shows).
Arm a's synthesizer reads the attributed artifact; arm b's reads the blind
artifact. This isolates the attribution variable cleanly — the synthesizer
genuinely has never seen the identities in arm b, which is a STRONGER
blind than production host-mode (where the orchestrating agent saw
responses stream in attributed).

## Metrics (pre-registered in the roadmap, council-tightened)

1. **Verdict changes** arm a vs arm b per question.
2. **Ü1 degradation criteria** on arm-b syntheses: (a) synthesis
   contradicts a position ALL members agreed on; (b) synthesis cites
   evidence present in no member response. Zero triggers over ≥10 pairs =
   Ü1 adopted.
3. **Ü3**: maintainer — blind to arms — rates `collective_blind_spot` as
   decision-influencing in ≥2 of 3 sampled runs.
4. **Ü2**: maintainer blind-prefers the stance arm's synthesis in the
   MAJORITY of pairs where arms differ substantively.

Maintainer blind ratings are collected via
[`blind-rating-packet.md`](blind-rating-packet.md) (arms shuffled and
hidden; the arm key lives in `rating-key.md` — open only AFTER rating;
1-person blind, stated honestly, never inflated into significance).

## Honest limitations

- n=10 questions, 1 pair each — variance across repeats of the SAME
  question is not measured (diversity was preferred over repeats).
- The maintainer blind preference is a 1-person sample.
- Stance effects (Ü2) and blinding effects (Ü1) are bundled in arm b —
  a verdict change cannot be attributed to one mechanism alone; the
  degradation criteria (Ü1) and field-quality rating (Ü3) are
  mechanism-specific, the preference rating (Ü2 rule) is arm-level.

## Reproduce

Runner: 10 questions from `agents/runtime/council/questions/` (list in
`results-2026-07-28.md`), two `council:run` invocations each per the arm
flags above, outputs under `agents/runtime/council/responses/blind-review-ab/`
(gitignored, auto-pruned — the durable evidence is the results file here).
