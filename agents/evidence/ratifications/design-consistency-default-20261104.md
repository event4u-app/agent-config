---
proposed_by: the repository owner, in session on 2026-10-27 (default flip in one PR) and 2026-11-04 (answer "1" — ship recording-only with shadow true)
implemented_by: claude-opus-5.5 session on fix/design-consistency-false-alarms
reviewed_by: AI council, 2 seats, provider-diverse (anthropic + openai), round 19 of 2026-11-04
providers: [anthropic, openai]
verdict: ratified
seats:
  anthropic: confirmed-non-expanding
  openai: ratified
effective_after: merge
subject: 71ffb4daf46a92b6df52b4cc415e1e12c4bf9a53af9827aaf6cb6b420fd9ae92
---

<!-- evidence-type: ratification -->

# Ratification — the dispatch bundle raise for the design-consistency check, shipped recording-only

`check_kernel_edit_ratified` gates one file on this branch,
`src/config/hook-bundle-budget.json`, the byte ceiling of `dist/hooks/dispatch.js`.
The `subject:` digest above covers it, computed with
`./scripts-run src/scripts/ratification_subject --base-ref origin/main --files <the branch's changed files>`
at commit `c3bc2daadb`. The prompt both seats answered is
`agents/evidence/council/design-consistency-default-ratification-r19-20261104.question.md`.
The record is written by hand because the seats closed on the `VERDICT:` line that
prompt asked for, not on the `STANCE:` line `ratification_record` parses.

## What was ratified

- The dispatch bundle ceiling rises from 1,578,600 B to 1,579,000 B. The branch
  measures 1,578,733 B against a base of 1,576,259 B (`origin/main` 1a552b83c5),
  +2,474 B: the switch, the consistency-only path, a call site in the full pass,
  the root and path handling and the loader. The check itself ships as a
  conditional chunk (`design_consistency_pass`, 45,272 B, own ceiling 47,000 B),
  loaded only on a UI write.
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

## Dispositions

- The "DELIVERED" header in `src/scripts/_lib/design_consistency_pass.ts` was
  corrected after the round (commit `c3bc2daadb`); it does not touch the gated
  file.
- Condition 3 for delivery is carried by roadmap step 3.10 and decision D14 of
  `road-to-a-control-that-matches-its-neighbours`: delivery is a separate flip
  of one default, measured again before it lands.
