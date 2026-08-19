# Completion review — inbox-harvest residuals, closed on two named locks

**Skipped:** no code surface for this completion — the diff is one roadmap file moved into `archive/` with its two dispositions recorded, its three regenerated views, this artefact, and a two-number ratchet walk-down in `src/config/estate-count-budget.json`, and the gate measures zero code paths of six changed files, scope 00a4f1fdaa3bd61ea65630d5c34908b82f2e5791dd92f3b0d11d45a2d9ff8e67, declared 2026-08-19

## Why a skip rather than a review

The change records two dispositions and archives the file that carried them. It
ships no executable surface: no script, no hook, no test, no frontmatter field,
and no rule or skill body. Five of six changed paths sit under `agents/`, three
of those are regenerated artefacts (`agents/roadmaps-progress.md` by
`agent-config roadmap:progress`, `agents/roadmaps/archive/{INDEX.md,index.json}`
by `build_archive_index`), and one is this artefact.

**The sixth path is under `src/`, and the skip is claimed on the gate's own
classification rather than on my reading of it.**
`src/config/estate-count-budget.json` changes two integers and appends one
`baseline_history` entry. § 2.4's classifier (`isCodePath`) returns code for
anything under `src/scripts/` and otherwise decides by extension; `json` is not
in `CODE_EXTENSIONS`, deliberately — the list's own comment excludes dependency
state and data files while including IaC and templates that carry executable
behaviour. So the gate measures zero code paths here and does not emit its
`skip declaration present but the diff touches N code path(s)` finding, which it
would otherwise raise before any of this prose mattered. Stated because "a config
under `src/` is not code" is exactly the sentence a reader should distrust on an
author's word.

**What that config change is, so it is not taken on trust either.** It is a
**tightening**: `active_roadmaps` 34 → 33 and `open_blockers` 73 → 71, both
ceilings moving DOWN, because `check_estate_count` failed the first CI run with
*"un-walked tightening"* and names the walk-down as belonging in the change that
earned the lower measurement. `later_roadmaps` stays at 50, which is that gate's
own check distinguishing a closure from a park. Green afterwards at 33/50/71
(+0/+0/+0), with `tests/scripts/check_estate_count.test.ts` at 29 passed. The
`block-config-weakening` guard flagged the edit for a direction statement, which
is what this paragraph and the commit message both supply.

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
- **One gate was not run locally, and CI is how that surfaced.**
  `check_estate_count` is registered in the Consistency workflow and **not** in
  `task preflight`, so a green preflight said nothing about it and the first
  signal was the PR turning red. Recorded rather than smoothed over: the local
  suite's blindness here is a property of the gate registration, not of this
  change, and the same shape will red the next roadmap-disposing PR that trusts
  preflight alone.
- **Gates run on this branch:** `task preflight` green including `lint_regression`
  (no regressions) and the kernel-rule bundle check (no kernel rule touched);
  `check_references` → no broken references after the move;
  `lint_roadmap_complexity` → 36 roadmaps complexity-clean;
  `agent-config roadmap:progress` → 33 active, no unarchived completion left;
  `check_estate_count` → estate within its ratchet at 33/50/71 after the
  walk-down; `task consistency` → no derived drift.

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
