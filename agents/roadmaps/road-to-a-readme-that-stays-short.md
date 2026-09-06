---
complexity: lightweight
status: ready
execution:
  mode: phase-checkpoints
relates:
  - slug: road-to-figures-that-name-their-denominator
    relation: disjoint
    note: >
      Both touch published surfaces and neither touches the other's. That one
      repairs three statements the tree contradicts. This one repairs a size
      regression on one file and the missing ratchet that let it come back.
estate_growth_exempt: "A completed, archived roadmap reached exactly this goal on 2026-05-18 — `agents/roadmaps/archive/readme-and-docs-improvement.md` records all eleven of its success criteria as met — and the file has since returned to 638 lines, 5,550 words and a first executable command on line 160. The only guard is `lint_readme_size.ts`, a fixed 750-LINE ceiling with 112 lines of headroom, which measures neither words nor the position of the first command and therefore could not have fired at any point during the regression. Under `recurring-criticism` a repeat is evidence about the system rather than about the item: the earlier disposition shipped and did not hold, and no active roadmap, later roadmap or stub owns the ratchet that would have held it."
estate_offset_exempt: "Cannot be offset. The natural offset is the archived roadmap that already did this work once; archiving something to pay for repeating it would be the third cycle of the same trade."
---
# Road to a README that stays short

> **Source:** `agents/tmp.old/inbox-2026-09-r/` — one of eleven prepared harvest
> loops delivered on 2026-09-06. Two of the eleven independently reported the
> README as too long; both quoted 5,181 words, which is `never-true` — the
> measured figure is 5,550. The recurrence framing and the missing-ratchet
> diagnosis are this run's own.

> **Arrivals:** 3 (at least) — latest `inbox-2026-09-r` (2026-09-06), which
> raised it twice independently; earlier:
> `agents/roadmaps/archive/readme-and-docs-improvement.md`, which fixed it and
> archived as complete on 2026-05-18.

## Goal

The README reaches its first executable command quickly, and a change that
undoes that is caught before it merges rather than three months later by an
external reader. Measured at `6af83a64b`: `wc -l README.md` = **638**,
`wc -w` = **5,550**, and `grep -n '^```' README.md | head -1` = **160** — a
reader runs nothing for the first quarter of the file. The one guard,
`src/scripts/lint_readme_size.ts:24`, caps **lines** at 750 and is green with
112 to spare; it has no word budget and no notion of where the first command
sits, so every step of the regression passed it. Out of scope by decision: the
docs site's information architecture, which is held by an owner decision of
2026-07-22 recorded in `agents/roadmaps/archive/road-to-starlight-project-docs.md`
and is not this roadmap's to reopen; and any change to what the README claims,
as opposed to how long it takes to say it.

## Phase 1 — Measure the two things that regressed

- [ ] **1.1 Add a word budget and a first-command budget to the existing linter.** Not a
      new gate — `lint_readme_size.ts` already owns README size and already runs from
      `Taskfile.yml`. It gains two measurements: total words, and the line number of the
      first fenced block.
      verify: the linter prints all three figures, and a README with the first fence
      pushed 40 lines further down reddens it while a same-length reordering does not.
- [ ] **1.2 Set both budgets from the archived roadmap's own end state, not from today.**
      Today's file is the regression; taking it as the baseline would ratchet the defect
      in. Derive the numbers from the README as it stood when
      `readme-and-docs-improvement.md` archived, and state that derivation in the
      linter.
      verify: the derivation is a command in the linter's own comment, re-runnable
      against the archive commit, and today's README fails at least one of the two new
      budgets.

## Phase 2 — Bring the file back under them

- [ ] **2.1 Move the first executable command above the budget line.** The content
      between the top and line 160 is orientation prose; the archived roadmap's own
      criterion was that a reader reaches a command early. Nothing is deleted that a
      reader needs — it moves to `docs/` or to the site, which already carries a
      getting-started path.
      verify: `grep -n '^```' README.md | head -1` is at or below the Phase 1 budget, and
      every claim relocated out of the README still exists somewhere `check_claims`
      scans.
- [ ] **2.2 Bring the word count under its budget without dropping a backed claim.**
      `README.md` is a publish surface of `check_claims.ts`, so a trim that removes a
      claim is a claims change, not a length change.
      verify: `./scripts-run src/scripts/check_claims` passes and the set of claims it
      finds on `README.md` before and after the trim is unchanged, or the difference is
      listed with each claim's new home.

## Phase 3 — The ratchet holds where the last fix did not

- [ ] **3.1 Register the linter's new budgets in `src/config/gate-coverage.yml` with a
      CI-identical `argv`.** The previous round's failure mode was that nothing watched
      the file; a budget that is not registered can be removed as quietly as it was
      added.
      verify: `./scripts-run src/scripts/check_gate_coverage` passes with the row, and a
      deliberate mismatch between the row's `argv` and the CI invocation fails it.
- [ ] **3.2 Record the recurrence where the next round will meet it.** The arrival count
      above belongs on this roadmap while it is active and must survive its archival —
      either in the linter's comment or in the budget's own record.
      verify: after this roadmap archives, a reader of `lint_readme_size.ts` or its
      budget record learns that the file has regressed once before and what caught it.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-09-06 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The budgets are set from today's file | implementation | Deriving the word and first-command budgets from the current README makes the gate green on day one and locks the regression in as the new floor — the most likely way for this roadmap to ship and achieve nothing. | 1.2 requires the derivation to come from the archive commit and to be re-runnable as a command, and requires today's README to FAIL at least one new budget; a Phase 1 that ends green is a failed Phase 1. | Phase 1 — Measure the two things that regressed |
| 2 | Trimming the README drops a backed claim | product | `README.md` is a publish surface of the claims gate, so a length-driven trim can silently remove a claim that `docs/CLAIMS.md` still asserts is published there. | 2.2 requires the claim set found on the file to be unchanged, or every moved claim to be listed with its new home; the claims gate runs as the step's own verify rather than afterwards. | Phase 2 — Bring the file back under them |
| 3 | The work spills into the docs site | product | The obvious destination for relocated prose is the site, whose information architecture is held by an owner decision from 2026-07-22 that this roadmap must not reopen. | The goal names that decision as out of scope; 2.1 targets `docs/` or the existing getting-started path, both of which predate the lock and need no architectural change. | Phase 2 — Bring the file back under them |
| 4 | The ratchet is added and later removed as quietly as the regression arrived | implementation | A budget living only in a script can be relaxed in one line by whoever finds it inconvenient, which is how the previous fix stopped holding. | 3.1 registers it in `gate-coverage.yml` with a CI-identical `argv` so its removal is a gate failure rather than an edit, and 3.2 puts the reason next to the number so a later reader knows what it is for. | Phase 3 — The ratchet holds where the last fix did not |

## Acceptance Criteria

- [ ] AC-1 — `lint_readme_size` measures lines, words and the first fenced-block line, and prints all three.
- [ ] AC-2 — Both new budgets are derived by a re-runnable command from the README as it stood at the archived roadmap's completion, and that derivation is recorded in the linter.
- [ ] AC-3 — The first executable command sits at or below its budget, and the word count sits at or below its budget.
- [ ] AC-4 — `check_claims` passes and the claim set published on `README.md` is unchanged, or each moved claim is listed with its new home.
- [ ] AC-5 — `src/config/gate-coverage.yml` carries the linter's row with a CI-identical `argv`, and a deliberate mismatch fails `check_gate_coverage`.
- [ ] AC-6 — A reader of the linter or its budget record learns that this file regressed once before, after this roadmap archives.
