<!-- evidence-type: analysis -->

<!-- The prompt given to the council on 2026-10-20, committed verbatim so the
     verdict beside it can be checked against what was actually asked
     (evaluator-independence: a recorded verdict whose prompt is not
     recoverable is not evidence). Not edited after the run. -->

# Council question — disposition of the last open blocker, `fork-widening-is-owner-owned`

Context. A roadmap ("skills that arrive when called") has every step and every
acceptance criterion closed. One blocker remains open and blocks nothing:

- **Blocker `fork-widening-is-owner-owned`** (Owner field: owner, Class 3,
  product-owned). A pilot rendered `context: fork` (the first host's own
  frontmatter key: the skill runs in a forked subagent context and only its
  result returns) for five report-type skills. The pilot closed with HARM: a
  forked run measurably saves main-conversation tokens (scales with body size),
  but a fork cannot see the conversation it was called in (`CANARY=NONE` forked
  vs `CANARY=ZORBLAX` inline). So the render ships unwired; no consumer sees a
  change today.
- Options recorded: (a) widen — name report skills whose bodies need nothing
  from the invoking conversation and ship `context: fork` for them; (b) hold at
  five and leave the render unwired (today's state); (c) retire the pilot and
  delete the render.
- Resolved when: the answer is recorded and the pilot config's `status` says
  `widened`, `held` or `retired`. Recommendation recorded: (b) for now.
- The step that posed it (3.3) reads: "Widening is posed, not taken. Extending
  the fork set is put to the owner on 3.2's record." The reason given for owner
  ownership: widening changes what a consumer's conversation contains on every
  install.

Repository rules. The council decides any transition that is reversible inside
the authorised envelope and weakens no owner-reserved invariant; the owner
decides one that changes a public commitment, is irreversible, or cannot be
bounded. An open blocker prevents the finished roadmap from archiving. A
disposition that keeps the item alive (carry it with its blocker into a named
follow-up roadmap parked under `later/`) is council-decidable; one that drops it
needs the owner.

Question — pick exactly one and say DECIDE or ESCALATE:

1. Council resolves the blocker as (b) hold: status `held` is recorded, nothing
   changes for any consumer, and the widening question stays open to the owner
   at any time (reopen trigger written down). Is choosing "hold" owner-reserved,
   given it is the status quo and no transition?
2. Carry: move the blocker, unanswered, into a new follow-up roadmap under
   `later/` whose single item is the owner question, so the parent archives and
   the question survives where a reader finds it.
3. Escalate: leave the roadmap unarchived until the owner answers.

Name the routing test you applied and the one fact that decided it.
