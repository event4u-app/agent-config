<!-- evidence-type: analysis -->
<!-- analyzed: 2026-08-22 | commit: eb1e0b866 | files: 5 -->

# Autonomous roadmap-drain run — 2026-08-22

Zero questions to the operator. Every decision that would normally end in "ask
the user" went to the AI council instead, and every council pass reached
**2 of 2 seats present and convergent**.

**The run did not empty the roadmap directory, and this file says where it
stopped and why** rather than presenting five PRs as completion.

## PRs

| PR | Roadmap | State at hand-off |
|---|---|---|
| [#1517](https://github.com/event4u-app/agent-config/pull/1517) | `road-to-drain-commands` | **MERGED.** 37 done / 2 cancelled / 0 open. Archived. |
| [#1518](https://github.com/event4u-app/agent-config/pull/1518) | `road-to-demand-gate-audience-followup` | Open. Closed as `transferred`. Archived. |
| [#1519](https://github.com/event4u-app/agent-config/pull/1519) | `road-to-condensed-link-repair` | Open. 6 done / 1 cancelled-as-null / 0 open. Archived. |
| [#1522](https://github.com/event4u-app/agent-config/pull/1522) | `road-to-evidence-based-adr-governance` | Open. 21 done / **13 open**. **Not archived.** |
| [#1523](https://github.com/event4u-app/agent-config/pull/1523) | `road-to-subagent-lifecycle-integrity` | Open. 14 done / **3 open**. **Not archived.** |

`road-to-per-turn-hook-economy` is driven by a peer session's
[#1495](https://github.com/event4u-app/agent-config/pull/1495) — see § Discarded.

## Council decisions

Five passes, all 2/2 convergent. Recorded under
`agents/runtime/council/responses/` (gitignored and machine-local, so the
verdicts travel here and in each roadmap's blocker entry, not the transcripts).

**1 — `merge-authority` (`road-to-drain-commands`).** Options: (a) take the
blocker's declared *decline* branch · (b) defer and park · (c) cancel
operationally under an authority-unavailable framing. **Verdict (c).** The
blocker declared two terminal branches, both predicated on an owner act, and
neither fired — the owner was *absent*, not declining. Recording an absence as a
decline "fabricates satisfaction of a terminal condition" and would establish
that a council can settle an owner-reserved question merely by running
autonomously. `--merge` was **removed** rather than left inert, so an archived
roadmap leaves no latent executable authority behind a documented switch.

**2 — six blockers on `road-to-per-turn-hook-economy`.** Verdicts Q1(c) decline ·
Q2(b) fix the unwrap, keep the envelope pass · Q3(a) measure it · Q4(b)
observe-only · Q5(c) deny where a refusal is real · Q6(c) cancel 5.3 with two
named stubs. **All discarded — see § Discarded.**

**3 — `road-to-demand-gate-audience-followup` disposition.** Options: (a) stub ·
(b) `later/` · (c) leave active and `draft` · (d) cancel the item. **Verdict (a)**,
conditional on verifying `stubs/` is genuinely excluded from the estate ratchet
rather than excluded by naming convention. Verified: `EXCLUDE_DIRS` at
`src/agent-src/scripts/update_roadmap_progress.ts:88`. Both seats also refused to
call the whole item a null — only the *evidence* half is one; the maintainer
judgement stays open.

**4 — two blockers on `road-to-evidence-based-adr-governance`.** The council
**rejected the blocker's own `RE-AFFIRMED (no)` label** and required a third,
`AUTHORITY UNAVAILABLE — FLOOR PRESERVED`, because `RE-AFFIRMED` conflates an
operational preservation a council may decide with a policy rejection only the
owner may make. Its decisive catch was **sequencing**: step 7.1 says "read the
Phase 6 measurements *when they land*", and 6.3 was still open, so ruling 7.1
first would have produced "a published null pointing at nothing". 6.3 publishes
its unevaluable null first; only then does 7.1 close.

**5 — AC-2 of `road-to-condensed-link-repair`.** Options: (a) amend the criterion ·
(b) link plus a validator-ignore widening · (c) project `docs/decisions/` ·
(d) close as unsatisfiable. **Verdict (d)**; **(b) rejected outright**; (c) routed
out as a distribution decision, since "a link-repair roadmap is the wrong venue
for re-architecting the projection contract". The finding kept: AC-2 forced two
different semantic classes — agent-consumable navigation and a maintainer citation
to deliberately-excluded material — into one link requirement.

## Descopes and transfers

| Stub | Carries | Reopens on |
|---|---|---|
| `road-to-owner-authority-decisions` | Three owner-reserved decisions: the commit-policy fence, ADR-005 § 1 auto-merge, and grade-derived authority incl. its kill switch (step 7.2, transferred whole) | An explicit owner ruling on any one — severable |
| `road-to-demand-gate-audience-default` | The internal-vs-public default position | Evidence, **or** a recorded maintainer judgement |

No floor was lowered anywhere in this run. `commit-policy.md:37`, ADR-005 § 1 and
`non-destructive-by-default`'s per-turn merge confirmation all stand unchanged,
and grade-derived authority remains disabled.

## Discarded work — the run's own largest error

`road-to-per-turn-hook-economy`: council pass 2 was run, six verdicts recorded,
five stubs written, and three code changes implemented — then **all of it
discarded**.

Cause: `./agent-config gates --all` reads the **trunk**, so it reported seven
open blockers that PR #1495 had already resolved on its own branch. The council
was therefore asked a **stale question** and answered it faithfully. Two of its
verdicts directly contradicted better-informed landed decisions:

- Q2 ruled "keep the whole-envelope pass" on the grounds that fixtures cannot
  prove host-shape completeness. #1495 had already narrowed the scanner under an
  **earlier** council ruling (2026-08-20, option (a)) that shipped an
  unknown-shape stderr beacon as the mitigation — strictly stronger than what my
  question described.
- Q6's stubs asserted P4 was open. P4 had been **closed on the trunk** at
  `bcbb0380b`.

Shipping either would have reversed a better decision and published a false
claim. The branch was dropped. **The generalisable finding:** a blocker inventory
computed against `main` is not the state of a roadmap that has an open PR, and a
council answer is only as good as the frame it was given.

One accident worth recording: `git checkout -B` moved a branch a peer worktree
had checked out. Caught immediately and restored via `git update-ref`; the peer's
tree was verified clean at its original commit. Nothing was lost.

## Where the run stopped, and why

Subagent delegation died mid-run on an **individual spend limit** (reset 07:50
Europe/Berlin). Two implementation slices were in flight and neither finished.

**`road-to-evidence-based-adr-governance` — 13 steps open.** Step 2.2
(`adr:effective`) was recovered from a dead subagent's partial work, verified
independently, completed across all eight budgeted surfaces, and its test was seen
RED before green. Still open: **2.4** (index/README columns), **3.4** (central
adjudication across the 187-record corpus), **4.3 / 4.4** (internal and structural
lane rows), and AC-1…AC-9, which depend on them.

**`road-to-subagent-lifecycle-integrity` — 3 steps open.** Phase 1 Step 4 closed
with a real measurement (below). Phase 2 Steps 2 and 3 and Phase 4 Step 1 remain,
all **builds** rather than measurements — Step 2's data gate is now lifted.

Neither roadmap was archived. Archiving either would have been the silent-green
this repository has refused before.

## The run's one new number

`road-to-subagent-lifecycle-integrity` Phase 1 Step 4 had withheld its fourth
column since 2026-08-20 because the data would have measured the answer format.
Enough post-split data now exists:

**Envelope return rate: 0.00 % — 0 `ok` in 1,296 stops** (2026-08-21T01:23Z →
2026-08-22T03:01Z, 10 sessions, 74 starts). `no_message` is **0**, so something
came back every single time; `no_envelope` is **1,291 (99.61 %)**, so what came
back was prose. **The return channel works and is universally unused.** That
replaces the 0.27 % model-carried capture figure the step was written to retire.

The run corrected itself once here, and it would otherwise have shipped a wrong
denominator: the first pass anchored the window on any post-split value and got
1,317 stops across 23 sessions, but `fail` **predates the split**, so those rows
are old-classifier output. Full numbers and limits:
`agents/evidence/investigations/subagent-envelope-return-baseline.md`.

## Ratchets walked, each with its earning change

- `lint_roadmap_blockers:decidability` **12 → 1** (#1522). Not to 0: the last
  violation is `road-to-drain-commands:395`, which #1517 resolved, and a baseline
  must describe the tree it ships with rather than the tree someone expects next.
- `check_estate_count` `open_blockers` **34 → 32** (#1522), `active_roadmaps`
  **5 → 4 → 3** across #1518/#1519.
- `cli_help_command_count` **101 → 102** (#1522), both budget surfaces moved in
  the same PR as the verb, per that budget's own zero-headroom contract.

Every ratchet conflict was resolved by taking main's lineage whole and
re-measuring from the tree, never by carrying numbers forward
(`ADR-239-no-union-merge-for-ratchet-baselines`).

## A gate that reports green on a stale commit

Found while clearing #1519's CI, and it is the reason CI was right and the local
run was not.

`task check-archive-index` **regenerates** `agents/roadmaps/archive/{INDEX.md,index.json}`
and *then* compares — so it writes the fix into the working tree before checking,
and reports `rc=0` on a commit whose committed index is stale. CI, checking out a
clean tree, correctly reported `archive index out of date`.

Both runs printed the same `scanned: 552`, which is what made it look like an
environment difference. It was not: the count matched, the *comparison* did not,
because one side had already mutated the thing it was comparing. `git status`
immediately after the gate is what shows it — two modified files the gate itself
wrote.

Consequence for this run: three of #1519's checks were red on one cause
(`Sync + Generate Tools Consistency` plus two `Node Tests` shards, whose failing
assertion was literally *"is up to date against the real archive — the committed
index is not stale"*). One commit fixed all three.

Worth recording beyond this run, because it makes a whole class of local
verification untrustworthy: a gate that repairs before it checks cannot fail
locally, so "green locally" says nothing about the commit. The archival flow is
also where this bites hardest — the index only goes stale when a roadmap is
archived, which is exactly what a drain run does.

## Known pre-existing red, not introduced here

`check_condensed_paths` is red on `main` with two `body-link-missing` findings and
runs in no workflow, so `task ci` stops there and roughly forty later gates never
run remotely. **#1519 fixes both and wires the gate into
`.github/workflows/consistency.yml`**, verified green on run 32546466190.
