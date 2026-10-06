**Skipped:** no code surface for this completion — the branch changes markdown only: `road-to-stacks-beyond-php` moved into `agents/roadmaps/later/` with a wake condition, the five inbound path references in the programme roadmap repointed, and this declaration. No executable behaviour is added, changed or removed, so there is nothing a completion review could bind to, scope 0ff6dbacdec42e82149b386b4f1164f62faf4abb099b8f8429e1a86ae246a806, declared 2026-10-06

# stacks-beyond-php — completion-review skip

Branch `drain/stacks-beyond-php-20261006`.

## Why there is no code surface

The lane arrived at 6 of 9 steps closed with three inline `blocked-by:` markers and
no registered blocker of its own. The work was to find where each marker's id is
actually registered and settle it against the live tree. All three name one id,
`b5-skill-growth-for-stacks`, registered once in `road-to-leading-every-row.md`.
Settling it produced a disposition change and no code: the lane is parked, and the
blocker stays where it already lives.

## How each blocked item was settled

All three resolve to the same blocker, so they settle together rather than
separately:

- **2.1 python** — marker `b5-skill-growth-for-stacks`; owner-reserved, already registered in the programme.
- **2.2 typescript** — same id, same settlement.
- **2.3 go** — same id, same settlement.

The roadmap states its own release condition and asks a visiting lane to **run** it
rather than read a `Status:` line. It was run: `grep -n PENDING` over the file
returns the D3 row, so the question is open. The blocker entry was then read at its
registration rather than summarised from the marker — asked 2026-10-01, unanswered,
and re-confirmed owner-reserved by two AI-council passes on 2026-10-06 at 3 of 4
seat-opinions, with the dissent recorded.

**No council pass was run on this branch, and that is deliberate.** The question
was put to the council twice the previous day and declined twice. Re-running it
would be a second evaluation of the same subject in search of a different verdict,
which `evaluator-independence` forbids by name. Spend on this lane: **$0**.

## Why parked rather than left active or blocker-registered here

Two options were considered and one was rejected on evidence.

**Registering b5 locally was rejected.** It would create a second record of one
owner question — the two would drift, and `b5`'s own `Resolved when:` already points
at this lane's D3 row, so the lane is the condition and not a second holder of it.
It would also have cost `open_blockers` +1 against a metric whose allowance is zero
(`check_estate_count.ts:736`), payable only by a diff-scoped `estate_growth_exempt:`
claim that the lane's own Phase 2 hand-over has already reserved, verbatim, for the
skill growth an answered b5 would authorise. Spending that key here would leave the
later change unable to add the line it is told to add.

**Parking was taken, on a precedent from the same inbox round.**
`later/road-to-federation-behind-adr-278.md` came out of `inbox-2026-10-b` with its
remaining work gated on blocker `b8` of this same programme, and is parked with an
`entry_condition` naming that blocker. This lane is in exactly that state against
`b5`. The base moved during the run and parked
`road-to-host-claims-the-tree-contradicts-carried.md` the same way, which is the same
convention arriving independently.

## The three markers are invisible to their own gate — measured, not repaired here

`lint_roadmap_blockers`'s `BLOCKED_BY_LINE_RE` is anchored at the checkbox (`^- [ ]
… <!-- blocked-by: … -->`). All three of this lane's markers sit on six-space
continuation lines, so the gate never matched them and reported the file clean
vacuously. Tree-wide count on the pre-merge tip: 34 `blocked-by:` mentions across
the active tree and `stubs/`, 15 on a checkbox line, and of the remainder only 8 are
real markers — the rest are prose about the syntax.

This is **not repaired here.** It has an owning stub,
`stubs/road-to-blocker-parse-visibility.md`, which records the same class and states
that the remaining instances are kept there "rather than fixed drive-by". Moving
these three onto their checkbox lines would also have made them gate-**visible** and
gate-**illegal** in one step, because the id resolves in a sibling file and the
checker requires same-file declaration. The finding is recorded for that stub rather
than acted on.

## What was verified, and with which command

Markdown-only does not mean unverified. Every closed step's own `verify:` clause was
re-run against `origin/main` `2bb3a1a03` before the file was parked, because a `[x]`
is a claim and this roadmap's own Risk 6 is a figure going stale under a correctly
closed box:

- 1.1 — `grep -cE` over the composition table → **30** classified rows, inside `/^(2[7-9]|[3-9][0-9])$/`.
- 1.2 — `ls src/skills` → 299, `git ls-tree` at `origin/main` → 299, equal.
- 1.3 — `npx vitest run tests/scripts -t 'pyproject never binds pest-testing'` → 5 passed.
- 1.4 — reference files present → **2**.
- 3.1 — `npx vitest run tests/scripts -t 'resolver fixture per stack'` → 8 passed.
- 3.2 — the catalog oracle → **`299-14845`**, the pinned value.

Gates run on the branch:

- `lint_roadmap_later_disposition` — parked correctly, both wake-condition ratchets hold.
- `lint_roadmap_blockers` — 141 roadmaps blocker-contract-clean.
- `lint_deferral_integrity` — 773 dead roadmaps scanned, every annotated carry resolves.
- `check_references` — no broken references, 2377 scanned.
- `check_verify_expectation_delta` — every added verify clause states what its command must produce.
- `check_estate_count` — within its ratchet: `-1 active / +1 later`, recognised as `1 parked`.
- `check_md_language` on both touched files — no German content.
- `agent-config roadmap:progress` — regenerated after the base merge, 12 roadmaps.

## What is NOT claimed

The three Phase 2 steps are **not** closed and were not flipped to any other glyph.
They stay `[ ]` in a parked file, which is the honest state: the work is specified,
costed and unauthorised. Nothing here answers `b5`, narrows it, or proposes a cap —
the two refinements the council attached to it are left with the blocker.

The programme's step 3.2 oracle is still structurally broken, and this branch did
not repair it. Its own text already records why the count cannot reach `:0`; the
only change made to it here is the path, so that it reads the file where it now is.
One new false hit was avoided rather than introduced: the wake condition deliberately
does not repeat the literal token that oracle greps for.
