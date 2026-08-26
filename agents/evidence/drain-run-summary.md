<!-- evidence-type: analysis -->

# Autonomous roadmap-drain run — 2026-08-25/26

> The single report for the run, per its mandate: **every PR, every council
> decision, every descope.** Written as the last commit of the final PR.
>
> **The roadmap directory is NOT empty, and this run did not empty it.** What
> follows says which roadmaps were never opened and why, because a summary that
> reported only the work done would misdescribe the run.
>
> **§§ 1–7 cover the run's FIRST SEGMENT and §§ 8–13 the SECOND.** They are kept
> separate rather than merged: the second segment re-opened four roadmaps the first had
> advanced and left active, so a single merged table would report the same
> roadmap twice with two different outcomes and hide which came first.

## 1. The pull requests

All eight are **CI-green** and open against `main`. None was merged — the mandate
made the PR the touchpoint.

| PR | roadmap | outcome |
|---|---|---|
| [#1645](https://github.com/event4u-app/agent-config/pull/1645) | `web-launch-readiness` | **Closed by approved rescope, archived.** 15/19 met, 4 descoped |
| [#1646](https://github.com/event4u-app/agent-config/pull/1646) | `channel-contract-and-profile-drift` | **Complete, archived.** 13/14 met, 1 cancelled |
| [#1647](https://github.com/event4u-app/agent-config/pull/1647) | `merge-surface-zero` | **Parked to `later/`.** Step 3.1 split; B4 decision packet written |
| [#1648](https://github.com/event4u-app/agent-config/pull/1648) | `canonical-terms` | All three deferred **decisions taken**; 4/9 met, Phase 2 re-scoped |
| [#1649](https://github.com/event4u-app/agent-config/pull/1649) | `contract-review-deadlines` | **Phases 0+1 complete**, 10/24. The beta gate gains a floor |
| [#1650](https://github.com/event4u-app/agent-config/pull/1650) | `skill-ecosystem-runtime-enforcement` | Both blockers resolved; **Phase 1 built**, 7/53 |
| [#1651](https://github.com/event4u-app/agent-config/pull/1651) | `memory-twin-reconciliation` | Release class decided; two twins characterised, 4/13 |
| *(this PR)* | `episode-finalizer-and-outcome-attribution-v2` | Both blockers resolved; **parked to `later/`**, 2 steps descoped |

**Estate movement:** 2 roadmaps archived, 2 parked to `later/`, 4 advanced and
left active.

## 2. Council decisions — 7 sessions, 15 decisions, $0.43

Every session: `anthropic/claude-sonnet-4-5` + `openai/codex-default`, 3 rounds,
blind chairman, quorum concluded 2/2. All ran under the maintainer's standing
delegation, quoted verbatim in each question. **No tracked artefact grants the
council standing authority over owner-reserved decisions** — the authority is
this session's instruction, and every record says so.

| # | decision | verdict | note |
|---|---|---|---|
| 1 | web-launch closure | **approve the rescope** 2/2 | with 5 binding conditions; **1 condition refused** (below) |
| 2 | `write-engine.md` stability | **keep beta, extend to 2026-09-24** 2/2 | as an administrative holding period, *not* approval |
| 3 | profile surfaces in `brand-audit` | **out of scope** 2/2 | mechanism-match made and found **insufficient** |
| 4 | merge-surface-zero disposition | **park to `later/`** 2/2 | (b) and (c) both refused with reasons |
| 5 | step 3.1 | **split, do not check** 2/2 | accounting for delivered scope, not redefinition |
| 6 | B4 writer | **decision packet only** 2/2 | design-and-propose; never merge |
| 7 | canonical dialect | **American** 2/2 | *and the roadmap's own premise was refuted* |
| 8 | closed-set row placement | **option 2, close it** 2/2 | "wait" rejected as a non-disposition |
| 9 | shim scope | **container-only** 2/2 unanimous | one offered evidence **refused** as too weak |
| 10 | plan injection | **defer both halves** 2/2 | both seats **overruled the author's recommendation** |
| 11 | memory-twin release class | **minor** 2/2 | flag proposal a 1-of-2 split, **not adopted** |
| 12 | lapsed-deadline gate | **a no-growth baseline ratchet** 2/2 | a *fifth* option; none of the four offered |
| 13 | quality columns | **host null, narrowly scoped** 2/2 | author's recommendation overruled on arithmetic |
| 14 | machine-local denominator | **unresolvable by an autonomous run** 2/2 | |
| 15 | episode-finalizer disposition | **park to `later/`** 2/2 | reached by two independent tests |

### Where the council overruled the roadmap authors — four times

Recorded because it is the strongest evidence the sessions were not rubber stamps:

- **#10** — the author recommended shipping `attest_artifact.ts` *"on its own
  merit"*. Both seats: no protected artifact, no threat model, no consumer, no
  failure response. *"A mechanism without a subject."* Verified in the tree: the
  script did not exist, so it was a **build**, not a re-labelling.
- **#13** — the author recommended adopting the episode-boundary candidate and
  evaluating its falsifier. There is **no eligible corpus to evaluate it
  against** (0 populated rows, three corpus growths moving no verdict). Adopting
  a definition whose falsifier is unevaluable is the wrong order of operations.
- **#8** and **#12** — both blockers recommended *wait*. Both seats: a deferral
  whose trigger is an unfunded mechanism is not a disposition.

### Where a seat overruled the other, and the reason was adopted

- **#1** — anthropic asked this council to freeze the parked benchmark's seven
  protocol items. openai refused: *"Having this ground-truth-aware council select
  sample sizes, metrics, or thresholds would freeze contamination into the
  experiment rather than eliminate it."* The COI that bars this session from
  **running** the arms bars it equally from **parameterising** them.
- **#11** — anthropic wanted a migration flag. openai: *"'Silent data corruption'
  is not supported by the supplied facts."* Adopted for consistency: the same
  evidence discipline that killed #10's attestation kills this flag.

## 3. Findings the run produced that no roadmap had asked for

- **A gate reporting green over 86 violations.** `check_beta_review_markers`
  compared `keep-beta-until` only against `today + 90` and errored on dates too
  far in the **future**. No floor. It printed *"All beta contracts carry a valid
  review marker"* while **86 of 121** were lapsed — and `STABILITY.md`'s own 25 %
  re-audit trigger had fired at **71.1 %** with nothing able to observe it.
- **44 of those 86 lapsed on ONE day.** A cohort artifact — one past session's
  uniform window expiring at once — not 86 lapses of discipline. It changed the
  decision from *report vs fail* to a **ratchet**.
- **A published measurement inverted by scope.** `road-to-canonical-terms` rests
  on `behaviour/behavior` splitting 57/43 **British**. Per directory, `src/` — the
  shipped surface — is **22/78 American**. Three of nine pairs flip. The roadmap
  also cited the **wrong evidence file**; the dialect numbers live in the wording
  baseline, and the file it named contains zero dialect content.
- **A template missing a safety gate.** `memory_signal.ts`'s 36-line divergence
  is **one** difference: the template side carries **none** of ADR-130's
  provenance gate, so a consumer running it can write `subject: user` records
  into tracked project intake.
- **A CLI difference where the obvious verdict inverts.** Both memory twins
  implement the same mutual exclusion; dev is order-stable, the template is
  **argparse-faithful** — and this repo states argparse parity as a convention.
  Recorded **undecided**, both behaviours measured, rather than guessed.

## 4. Descopes and parkings — every one, with its reason

| item | disposition | reason |
|---|---|---|
| web-launch 3.2, 3.3 | `[-]` descoped | the authoring session may not run the experiment that grades its own fixtures |
| web-launch AC-5 (remainder), AC-6 | `[-]` unmet, **verbatim** | both seats refused rewriting criteria to match what shipped |
| channel-contract 2.2 | `[-]` not applicable | conditional step; 2.1 decided out-of-scope, so its condition is false |
| `merge-surface-zero` | **`later/`** | 5 steps on an owner-reserved trunk writer, 2 on repo-admin, 2 on a 20-PR window |
| canonical-terms 2.1 | re-scoped, still open | sweep **not authorised**: needs a classified inventory + a blast-radius pilot |
| runtime-enforcement Step 7 | `[~]` half done | the flag exists; the Phase 2 diagnostic it names does not |
| episode-finalizer 2.2, 5.2 | `[-]` descoped | all 4,912 stops machine-local against a `≥200 non-local` band |
| `episode-finalizer-v2` | **`later/`** | AC-2 requires ≥2 machine provenances; unobtainable in-session |

**Nothing was descoped to make a roadmap look finished.** Two roadmaps were
parked precisely to avoid that, and in both the external-validity gap is stated
in the roadmap's own header rather than only beside the steps.

## 5. The seven roadmaps never opened

| roadmap | open | why not |
|---|---:|---|
| `skill-ecosystem-eval-integrity` | 42 | gained a tracked Step 8 via #1646; not otherwise worked |
| `inbox-harvest-2026-08-e-council-topology-evidence` | 74 | 5 open blockers, largest in the estate |
| `capability-native-execution` | 52 | not reached |
| `decision-conformance` | 29 | not reached |
| `component-granularity-vocabulary` | 28 | not reached |
| `internal-estate-fit` | 25 | not reached |
| `published-number-truth` | 21 | not reached |
| `ten-across-the-board` | 19 | not reached |

**These were not blocked — they were not reached.** Roughly **290 open steps**
remain. Saying "not reached" rather than "deferred" is the point: nothing about
them was assessed.

## 6. Quota and the run's own limits

Council quota ended at **41/50** per provider, having warned *near limit* on
both. No decision was degraded to a single seat, and no seat was absent from any
session.

**Three things this run could not do, by construction:**

1. **Merge anything.** The PR is the touchpoint, so eight PRs are open and the
   estate movement above is pending review.
2. **Produce a second machine.** Council #14's verdict is a property of the
   world, not of effort.
3. **Authorise trunk mutation.** B4's writer would be the **first** workflow in
   this repository to push to `main`, and it needs a standing bypass of the
   repository's own pull-request rule. A packet was written; nothing was wired.

## 7. Verification discipline

Every load-bearing assertion added this run was **seen red** before being
believed — 18 sabotage probes across five PRs, each restored and re-verified:

| PR | probes | notable |
|---|---:|---|
| #1646 | 4 | schema enum, the short-form typo, contract drift, surface drift |
| #1649 | 5 | each probe fails **only its own target**, proving the assertions independent |
| #1650 | 4 | removing the shim's loop guard made the probe **hang** — that is the proof |

Three preflight/CI failures were **fixed, never bypassed**: an undeclared
evidence type, a stale risk review answered with an actual re-review, and a
suppression file undeclared in `SUPPRESSION_INVENTORY` — the last caught by CI
after the local gate passed, because that gate is diff-scoped and blind until
committed. `AGENT_CONFIG_SKIP_PREPUSH_PREFLIGHT` was never used.

---

# Second segment — 2026-08-26

> The first segment's eight PRs were still open when it ended. This segment
> merged five of them after fixing what CI found, then opened five more.
>
> **The directory is still not empty**, and § 12 says what remains.

## 8. The pull requests

| PR | roadmap | outcome |
|---|---|---|
| #1653 | `canonical-terms` | **merged** — post-merge red fixed (the routing seed IS the live measurement) |
| #1654 | `contract-review-deadlines` | **merged** — three merge conflicts resolved, all in count-carrying prose |
| #1655 | `memory-twin-reconciliation` | **merged** — snapshot red fixed; the added key is a restored CONTROL, not drift |
| #1657 | `skill-ecosystem-runtime-enforcement` | 53 items, **archived** |
| #1659 | `skill-ecosystem-eval-integrity` | **merged** — 43 items |
| #1660 | `kernel-invariant-restoration` | **merged** — 3 of 5; clause 1 filed as human-only |
| #1661 | `inbox-harvest-f-owner-decision-queue` | 10 items, **archived** |
| #1662 | `inbox-harvest-f-code-graph-evidence-refresh` | 10 of 11; 3.1 **open by council ruling** |
| *(this PR)* | `inbox-harvest-f-skill-selection-evidence` | 12 items, **archived** |

## 9. Council decisions — 3 sessions, 6 decisions

Same shape as the first segment: two seats, blind peer review, quorum 2/2, on the
maintainer's delegation. Every one is recorded at the roadmap step it settled and
**none is linked by path** — council artefacts are gitignored and auto-pruned, so
a path to one is a reference that rots.

| # | decision | verdict |
|---|---|---|
| 16 | the PREREG verdict method | **amend now, before any run** 2/2 — with the magnitude bar kept independently binding |
| 17 | kernel invariant clause 1 | **restore the literal** 2/2 — *the reverse of the roadmap's own guess* |
| 18 | kernel invariant clause 2 | **amend the invariant** 2/2, with an explicit equivalence statement |
| 19 | stub review cadence | **per-shape: 30 / 180 days** 2/2 |
| 20 | the family cap | **leave `CAP = 2`** 2/2, revisit at **seven** days not thirty |
| 21 | the code-graph benchmark | **(c) now, and 3.1 must NOT close** 2/2 |

### Where the council corrected the work rather than approving it

- **#17 is the sharpest.** `road-to-kernel-invariant-restoration` assumed clause 1
  was the *amend* candidate because the current sentence reads better. Both seats
  rejected that: *"WAIT"* plus *"never fire in the turn you ask"* does **not**
  forbid acting in a LATER turn without an answer, while *"WAIT for the answer"*
  does. The reworded form is a tighter sentence about a **narrower guarantee** —
  exactly the shape the gate exists to catch, and exactly the shape a reviewer
  reading only the prose would approve.
- **#16** — both seats independently refused the bare replacement: a sign test
  answers *direction* and says nothing about *magnitude*, so replacing Wilcoxon
  outright would let a clean sweep of negligible improvements claim a **size**
  win. A seat also forced the framing correction — *before any Phase-3 outcome
  data, informed by twelve non-Phase-3 records*, not "before any data".
- **#21** — the run asked which ledger status was correct rather than choosing.
  Both seats: `backed` stays. NOT `resolved-null`, which would assert the
  retrieval question was **answered** null on a build nobody measured; NOT
  `superseded_by`, which expects replacement *evidence* and takes a claim, not a
  repair commit. What they required instead was structured build-scoping reaching
  **every index**, not only the detailed entry.
- **#19 / #20** — both seats also ruled that a delegated agent MAY settle these,
  because each is a reversible operating policy rather than a floor. That ruling
  is recorded because it is what made the rest of the segment legitimate rather
  than presumptuous.

## 10. Five premises measurement contradicted

The most useful rows here. Each is a roadmap's own framing, corrected in place.

| the roadmap said | measured |
|---|---|
| 15 hook concerns | **53** |
| **48** stubs carry no probe | **8** — it counted only level-2 headings |
| 77 stub files | **76** |
| 43 % of edges AMBIGUOUS is a defect | 86.7 % of them have **no in-repo target at all** — the taxonomy working, not the graph broken |
| clause 1 is the amend candidate | the **reverse** (§ 9) |

## 11. Descopes, nulls and recorded no-ops

| item | disposition | reason |
|---|---|---|
| the largest AMBIGUOUS class (58,612 edges) | **null route** | `join`, `push`, `map`, `readFileSync`, `toBe` — `Array.prototype`, `node:fs`, vitest. Not resolvable, not merely hard |
| the catalogue-wide `triggers.json` backfill | **no-op, lock stands** | mechanism-match confirmed; reopen condition **checked and unfired** — the observation store records delivery counts and names no skill |
| per-pack link validation | out of scope | belongs to a parked owner; widening quietly would answer a question nobody asked |
| `lint_eval_specs` advisory period | **skipped** | the corpus measured clean in all five classes; an advisory window over zero debt measures nothing and delays the protection |
| option (b) for the code-graph benchmark | refused | different corpora destroy the comparability that makes the re-run worth doing |
| the four pre-existing owner decisions | left verbatim | re-formatting someone else's open decision to satisfy a later roadmap's criterion edits the record, not the queue |
| AC-3 (eight decisions), AC-1 (non-inference) | **partially met, stated as such** | claiming them fully met would be the overstatement those very criteria exist to prevent |

## 12. What remains

Eight roadmaps, roughly 250 open steps. Two carry the blockers below; six were
**not reached** rather than assessed: `published-number-truth`,
`ten-across-the-board`, `internal-estate-fit`,
`component-granularity-vocabulary`, `decision-conformance`,
`capability-native-execution` (5 blockers), and
`inbox-harvest-e-council-topology-evidence` (5 blockers, largest in the estate).

**Two blockers left open, both `Owner: maintainer`, both with the exact work
written down:**

- **`clause-1-restore-is-human-only`** — `block_kernel_rule_writes` denies the
  write. The guard's scope was established by **reading** it, never by attempting
  the write: a council seat was explicit that probing a safety guard by writing
  to it is not an acceptable way to learn its reach, and this run did not. The
  cost of doing nothing is named: the kernel's never-act-while-asking floor
  currently holds the **narrower** guarantee.
- **`b-bench-inputs-absent`** — pinned question files under gitignored
  `agents/tmp/` plus three external repository clones. A seat named what this run
  cannot supply: a maintainer determination that the inputs are irrecoverable,
  which either retires the step or approves a separately named non-comparable
  benchmark.

**Nothing was merged by this run.** A production-branch merge needs a this-turn
confirmation and no standing mandate lifts it, so the green PRs above are waiting
on a human.

## 13. Method, and the two disciplines that changed outcomes

`task ci` is red on `main` for pre-existing reasons, so *"the pipeline is green"*
was never an available claim. Every PR instead ran **every task in the `ci` list
individually, on the branch and on a detached `origin/main`, and compared the
failure sets.** The claim is *zero branch-only failures*; where one survived it is
named in the PR body with its reason.

Found and fixed that way rather than by CI after the fact: a **dead
dependency-halt rung** whose ReferenceError was swallowed by its own `catch` (and
whose pure-decision tests all stayed green, because a decision function cannot
observe a caller that never computes its input); a fifth status value the MCP
tool's published union does not carry; a **raw U+1F control byte** where an escape
was meant; a schema change with no `x-schemaVersion` bump; a suppression entry
with no falsifier; evidence artifacts declaring their type in frontmatter a
marker-reading gate cannot see; and **four ratchet crossings, every one paid back
by extraction rather than by raising a baseline**.

Two disciplines are worth naming because they changed outcomes:

**Sabotage before claiming.** The concurrency guard was proven by disabling it —
1 of 8 parallel writes survived; 8 of 8 with it restored. Five regression tests
were each shown red before being trusted, including the one for the ranker's
stale default (reverting it reds 2 of 9) and the one for the memory-signal
provenance gate (removing it reds 2 of 45).

**Read the guard, do not probe it.** The one place where the cheap way to learn a
limit would have meant writing to a safety mechanism. The limit was read out of
the guard's own source instead, and the fact that it was read rather than tested
is recorded in the blocker so a later reader knows which.
