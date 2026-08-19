# Completion review — inbox-harvest residuals, closed on two named locks

**Skipped:** no code surface for this completion — the diff is one roadmap file moved into `archive/` with its two dispositions recorded, plus the regenerated dashboard, archive index and index JSON that are generated views of that same move, and the gate measures zero code paths of four changed files, scope d5f20f75e530053d81c3864847fc40915218e7e1a67ddda3bbfa3b16f7e062af, declared 2026-08-19

## Why a skip rather than a review

The change records two dispositions and archives the file that carried them. It
ships no executable surface: no script, no hook, no config, no test, no
frontmatter field, and no rule or skill body. All four changed paths sit under
`agents/`, and three of the four are regenerated artefacts
(`agents/roadmaps-progress.md` by `agent-config roadmap:progress`,
`agents/roadmaps/archive/{INDEX.md,index.json}` by `build_archive_index`).

What replaces a code review here is the verification that produced the two
dispositions. Both are re-runnable, and in one case the verification **changed
the outcome** rather than confirming it.

- **R1's cited lock was checked, not quoted, and it said the opposite.** The step
  read *"section 2.7 of the completion-review contract forbids editing a round
  record in place"*. `docs/contracts/plan-review-gates.md` § 2.7 opens with the
  reverse — the rename is *"an archival step at the end of a round, never an edit
  ban on the live artefact"* — and § 2.1 **requires** re-binding the live
  `<slug>.findings.md`, so renaming instead would produce `missing-artifact`. The
  same contract already carried the refutation explicitly, in its
  review-prompt-binding baseline paragraph: two broken records are recorded
  rather than repaired *"Not because § 2.7 forbids the edit — an earlier revision
  of this paragraph said that and was wrong: § 2.7 scopes its freeze to
  superseded `round<N>-review.md` records"*. Cancelling on the step's own wording
  would have cited a lock the contract denies.
- **The lock that replaced it is narrower and was measured.** Two parts. § 2.7
  does freeze the superseded `*.round<N>-review.md` records, so a uniform
  re-format cannot reach them; and the contract deliberately declined a corpus
  migration event for this class when it made the `v1` extension fields optional
  ("a required field would have been a migration event for the whole evidence
  corpus"). Counts, 2026-08-19: `ls agents/evidence/reviews/*.findings.md | wc -l`
  → **101**; `ls agents/evidence/reviews/*.round*-review.md | wc -l` → **16**.
- **R2's revisit trigger was probed, which is what its blocker asked for.** The
  decline at `src/scripts/check_review_dispositions.ts:16-21` names the trigger
  *"a disposition that genuinely cannot be recorded in the round record itself"*.
  `./scripts-run src/scripts/check_review_dispositions` returned **17 archived
  records scanned, all terminal, zero findings** — the negation of the trigger.
  The blocker had recorded that the 2026-08-14 blanket grant released the
  permission to revisit but supplies none of the evidence the trigger asks for;
  the probe is that evidence, and it points at cancellation.
- **The housekeeping blocker took the branch that deletes nothing.** Option (c),
  its own recommendation. Both keep-reason facts re-verified rather than quoted:
  `/agents/tmp.old/` is gitignored at `.gitignore:51`, and `ls agents/tmp.old/`
  in this worktree returns `No such file or directory` — so the four spent items
  are already invisible to every diff, every clone and every consumer. Nothing
  was deleted, so no approval was inferred for an object nobody named.
- **The terminal state was counted, not asserted.** After the edits: 0 open, 0
  deferred, 2 done, 2 cancelled, 0 open blockers — so no Iron Law 3 deferral
  flow applies and the archive gate clears on its own terms.
- **Gates run on this branch:** `task preflight` green including `lint_regression`
  (no regressions) and the kernel-rule bundle check (no kernel rule touched);
  `check_references` → no broken references after the move;
  `lint_roadmap_complexity` → 36 roadmaps complexity-clean;
  `agent-config roadmap:progress` → 33 active, no unarchived completion left.

## Authority for recording the dispositions

Both blockers carry `Owner: maintainer`, so whether an agent may record a
disposition at all was put to the AI council rather than assumed. Both seats
converged: it may, because observing that a named trigger did **not** fire closes
the loop, whereas the reserved call is *whether to reopen* — and reopening is
exactly what was not done. Each blocker's own `Resolved when` clause lists
cancellation as a valid branch, and in both cases the option taken is the one the
blocker itself recommends.

## Scope this does NOT cover

- **The `check_council_layout` side finding**, carried inside the housekeeping
  blocker and deliberately not folded in there either: it prints findings and
  **exits 0**, currently carrying roughly 18 permanent findings — an advisory
  gate nobody sees, which is the allowlist-fatigue shape this repo's own rules
  warn about. It archives with this roadmap and is not repaired here.
- **`road-to-long-horizon-execution`'s one `[~]` deferred item**, which reds
  `roadmap:progress-check` locally. Verified pre-existing on `origin/main`
  (20/20 done, 1 deferred, at the PR #1434 merge), so it is inherited and not
  caused by this change. It belongs to that roadmap and needs the user's Iron
  Law 3 decision.
- **Whether R1's underlying idea is good.** The cancellation is a statement about
  a lock, not a verdict on JSON findings. R1's schema half already shipped and
  stays; R2's index stays available the moment its trigger fires.

## Standing caveat

A skip declaration is a statement about the diff's surface, not a claim that the
prose is correct. Every claim above names the command, file or line that decides
it, so a later reader can refute a row without trusting this artefact.
