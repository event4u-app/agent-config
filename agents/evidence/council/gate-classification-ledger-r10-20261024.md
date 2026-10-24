<!-- evidence-type: analysis -->

# Split: openai closes 7.1 narrowly, anthropic will not on an unverifiable process

AI council, 2026-10-24, the fifteenth round that day. anthropic/claude-sonnet-4-5
+ openai/codex-default, design mode, 2 rounds with peer review, CLI transport,
`$0.00`. **2/2 present** after the run. The anthropic probe record had been reset
after two empty rounds, and the pre-run line still read 1/2. The prompt is
committed verbatim beside this file as
`gate-classification-ledger-r10-20261024.question.md`.

## The split

| | anthropic | openai |
|---|---|---|
| Q1: previous items resolved | No: five of six; pin-renewal ownership is a mechanism, not an owner | No: five of six; the same gap |
| Q2: exit criterion met | **No.** *"Literal criterion met, process unverifiable."* | **Yes, narrowly.** *"Approve 7.1, but do not authorize reliance on it in 7.2 until renewal ownership and an enforceable suspension gate exist."* |
| Owner-reserved? | No | No |

The stricter reading is taken. **7.1 stays open.**

## What anthropic requires before it would answer yes

1. Name a pin-renewal owner, as an accountable role rather than *"a council
   round"*. openai asks for the same.
2. Document the twelve review disagreements and how each was resolved. *"You
   can't verify the reconciler honored verdicts you can't see."*
3. Run a cross-provider spot-check of a sample of 5–10 ledger rows against the
   check code.
4. Show that the disagreements were not resolved in the author's favour.
   openai disagrees with this as a measure: *"Correctness depends on rationale
   and evidence, not the percentage of decisions awarded to either side."*

## What openai requires before 7.2, not 7.1

- An independently reproduced historical enumeration at `bbe5b73be`. It must
  prove no seventeenth qualifying check existed, not only that the sixteen
  did.
- Rollback scope, authority and deadline.
- A candidate-state re-attestation, so that the sequencing rule cannot
  deadlock.
- Quorum and independence rules for *"a council round"*.

## Applied in revision 11

- **The twelve disagreements are published** in the ledger, each with the
  author's mapping, the reviewer's suggestion, the current mapping and the
  reviewer's reason. **All 12 resolved in the reviewer's favour.**
- **Owner.** The agent lane holding the roadmap's claim. It initiates the
  council round, records it, and leaves the pin stale until the round answers
  2/2. A degraded round renews nothing. Second-principal approval stays
  owner-reserved.
- **Candidate state.** Re-attestation runs against the proposed merge result,
  before the change lands.
- **The cross-provider spot-check** goes to the sixteenth round, with source
  excerpts for six rows.
