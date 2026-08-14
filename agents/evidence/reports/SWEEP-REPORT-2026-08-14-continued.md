# Roadmap completion sweep — 2026-08-14, continuation run

**Base:** `1bff954d2` (`origin/main`, "Merge pull request #1351").
**Branch:** `roadmap-sweep/2026-08-14-continued`. Not pushed; merge is the maintainer act.
**Authorization:** the same blanket in-session grant of 2026-08-14, re-issued.
**Predecessor:** `SWEEP-REPORT-2026-08-14.md`, merged as PR #1351 earlier the same day.
Nothing in that report is rewritten here.

## Headline — the same prompt ran twice, and the second run's product is corrections

The first sweep discharged the 6 blockers that authorization could reach and
documented why the other 33 could not be. Re-issuing the prompt cannot find
another six; the grant was already spent on everything it fits.

What a second pass **is** good for is checking the first pass's claims against
the tree. Four did not survive:

> **A bench recorded as "fire it next session" has no runner and a human
> primary scorer. A roadmap step recorded as blocked has been unblocked since
> the morning. A "three offenders" count is four. A hazard recorded as
> repo-wide is scoped to one path prefix.**

Three of those four were assertions made *by the previous sweep or by the
roadmaps it edited*, and each would have cost the next session something real —
a budget, a closure, an incomplete retrofit, or a correct action refused out of
fear. That is this run's product.

## Counts

| Measure | Before | After | Δ |
|---|---:|---:|---:|
| Open roadmaps | 26 | 26 | 0 |
| Steps done | 234 / 411 | 234 / 411 | **0** |
| Open blockers | 33 | 33 | 0 |
| Blockers needing the user | 9 | 9 | 0 |

**Zero steps closed, and that is the finding rather than a shortfall.** The one
step this run proved closable — `road-to-inbox-harvest-2026-08` P2.2 — is
blocked from closing by an Iron Law, not by its work (below). Every other open
step across 26 roadmaps is gated on data, a host install, a human, or a kernel
guard, exactly as the predecessor found.

**The blocker count is flat but its composition moved**: one discharged by
authorization, one surfaced that had never been written down. A flat number
concealing a real exchange is worth stating, because the dashboard cannot.

## Blockers resolved (1)

| Blocker | Roadmap | Decision |
|---|---|---|
| `consolidation-breaking-change-permission` | cost-parity-1 | **ALL tranches authorized**, not just the pilot |

The grant names this one explicitly. Two things the resolution deliberately does
not do. It does not spend the migration note: the grant released the *asking*,
not the *documenting*, so the note moves into step 2.3 as the tranche deliverable
it always was. And it flips no step — `agent-config gates` renders it as
"unblocks: 49 steps" because it counts the roadmap rather than the critical path,
while Phase 2 remains gated on `utilization-sweep-window` (time-gated to
~2026-08-26) and `skill-activation-window` (an unverified instrument). A tranche
landed today would publish an activation comparison against a baseline that does
not exist — the silent-capability-loss trade that roadmap's Risk 1 refuses.

## Blocker surfaced (1) — the correction that matters most

`manual-rubric-rater`, on `road-to-scale-history-bench-run`, owner **user**.

The predecessor recorded that bench as *"genuinely fireable; held for session
capacity, not permission"* and pre-authorized it to fire in the next session with
time. This run had time. Checked against the tree, it is not fireable at all:

1. **There is no runner.** `internal/bench/scale-history/` holds `task.md`,
   `seed-schema.sql`, `rubric.md`, `sample-artifact/` and `score.ts` — and
   `score.ts` is a *scorer*, taking `--artifact <dir>` and spawning
   `lint_persistence` over it (`score.ts:25-26`, `:75-99`). A grep for a
   scale-history runner across `internal/bench/`, `src/scripts/` and `tests/`
   returns the scorer, its test, and the pre-registration. Nothing produces the
   96 artifacts (3 arms × 16 × ≥2 families) the prereg requires.
2. **The primary scorer is a human, by pre-registration.** The prereg makes the
   manual rubric PRIMARY and `lint_persistence` SECONDARY
   (`scale-history-PREREG.md:63-69`), and the rubric's first line binds the
   ordering: *"The rater never sees `lint_persistence` output before scoring
   (anti-anchor)"* (`rubric.md:4-5`). An agent scoring artifacts an agent
   produced is the substitution that invalidates the result — the same refusal
   `road-to-council-blind-review` records for its own blind ratings.

So the honest state is **authorized, and blocked on two builds the roadmap does
not contain**. The spend grant is untouched and is not re-asked. Had this run
taken "fire it" literally, it would have spent a real budget on a run with no
producer and no admissible scorer.

## Maintainer-delegated decisions, with the reasoning that decided them

**1 · ADR-223 `proposed` → `accepted`.** The grant names
`required-check-set-change`; the ADR says in its own Status section that
acceptance is the maintainer's call. Worth stating what acceptance does *not*
buy: ADR-223's decision is **not to demote**, so accepting it settles the
question by closing it and licenses no ruleset write. The macOS leg and the
`npm audit` gate were never in the required set (ADR-223 § Context fact 1) —
removing them from a PR would be a *trigger* change, not a required-check change.

**2 · The distillation retrofit is four skills, not three.**
`lint_skill_router_head` reports 4 over the 400-line cap and `GRANDFATHERED` in
`lint_skill_router_head.ts:60-65` names them with measured counts — `ai-council`
(1055), `skill-writing` (767), `roadmap-management` (552), `quality-tools` (445).
The allowlist is **shrink-only**, so retrofitting three and closing the step
leaves the fourth entry unremovable and the step falsely done. Corrected in both
the step and its Rollback line, with the lint bound as the step's `verify:`.

**3 · The ledger `session_id` correction is done; the step is not.**
`road-to-subagent-lifecycle-integrity` Phase 1 Step 4 correction (b) said the
appended line does not carry `session_id`. It does, as of the predecessor —
`subagent_ledger_hook.ts:593` and `:608`, header at `:76`. Marked FIXED so it is
not re-implemented. The step stays open on a reason now written down: the
pre-fix window is still cross-session, so the ≥20-dispatch baseline counts from
the fix commit **forward**, not from the existing 25 stop records. The citation
is given as a field name plus a pair of offsets deliberately — this file's Phase
4 sibling has had three successive line citations rot, so the durable anchor is
the field.

## Where a hard invariant beat the grant

Per the run's own conflict rule, these were skipped and recorded rather than
softened.

**The npm publish and public GitHub Release** (`road-to-ci-native-release-first-run`
Phase 2). `non-destructive-by-default` lists *deploy / release* and *irreversible
external action — publish* as Hard Floor triggers, and requires a **this-turn
approval naming the exact object**. "All maintainer blockers are approved" names
a category. A blanket grant is precisely the shape the Hard Floor is written to
not accept, and this is the single most irreversible act anywhere in the estate:
an npm `latest` dist-tag move, a public Release, a git tag.

**The ruleset write and the merge-queue enablement** (`-ci-economy`,
`maintainer-bus-factor` Phase 2). Same Hard Floor, infrastructure leg: both
change how every future merge to `main` lands, including the maintainer's own.
The grant itself asked for the steps it cannot delegate to be handed back, so
both blockers now carry the full procedure — `gh api` read-modify-write with a
before-artefact and a rollback line, plus the browser click-path — and three
traps that each fail silently:

- a path filter on a required check's PR trigger never reports on a PR touching
  none of those paths, and never-reported reads as never-satisfied: permanent
  block, no red X;
- nothing in CI observes whether the armed set still matches
  `branch-protection-policy.md`, so it must be armed against that file;
- the merge queue must be enabled **after** `merge_group` triggers land. Zero
  workflows declare one today; enabling first stalls every PR.

**The `install --layer` suppression** (`road-to-carrier-layer-convergence`
Phase 3). It changes the user's global install live for every session on this
machine. `security-sensitive-stop` § self-modification routes a self-config edit
through the edit-permission gates rather than letting a session apply it to
itself. Recorded, not run.

**The three kernel amendments**, unchanged from the predecessor.
`block_kernel_rule_writes` is a `fail_closed: true`, `severity: blocking`
PreToolUse guard bound on every host (`hook_manifest.yaml:114-118`), keyed on
`is_kernel_rule(basename) && path contains 'rules/'`, with no agent-accessible
override. It is a mechanism, not a preference, and no in-session grant reaches
an exit-1 at tool-call time.

## The one step that is done and cannot be closed

`road-to-inbox-harvest-2026-08` P2.2 — the executable-DoD + bounded self-fix
loop. Its blocker `self-fix-halt-telemetry` **resolved 2026-08-14** via path (b);
the step's own text still said *"BUILD HALF SHIPPED, MEASUREMENT HALF BLOCKED"*,
a premise that died the same morning. On the work, P2.2 is done, and it is the
only step in the estate this run found in that state.

It stays `[ ]` because the roadmap carries four `[~]` deferrals, so flipping it
takes `count_open` to 0 with `count_deferred` at 4 — the exact trigger for
`roadmap-progress-sync` Iron Law 3, which reserves the disposition of a deferral
to the user. The closing commit is roadmap-touching by construction, so **it
blocks itself** until the four are disposed in the same change.

None of the four is honestly cancellable — P1.1 is a wanted rendering half over
a shipped schema, P1.4 reopens a decision the grant has now approved reopening,
P3.3 is "worth doing, not urgent", P5.6 is a deliberate ratchet-before-split
stance. Marking any of them `[-]` to clear the gate would be the buried-work
failure Iron Law 3 exists to stop. They are surfaced to the maintainer this run,
and the closing recipe is written at the step.

## Honest nulls — attempted, and did not produce what was hoped

- **Zero steps closed.** Stated as the headline rather than buried: across 26
  roadmaps and four parallel surveys, no open step was both executable under the
  grant and free of a data, host, human, or kernel gate — except P2.2, which an
  Iron Law holds shut.
- **A hazard was overstated, in the direction that suppresses correct work.**
  `-ledger-truth` records that with `count_open` at 0 and a `[~]` present the
  gate *"refuses **every** commit in the repository"*. The installed pre-commit
  guards the check behind
  `git diff --cached --name-only | grep -qE '^agents/roadmaps(-progress\.md|/)'`,
  commented *"only fires when staged changes touch a roadmap file or the
  dashboard itself, so unrelated commits stay fast."* A commit touching no
  roadmap is unaffected. This nearly cost the run a correct closure: the
  overstated version reads as "closing P2.2 deadlocks the branch", which would
  have made the right analysis look reckless. Corrected in place, with the
  narrower real hazard restated.
- **The cost-parity Phase 6 scope-exclusion phase was NOT closed, deliberately.**
  Its eight `- [ ]` items are non-goals, and the house convention (verified
  against `road-to-cost-parity-0-program` Phase 4 and `road-to-always-on-
  orchestration` Phase 7, both archived) is to mark them `[x]` with a
  verification comment — *"verified against the delivered diff, not asserted"*.
  With Phases 1–5 at 0 %, there is no delivered diff to verify against, and 6.7
  (no lint beyond the enumerated set) and 6.8 (a byte ceiling measured by 3.5c)
  are unknowable before delivery. Closing them would have moved the roadmap 8
  steps for free and asserted properties of a diff that does not exist.
- **A subagent survey asserted the blanket grant covered the npm publish, the
  branch-protection change, and the global install suppression.** It did not,
  and the harness flagged it. Recorded because the failure mode is instructive:
  a category-level authorization propagated through a delegation reads as
  object-level consent at the far end, and the Hard Floor is the thing that has
  to survive that. It did.

## Spend

| | Rendered estimate | Actually incurred |
|---|---|---|
| scale-history 3-arm bench | per prereg cost sheet | **$0** — not fireable (no runner, human primary scorer) |
| solution-minimalism Phase 3 | $150–250 floor | **$0** — not fired; blocked on deltas #10/#11 |
| surface-consolidation benchmarks | maintainer estimate pending | **$0** — not fired |
| AI council | n/a | **$0** — not invoked |

**Total incurred: $0.00.** No external model call was made this run. The four
parallel surveys ran as in-session subagents on the session model.

The predecessor's finding that a subscription-transport council seat still bills
(estimate `$0.0000`, actual `$0.029745`) stands and was the reason no council
pass was opened here: this run's open questions are dispositions reserved to the
user by an Iron Law, and a council cannot answer those.

## Verification

`task preflight` was green (exit 0) on the base commit **before** any edit, so
anything red afterwards is attributable to this branch. Per-change verification
is in each commit message: `lint_roadmap_blockers` clean over 32 roadmaps (it
caught a dropped `What to do` field mid-run, restored in the same commit),
`check-adr-frontmatter` 171 ADRs / 0 errors, `lint_skill_router_head` as the
bound verify for the corrected retrofit count, and the dashboard regenerated
after every roadmap touch with `roadmap:progress-check` reporting up to date.

Remote CI on the PR remains the authoritative gate.

**The predecessor's standing advisory is inherited and still owed.**
`check_completion_review` reports `missing-artifact` against that branch's code
changes, and no skip was filed because the skip grammar requires asserting *"no
code surface for this completion"*, which was false there. This run adds **no
code** — every change is roadmap prose, one ADR status field, and the
regenerated dashboard — so it contributes no new code surface to that debt. It
does not discharge it either.
