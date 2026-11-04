---
proposed_by: the repository owner, in session on 2026-10-27 (default flip in one PR) and 2026-11-04 (answer "1" — ship recording-only with shadow true)
implemented_by: claude-opus-5.5 session on fix/design-consistency-false-alarms
reviewed_by: AI council, 2 seats, provider-diverse (anthropic + openai), rounds 19 and 20 of 2026-11-04
providers: [anthropic, openai]
verdict: confirmed-non-expanding
seats:
  anthropic: confirmed-non-expanding
  openai: confirmed-non-expanding
effective_after: merge
subject: 7e9b2c29abbf14e3605066d8f1a3b99f77060913d549ec3e80948a926bac6db8
---

<!-- evidence-type: ratification -->

# Ratification — the dispatch bundle raise for the design-consistency check, shipped recording-only

`check_kernel_edit_ratified` gates one file on this branch,
`src/config/hook-bundle-budget.json`, the byte ceiling of `dist/hooks/dispatch.js`.
The `subject:` digest above covers it, computed with
`./scripts-run src/scripts/ratification_subject --base-ref origin/main --files <the branch's changed files>`
at commit `c3ce008683`, after `origin/main` (`b53718de25`) was merged. The prompt both seats answered is
`agents/evidence/council/design-consistency-default-ratification-r20-20261104.question.md`;
round 19 (`…-r19-20261104.question.md`) ratified the same change on the earlier base
`1a552b83c5` and is superseded only because the gated figures moved with the base.
The record is written by hand because the seats closed on the `VERDICT:` line that
prompt asked for, not on the `STANCE:` line `ratification_record` parses.

## What was ratified

- The dispatch bundle ceiling rises from 1,582,000 B to 1,585,000 B. The branch
  measures 1,584,460 B against a base of 1,581,986 B (`origin/main` b53718de25),
  +2,474 B, the same delta as on the earlier base: the switch, the
  consistency-only path, a call site in the full pass, the root and path
  handling and the loader. The check itself ships as a conditional chunk
  (`design_consistency_pass`, 51,457 B at the reviewed commit, own ceiling
  53,000 B), loaded only on a UI write; origin/main's sibling-gap rule joined
  the same linter module.
- `hooks.design_consistency.enabled` defaults to `true` and
  `hooks.design_consistency.shadow` to `true`: the check runs and records every
  UI write and delivers nothing. Delivery waits on roadmap step 3.10, a
  parser-grade definition reader, after round 18 found two definitions the
  pattern reader misreads (an `export` inside a namespace, a declaration inside
  a regex literal).

## Seats

- **anthropic — `confirmed-non-expanding`.** Agrees the raise is necessary and
  the failure contract holds. Disagrees that condition 3 is met for what ships:
  recording pays the latency now and avoids no review round itself; the bet is
  judged reasonable because shadow mode cannot block and the reverse trigger
  reviews it. Named the module header that still said "DELIVERED".
- **openai — `ratified`.** Approves the raise and the shadow default; the known
  reader defects affect recorded evidence, not default advisories. Notes that
  the packet does not establish all four conditions for default delivery, that
  the 30-minute benefit is an estimate rather than a bound, and that a failure
  before `appendFileSync` leaves no shadow row (stated in the evidence file
  under the recorder's coverage limit).

## Round 20

- **anthropic — `confirmed-non-expanding`.** Approves the raise for the
  recording default; condition 3 and latency compliance (p95 at the budget's
  edge) are prospective; asks for the activation claim to say so and for
  rebuild variability to be measured before merge.
- **openai — `confirmed-non-expanding`.** Approves for bounded shadow
  collection; asks to correct "all four hold", to bound the subprocess calls
  the failure contract did not cover, to use one denominator for the false
  rate, and to verify the gates on the reviewed commit.

## Dispositions

- The "DELIVERED" header in `src/scripts/_lib/design_consistency_pass.ts` was
  corrected after the round (commit `c3bc2daadb`); it does not touch the gated
  file.
- Round 20, after the review (none touches the gated file):
  - "All four hold" now reads conditions 1, 2 and 4 hold, condition 3 is an
    estimate for delivery, in the evidence file, the module header and CLAIMS.
  - The two version-control calls on the UI-write path (`status`, `rev-parse`)
    carry a 3 s timeout; a test with a stalled stand-in binary was red at 30 s
    first. The chunk is 51,679 B with it, under its 53,000 B ceiling.
  - The reverse trigger's rate uses the readings' denominator, legitimate
    writes.
  - Rebuild variability, measured 2026-11-04: three consecutive builds read
    1,584,460 B and 51,679 B each, 0 B of variation on the locked toolchain.
  - `check_hook_bundle_composition` and the loader tests pass on the branch.
- Condition 3 for delivery is carried by roadmap step 3.10 and decision D14 of
  `road-to-a-control-that-matches-its-neighbours`: delivery is a separate flip
  of one default, measured again before it lands.
