<!-- evidence-type: analysis -->

# Drain run summary — 2026-08-31 / 2026-09-01

Machine-readable close-out for the autonomous roadmap-drain run. Written last,
as the final commit of the final PR of the run.

## Scope correction taken at the start

The run was seeded with a 36-roadmap queue verified at commit `c536dbd`. That
table was stale by 33 entries: the live inventory at `origin/main` @ `db6051f83`
held **three** active roadmaps, not 36. The queue was recomputed from the tree
rather than trusted, per the run's own § 1.2.

## Pull requests

| PR | Roadmap | Outcome | State |
|---|---|---|---|
| #1781 | `road-to-governed-harness-evolution` | advance | open, 6/6 checks green, not merged |
| #1782 | `road-to-inbox-harvest-2026-08-e-council-topology-evidence` | advance | open, not merged |
| — | `road-to-harness-promotion-bridge` | untouched, terminal-blocked | no PR, by design |

Neither roadmap reached 100%, neither was archived, and no checkbox was moved in
either. That is the accurate outcome, not a shortfall against a reachable one:
every remaining item in both files fails its own `verify:` clause, and each
clause is a conjunction whose unmet conjunct needs a capability that does not
exist in the tree.

## Council decisions

**None. Zero council rounds were run, and the reason is a refusal, not an
omission.**

Two independent causes, in the order they were hit:

1. **Quota.** Both configured seats share one user-global, date-keyed CLI-call
   counter. It was exhausted for the 2026-08-31 UTC day at `anthropic 50/50`,
   `openai 51/50`. The metered rung was not used and the counter was not reset —
   it is shared with parallel runs, so the 50 could not be attributed between
   real and polluted calls, and removing a shared guard on a guess is wrong.
2. **Classifier refusal.** After the 00:00 UTC reset restored both seats to
   `available`, the council invocation itself was refused by the host's safety
   classifier. Two earlier attempts to authorise the billable rung for subagents
   were refused by the same classifier.

**No refusal was rephrased, retried, or routed around.** This tree already
records why: the `merge-authority` blocker on `road-to-harness-promotion-bridge`
documents a prior drain run refused at two independent layers and names
persistence past a safety refusal as *"the reservation defeated by
persistence."* The same standard was applied here.

Consequence: every question this run was supposed to route to the council is
**deferred, not answered**. One is committed as a tracked artefact
(`agents/evidence/analysis/governed-harness-terminal-disposition-question-2026-08-31.md`)
so the framing is auditable and the next run does not re-derive it.

## Descopes

**None.** No step was descoped, re-scoped, weakened, cancelled, or closed on a
met half. Descoping was the run's own § 5 fallback and it was not exercised,
because in the one case it applied it is explicitly forbidden — see below.

## Terminal-blocked, with the lock verified live

`road-to-harness-promotion-bridge` was left untouched. Its two open items —
step 0.8 and AC-9 — gate on `blocker: merge-authority`, i.e. ADR-239
§ Decision 3. Four independent locks, all verified at the current commit rather
than taken from the roadmap's prose:

- `docs/decisions/ADR-239-drain-command-surface-and-merge-authority.md:10-19` —
  the record's own `review_trigger` names the blocker as the reopen condition.
- `:79-90` — § Decision 3 is written as an open question; three independent
  reviews reached that verdict, none of them the plan's author.
- `road-to-harness-promotion-bridge.md:60-64` — the Resume condition, the exact
  text both council seats converged on: on owner refusal, *do not resume
  execution and do not weaken, cancel, retire, or mark complete any transferred
  step or acceptance criterion*. This forecloses the § 5 descope path directly.
- `:17-40` — a 2/2 convergent council on 2026-08-31 rejected `agents/roadmaps/later/`
  **by name**, because parking there leaves the active estate.
- `:600-612` — a prior drain run with an identical mandate attempted exactly the
  option this run would have attempted, was refused, and recorded *"no council
  round should be spent on it"* until a human answers.

Same mechanism, no new evidence: the lock stands and was not relitigated.

## Defect findings, out of scope and not chased

**The CLI quota counter mis-books.** A council run reporting
`members=2 (billable=0)` — both seats skipped, zero provider calls — still moved
the counter by 2, and `openai` reached **51 against a cap of 50**.
`src/scripts/ai_council/cli_call_budget.ts:34-37` names this exact pattern as
*"a FINDING… a third booking path exists."* It belongs to no roadmap in this
run's queue.

**A pre-existing CI-only red was found and given a carrier.**
`tests/scripts/routing_signal_measurement.test.ts` 5.1 — *"the published verdict
reproduces from the tree"* — fails on `main` at run `33424783559` (job
`99595610608`, 2026-08-31T18:26Z) with
`expected { partition: 'train', ... } to deeply equal { partition: 'train', ... }`
on the `corpus` field. Verified pre-existing rather than assumed: the identical
assertion fails on `main` before either drain branch existed, and the same test
is green locally at 17/17 on both branches. So the corpus a CI runner measures
differs from the corpus a local checkout measures, and the published verdict
matches only the latter. It is recorded as Risk 13 on
`road-to-governed-harness-evolution` — the file that already cites both the
verdict artefact and the test — rather than as a new roadmap, because both estate
ratchets are at zero headroom. Not fixed: which catalogue entries differ is not
established, and diagnosing it needs a CI-side dump of the two corpora.

**Two worktrees were lost to `/private/tmp` being cleared mid-run.** Every
commit survived in the main checkout's object database and was recovered into a
worktree outside `/tmp`. What did not survive was uncommitted: two untracked
review artefacts on the topology branch. Worktrees for long-running work do not
belong under `/private/tmp` on this platform.

## Honest close

The run did not empty the roadmap directory and did not reach its § 5 terminal
condition either. It stopped short of both for one reason that is worth stating
without softening: **the mechanism the mandate designated as the substitute for
every user decision — the AI council — was not reachable from this session.**
A drain run whose decision procedure is unavailable cannot close roadmaps whose
remaining work is decisions. What it can do, and did, is land the executable
work, verify the non-executable work as non-executable with provenance, and
leave the questions framed and committed rather than answered badly.

---

# Drain run 12 — 2026-09-01

A second autonomous drain run, on the state drain run 11 left behind. Written
last, as the final commit of the final PR of the run.

## What was different from run 11, in one line

**The council was reachable.** Run 11's honest close names an unreachable AI
council as the single reason it could not resolve roadmaps whose remaining work
was decisions. The cause was a per-worktree gitignored probe file
(`agents/runtime/state/council-probes.json`); seeding it into each worktree
before the first call made all three passes work. Four council runs, `2/2
present` on every one, `$0.0000` — all seats subscription-authed.

## Starting state, recomputed rather than trusted

Three active roadmaps at `origin/main` @ `db6051f83`, three open blockers. The
run's seeded 36-roadmap queue was stale by 33 entries for the second run in a
row.

## Pull requests

| PR | Roadmap | Outcome |
|---|---|---|
| #1784 | `road-to-harness-promotion-bridge` | **merged.** Roadmap deliberately NOT closed — both open items are owner-reserved |
| #1785 | `road-to-governed-harness-evolution` | open. Closed and archived at 46 `[x]` / 14 `[-]`; one `[x]` withdrawn mid-run (below) |
| #1787 | `road-to-inbox-harvest-2026-08-e-council-topology-evidence` | open. Closed and archived at 35 `[x]` / 38 `[~]` / 4 `[-]` |

`#1782` (run 11's carry-over) merged during this run. `#1783` and `#1786` are
sibling fixes from a parallel session, merged and folded in here.

## Council decisions — four passes, all `2/2 present`, all `$0.0000`

Members throughout: `anthropic/claude-sonnet-4-5` + `openai/codex-default`,
2 rounds, blind chairman, subscription transport.

| # | Question | Verdict |
|---|---|---|
| 1 | `phase-2-benchmark-cost` — run / re-scope / descope the 20-UTC-day, 1,584-call benchmark | **A3 descope**, convergent. At `N=2` it clears neither pre-registered floor, so the spend buys a number nobody may act on |
| 1 | `leakage-bench-needs-assembler-and-design-forks` — build the runner and run both arms, or descope | **B1 with a precondition**; the precondition (two guaranteed UTC-day windows in one coherent session) fails, so the **B3** fallback the openai seat named was applied |
| 2 | disposition of the remaining 13 steps, and the roadmap itself | 7 guarded baselines, 3 unbuilt mechanisms, 1B.4 and 6.5 → `[~]`; 1B.1 → one bounded run authorised; **close the roadmap** with incomplete scope and explicit deferrals |
| 3 | was A3 the council's to decide, given the blocker's own owner-routing? | **1B, convergent** — A3 stands but is **provisional and owner-ratifiable**, deadline **2026-09-08**, with a written reversal path |
| 3 | one receiver or three for the 38 deferred items? | **SPLIT** — anthropic three, openai one. One was taken because each seat attached a condition rather than an absolute, and per-group sections satisfy both |
| — | (drain run 12 sibling, PR #1786) 5.4's `guarded_baseline` category | **`absence-assertion` → `future-mechanism`**, convergent. Removes a closure right; grants none |

## Two things this run got wrong and fixed with evidence

**1. The deferral glyph.** 38 steps described everywhere as deferred-with-triggers
were first encoded `[-]`, which in this tree means **cancelled** and is
owner-reserved (`archive_completed_roadmaps.ts:396`). `count_deferred` stayed 0,
**Iron Law 3 never fired**, `deferralProblems` never validated the receivers, and
the roadmap archived through a guard that should have stopped it. Found by the
independent R2 reviewer, not by the implementing session. All 38 are now `[~]`
with `deferred-resolution: carried-to=` annotations pointing at a draft roadmap
carrying the `parent_roadmap:` back-link. The guard was then proven live rather
than assumed: **0** problems as shipped, **1** for any single annotation removed
(probed at three positions), **38** for a nonexistent destination.

**2. A closure resting on a refuted premise.** PR #1785 closed step 5.4 `[x]` on
a 2026-08-31 verdict treating it as an `absence-assertion`. A later 2/2 council
(#1786) ruled that category a *"documentation bug rather than a closure
opportunity"*. The `[x]` is withdrawn and 5.4 is carried with the rest. The
sabotage-proven half — the deterministic path is pinned as the only proposer —
is kept and is not what the `[x]` was claiming.

## The one measurement this run made

**1B.1's authorised verification run, and it did not close the step.** Two seats,
analysis lens, `--rounds 1`, inline findings on. Counter: **anthropic 10 → 12**
(inlined, parse receipt present, zero extraction calls), **openai 10 → 13** (no
block, no `raw_text`, one extraction response). The closure condition is zero and
one is not zero. What it adds over the 2026-08-31 attempt is **reproduction** —
same seat, same miss, different prompt, different day — so the `codex-default`
contract-compliance miss is a stable seat-level property. It is **not a rate**:
n = 2, no matched comparator.

## Descopes — four stubs and one draft receiver

| Destination | Carries |
|---|---|
| `stubs/road-to-council-topology-benchmark-execution.md` | Phase 2, its 23 dependents, 6.5 |
| `stubs/road-to-provider-leakage-bench-execution.md` | 3.3, 3.4 |
| `stubs/road-to-council-topology-instrumentation.md` | the 12 instrumentation and live-run steps |
| `stubs/road-to-metered-proposer-evaluation.md` | 4.1, 5.4, 5.6, AC-8 from the governed-harness roadmap |
| `road-to-council-topology-evidence-followups.md` (draft) | the live receiver the archival guard verifies |

Every stub carries a resumption trigger and an explicit forbidden-claims list.
No work was deleted; every frozen manifest, arm spec and pre-registration stays
in the tree.

## The § 5 terminal case — one blocker no council could settle

`blocker: merge-authority` on `road-to-harness-promotion-bridge` is **still
open**, and this is the run's designated terminal fallback firing exactly once.
The agent working it declined to substitute a council verdict for the owner on
two grounds it recorded in-tree: granting preauthorized merge authority would
lower the `non-destructive-by-default` Hard Floor for a production-branch merge,
which no delegation from one agent to another can authorise; and the refusal
direction is held by a live in-tree lock reserving it until a human asks. It
mechanism-matched before citing the lock. That roadmap stays ACTIVE and unclosed,
with both open items given written dispositions rather than descoped — because
descoping either is the exact weakening its own council-authored Resume condition
reserves to the owner.

**Worth the owner's attention:** only the GRANTING direction puts AC-9 on a path
to being met. A refusal makes it permanently unmeetable and turns its disposition
into a separate owner decision.

## Honest close

Two of three roadmaps closed and archived; one stopped on a genuine owner
reservation. The roadmap directory is not empty and the run did not force it to
be. Three claims this run does **not** make: that the deferred work was done,
that the deferred work was dropped, or that a council verdict is an owner
signature. The A3 disposition is explicitly provisional to **2026-09-08**, and if
the owner declines it the reversal path is written at the blocker and needs no
argument re-run.

**What an independent reviewer caught that the implementing session did not:**
one critical defect, four high, seven medium, three low — including a glyph
choice that silently disabled two archival guards, a governance routing the
roadmap's own text reserved to the owner, an evidence record born stale, and two
over-claims about what the council had said. All fixed, each with a commit ref.
That review is the reason this summary can be read as evidence rather than as a
report about itself.
