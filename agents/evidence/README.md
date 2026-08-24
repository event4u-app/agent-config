# Evidence registers

Four register classes carry evidence in this repository, and the split is the
useful part. A grep for "claim", "evidence" or "status" hits all four; what
separates them is **what each one is a register OF**.

| Register | Records | Gate |
|---|---|---|
| [`docs/CLAIMS.md`](../../docs/CLAIMS.md) | Public-facing claims **this package makes about itself** | `check_claims.ts` |
| [`provenance/borrows.jsonl`](../../provenance/borrows.jsonl) | Borrowed **code** taken from elsewhere | `lint_provenance.ts` |
| [`provenance/harvests.jsonl`](../../provenance/harvests.jsonl) | Borrowed **ideas** asserted by an artefact here | `lint_harvest_provenance.ts` |
| `ac-capability-scorecard.yaml` | Capability assessment against **an external reviewer's rubric axes** | `check_score_contract.ts` |

The first three were already documented — the two provenance ledgers in
[`provenance/README.md`](../../provenance/README.md), which states the
direction-of-travel distinction between them and `docs/CLAIMS.md`. This file
exists because the scorecard is a fourth class that fits none of those
descriptions and would have been mis-filed under any of them.

## Why the scorecard is not one of the other three

- **Not a projection of `docs/CLAIMS.md`.** Rubric categories are an external
  reviewer's assessment axes. Filtering `CLAIMS.md` by category would mean
  registering ~32 *public claims this package does not want to make*.
- **Not a provenance ledger.** `provenance/README.md` scopes itself to *what
  this package took from somewhere else*. A capability score is neither a
  borrowed algorithm nor a harvested heuristic, and `provenance/README.md` is
  therefore **not** amended by the scorecard's existence — it remains an
  accurate description of the two ledgers it owns.

AI council 2026-08-24, 2/2 convergent (`anthropic/claude-sonnet-4-5` +
`openai/codex-default`, 2 rounds, blind peer review). Both seats independently
reached the same correction: `b-scorecard-fourth-ledger`'s `Resolved when` named
`provenance/README.md`, which is the wrong file — the register set is recorded
**here**.

## Authority — who may write what

```
A COMPANION ROADMAP MAY APPEND EVIDENCE REFERENCES TO A SCORECARD ROW.
IT MAY NEVER WRITE THAT ROW'S `status`.
```

`status` is a **derived** field: it must be consistent with the row's evidence
arrays under the mechanical rules in
[`check_score_contract.ts`](../../src/scripts/check_score_contract.ts), and the
gate refuses a row whose `status` and evidence disagree. The gate **validates**;
it does not author. A roadmap step that closes a phase updates the URIs, and the
row's status becomes legal or illegal as a consequence — which is the point: a
checkbox cannot award a `ten`.

One seat pushed back on the original phrasing here — that only the checker may
"determine or validate" status — on the ground that a validator ordinarily does
not author repository data. That is why this section names the writer (a human or
a roadmap step, appending evidence) separately from the authority (the gate,
refusing an inconsistent combination).

## The scorecard's manifest is incomplete, and mechanically says so

The external review reportedly carried **32** categories. It is **not in the
tracked tree** — its inbox copy is gone. **23** categories with baseline scores
are recoverable, from
`agents/roadmaps/road-to-ten-across-the-board.md` § Category → closing path.
**Nine identities are unknown** — not merely their scores.

So the file carries a `rubric:` block declaring `state: incomplete` with the
arithmetic, and the gate enforces three things about it: the arithmetic adds up,
`state: complete` is refused while `authority: unavailable-external-review`, and
a row outside the declared manifest is refused. Incompleteness is a machine-
readable fact here rather than a comment someone can quietly delete.

Two axes named as non-regression floors elsewhere — runtime simplicity and host
portability — are deliberately **not** rows. Nothing establishes they were rubric
categories, and adding them would reduce a known gap of nine by guessing.
