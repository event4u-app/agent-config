---
proposed_by: claude-opus-5.5/drain-road-to-self-modification-that-a-council-must-pass-20261017
implemented_by: claude-opus-5.5/drain-road-to-self-modification-that-a-council-must-pass-20261017
reviewed_by: ai-council
subject: e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
providers: [anthropic, openai]
verdict: refused
seats:
  anthropic: ratified
  openai: refused
effective_after: merge
---

<!-- evidence-type: ratification -->

# Modification review — the record writer, then the header/disposition split

Step 3.4 of `road-to-self-modification-that-a-council-must-pass`, attempted on
branch `drain/road-to-self-modification-that-a-council-must-pass-20261017` on
2026-10-17. Two rounds, both seats each round, `--prompt-mode pr --rounds 1`
through the CLI seats (anthropic/claude-sonnet-4-5, openai/codex-default),
nothing billed. The header above is round 2's, printed by
`ratification_header`. **Neither round passed, and nothing reviewed here is on
the branch any more**: each source, contract and test file is back at
`origin/main` @ `87c4674f1`, checked as an empty net diff.

`subject` is the digest of the empty gated set: none of the reviewed paths is on
the gate's watch list (`ratification_subject` prints "nothing in this change is
gated, so no record is owed"). This record is kept as the evidence of the two
refusals, not as a record any change depends on.

Prompts, committed verbatim:
`agents/evidence/council/record-writer-review-20261017.question.md` (round 1) and
`agents/evidence/council/record-writer-review-r2-20261017.question.md` (round 2).
Both carry the nine questions of `modification_review_questions.ts` and the full
diff under review, and state no expected outcome.

## Round 1 — the writer and the split together: split, `refused`

The change: `src/scripts/_lib/ratification_record_writer.ts`, which read a
council session record (each seat's stance line, its answers keyed by the
questions' numbering), took `subject` from the gate's `expectedSubjectFor`,
spelled `reviewed_by` one way, derived the header and read the result back
through the canonical reader; plus `deriveModificationOutcome` and two contract
paragraphs.

| Seat | Verdict | Dealbreaker | What it said |
|---|---|---|---|
| anthropic | `ratified` | no | Derivation over extraction, the round trip and the stated gap are adequate; asked for the round-trip failures to be logged. |
| openai | `refused` | yes | Authority laundering: any object with a `responses` array becomes a canonical record branded `ai-council`, so a fabricated session looks more trustworthy than a hand-typed record. The answer parser keys numbered preamble as answers. Run details of a past council belong in a record, not in source. The split alone is "a justified small change"; the writer should wait for a session identity bound to the reviewed revision. |

Disposition: the writer and its suite were withdrawn; the split went to round 2.

## Round 2 — the split alone: split, `refused`

The change: `deriveModificationOutcome` in `modification_review.ts`, returning
the canonical header and the run's disposition (`accepted`, `refused`,
`quorum-short`) under different names, its four-case test, and a contract
paragraph saying `deriveModificationVerdict` decides the run and never the
record.

| Seat | Verdict | Dealbreaker | What it said |
|---|---|---|---|
| anthropic | `ratified` | no | The split narrows authority and is tested; `deriveModificationVerdict` stays exported and could still be misused. |
| openai | `refused` | yes | Two defects in the new function: a `requiredProviders` of zero or below makes an empty council `accepted`, with no bound on non-integer values; and copying arbitrary seat names into a plain object mishandles `__proto__`. The contract's "a caller cannot write the one into the place of the other" is too strong while the other function stays callable. Tests only exercise `requiredProviders = 2`. |

Disposition: reverted. Both council runs the drain was allowed are spent, and a
fix nobody reviewed is not a ratified change.

## What the next attempt starts from

1. **The split** lands only with `requiredProviders` validated as a positive
   integer (a refusal otherwise), the seat map built prototype-free, tests at
   zero, negative, fractional and non-finite thresholds and a `__proto__` seat,
   and contract wording that claims a clearer interface rather than an enforced
   one.
2. **The writer** waits on a provenance answer: a session record it accepts has
   to be bound to the reviewed revision and the committed prompt package, or the
   writer must not brand its output as a council's. The answer parser keys only
   what it can tell from preamble.
3. Council run details stay in records like this one, not in source comments.
