<!-- evidence-type: analysis -->

# Three open questions from round inbox-2026-10-aw — which can the council decide?

For each question, decide it if it is council-decidable, or state that it is
owner-reserved and why. Owner-reserved means it weakens an owner-reserved
invariant, creates an external, irreversible or destructive commitment, or
asserts something only the owner can know. Reversible work inside the existing
authority envelope is council-decidable. Repository WIP cap: 5 active roadmaps
(owner directive 2026-10-24); 3 are active today.

## Q1 — Wake `later/road-to-a-graph-that-wins`?

- Its `entry_condition`: the parent `road-to-a-graph-that-is-shipped` is archived
  AND the two benchmark subject repositories (ADR-260 § 5 reserves the choice to
  the owner) are named in its `## Corpus header`.
- In the tree: the parent is archived (`agents/roadmaps/archive/road-to-a-graph-that-is-shipped.md`).
  The corpus header names `event4u-app/unopim` and `event4u-app/larasend` (public
  MIT forks), filled 2026-10-23 by the owner.
- 18 open steps. No detector evaluates `entry_condition`, so it stayed parked.
  Fourth arrival of this request in review rounds.
- Options: (a) wake it now (move to `agents/roadmaps/`, status ready), making 4
  active; (b) leave it parked with a stated reason.

## Q2 — `later/road-to-release-finding-ordering`: unpark the unblocked part?

- 14 open steps: 1.1–1.3 (decide and build a terminal-state-aware wait and a
  completion manifest), 2.1 (fail-closed fixture-injection flag), 2.2
  (demonstrate end to end on a synthetic `release/*` PR), 2.3 (cover three
  states), 3.1–3.3 (three carried findings).
- Its only blocker, `release-pr-demonstration-owner-call` (owner), gates 2.2 and
  AC-2 only: a synthetic `release/*` PR is in the Hard-Floor table, which no
  autonomous run lifts. Options the blocker offers the owner: (1) authorize one
  synthetic `release/*` PR; (2) move `review_by` with a reason; (3) cancel AC-2.
- `review_by` 2026-09-20 has passed. Seventh arrival; reviews say the park
  holds more than the blocker does.
- Options for the council: (a) unpark it and run every step but 2.2, which
  stays behind the owner blocker; (b) leave it parked; (c) also decide the
  owner blocker.

## Q3 — OQ-18: seven ADRs name the owner as decision-maker without his words

- `check_new_adr_evidence` requires an added ADR that names the owner as
  decision-maker to cite an `agents/evidence/owner-directives/*.md`. It caught
  ADR-286 recording an owner refusal the owner never gave. Run once over the
  tree, 7 more accepted records from ADR-282 on (283, 287, 288, 293, 297, 298,
  299) name the owner in `decision_makers` and cite no directive.
- Options: (a) the owner confirms each attribution and his words are recorded as
  owner-directives; (b) records the owner did not decide are relabelled
  `council`/`agent`; (c) leave them.
- Question for the council: can any part of this be decided without the owner,
  and what should the owner be asked, in one question?

Close your reply with EXACTLY this line, and nothing after it:
STANCE: <Q1 a|b> <Q2 a|b|c> <Q3 owner|council> | CONFIDENCE: high|med|low | DEALBREAKER: yes|no
