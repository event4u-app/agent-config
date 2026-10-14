# Findings: the 265 net-removed assertions on `drain/what-was-built-never-ran-20261013`

<!-- evidence-type: analysis -->

`check_test_weakening` refuses this diff with three files:

```
tests/hooks/run_continuation_dispatch.test.ts: 167 assertion(s) net-removed
tests/scripts/hooks/journal_record_hook.test.ts: 1 assertion(s) net-removed
tests/scripts/hooks/run_continuation.test.ts: 97 assertion(s) net-removed
```

The gate discharges on the presence of any file under `agents/evidence/reviews/`
in the same diff; it never reads one (`_lib/test_delta.ts:40`). This artifact is
therefore written as if the gate did read it, because the cheap way to satisfy it
is the one that makes the gate worthless.

**Verdict: the two deleted suites are a deletion of the subject, not a weakening
of a judge. `journal_record_hook.test.ts` is a different case and is net
STRONGER. One residual is real and is recorded below rather than smoothed away.**

## 1. What the council reviewed, and what it did not

Round 5 ran on 2026-10-14, one invocation, two subscription CLI seats, $0,
quorum 2/2 after the run. Recorded at
`agents/evidence/ratifications/drain-what-was-built-never-ran-20261013.md`
§ Round 5. Both seats approved; neither refused. Quoted rather than paraphrased:

- **anthropic/claude-sonnet-4-5 — `ratified`.** "The commit faithfully executes
  a converged two-seat council's dated kill criterion ... The hook-plumbing
  changes are surgical: only `run-continuation` is removed from the manifest,
  registry, latency budget, and policy comments. No other concern is touched,
  weakened, or renumbered."
- **openai/codex-default — `confirmed-non-expanding`, approving, and the
  qualifier is load-bearing.** "With 39 changed files but only four source
  excerpts shown, this seat can confirm non-expansion of the reproduced
  plumbing, not ratify the complete commit."

**The council did not see the test deletions as such, and this artifact does not
let the round-5 approval imply that it did.** The four excerpts appended to the
round-5 prompt are named in that record: `src/scripts/hook_manifest.yaml`,
`src/config/hook-latency-budget.json`, `src/scripts/hooks/concern_failure_policy.ts`,
`src/scripts/hooks/concern_registry.ts`. No test file was among them. The seat
that declined the stronger label declined it on exactly this ground. The
ratification is evidence about the plumbing removal; the number in the gate's
message is one nobody on the council looked at. That is what this review is for.

## 2. Why 265 is a deletion of the subject

The concern `run-continuation` was withdrawn on its own pre-registered kill date
(`road-to-what-was-built-and-never-ran` Phase 4, executing a criterion a
converged two-seat council set on 2026-09-12). Measured on the tree at
`f72d12d0f`, not asserted:

| Claim | Command | Result |
|---|---|---|
| no manifest definition or binding | `grep -c 'run-continuation\|run_continuation' src/scripts/hook_manifest.yaml` | `0` |
| no generated-manifest entry | same over `src/scripts/hook_manifest.json` | `0` |
| no registry entry | `grep -c 'run.continuation' src/scripts/hooks/concern_registry.ts` | `0` |
| the hook script is gone | `ls src/scripts/hooks/run_continuation_hook.ts` | no such file |

Both deleted suites import from `src/scripts/hooks/run_continuation_hook.js`, so
neither can compile against this tree at all. They are not tests that were
loosened; they are tests whose unit of test no longer exists.

Per suite:

- **`tests/hooks/run_continuation_dispatch.test.ts` (167, 1,373 lines, 33
  cases).** Every one of its three `describe` blocks names the concern:
  "chain order in the shipped manifest", "driven through the live dispatcher",
  "the premise rung, through the live dispatcher". There is no non-subject
  residue to argue about — the suite's entire subject is a concern that is no
  longer bound on any host.
- **`tests/scripts/hooks/run_continuation.test.ts` (97, 687 lines, 55 cases).**
  Mostly hook internals. Four of its exported symbols — `refusedThisTurn`,
  `extractVerify`, `scanOpenSteps`, `stateRelPath` — do not exist anywhere in
  `src/` after this diff (`grep -rn 'export function <sym>' src`), so their cases
  died with their definitions. The ladder cases are the interesting half and are
  treated in § 4.

## 3. `journal_record_hook.test.ts` is the other case entirely

One assertion net-removed, and it is a counting artifact. The whole change:

```diff
-    it('run-continuation still ends the claude stop chain', () => {
+    it('journal-record still ends the claude stop chain', () => {
         const names = _resolve_concerns(manifest, 'claude', 'stop').map((c) => c.name);
-        expect(names[names.length - 1]).toBe('run-continuation');
-        expect(names).toContain(CONCERN);
+        expect(names[names.length - 1]).toBe(CONCERN);
     });
```

Two assertions became one, so the gate counts `-1`. But `toBe(CONCERN)` on the
last element **implies** `toContain(CONCERN)` and additionally pins the position
that mere membership left free. The surviving assertion strictly subsumes the one
it replaced, and the dropped half asserted the position of a concern that no
longer exists. The case asserts MORE about `journal-record` than it did before.
A gate counting `expect` calls cannot see that; a reader can, which is the
division of labour this artifact exists to perform.

## 4. What would falsify the verdict, and the one thing that nearly does

The falsifier stated in advance: an assertion among the 265 that tested something
OTHER than the withdrawn concern and now tests nothing. It was searched for by
taking every symbol the deleted suites imported, locating its definition on this
tree, and grepping the surviving test corpus for it.

**One hit, and it is real.** `run_continuation.test.ts` § "the dependency-halt
WIRING, not only the rung" — four cases, six assertions — tested
`readUnavailableDependency`, which is defined in
`src/scripts/_lib/loop_guards.ts:210` and **survives this diff**. Its sibling
`tests/lib/loop_guards.test.ts` covers `detectUnavailableDependency`,
`matchesWholeLine`, `stallSignal` and `atomicWriteJson` — not the reader. So
after this diff `readUnavailableDependency` has zero test coverage.

The deleted docblock makes this sharper than a coverage statistic, and it is
quoted because it indicts the deletion in its own words: the reader exists
*because* the inline version referenced a constant that did not exist, the read
sits in a `catch` that fail-opens to `null`, "so the ReferenceError was swallowed
on every fire and the rung was dead while every pure-ladder assertion stayed
green. A decision function cannot observe a caller that never computes its
input." The test that caught that class of defect is the one being deleted.

**It does not falsify the verdict, and the reason is checkable rather than
rhetorical: the function it protected is now unreachable.** On `origin/main`,
`_lib/loop_guards.js` had two importers in `src/`, and the only consumer of the
reader was `hooks/run_continuation_hook.ts`. After this diff:

| Export | `src/` consumers after this diff |
|---|---|
| `readUnavailableDependency` | none |
| `detectUnavailableDependency` | none |
| `matchesWholeLine` | none |
| `stallSignal` | `_lib/loop_surfaces.ts` |
| `atomicWriteJson` | `_lib/context_observation.ts` |

Untested behaviour that nothing calls is not a coverage gap; it is dead code with
an honest coverage report. The correct reading is that the deletion was right and
left a residue, not that the deletion was wrong.

**The ladder itself keeps its coverage, so the larger half of § 2's residue is
not a gap at all.** `_lib/continuation_ladder.ts` survives and
`tests/e2e/adversarial-verification-fixtures.test.ts` imports `ladder`,
`terminalStateFor`, `HALT_ACTIONS`, `TERMINAL_STATE_BY_ACTION`, `MAX_ITERATIONS`,
`WALL_CLOCK_CAP_MS`, `deliveryBlocksCompletion` and `DELIVERY_STATES` from it,
calling `ladder(` 15 times — including two assertions on
`halt-dependency-unavailable`, the exact rung the deleted wiring cases fed. One
ladder export loses coverage with the suites: `parseHaltStamp`.

## 5. Residual, recorded rather than fixed

`_lib/continuation_ladder.ts` (340 lines) had exactly one production importer on
`origin/main` — the deleted hook — and has none now; it is reached only from
`tests/e2e/adversarial-verification-fixtures.test.ts`. Together with the three
orphaned `loop_guards` exports above, this diff leaves a module and four exported
functions that no shipped path calls.

Not removed here, and the boundary is stated rather than assumed.
`minimal-safe-diff` § Own-orphan cleanup makes an identifier an own-orphan only
when **no** reference survives in a file the diff did not touch; a reference to
the ladder survives in an e2e test this diff did not touch, so the module is not
one. `readUnavailableDependency` has no surviving reference at all and is an
own-orphan by that test — but removing an exported function from a `_lib` module
is a public-surface change of ~40 lines, outside the five fix-now conditions
`active-remediation` sets, so it is surfaced for a decision instead of taken
silently at the end of a gate-clearing lane. Retention was also a council-checked
property of this change: the round-5 record names
`_lib/continuation_ladder.ts` (340 lines) among the artifacts deliberately kept.
A follow-up that deletes it is a separate decision about whether the ladder has a
successor, which is precisely the question ADR-118 and the parked roadmap were
kept to answer.

## 6. Did writing this change the view of any deletion

Yes, on one point, and in the direction of recording a cost rather than reversing
a call. Before the symbol-by-symbol sweep the three files read as one homogeneous
"the concern is gone, its tests go with it". They are three different cases: two
clean subject deletions, one net-strengthened case the gate miscounts as a loss,
and a six-assertion block whose subject survives and is now both untested and
uncalled. No deletion is restored, because no restored test would assert anything
about a path this tree can still execute.

## Independence

Written by the lane that is closing the gate it discharges, which is the same
evaluator-independence risk the round-5 record states about itself. It is not
removed by saying so. What is offered against it instead: every claim above is a
command or a quotation, the falsifier was named before it was searched for, the
one hit against the verdict is reported with the deleted docblock that argues
hardest for it, and the residue is left open rather than closed by assertion.
