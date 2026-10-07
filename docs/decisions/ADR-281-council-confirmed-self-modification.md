---
adr: 281
status: accepted
date: 2026-10-07
decision: council-confirmed-self-modification
supersedes: ADR-268, ADR-118
supersedes_scope: >-
  The ladder sentence of ADR-268 § 4 ("The ratification ladder is: an
  independent session or agent → the AI council, CLI-first → a different
  provider → the owner, reached only on non-convergence, on unavailable
  diversity for a critical expansion, or on an owner-reserved dimension"),
  whose first rung this record removes for the gated surface and for changes
  the learning lanes originate, and to whose owner list it adds a change to
  the reviewer itself; and rejection 2 of ADR-118 § 3 ("no loop commits
  changes to `src/skills/` or `src/rules/` without human approval"), which
  becomes: for a proposal scoped to the package, the approval is the
  council's record and the user is its last rung. Nothing else in either
  record. ADR-268 § 4's Iron Law, its tool-call-deny sentence, its soak
  retirement and every other section stand; ADR-118 § 3 rejections 1, 3, 4
  and 5 and the rest of that record stand.
superseded_by: —
phase: road-to-self-modification-that-a-council-must-pass · Phase 1
type: structural
reopen_policy: owner
protected_dimensions: governance
provenance:
  kind: human
  decision_makers: [owner]
  human_directed: true
evidence:
  strength: E2
  basis:
    - docs/decisions/ADR-268-mission-scoped-authority-persistence-and-ratified-self-amendment.md
    - docs/decisions/ADR-118-loop-engineering-boundaries.md
    - docs/contracts/ratification-artifact.md
    - src/scripts/check_kernel_edit_ratified.ts
    - src/scripts/_lib/ratification_artifact.ts
    - src/config/ratification-policy.json
    - src/rules/decision-revisit-gate.md
    - docs/guidelines/agent-infra/self-improvement-pipeline.md
review_trigger: >-
  Owner ruling only. The review load on the gated surface or on the learning
  lanes changes materially; the owner widens the reading to every change of a
  rule, skill, command or hook (option (b) of the directive-reading blocker);
  or a place only a person writes comes to exist, at which point the
  owner-permission-route moves from the forge bypass to a recorded owner
  ruling beside the council's non-passing record.
---

# ADR-281 — Self-modification is a goal, and a council must pass it

## Status

**Accepted, owner-directed, 2026-10-07.** The directive was given on 2026-10-05;
its reading and the owner's permission route were answered by the owner on
2026-10-06 through `/roadmap:resolve-blockers` — option (a) for the reading of
the directive, option (b) for the route past a council that cannot conclude.
This record writes those two answers down; it decides nothing the owner did not
answer. The authorising event is the owner's review and merge of the change
that carries it — the same standard ADR-268's own § Alternatives sets: a record
is accepted because a person said so, never because a transcript was
persuasive.

## Context

The owner's directive of 2026-10-05, in his words: self-modification is good
and should be a goal here too; it must at the least be confirmed and permitted
by an AI council, which always questions critically and checks what the
modification does; and in the last resort the user must permit it.

ADR-268 § 4 already permits an agent to edit kernel rules, governance hooks and
authority schemas inside an authorised mission, and makes an authority-expanding
edit inert until a ratification artifact exists. Its ladder starts with "an
independent session or agent". In practice the reviewer already is a council —
22 of the 23 artifacts on the trunk name one — and the repository's reader
already refuses a record with fewer distinct providers than
`src/config/ratification-policy.json` requires, so the first rung was weaker in
the text than in the reader.

## Decision

### § 1 — Self-modification is a goal, not an exception

A change the package makes to what governs it is a legitimate goal of a run. It
is constrained by the record it must carry, never by a refusal to make it.

### § 2 — The council is the lowest rung that can pass

For a change to the **gated surface** — the paths `check_kernel_edit_ratified`
watches — and for a change that **originates in the package's own learning
lanes** (a proposal under `agents/proposals/` scoped to the package), the lowest
rung that can pass is the AI council. An independent session alone no longer
ratifies. The rest of ADR-268 § 4's ladder stands: a different provider, then
the owner — reached on non-convergence, on unavailable diversity for a critical
expansion, or on an owner-reserved dimension. **A change to the reviewer
itself** — the modules that compute the record's subject, write the record, ask
the questions and derive the verdict — joins the owner's list.

Commissioned work, a change a user asked for, keeps its present speed: it needs
the user's approval as now, and a council record only where it touches the
gated surface.

### § 3 — The verdict rule, for the owner to accept or strike

Quorum and escalation are the owner's to set (`decision-revisit-gate`'s
owner-reserved row on governance self-amendment). The owner accepted this rule
as drafted:

A seat **concludes** when its closing stance line parses to one of
`ratified`, `confirmed-non-expanding`, `refused`; a missing line, an abstention
or any other label is a seat that did not conclude. Then, in this order: any
concluding seat on `refused` gives `refused`; fewer concluding providers than
`required_providers` in the ratification policy gives `non-convergent`;
otherwise `ratified` if any seat said so, and `confirmed-non-expanding` if all
did.

### § 4 — When the user decides, for the owner to accept or strike

In the order of ADR-268 § 4, the user decides when: the record is
`non-convergent` after a different provider was tried; provider diversity is
unavailable for a critical expansion; the change touches a row of the
owner-reserved table in `decision-revisit-gate`; or the change is to the
reviewer itself. In those cases the run stops with the change open and
labelled, the non-passing record in it, and one question: the council's
recommendation, the dissent, the exact change, what it is expected to gain,
what it risks, and how it is undone.

### § 5 — The owner-permission-route is the owner's own bypass on the forge

`owner-permission-route`: where the council cannot conclude, the owner's
permission is given as **his own recorded bypass on the forge, restored
afterwards** — option (b) of the blocker of that name. It is preceded by an
ask: on non-convergence, or on the red check it causes, the agent tells the
owner at once and asks in-session with options. A yes is then given as the
forge act, never as a chat answer, because a chat answer reaches the tree only
as text an agent wrote, and ADR-268 § 4 forbids an agent ratifying its own
increase in power. The ratification contract's two sentences that rule a bypass
out — a red check is not an emergency; an unconditional bypass actor is a
failure of the platform anchor — are amended for **recorded non-convergence
only**: the bypass is per case and restored, never a standing actor.

What this route cannot prove: the gate cannot see a forge bypass, so nothing in
the tree distinguishes the owner's act from any other administrator's. The
trace is the bypass record the contract's emergency procedure already requires.

### § 6 — A passing record makes a change ready, not landed

A passing record permits the change to pass the gate. It does not publish or
land it; whether a run may land its own change is the typed grant's question
(ADR-268 § 3). The self-repair loop's outward step and the upstream consent
lines are unchanged.

## Consequences

- The ratification contract's ladder paragraph follows § 2, and its emergency
  procedure gains the one non-convergence case of § 5.
- The shipped sentences that call kernel rules immutable, and the pipeline
  guideline's "no autonomous self-edits", are corrected to state § 2.
- The gate binds each record to the content it reviewed, so a passing record
  cannot be carried by a later edit; that is what makes "the council confirmed
  this change" mean this change.
- A council outage now stops governance work for the user instead of letting
  the run decide alone. That is the directive's last rung, not a defect.

## Not reopened

- ADR-268 § 4's Iron Law, the tool-call deny on kernel rules
  (`block_kernel_rule_writes.ts`) and its retirement, which waits on its own
  blocker in `road-to-typed-grants-that-persist`.
- ADR-268 § 3: no landing authority is added.
- ADR-118 § 3 rejection 1 (no open-ended hill-climbing on the config) and the
  kill on automated promotion of learnings.
- The self-repair loop, its deny list and its outward step; the consumer
  override registry.
- The closed verdict vocabulary of the ratification artifact.

## Alternatives

- **Option (b) of the reading — every change to a rule, skill, command or hook
  needs a council review.** Not chosen by the owner. Measured: 22 of the 49
  commits before the pin touched such a file and 8 carried a record, so it
  would add 14 reviews over that span.
- **Option (c) of the reading — the gated surface only.** Not chosen: it would
  leave the package's own learning lanes, which originate changes nobody asked
  for, with no council at all.
- **Owner-permission option (a), an owner-ruling record beside the council's
  non-passing record.** Not chosen: it needs a place only a person writes, which
  does not exist at the pin. It becomes the route once one exists — this
  record's review trigger.
- **Owner-permission option (c), no route.** Not chosen: it is what the tree did
  before, and it leaves the directive's last rung with nothing the owner can
  write.

## Evidence

- The directive of 2026-10-05 and the owner's answers of 2026-10-06 to the
  blockers `self-modification-directive-reading-confirmed` (option (a)) and
  `owner-permission-route` (option (b), with the ask-first condition), recorded
  as decisions D10 and D11 of `road-to-self-modification-that-a-council-must-pass`.
- `docs/decisions/ADR-268-mission-scoped-authority-persistence-and-ratified-self-amendment.md`
  § 4 — the ladder this amends.
- `src/scripts/_lib/ratification_artifact.ts` — the reader that already refuses
  a record with fewer distinct providers than the policy requires.
- `src/rules/decision-revisit-gate.md` — the owner-reserved row on quorum and
  escalation that makes §§ 3-4 the owner's to set.

## References

- ADR-268 (§ 4 ladder sentence superseded by § 2) · ADR-118 (§ 3 rejection 2
  superseded by § 2) · ADR-201
