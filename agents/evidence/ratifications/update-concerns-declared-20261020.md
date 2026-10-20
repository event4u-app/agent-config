---
proposed_by: claude-opus-5 session 42c8753e (drain/update-concerns-declared-20261020)
implemented_by: claude-opus-5 session 42c8753e (drain/update-concerns-declared-20261020)
reviewed_by: AI council, 2 seats, provider-diverse (anthropic + openai), round 2 of 2026-10-20
providers: [anthropic, openai]
verdict: ratified
seats:
  anthropic: ratified
  openai: ratified
effective_after: merge
subject: f82701e129e7a77889e579bf4467a05957127419c81ac1348dee4005616febff
---

<!-- evidence-type: ratification -->

# Two update concerns return, as declared authority expansions

Round 2. The same two seats **refused** this 2/2 earlier on 2026-10-20 and
named four things the next round had to carry. Both now return **`ratified`**:
register them, as declared authority expansions, under two effect terms this
same ratification adds.

## What changed between the refusal and the ratification

Not the argument — the code, and it was re-read in the tree for this round
rather than carried over from the note that claimed it.

| Ask | State |
|---|---|
| (a) split both concerns out of the chunk change | done; the chunk left this change entirely and was ratified separately |
| (c) keep `update-notice` read-only | holds — `updateNotice` returns `activate: null` on **all three** return paths (`update_notice.ts:138`, `:178`, `:207`) |
| (d) gate `update-auto-invite` on a user-owned setting, ring-0 as kill switch only | holds — `autoInviteDecision` refuses on `mode !== 'ask'` at `:90`, **before** it reads `ringZeroExited` at `:91` |
| (b) declare them as authority expansions | this record |

The order in (d) is the substance, not a detail: a rollout switch can only
ever subtract from a human's yes, and if the two lines were swapped the
council's condition would be false while every other property still held.

## Why two new effect terms, and not an existing one

The `effect:` vocabulary is a CLOSED set of seven, and none named "may
initiate an action". `notification` is defined as *tells the human something
and changes nothing else* — and `update-notice` writes a staged candidate
while `update-auto-invite` opens a question. Registering either under
`notification` under-declares an observable effect, which is precisely the
failure round 1 refused.

Both seats agreed the vocabulary had to be extended before registration. They
differed on one name and **the disagreement was resolved by argument, not by
splitting the difference**:

- One seat proposed `staging`.
- The other proposed `state_change` and said why `staging` is worse: it is
  tied to this implementation, where the governance boundary wants a
  capability — state mutation, interaction, execution — that outlives one
  feature's vocabulary.

`state_change` is taken, with that reasoning recorded rather than the name
alone. Both seats proposed `interaction` independently.

Added:

- **`state_change`** — writes operational state WITHOUT activating or
  executing the action that state represents.
- **`interaction`** — solicits user input from a lifecycle hook, without
  deciding or executing the action it proposes.

A seat noted that if the schema allowed multiple effects the honest
declaration would be `[notification, state_change]` and `[notification,
interaction]`. It allows one, so the higher-authority term is declared and the
notice half is described in the manifest comment — which is what that seat
asked for in that case.

## The six conditions, and where each is discharged

1. **Ratify the vocabulary before registering the concerns.** This artifact's
   `subject` covers both in one digest; they are one change and cannot land
   apart.
2. **Preserve and test `activate: null` on every `updateNotice` path.**
   `tests/scripts/update_concerns_declared_effects.test.ts`, two cases. The
   stronger one asserts the TYPE (`readonly activate: null`), so a path added
   later cannot return anything else — a behavioural sweep over today's call
   sites would not survive that.
3. **Preserve and test `mode: ask` before the ring-0 switch.** Three cases,
   and the load-bearing one asserts WHICH reason comes back when both are
   missing. Sensitivity proven rather than assumed: swapping the two lines in
   `update_invite.ts` reds that case and only that case.
4. **Declare that neither concern may invoke an upgrade command.** Four cases,
   one per module, asserting that `child_process` is not reachable by static,
   dynamic or `require` import. A first attempt grepped for `exec(` and failed
   on `RING_ZERO_EXIT_LINE.exec()` — a regex method. Matching the name would
   have had to be loosened until it matched nothing; import reachability is
   the property that was actually meant.
5. **Manifest validation must reject a missing or weaker effect.** Asserted
   per concern, both that the right term is present AND that `notification` is
   absent — a block carrying both would pass a presence-only check.
6. **Document whether staged state is visible, replaceable and clearable.**
   NOT discharged here, and named rather than quietly skipped. It is prose
   owed to the roadmap, and `reversible` is not assumed merely because
   activation is deferred — the seat's own warning.

## What this does not establish

The ratification permits the REGISTRATION under two declared terms. It does
not make either concern safe by argument: it rests on two code properties that
can regress, which is why conditions 2 and 3 are tests rather than sentences.
If either regresses, the verdict that permitted this no longer describes the
code, and the registration should be read as unratified until a new round.
