<!-- evidence-type: analysis -->

# Every open blocker in the active tree, with its resolution condition executed

**Date:** 2026-10-16 · **Tree:** `origin/main@e1956ead7` · **Method:** each
blocker's own `Resolved when` clause was **run**, never read.

The estate's bottleneck is not the roadmap count — `ADR-287` settled that — it
is the blockers, and a blocker's `Status:` field is the one part of it that
goes stale without anybody noticing. So this sweep executes the condition.

## Two counts, two denominators — and the difference is five draft roadmaps

`agents/roadmaps-progress.md` reported **15** open blockers in the active tree.
A pass over `## Blockers` sections counting every entry whose `Status:` does not
begin `resolved` returns **20**.

**Neither is wrong.** The dashboard excludes `status: draft` roadmaps, and the
five it leaves out are exactly the five the wider pass adds:
`four-dated-re-checks-are-calendar-bound` (corpus-refresh-cadence-shape),
`kernel-write-deny-ask-when-uncertain` and `grant-object-undelivered`
(decision-closure), `ratification-platform-anchor` and
`kernel-guard-first-crossing` (typed-grants-that-persist). This document works
against the wider denominator because a blocker in a draft roadmap is still a
decision somebody owes, and three of those five are `Class: 3` human-only.

`ADR-287`'s state table carries the dashboard's 15, which is consistent with
every other figure in that table. Its History records the wider reading rather
than replacing the number.

Separately, `report_parked_blockers` covers `agents/roadmaps/later/` and reports
**66** more (57 owner-wait, 9 agent-wait). There is **no equivalent report for
the active tree** — the dashboard prints a count and no list, which is the
mechanical reason an active blocker can sit unread: nothing enumerates them. This
document is a one-off stand-in, not that report.

## Conditions executed — none of them had gone stale

Four blockers carry a condition an agent can run directly. All four were run on
this tree, and all four still hold open:

| Blocker | Condition | Result |
|---|---|---|
| `host-sync-layout-at-current-host` | `tests/fixtures/design-sync/host-observed/` exists | absent |
| `outside-tree-destruction-reading` | a file under `agents/evidence/owner-directives/` names the slug | no match |
| `grant-object-undelivered` | `grep -rln granted_by src tests` returns ≥ 1 path | **0** paths |
| `adr-020-ownership-ledger-reading` | `adr_cite_check ADR-020` status, amendments, successors | `accepted`, amended ×3, no `review_trigger`, no protected dimension |

The fourth is the one that moved: reading it was step 0.1 of its own roadmap,
and the three amendments it surfaced are what both council seats then reasoned
from.

## Disposition of all 20

### Closed this round — 3, all council-decidable and all 2/2 with no split

| Blocker | Verdict | Record |
|---|---|---|
| `adr-020-ownership-ledger-reading` | **(a)** — the ledger makes ADR-020 coherent | `agents/evidence/council/ownership-ledger-adr020-20261016.md` |
| `identifier-table-at-rest` | **(b)** — no detected value is persisted between events | `agents/evidence/council/identifier-table-at-rest-20261016.md` |
| `benchmark-fixture-fonts` | **(a)** — the typeface lock binds published artefacts | `agents/evidence/council/benchmark-fixture-fonts-20261016.md` |

After the round the dashboard reads **12**; the wider pass reads **17**. The
offset is the same five draft-roadmap blockers.

The third ran **against its roadmap's own written recommendation of (b)**,
which is the clearest evidence in this sweep that the rounds were worth paying
for rather than taking the recommendation as read.

### Cannot be closed by an agent — 6, each for a named mechanical reason

| Blocker | Why not |
|---|---|
| `kernel-write-deny-ask-when-uncertain` | the write is refused by `block-kernel-rule-writes`; the route out is the human-owned override registry or removing the manifest entry |
| `kernel-guard-first-crossing` | needs a maintainer-authored kernel commit to exist on the branch |
| `ratification-platform-anchor` | the decision is made and the gate is built; a human act remains |
| `external-bootstrap-boundary-for-phases-2-3` | forge-side approval configuration, reserved to the owner by its roadmap's D3 |
| `four-dated-re-checks-are-calendar-bound` | two further occasions on separate days; a calendar cannot be compressed |
| `grant-object-undelivered` | nothing in its own file; waits on a sibling roadmap to deliver the grant object |

`Class: 3` on four of these means *a human is the content*, not *a human
usually does this* — the distinction `ADR-237` draws, applied here rather than
assumed.

### Waiting on the owner — 11 at the time of this sweep

Each was a pick-one whose roadmap **already stated a recommendation with its
reasoning**. The sweep's reading was that nothing was missing except somebody
saying yes.

| Blocker | Recommendation on file |
|---|---|
| `node-floor-raise` | (a) raise to `>=22` — Node 20 passed its support window 2026-04-30 |
| `which-completeness-skills-owe` | (b) reach, not presence — makes the minimal install legal while keeping "no silent subset" checkable |
| `default-flip-of-the-installed-layer` | (a) — the owner answered this on 2026-10-06; it waits on an arrival record |
| `auto-default-for-existing-installs` | (b) until the ring-0 record exists, then reconsider |
| `default-mode-for-consumers` | (a) — the credential class costs a coding task no utility |
| `maintainer-design-router-name` | (a) a different name — under (b) the router silently disappears from the host the work happens on |
| `outside-tree-destruction-reading` | (a) — adds no question and no grant, so both standing criteria hold |
| `impact-numbering-model` | (b) first, then (a) once the replay has run |
| `consumer-gate-denominator` | (b) report for three months — a ratchet set from a first reading fixes a number before anyone knows its variance |
| `request-gateway-build` | (a), conditional on its own 7.2 |
| `host-sync-layout-at-current-host` | (a) — a fixture invented from an old extract would test the extract, not the host |

Four of these change something a consumer can observe — the Node floor, two
defaults and a shipped command's name. Those are compatibility and public-surface
commitments, which is why the sweep put them here rather than with the council.

## Second pass — the eleven went to the council, not to the owner

The owner's instruction on reading the above was to try the council first. All
eleven were put in ten rounds (the Node floor and the `auto` default travelled
together), each carrying the owner-reserved table and an instruction to open
with `DECIDE` or `ESCALATE`. Verdicts, reasoning and the tree facts they turned
on: `agents/evidence/council/owner-blocker-routing-20261016.md`.

The sweep's own framing was wrong in one respect, and the correction is the
most useful thing in this document: **"waiting on the owner" described the
labels, not the transitions.** The labels were right about five of the eleven
— the five the table below escalates. (Corrected 2026-10-22, release finding
`3a0f5743db3a`: this read "four", which matches no row of the table.)

| Outcome | Count | Blockers |
|---|---:|---|
| Decided by the council | 5 | `default-mode-for-consumers` · `maintainer-design-router-name` · `outside-tree-destruction-reading` · `consumer-gate-denominator` · `impact-numbering-model` (option (b); (a) stays owner-reserved) |
| Settled by tree evidence instead | 1 | `default-flip-of-the-installed-layer` |
| Escalated, seats convergent | 2 | `node-floor-raise` · `which-completeness-skills-owe` |
| Escalated on a split | 3 | `auto-default-for-existing-installs` · `request-gateway-build` · `host-sync-layout-at-current-host` |

**Open blockers across the active tree: 20 → 13** (the dashboard, which
excludes `status: draft` roadmaps, reads 8). Three closed by the first round of
council work and four by the second.

Two of the five council decisions did **not** close their blocker, and the
difference is worth keeping straight: `impact-numbering-model` is decided on
option (b) and stays open on (a), which is owner-reserved; and
`default-flip-of-the-installed-layer` was never a question — the tree evidence
re-pointed its condition to a scheduled producer, so it stays open as an
accrual wait rather than as a decision.

### Three stale records the second pass found, none of them a decision

The pattern the first pass caught in four resolution conditions recurred in
three places that no condition pointed at:

1. **`default-flip-of-the-installed-layer`** said its arrival record was *"not
   obtainable in any scheduled file"*. Its own sibling blocker, one entry above
   it in the same file, has recorded the opposite since 2026-10-15.
2. **`four-dated-re-checks-are-calendar-bound`** said two occasions remained and
   named a December deadline for two corpora. One remains; both named corpora
   were re-stamped; the real first red is a **third** corpus five weeks earlier.
3. **`threat-modeling`'s cadence stamp** moved from `2026-09-18` to `2026-10-13`
   in a pull request about account-lifecycle threat rows. The step that exists
   to move it never ran, and the stamp now claims freshness against four
   upstreams when one was read. That is this roadmap's own Risk 2 arriving
   sideways, through a change with no reason to think it was touching a cadence
   stamp.

None of the three was a judgement call. All three were a field nobody re-read
after the thing it described changed.

## The structural finding

Seventeen of twenty blockers are waiting on a person, and eleven of those
seventeen are waiting on a person to agree with a recommendation that is
already written down. That is not a throughput problem and no amount of agent
work reduces it.

`ADR-287` ruled that the estate shrinks by finishing. This sweep names what
finishing is currently waiting on, and it is a decision queue rather than a
work queue.
