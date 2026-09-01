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
