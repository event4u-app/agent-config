# Owner-claim census over existing ADRs — 2026-10-25

**Tree:** `c073ca2e5a` (18.2.0). **Step:** 4.1 of `road-to-records-that-agree-after-eighteen`.

`check_new_adr_evidence` checks only ADRs ADDED by a diff. This run applied
its own `checkRecords` once to every `docs/decisions/ADR-*.md`. The command
imports the shipped module and calls `checkRecords(root, allAdrFiles)`, then
keeps the findings whose reason names `agents/evidence/owner-directives/`.

| Reading | Count |
|---|---|
| Accepted records read | 204 |
| Owner-claim misses (`human_directed: true` or `owner` in `decision_makers`, no owner-directive cited), all ADRs | 49 |
| The same, ADR-282 onwards (when the owner-directive record was introduced) | 14 |
| Of those 14, `owner` named in `decision_makers` | 8 |

The 14: ADR-283, 284, 285, 286, 287, 288, 289, 290, 291, 293, 296, 297, 298
and 299.

The 8 that name the owner as a decision-maker: ADR-283, 286, 287, 288, 293,
297, 298 and 299. ADR-286 § D2 is already corrected by ADR-301. The other six
of the 14 carry only `human_directed: true` with `agent` or `council`
decision-makers. The gate's predicate counts them, but they do not attribute a
decision to the owner.

A miss does not mean the record is wrong. It means nothing checkable shows the
owner's words. The predicate stays diff-scoped. The 7 records left are raised
as one owner question, OQ-18 in `agents/owner-questions.md`.

Not checked: whether the owner's words exist elsewhere (a chat, a PR comment).
No gate reads those.
