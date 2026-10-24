<!-- evidence-type: analysis -->

# Owner directive — throughput over ceremony

| Field | Value |
|---|---|
| Ordered by | the repository owner, in chat |
| Date | 2026-10-24 |
| Scope | every roadmap run, until the owner changes it |
| Grants by itself | the working rules below; it lowers no test, CI gate or Hard-Floor obligation |

Progress is measured in closed steps, not merged PRs. Tests and CI are unchanged; only
justification paperwork is cut.

## Immediate

1. `road-to-authority-routing-mechanism` step 7.1 is parked with a revisable
   fail-closed default (D48). No further council round on 7.1.
2. Every open question to the owner lives in `agents/owner-questions.md` (ID, one line
   of context, options, recommendation, what it blocks). A PR whose only content is a
   question to the owner is not opened: the question goes into the list and the run
   takes the next step.
3. At most five active roadmaps. A new inbox round creates no active roadmap; it lands
   in `later/` or as an addition to an existing roadmap. A new roadmap is pulled only
   when an active one completes.

## Working rules

4. **Timebox per step.** At the third `(partial)` PR, or after two days open, the step
   is parked with a result note. More than about ten decisions in one step means it is
   cut wrong: split it.
5. **Ceremony by risk.** The council runs only for irreversible, release- or
   security-relevant decisions; otherwise one reviewer or none. Files under
   `agents/evidence/` only where someone must read them later (release, security,
   owner-reserved); a normal step's PR description is enough. Target: evidence lines
   well below `src/` lines.
6. **Parallelism.** At most three sessions at once, on separate areas, never two on the
   same roadmap. During work, vitest runs only the affected tests; the full suite runs
   before merge. Each session reports its council and vitest call counts at the end.
7. **Daily report.** Closed steps (of those, from roadmaps older than seven days), open
   steps with the trend against yesterday, evidence lines against `src/` lines, steps
   parked by the timebox, new owner questions.
