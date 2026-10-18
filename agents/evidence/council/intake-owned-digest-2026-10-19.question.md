<!-- evidence-type: analysis -->

<!-- The prompt given to the council on 2026-10-19, committed verbatim so the
     verdict beside it can be checked against what was actually asked
     (evaluator-independence: a recorded verdict whose prompt is not
     recoverable is not evidence). Not edited after the run. -->
<!-- check-refs: skip -->
<!-- The prompt names agents/roadmaps/OWNED.md, the location the council moved; the skip keeps the prompt verbatim. -->

# A digest of what each roadmap owns: budget, row set, and where it lives

You are deciding the shape of one generated file in a repository that ships
rules, skills and hooks for AI coding agents. Plans are Markdown roadmaps under
`agents/roadmaps/` (active), `agents/roadmaps/later/` (parked) and
`agents/roadmaps/stubs/` (parked stubs). The file is a digest an intake session
reads before deep work, so that a finding whose subject an existing roadmap
already owns lands as a step on that owner instead of as a new file. Answer the
three questions below separately. For each, name the option you choose (or a
better one you state precisely), and give the strongest argument against your
choice. Do not summarise the evidence back.

## The step as written

> One generated, tracked digest. `agents/roadmaps/OWNED.md`, one row per active
> and parked roadmap: slug, the owned defect in at most 20 words, status, and the
> paths it cites most. Generated, drift-checked, at most 4,000 tokens, no
> external source names.

A recorded decision (D6) set the budget: "One row per file at ≤ 20 words fits
130 files in that budget." Its revisit condition: "the digest is truncated or
unread".

## Facts, measured at `origin/main` on 2026-10-19

- Tracked roadmaps: 29 active, 101 under `later/`, 128 under `stubs/`.
- A prototype generator takes the description from the first sentence of each
  file's `## Goal` section (falling back to the H1 title), and the paths from
  the most-cited backticked repository paths. Token figures below are
  characters / 4.
  - active + later, 20 words, 2 paths: 131 rows, ~6,170 tokens.
  - active + later, 12 words, 1 path: 131 rows, ~4,960 tokens.
  - active at 20 words and 3 paths, later at 10 words and no paths: ~4,590 tokens.
  - active + later + stubs, 20 words, 2 paths: 263 rows, ~10,540 tokens.
- The 4,000-token budget therefore cannot hold the step's own row definition at
  today's count; D6's arithmetic assumed fewer, shorter rows.
- 433 commits in the last 30 days touched `agents/roadmaps/`. The roadmap
  dashboard (`agents/roadmaps-progress.md`) was deliberately untracked because
  it was "the #1 merge-conflict path at 830 commits in 60 days"; its CI check
  now asserts it is NOT tracked, and compares it with a fresh render only when
  present on disk.
- `agents/roadmaps/*.md` is the glob that roughly 60 scripts read as "the
  active roadmaps" (the estate ratchet, the complexity lint, the trackability
  check, the dashboard). Each keeps its own exclusion list (`README.md`,
  `template.md`, `open-questions*`). A non-roadmap file inside that glob is read
  as a roadmap unless every one of those lists gains it.
- The intake command (`/analyze:inbox` Phase 2) would consult the digest for its
  `recurrence` column before a later grep phase. A session in this repository
  can run a generator before reading; a session that only has the tracked tree
  (another clone, a reviewer, a web reader) cannot.

## Question 1 — row set and budget

- **A.** Active + later, 20 words, 2 paths; budget raised to 7,000 tokens.
- **B.** Active + later, 12 words, 1 path; budget 5,000 tokens.
- **C.** Active rows in full (20 words, 3 paths); later rows short (10 words,
  no paths); budget 5,000 tokens.
- **D.** Keep 4,000 tokens; active only.

## Question 2 — tracked or generated on demand

- **i.** Tracked, drift-checked in CI: every PR that changes a roadmap's goal,
  status or most-cited paths must also regenerate the digest.
- **ii.** Untracked, like the dashboard: written by the same regeneration
  command, gitignored, compared against a fresh render only when present; the
  intake regenerates before it reads.
- **iii.** Tracked, but the row holds only fields that change rarely (slug,
  directory/status, goal sentence — no paths), so drift is limited to landing,
  parking, archiving and goal rewrites.

## Question 3 — location

- **a.** `agents/roadmaps/OWNED.md` as written, with the name added to every
  roadmap-glob exclusion list.
- **b.** A sibling outside the glob, `agents/roadmaps-owned.md`, next to the
  dashboard.
