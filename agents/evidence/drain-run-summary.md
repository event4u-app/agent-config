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
| `stubs/road-to-metered-proposer-evaluation.md` — **never landed**; superseded 2026-09-01 by `road-to-governed-evidence-production` | 4.1, 5.4, 5.6, AC-8 from the governed-harness roadmap |
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

---

# Drain run 13 — 2026-09-01

A second autonomous drain run, on the tree the run above left behind. Same
standing instruction: every open question, decision or blocker goes to the AI
council rather than to the maintainer, and the council's recorded decision
substitutes for owner sign-off.

## Scope

Recomputed from the tree, not from the seed queue — the seed named 36 roadmaps
and **three** were active at `origin/main` @ `468eeefc7`. Two of the three are
the ones run 12 left open; the third, `road-to-governed-evidence-production`, is
the receiver run 12's successor created.

**The active directory is NOT empty at the end of this run, and that is the
recorded outcome rather than a shortfall.** All three files remain, each for a
reason that is written down and falsifiable.

## Pull requests

| PR | Roadmap | Outcome | State |
|---|---|---|---|
| [#1789](https://github.com/event4u-app/agent-config/pull/1789) | `road-to-harness-promotion-bridge` | defect fixed + hardened; dispositions recorded; roadmap stays active | open |
| [#1790](https://github.com/event4u-app/agent-config/pull/1790) | `road-to-council-topology-evidence-followups` | triggers verified, 4 faithfulness repairs; deliberately not drained | **merged** |
| [#1791](https://github.com/event4u-app/agent-config/pull/1791) | `road-to-governed-evidence-production` | Phase 1 closed; Phase 2 unblocked, arm built, execution refused | open |

`#1785` (a run-12 leftover for an already-archived roadmap) was merged by a human
during this run. It was not touched by this run and is out of its scope.

## Council decisions — one session, five questions

AI council 2026-09-01: `anthropic/claude-sonnet-4-5` + `openai/codex-default`,
2 rounds, deep, peer-review, blind chairman, quorum **2/2 present, needed 1 —
concluded**, subscription transport, `billable=0`, **`$0.0000`**.

| Q | Question | Verdict | Executed? |
|---|---|---|---|
| 1 | ADR-239 § Decision 3 / `blocker: merge-authority` | **1A refuse, 2/2** | **NO** — see below |
| 2 | AC-9's disposition | **SPLIT 2A/2B**, both on one shared condition | resolved as **2B** from the tree |
| 3 | `blocker: metered-backend-park` | **3B narrow to a proposer, 2/2** | **YES** |
| 4 | the topology receiver's disposition | **4A leave as draft receiver, 2/2** | **YES** |
| 5 | is the delegation manufacturing closure? | **YES**, one risk named | risk declined |

**Q1's verdict was obtained and deliberately not executed, and the run discloses
its own procedural defect for having asked.** The tree carries a live lock
reserving that argument until *"a human either answers it or explicitly asks for
the (b) argument to be put"*, and the question was written and dispatched before
that lock was read — a `decision-revisit-gate` step-2 miss. Independently of the
lock, writing the refusal into ADR-239 **is** settling ADR-239, which the
reservation names in either direction. Disclosed in
`road-to-harness-promotion-bridge.md` § Blockers, where the next reader looks.

**Q2's split was resolved by a fact, not by picking a side.** Both seats
conditioned their answer on the same question — does this repository admit an
archive with an unmet acceptance criterion? It does not:
`archive_completed_roadmaps.ts:14-16,562-563` gates on `count_open == 0`, counted
by a whole-file `/gm` regex with no section filter, so `- [ ] AC-9` counts like
an unfinished step. There is no `terminal-incomplete` disposition and no flag
that supplies one.

**Q3 was taken only after reading the actual lock, which corrected the
blocker's own provenance.** The blocker cited *"the 5.2 evaluator-independence
decision"*; step 5.2 only defers, and the reasoning lives in
`agents/roadmaps/later/road-to-routing-assurance-live-floors.md:20-52`. Two facts
there decide it: the park states its own authority as *"council-decidable, not
owner-reserved"* (`:44-47`), and its objection is *"evaluating an artifact you
authored"*, explicitly not cost (`:27-33`).

## Descopes

**None.** Nothing was descoped, cancelled, weakened, or marked complete on any of
the three roadmaps in this run.

## Terminal blocks, and what clears each

| Item | Block | Clears when |
|---|---|---|
| `road-to-harness-promotion-bridge` 0.8, AC-9 | owner-reserved: ADR-239 § Decision 3 | the owner settles it; a **grant** is additionally barred by the `non-destructive-by-default` Hard Floor, which no standing instruction lifts |
| `road-to-governed-evidence-production` 2.1, 2.2, AC-2, AC-3, AC-4 | host execution refusal on a session authorised to make paid API calls | a human runs the frozen protocol, or authorises a spending session |
| `road-to-council-topology-evidence-followups`, all 38 | capacity that does not exist: `n >= 5` eligible seats (2 of a schema universe of exactly 5 are enabled), and reservation windows the tree cannot represent | the capacity exists **and** a human flips `status: draft` |

The middle row is the one that moved. Phase 2 was held by a governance lock; it
is now held by an environment-scoped refusal, which is falsifiable and cheap to
clear. The run did **not** retry that refusal — the same shape is on record one
roadmap over, where a run *"stopped rather than rephrasing its way past a safety
refusal, which would have been the reservation defeated by persistence."*

## What the run actually shipped

- **A real security defect and its hardening.** `Status: resolved` was the only
  closed token this repository recognises and the promotion capability read it as
  a **grant** — so recording a *refusal* of preauthorized merge authority would
  have minted the capability that performs unattended promotion. A neutral review
  then found **three further ways** the fixed version still minted against a
  blocker whose live status was `open` (a fenced example read as the live value,
  `granted` matched as a prefix so a half-written template minted, and an
  unscoped heading search). All four fixed, each pinned by its own test, each
  RED-proven individually.
- **Phase 1 of the governed-evidence receiver, closed on real evidence** — an
  independent append-only activation-receipt producer that imports no evaluation
  module (so its trust boundary holds by construction), a falsifiable trust
  boundary and evidence-cost contract, and a twelve-stage enumeration that is
  *computed* from committed arrays and reproduced by a second route.
- **A metered proposer arm whose role constraint is structural** — six forbidden
  roles each made unavailable by the type or the shape rather than by intention;
  a scoring key is a build error.
- **28 RED proofs across the run**, every one restored byte-identically. Three of
  them found real defects instead of confirming health: an unfalsifiable
  `assertCheapestFirst` guard, a vacuous test stub that made an ordering
  assertion meaningless, and a hand-written family list that was the wrong
  complement.
- **A pre-existing red on `main`, diagnosed and swept.** PR #1788 archived a
  roadmap without updating a test's hardcoded path, failing collection and taking
  Node Tests shard 4/4 down on both OSes. Defect-pattern sweep: 8 candidate
  sites, 1 real defect. Fixed independently on `main` via #1785 with a stricter
  resolver; that version was taken.

## Honest nulls

- **No metered model call was made by any session in this run.** Zero requests to
  any provider API, including no wiring probe — that would itself be a capture by
  the park's own reasoning. The metered transport's live path is unexercised.
- **No measurement was taken for any of the 38 topology items and none is
  claimed.** Zero of them turned out to be already satisfied.
- **`adherence` is reachable through the evaluation cascade's stage list but from
  no shipped observer**, because no evidence source is admitted for it. Named in
  the step rather than papered over.
- **No tree-wide scan covers the new metered arm**; containment is asserted
  locally over three paths. Recorded as an open question.
- **The two prior councils' rulings were not overturned.** Where this run
  disagreed with a recorded lock it said so and left the lock standing.

## Open questions left for a human

1. ADR-239 § Decision 3 — grant or refuse preauthorized merge authority. The
   council's reasoning for refusal is recorded and unexecuted.
2. Whether to run the frozen metered-proposer protocol, and who freezes its one
   deliberately-unset slot (the paired outcome metric and its aggregation).
3. Whether `road-to-council-topology-evidence-followups` should be flipped to
   `ready` — its header reserves that to a human.
4. Whether the ungated 1000-line structural roadmap cap should get a gate.
   `road-to-harness-promotion-bridge` crossed it silently in this run.
5. Whether the unguarded-removal exposure on the topology receiver — 38
   obligations resting on a file no gate protects — warrants a standing
   validator.
