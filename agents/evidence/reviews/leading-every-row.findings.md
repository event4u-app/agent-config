# Completion review — road-to-leading-every-row, 2026-10-05

**Skipped:** no code surface for this completion — one roadmap file carrying a corrected citation and a hand-over; the validator reports 0 code path(s) of 1 changed file(s), scope 015de84baa0d7de4302c8b450846d04b692f3a07a9e8c86623f24a432fd1c739, declared 2026-10-05

## What this change is, and why R2 has nothing to bind to

One changed file, `agents/roadmaps/road-to-leading-every-row.md`. No script,
schema, config, workflow or projection is touched, so `task sync` and
`task generate-tools` have no input here. An R2 reviewer over this diff would be
reading a four-character citation correction and seventy lines of measurement
prose. That is the shape § 2.4 names.

The roadmap is an index over other roadmaps: its single open step tracks two
sibling-lane decision rows, both owner-reserved. Nothing in the diff grants an
authority, narrows a floor, installs an oracle or changes what any gate does.

## What a reviewer WOULD have caught, recorded here rather than hidden

**1 — the blocker's own citation was false, and the lane had already found it.**
b5 cited `src/scripts/check_estate_count.ts:832` for the zero skill allowance.
`sed -n '832p'` reads `const budgetJson = (): string =>`, and the enclosing
`function selfTest(): number {` opens at `:820` — a fixture builder with no
allowance in it. `grep -n 'skill_count: 0'` puts the real allowance at `:741`.
The stacks lane re-anchored this on 2026-10-05 and recorded the reason in its own
D3 row; the programme file kept the stale number, which is the direction a stale
citation usually travels — the lane corrects, the index does not hear about it.

**2 — the easy close was available on step 3.2 and was refused.** Its verify is
`grep -c 'PENDING'` over two lanes with exit `/:0$/`. Two of the four hits can
never clear: one is the stacks lane's own instruction text inside a fenced block,
the other is row D12 under an unrelated blocker. A narrower oracle counting only
the D3 and D1 rows would have been easy to install and would have looked like
progress. It was written into the hand-over and deliberately left uninstalled —
narrowing a step's own exit condition is a maintainer edit, and the narrowed form
is red today in any case, so installing it would have bought nothing but the
appearance of movement.

**3 — a green oracle was not read as an answer.** b1's limb (a) is
`grep -c 'no_envelope' <stub>` -> `/[1-9]/`, and it returns 2 — green. Both hits
sit at `:9-10` of the stub, inside the Arrivals blockquote that quotes this very
file's recommendation, so the oracle is satisfied by the text of the proposal
rather than by any decision. The stub carries no `## Decisions` section, and
`grep -rn 'subagent-return-gate' docs/decisions/` returns nothing while the same
grep for a slug that is cited there returns two files. b1 is reported unresolved.

**4 — every negative carries a control.** Each blocker command that returned
nothing was re-run against an input known to produce output on the same file or
directory: `grep -c 'ADR'` beside the zero for `signature-scoped`, the ADR-277
glob beside the absent ADR-278, the eight-heading listing beside the absent
corpus header, the four-heading listing beside the absent `## Decisions` section.

## Sensitivity of the one gate this change leans on

`lint_decision_classes` is the gate that could have failed on seventy lines of
new prose. Neutralised by inserting a `TBD` marker under `## Kill register`: the
gate went red and named `road-to-leading-every-row.md:205`. Restored by exact
string replacement rather than `git checkout`; the file hashes back to
`87fa4e1e…`, byte-identical to the pre-probe backup, and the gate is green again.

## What this change deliberately does NOT do

No step closed, and none could. All seven blockers (there is no b3) are owner
decisions; b5 and b6 are additionally circular, each resolving on a lane row
whose own text names the blocker back. The five remaining resolve against a
stub, two ADRs and a parked file, each naming the owner directly. No
`### blocker:` entry was added, so `open_blockers` stands at 60, unchanged.
