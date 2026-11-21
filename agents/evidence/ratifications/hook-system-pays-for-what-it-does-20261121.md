---
proposed_by: agent:claude-opus-5-5
implemented_by: agent:claude-opus-5-5
reviewed_by: ai-council
subject: e2ff87c27670ee065ae775cde3ac275acac9d85e6e8e32f6c9fc89572ed3b8a2
providers: [anthropic, openai]
verdict: refused
seats:
  anthropic: ratified
  openai: refused
effective_after: merge
---

<!-- evidence-type: ratification -->

# Modification review

Round 25 over the five gated files of the hook-system change (budget allowlist and backstop, concern-env scope, feedback policy), at the post-merge head.

Verdict `refused`, derived from each seat's stance line; the prompt every seat answered is `agents/evidence/council/hook-system-pays-ratification-r25-20261121.question.md`, committed at `2b47d6e1de5131bc381c38f79b513a37bc63020d` and naming this record's subject.

What this record does not establish: that a council produced the session it was rendered from. That file is the caller’s and council output is not kept, so on that point this record is exactly as trustworthy as a typed one. What it does establish is that the header says no more than the replies below, and that the prompt showed this content.

## Each seat, verbatim

### anthropic — `ratified`

````text
## Prior Points: Agreement and Disagreement

### What I agree with (Reviewer A)

1. **Round 24 closure assessment** - Agree fully. D1 explicitly names "per-chunk and chunk-group ceilings end", `update_json_under_lock` has an airtight return contract (no throws escape), all four conditions are met with concrete evidence.

2. **The package allowlist is the right control** - Strongly agree. The incident (95KB YAML parser) was a *dependency* problem. The old per-chunk ceilings caught it only as a side-effect (size jumped somewhere). The allowlist catches it by name at commit time, which is earlier, more specific, and can't be masked by one chunk's headroom hiding another's growth.

3. **The monitoring obligation needs an owner** - Critical point. The budget file says `"owner": "maintainer"` and `max_bytes_note: "look at what grew before moving the number"` but doesn't connect them. WHO investigates when it trips? Do they have authority to hold a release? What's the escalation path if "what grew" is contentious? This needs to be written down before merge.

### What I disagree with

Nothing material. Reviewer A's analysis is sound. The concern about 20% headroom trading proactive for reactive is valid, but I weight it differently: the allowlist handles the incident case (dependency addition), and D1 explicitly chose "real headroom" for own-code growth, which is the legitimate path ("what features are", per the budget comment).

---

## New Points and Refinements

### 1. The environment recovery system adds state but buys real robustness

The old system: save, harden, restore, per concern. Simple. The new system (covered by 15 tests): scope lifecycle, drift detection, failed-restore recovery across dispatches, re-entrant dispatch handling, pending-restore tracking. This is MORE stateful but handles failure modes the old system didn't:

- A failed restore between concerns marks the scope; next concern refuses to start until it's repaired (throws if it can't → dispatch gives no verdict → host command refuses).
- A failed closing restore is paid by the NEXT dispatch in the same process (`pendingRestore`, cleared by `recoverConcernEnv()`).
- A half-applied scope open (hardening threw) must roll back; if rollback fails, `pendingRestore` is set and the next scope pays it.
- A release that outlives its scope (scope closed while concern's cleanup ran) does nothing — no stale overwrites.

This is not a guard weakening; it's a guard *strengthening*. The old system's failure mode was "restore failed, now what?" and the answer was "process is dirty". The new system makes that recoverable.

**The test names confirm it:** "a failed close during an error in flight is recovered by the next dispatch in the same process", "when the owed restore still cannot be made, the next scope refuses to open". These are real scenarios the old system left unhandled.

### 2. The feedback write change has a correct but subtle dependency

```ts
summaryWritten = update_json_under_lock(...) === "written";
for (const entry of entries) {
  if (summaryWritten && isQuietAllow(entry)) continue;
  // write per-concern file
}
```

If summary write fails, ALL entries get their own file, even quiet allows. This is correct (don't silently lose outcomes) but means one summary failure → 15-20 extra writes. Not a safety issue — the right fail-open behavior — but worth noting: a filesystem hiccup on one file causes fan-out to many files. The old system had the same risk (every concern wrote every dispatch) but now it's conditional, so the failure mode is "fall back to old behavior".

### 3. The composition checker is load-bearing but not gated

The budget file (gated) defines the allowlist. The checker (not gated) enforces it. The asymmetry is defensible:
- The checker runs in CI (`consistency.yml` shows it)
- It's the only reader of the budget file
- Changing the checker would be caught by other gates (test changes, build changes)

But there's a theoretical gap: someone who could modify the checker without triggering other gates could bypass the allowlist. Mitigation: the checker is simple (shown excerpts), and the budget file's `_comment` explicitly says "Read by src/scripts/check_hook_bundle_composition.ts", so a future reader knows what enforces it.

**Recommendation:** Add `check_hook_bundle_composition.ts` to the ratification gate's watched set. It's the enforcement side of a gated control.

### 4. The 20% backstop is generous but time-bound

Current: 1,595,089 B. Backstop: 1,915,000 B. Headroom: 319,911 B. That's 3.3× the YAML parser incident. But:
- D1 explicitly chose "real headroom" (not stingy)
- The budget file says `"review_by": "2027-10-01"` — a year from D1's date
- The `max_bytes_note` says "when it does [fire], look at what grew before moving the number"

This is a one-year experiment: if the backstop never fires, maybe it's too loose; if it fires quarterly, maybe 20% was right; if it fires weekly, something else broke. The time-bound review is the monitoring control.

### 5. The LatestRun type change is a pure type-level fix

```ts
-export interface LatestRun {
+export type LatestRun = {
```

This fixed a typecheck failure: `update_json_under_lock<JsonObject>` takes a mutator that returns `JsonObject | null`. The mutator calls `withLatestRuns()`, which returns `Record<string, LatestRun>`. In strict mode, an interface (even a pure data interface) isn't assignable to `Record<string, X>` because interfaces can have index signatures or callable signatures. A `type` alias is. No runtime change, just satisfying the type checker.

---

## Round 24 Points: Closed

1. **D1 coverage** — Yes. D1 explicitly names "per-chunk and chunk-group ceilings end" and "one overall ceiling with real headroom". Unambiguous.
2. **Exception escape** — No. `update_json_under_lock` returns `LockedUpdateResult` (a three-literal union) from every path; the shown code has an outer `try { … } catch { return "failed"; }` around everything after lock acquisition.
3. **Conditions** — All four met. The budget note exists, test names cover the env recovery, the return type is restricted, the checker enforces the allowlist.
4. **Retired limits count** — Not safety-critical. Both seats agree multiple limits retired.

## Weakened Guards or Expanded Authority?

**Guards:**
- Environment isolation: strengthened (recovery across dispatches, half-applied rollback, release-after-scope protection).
- Feedback concurrency: unchanged (still locked writes, now with keep-newer semantics).
- Bundle composition: the allowlist is a *better* control for the incident than per-chunk ceilings (catches dependencies by name, not size). The backstop is wider (20% headroom) but D1 chose it.

**Authority:** None expanded. No new concerns, no new permissions, no new external calls. Just internal refactoring.

## Basis Beyond D1?

D1 says "one overall ceiling with real headroom" and "per-chunk and chunk-group ceilings end". That explicitly covers the relaxation. Under ADR-268 § 4, an owner directive that names the change IS sufficient basis.

**But:** The control works only if the monitoring obligation has an owner. The budget file says `"owner": "maintainer"` and `max_bytes_note: "look at what grew"` but doesn't connect them operationally.

---

## Concrete Next Step (condition on ratification)

Before merge: document the investigation protocol. Add to the budget file or an adjacent file (e.g., `docs/decisions/hook-bundle-budget-process.md`):

> When `max_bytes` trips, the maintainer investigates within [timeframe]. The investigation identifies which chunks grew and whether growth is feature work (expected), dependency addition (allowlist question), or unexpected. The maintainer has authority to hold a release pending investigation. If the total is justified, `max_bytes` is raised with a summary of what grew. If not justified, the offending code is refactored before release.

Without that, the control is "someone should investigate" with no one named. The ratchet worked because it was automatic (CI fails → you justify). The backstop works only if the investigation happens.

---

STANCE: ratified | CONFIDENCE: high | DEALBREAKER: no
````

### openai — `refused`

```text
## Assessment

**Mixed. Refuse ratification as shown.** D1 expressly authorizes the budget redesign, and the allowlist directly addresses the second-parser incident. The dispatcher diff still leaves an exception path that can prevent delivery of an already-computed hook verdict.

## Where I agree with Reviewer A

- **D1 covers both budget changes.** It calls for “one overall ceiling with real headroom” and explicitly ends the per-chunk and chunk-group ceilings, `shrink_only`, and the `raise_log` obligation. That settles the scope of the owner directive. Whether it satisfies ADR-268 § 4 remains open because § 4 is absent from the evidence. Include the operative clause. If it separately requires two-provider approval for weakening a watched control, that approval is the additional basis.
- **The allowlist targets the incident.** With only `yaml` listed, the checker adds a finding for an unlisted npm package and returns `1` when findings exist. Invalid budget input and build failures also produce nonzero status in the shown branches. The wider aggregate ceiling and removal of chunk ceilings do relax the size policy. The checker still rejects violations of the new policy.
- **The monitoring note and test inventory address the stated conditions at the level shown.** `max_bytes_note` gives the response to a breach, and the test names cover recovery, failed resets, and re-entry. The names establish intended coverage. Test results and the implementation of `unlistedPackages()` would substantiate it. The 18-versus-28 discrepancy is bookkeeping and remains unresolved without the retired file.

## Where I disagree with Reviewer A

**The strongest reason to withhold ratification is the loss of the per-file feedback exception boundary.** In `dispatch_hook.ts`’s `_write_feedback`, the new per-concern `update_json_under_lock()` call is outside a `try/catch`. In `state_io.ts`, `release(held)` runs in `finally`, where an exception can override any pending return, including `"written"` or `"failed"`. `is_replay_mode()` and `path.resolve()` also run before the first catch. `LockedUpdateResult` constrains returned values. The excerpt leaves the no-throw claim unproven. Since `main` invokes `_write_feedback` after `_reduce(rcs)`, an escaping exception can stop normal verdict delivery.

I also disagree that a new monitoring protocol is a ratification prerequisite. The stated condition was a note on what to do when the backstop trips, and the budget file provides one. Reviewer A’s suggested base-branch lookup would retrieve the configured ceiling. A meaningful per-PR size delta needs the measured bundle size at the base revision.

## New points and next steps

- **The environment scope begins after dispatch setup.** `openConcernEnvScope()` inherits the enclosing hardened baseline, which protects inner concern bodies and the explicit child environment once the scope opens. A synchronous nested `main()` still runs argument handling and pre-loop setup with the outer concern’s live environment. `recoverConcernEnv()` only acts when a restore is owed. Verify whether any pre-loop guard, selection step, or child launch reads that environment, and cover an environment-sensitive path through `main()` in the re-entry test. The shown severity reduction, advisory ceiling, and permission-verdict calls retain their logic. The excerpt does not establish broader isolation or show an expansion of concern authority.
- **Restore per-file exception containment and verify verdict delivery.** Keep a caller-side catch around each feedback write, contain failures in the diagnostic path, and test a throwing lock cleanup against a dispatch with a computed block verdict. Confirm that the host receives the original verdict and exit status. Include ADR-268 § 4 in the next review packet so the authorization question can be decided directly.

**The strongest counterargument** is that the feedback concern may be resolved by a small amount of evidence or a small patch. If `release()` and the pre-`try` operations are demonstrably non-throwing for dispatcher inputs, the concrete exception concern narrows substantially. The allowlist already provides a direct check for the dependency addition that motivated the redesign.

STANCE: refused | CONFIDENCE: med | DEALBREAKER: yes
```

## Gain, risk, rollback (stated by the implementer, not by a seat)

- **Gain.** One concern-env scope per dispatch instead of one hardening and restore per concern; quiet allows no longer write a feedback file each when `summary.json` was written; the hook-bundle budget stops blocking own-code growth (owner directive D1) while a new npm package in the bundle stays a red check.
- **Risk.** The size guard is looser: the backstop is 1,915,000 bytes, and the per-chunk ceilings are gone, so creep shows up only at the aggregate. The refusing seat's open point is that the per-concern feedback write lost its caller-side `try/catch`. The code it could not see answers it: `release()` calls `execute(['expire', …])`, which returns `undefined` on any error (`src/scripts/_lib/generation_lock.ts`), and `is_replay_mode()` only reads an environment variable. That answer was not put back to the seat.
- **Rollback.** Revert the merge commit. The retired budget file is kept in git at `2eef08c00b`, and the dispatcher modules are new files with no other importer.
