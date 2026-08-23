# Autonomous drain runs

---

# Run A — 2026-08-23 (earlier session)

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
- **3 real defects found and fixed** that no roadmap step had asked for, plus 4 of my own — including three that only remote CI can catch.

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
- **Three defects that ONLY remote CI catches**, all on #1573 and all worth the
  next run's attention because `task preflight` and the pre-push hook were green
  on every one:
  - `actions/upload-artifact@v4` — a **tag**. This repo SHA-pins every action and
    `tests/contracts/ci_supply_chain.test.ts` asserts it. The failure read
    *"dependabot claims SHA pinning: true, unpinned refs: 1"* on four shards,
    naming the contract rather than the file. Preflight does not run the contracts
    suite.
  - **`gate-hardening:unhardened-scan-scope` targets ZERO** — mandatory, not a
    floor. A new gate that routes through neither `_lib/scan_scope` nor a
    registered floor reds immediately. Fixed by `reportScanned` with *readings* as
    the unit: zero readings is a **dead scope**, because a store that parsed to no
    records reads identically to a store nobody has written.
  - **`actionlint`**: `matrix.os` referenced in a job with no matrix. Neither
    preflight nor the pre-push hook invokes actionlint; it runs in CI on changed
    workflow files only.
- **A reference to a file that does not exist yet, by design.** The published
  distribution is rendered from an empty store, so citing its path broke
  `check_references` in CI while passing locally — the local and CI exclusion sets
  differ. Marked `ref-ignore` with the reason inline rather than silenced.

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


---

# Run B — 2026-08-23 (this session)

Machine-readable record of a second autonomous roadmap-drain run on the same day.
Every decision below was taken by the **AI council** under maintainer-delegated
authority. None was referred back to the user; none was taken by the executing agent
alone on a question a roadmap reserves.

## Headline

- **10 pull requests** opened; **7 merged** during the run. The trunk moved under the
  branches eight times and every branch was merged onto it rather than pushed behind it.
- **8 roadmaps closed and archived.** 1 advanced by two full phases and deliberately
  **left open** rather than closed on partial work.
- **20 blockers resolved**, all by council. **0 questions to the user.**
- **6 council sessions**, 2/2 quorum in every one, $0.19 total (subscription transport,
  no metered spend). Quota after the run: 26/50 per member.
- **4 carries into stubs**, each with a promotion criterion. **0 silent drops.**

## Pull requests

| PR | Roadmap | Outcome |
|---|---|---|
| #1577 | `road-to-per-turn-hook-economy-carry` | closed + archived · **merged** |
| #1578 | `road-to-mcp-runtime-integrity` | closed + archived · **merged** |
| #1579 | `road-to-release-publication-integrity` | closed at Phase 1 + archived · **merged** |
| #1580 | `road-to-unowned-resume-conditions` | closed + archived · **merged** |
| #1582 | `road-to-target-project-assurance-readiness` | closed on its null route + archived · **merged** |
| #1583 | `road-to-override-efficacy-proof` | closed + archived · open, green |
| #1584 | `road-to-terminal-token-economy` | closed + archived · **merged** |
| #1585 | `road-to-review-independence` | closed + archived · open |
| #1586 | `road-to-council-evidence-integrity` | **Phases 1–2 only, roadmap left open** · open |

## Council decisions

Session 1 — 18 blockers in one pass, 16 convergent, 2 split. Session 2 — both ties, both
resolved. Sessions 3–6 — 9 further decisions, 2 of them re-evaluations of locks whose
recorded condition had changed.

| Blocker / question | Verdict | The load-bearing reason |
|---|---|---|
| `assurance-enforcement-thresholds` | defer Phase 8.5 | *nulls are not thresholds*: four unset numbers cannot support a blocking policy |
| `sibling-roadmap-dispositions` | record live dispositions | "archived, no measured result" is a legitimate disposition |
| `b-detector-license-verification` | own derivation | removes licensing ambiguity, executable without external evidence |
| `b-page-capture-primitive` | recorded nulls | no verified capture primitive; cut the render-dependent dimensions |
| `b-lifecycle-integrity-open-steps` | consume read-only | an archived roadmap's findings are frozen input |
| `b-maintainer-run-capture` | decline the capture | no human at a keyboard; Phase 3 proceeds independently |
| `b-bundler-choice-for-fixture` | `tsup` | purpose-built for the ESM+CJS+dts contract; familiarity ≠ purpose-fit |
| `b-cli-flag-probe` | honest null | an absent binary is a null, never a silent skip |
| `b-probe-channel-decision` | transcripts only, **partial** | proves argv correctness, not vendor honouring; `AC-5` narrowed |
| `second-ci-provider-key` | single-member gate | no credential can be minted autonomously |
| `sibling-ownership` | this roadmap owns the state | the roadmap that measures rotation is the only defensible owner |
| `b-plate-vs-skill-sprawl` | named sibling skills | the size cap and the anti-sprawl rule both hold |
| `b-behavioural-bench-spend` | fifteen rules out of scope | pre-authorized budget is *permission without a reason* |
| `b-colleague-machine-readings` | single-machine scope in the header | one machine reachable |
| `b-playbook-home-in-consumer-tree` | sixth context type | reuse the existing machinery |
| `b-async-split-cancellation` | cancel the split | **≤ 3 ms of a 1186 ms composite** — 0.25 % |
| `b-async-split-live-verification` | capability unavailable | no host carries the split config |
| `b-composite-ceiling-value` | **(c) extend observe-only** | first chose (b), then found it unexecutable at n = 0 |
| `b-stub-promotion-authority` | do not promote | an autonomous run does not override a deferred estate decision |
| Phase-3 rotation spike | record the null | the corpus does not carry file order; a re-review confounds ordering with variance |
| `b-ab-session-spend` (re-evaluated) | **deferral stands on a NEW condition** | the ordering objection was discharged; the ≥ 2-machine requirement is not |
| rtk wrapper mechanism | warn-only | *"a host capability is not yet a safe dispatcher capability"* |

Two splits went to a tiebreak and both converged. One verdict — `b-composite-ceiling-value`
— was **overturned by the facts**: option (b) required a number derived from ≥ 10 readings
and the store held **zero**, so the council was asked again and chose (c).

## The two lock re-evaluations, because they are the pattern worth reusing

`decision-revisit-gate` requires a lock whose recorded condition has changed to be
**surfaced, not obeyed**. It fired twice, and both times the outcome differed:

1. **`b-ab-session-spend`** was deferred on *ordering* — "Phase 2 has not chosen the
   mechanism". Phase 2 chose **in the same change**, so the condition was discharged. Put
   back to the council: the deferral **stood on a new condition** (the registration's own
   ≥ 2-machine requirement). Amending the registration down to one machine was refused —
   it lowers a bar written before any number was seen.
2. **`b-per-turn-composite-ceiling`** was deferred on a *bounded wait* whose bound was a
   named milestone. The milestone was reached and produced **n = 0**, so the wait had
   already ended without delivering its input. Continuing to wait would have been the
   indefinite park under a new name the roadmap's own risk register names.

## Descopes, carries and transfers — 4, all with promotion criteria

| Carried | To | What reopens it |
|---|---|---|
| override efficacy paired run (3 steps) | `stubs/road-to-override-efficacy-paired-run.md` | a **second** real override in the tree |
| widened rtk re-bench (3 steps) | `stubs/road-to-rtk-rebench-run.md` | a **second machine**; a CI runner counts |
| human risk corpus | `stubs/road-to-human-risk-corpus.md` | ≥ 60 human-labelled changes **and** R3 rate ≤ 0.40 |
| ADR-134 expiry date | `stubs/road-to-adr-134-expiry.md` | the date is decided, succeeded, or lapses as a recorded finding |

`stubs/` is excluded from `active_roadmaps`, so every carry is ratchet-compliant and costs
the estate nothing. **No `[~]` was resolved by deletion.**

## Defects found that no step asked for

- **The host DOES support a transparent input rewrite.** Three sites asserted otherwise;
  Claude Code 2.1.241 documents `updatedInput`, validates its schema and logs a fallback.
  The shipped claim collapsed a fact about *our plumbing* into a claim about *the host* —
  and was undated, which is why nobody could tell. All three corrected.
- **Two of four P3 concurrency call sites were unpinned.** The suite proved the lock
  *primitive* via inline worker re-implementations and never reached the real call sites;
  sabotaging one left all three tests green.
- **A doctor line contradicted its own strict gate.** A grep for a rule name in the
  registry read `verify-before-complete` as unregistered — the name sits inside a
  `justification:` block. Now parsed the way the audit parses it.
- **`[]` was classified as a parse failure.** The shared extractor's regex requires an
  object, so a member answering correctly with an empty array would have triggered a
  **paid** re-ask. Found by a test asserting the fix, not by the step.
- **Peer-review quotes resolved to the wrong source.** One label→source map was
  overwritten per reviewer; the artefact carried the last reviewer's mapping for every
  quote. The old assertion was on `size`, which cannot see a collision.
- **A check id needed registering in two runner registries.** Registering one crashed on
  the path this repository actually takes.

## Own errors, recorded because they are the reusable part

- **A grep-shaped verify is trapped by prose that quotes the token it forbids.** Hit four
  times — `pull_request` in a workflow comment, `{{envelope}}` in a route, "in stable input
  order" in a skill, `readFileSync` in a function's own explanation. Describe the token;
  never quote it inside the scanned region.
- **A baseline left one line loose is a red test.** `check_source_size_budget` warns
  "ratchet is loose" and exits 0, so a local run looks fine — and a committed test asserts
  `baseline == live total`. Learned from CI.
- **A budget branch must resolve a baseline conflict onto MAIN's floor**, never its own,
  or it silently gives back the other branch's gain.
- **`npx tsc` on one file is not the project typecheck.** `exactOptionalPropertyTypes`
  caught what the ad-hoc invocation missed. Use `task typecheck-ts`.
- **`execFile` has no `input` option.** A test spawned eight dispatchers that all took the
  no-envelope path and passed for the wrong reason.
- **A predicted failure message is not an observed one.** A recorded RED said
  `expected [] to include …`; the run printed `expected '' to contain …`. Corrected, because
  a message nobody ran is indistinguishable from one that was.

## What is NOT done, stated plainly

**9 roadmaps remain open**, none of them touched by this run:
`road-to-frontend-power` (60 steps) · `road-to-agentic-engineering-assurance` (53) ·
`road-to-frontend-fidelity-calibration` (36) · `road-to-trigger-delivered-rule-bodies` (34) ·
`road-to-chained-clip-continuity-and-provider-truth` (30) ·
`road-to-roadmap-situational-awareness` (29) · `road-to-role-scoped-spawn-profiles` (28) ·
`road-to-skill-delivery-over-mcp` (25) · plus the four remaining phases of
`road-to-council-evidence-integrity`.

The run stopped on **context exhaustion**, not on a blocker. Nothing above was left
undone because it was impossible; the queue was longer than one session. Twelve of the
twenty blockers those roadmaps carry are already council-resolved by session 1 of this
run, so a successor starts from decided positions rather than open ones.

**Defects that remain live and are named as such:** a `DERIVED_MARKER` can still reach a
published release section (no guard ships — #1579 cleared all three refusal causes and
promotion is the maintainer's call); rug-pull protection on third-party MCP tools remains
absent at protection level zero; override efficacy and rtk savings remain unmeasured;
`self_review_gate` remains single-member.

## Verification standard applied throughout

Every closed step's `verify:` was run, not asserted. Every new test was **seen RED** before
its fix, or its insensitivity was recorded when the RED could not be produced — twice,
honestly: a same-machine concurrency test that real dispatchers cannot make race, and a
re-ask bound whose removal produced `Tests  no tests` rather than a failing assertion.
Every null names the unavailable capability, the affected claims, the evidence boundary and
the reopening condition — a shape the council adopted unanimously in session 1 and that was
applied to all nine of them.
