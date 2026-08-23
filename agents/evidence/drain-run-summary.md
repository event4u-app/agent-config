# Autonomous drain run — 2026-08-23

Machine-readable record of one autonomous roadmap-drain run. Every decision below
was taken by the **AI council** under maintainer-delegated authority; none was
referred back to the user, and none was taken by the executing agent alone on a
question the roadmaps reserve.

## Headline

- **8 pull requests** opened. **4 merged** during the run (the trunk moved five
  times under the branches; every branch was rebased onto it rather than pushed
  behind it).
- **3 roadmaps closed and archived**, 1 parked with a recorded option, 2 advanced
  by a full phase, 2 resolved on a spend blocker.
- **9 council sessions**, $0.31 total, all at 2 of 2 seats. **Two ended 1–1 and
  went to a tie-break round**; both tie-breaks converged, and in both cases the
  synthesis beat either original position.
- **4 transfer stubs** created, each with a named promotion probe and a
  **measured** blocking cost.
- **3 real defects found and fixed** that no roadmap step had asked for.

## The correction that shaped the whole run

**The seed queue in the mission prompt was entirely stale.** It named 36 roadmaps
by slug; **none of those slugs existed** in `agents/roadmaps/` at
`407915361`. The live set was 25 different files. The queue was recomputed from
the tree, as the prompt's own step 1.2 requires, and every priority below derives
from that recount rather than from the table.

Also recomputed rather than trusted: **23 blockers, all Class 2/3.** There were
**zero** Class 0/1 executables, so the entire unblocking pass was council work —
`./agent-config gates --execute` was never applicable.

## Pull requests

| PR | Roadmap | Outcome | State |
|---|---|---|---|
| [#1566](https://github.com/event4u-app/agent-config/pull/1566) | `merge-op-split-and-negation-guard` | **closed 18/18**, archived | merged |
| [#1567](https://github.com/event4u-app/agent-config/pull/1567) | `test-independence-and-mutation-evidence` | **closed 13/13**, archived | merged |
| [#1569](https://github.com/event4u-app/agent-config/pull/1569) | `org-pack-fitness` | **closed 16/16**, archived | merged |
| [#1570](https://github.com/event4u-app/agent-config/pull/1570) | `mcp-runtime-integrity` | parked, AC-4 discharged | merged |
| [#1572](https://github.com/event4u-app/agent-config/pull/1572) | `target-project-assurance-readiness` | Phase 1 shipped | open |
| [#1573](https://github.com/event4u-app/agent-config/pull/1573) | `per-turn-hook-economy-carry` | Phase A1 shipped | open |
| [#1574](https://github.com/event4u-app/agent-config/pull/1574) | `terminal-token-economy` | 3.2–3.4 deferred, figure labelled | open |
| this PR | `override-efficacy-proof` | 2.3–2.5 deferred | open |

## Council decisions

Nine sessions. Each row is a decision the roadmap reserved to a human and the
council took instead.

| # | Question | Verdict | The load-bearing reason |
|---|---|---|---|
| 1 | `owner-reserved-boundary` — does an `autoMerge`-key ratchet touch the reserved merge-authority question? | **(a) no, ship it** | A ratchet over three key *names* is not a decision about whether authority may be granted. Reversible: the owner deletes the gate. |
| 2 | `kernel-doctrine-line` — reconcile the Hard Floor with a direct `merge PR #123`? | **(c) descope to a stub** | (a) is a kernel-rule edit → tool-call-time deny for an agent. Both seats called (b) *"security theater"*. |
| 3 | Cancel the tool-assisted mutation rig? | **(b) cancel** | Its own blocker pre-registered the test; 0.3 ran 10 probes in minutes. A stub would preserve **no mechanism the estate lacks**. |
| 4 | `b-delta-comment-dependency` — is a 0/19 roadmap with two spend blockers "still live"? | **(c) cancel + carry** | *"Nominally live but operationally deferred"* — no credible delivery path. |
| 5 | Pack-fitness Phase 2 presumes a capability 4 of 6 gates lack | **split 1–1 → (s)** | Sequence: build to the injection that exists, carry the retrofit. The roadmap **stops claiming** six-gate orthogonality, which was the (a) seat's real objection to (b). |
| 6 | MCP rug-pull: build the after-use variant, or park? | **(b3) park** | Both shortcuts refused. Required wording: *"protection level is zero."* |
| 7 | Target-assurance: close on `unmeasurable-here`, or park? | **split 1–1 → (b)** | `unmeasurable-here` covers a **capability the tree lacks**; here the inputs are **human-supplied**. Closing would dilute the precedent. |
| 8 | rtk re-bench — spend is authorized, run it? | **(b) defer** | Phase 2 has not chosen the mechanism Phase 3 benchmarks. **Wrong subject.** |
| 9 | Override efficacy — spend is authorized, run it? | **(b) defer** | n=1 against the single override in the tree. **Wrong population.** |

### The one principle both spend decisions turned on

Spend was **pre-authorized** for this run, so the council decided *how*, never
*whether*. It deferred both runs anyway, and both seats reached the same
formulation independently:

> **Pre-authorized budget is permission without reason.** It does not refute a
> methodological objection.

Recorded because it is the reusable half: the objections were *prematurity*
(wrong subject; wrong population), not cost, and an open budget refutes neither.

### Two 1–1 splits, and why the tie-breaks mattered

Both splits were resolved by a **narrowed** second round, not by re-asking.

- **#5** — one seat: adding `--root` seams to four CI gates is gate engineering
  the roadmap's Non-goals exclude. The other: step 2.2's orthogonality proof *is*
  the roadmap's claim and only the seams establish it. **The second seat conceded
  the scope objection in its own rationale**, which is what made a synthesis
  available. Round 2: sequence them, and make the roadmap stop claiming what it
  cannot prove.
- **#7** — one seat proposed closing on `unmeasurable-here`; the other refuted the
  classification and **the refutation carried both seats**: that precedent is for a
  capability the tree does not have, and a missing human labeller is a missing
  *input*. Closing would have erased actionable work **and** diluted a precedent.

## Descopes and transfers

Four stubs, each with a promotion probe and a measured blocking cost. `unknown` is
recorded where nothing was measured — *"no cost was observed" is not "the cost is
zero"*.

| Stub | Probe | `blocked_items` |
|---|---|---|
| `road-to-merge-confirmation-doctrine` | a maintainer opens a kernel PR and serves its ≥24h soak | **0** (measured) |
| `road-to-pack-gate-fixture-seams` | a narrow ADR-200 amendment authorizes an isolated-root seam | **3** (measured) |
| `road-to-per-pack-cost-delta-emitter` | a per-PR delta-comment surface exists | **0** (measured) |
| `b-human-risk-corpus` (blocker, not a stub) | a named external repo **plus** ≥60 classifier-blind human labels | — |

Two cancellations (`[-]`) were taken by the council in the user's seat, which is
normally owner-reserved: the mutation rig (redundant on its own pre-registered
measurement) and pack-fitness Phase 3 (dependency operationally deferred).

## Defects found that no step asked for

1. **`check_roadmap_trackable` was red on `main`** — a completion-note heading read
   `### Phase 3 fit the cap exactly`, which the gate parses as a phase with no
   checkboxes. Fixed in #1566.
2. **`road-to-target-project-assurance-readiness` cited a blocker that did not
   exist.** Phase 2 was gated by `blocker: spike-before-build` and the file shipped
   with **no `## Blockers` section at all**. The dependency was real and invisible.
   Fixed in #1572.
3. **An unqualified `33 %` was reading as this package's general measured claim.**
   It is a one-machine, eight-command, month-old spot measurement. Fixed in #1574
   at **every** reader-facing occurrence, not just the canonical one — a council
   refinement, since a scope stated only where a number is defined *"does not
   survive being copied or summarised"*.

## Own errors, recorded because they are the reusable part

- **Cited a gitignored council response path from an active roadmap.**
  `check_council_references` refused it, 0 → 1 against a clean baseline. The
  defect-pattern sweep found **53** sites of the construct; exactly **one** was in
  an active roadmap (mine), the other 52 under directories the gate deliberately
  does not scan. Fixed by inlining the convergence summary.
- **A sabotage probe that proved nothing.** Replacing a key regex with
  `/([A-Za-z_][A-Za-z0-9_-]*)/` left all tests green — that regex returns the
  *first* identifier on the line, which is not a forbidden name. A probe that does
  not go red has proven nothing about the guard, only about the probe. Recorded at
  the assertion, because it reads exactly like a proven guard.
- **`EXIT=$?` after a pipe.** Read `tail`'s status and showed a false `0` for three
  sabotage probes in a row. Re-captured with `cmd > file; echo $?`.
- **A type error `task preflight` does not catch.** `boundReason: undefined` fails
  `exactOptionalPropertyTypes`; preflight was green and the **pre-push** typecheck
  caught it. Preflight is the pass a contributor is told to run and it does not
  `tsc` over `src/scripts/`.
- **A stale `dist/` projection.** `dist == rewrite(src)` is a CI gate; the
  pre-commit sync regenerates, and the regenerated file must be committed or the
  push is refused.

## Verification standard applied throughout

Every gate registered under **CI-identical argv** on both sides
(`check_ci_local_parity` green, no new declared exception). Every new guard
**sabotage-probed** before its tests were trusted, with the observed red counts
recorded at the assertion and `git diff --stat` empty after restore. Every
completion claim carries `task preflight` exit 0 plus the named gates.

Three gates ship with **no canary recipe** and the reason recorded rather than
omitted: their only possible violation is a modification of an existing tracked
artefact, so a create-only plant lands outside the corpus and the gate correctly
stays green. Sensitivity is proven by committed violating fixtures instead.

## What remains

17 active roadmaps. The queue was worked in the prompt's order — descending
progress, then ascending complexity — and stopped with context, not with a
blocker. Two of the remaining files are now **unblocked by this run's work**:
Phase A1 (#1573) started the reading clock that `per_turn_composite`'s arming
precondition counts, which is the collection milestone the council required when
it parked `mcp-runtime-integrity`.

**No blocker was weakened, no floor was moved, and no gate was skipped or
re-baselined to pass.** Where a criterion could not be met it was deferred,
descoped or parked with the reason and the reopening condition written at the
place it acts.
