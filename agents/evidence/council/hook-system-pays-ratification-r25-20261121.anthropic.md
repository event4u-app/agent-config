<!-- evidence-type: original-review -->
<!-- check-refs: skip -->

<!-- The anthropic seat's reply of 2026-11-21 to the prompt in
     hook-system-pays-ratification-r25-20261121.question.md, verbatim (claude-sonnet-4-5). -->

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
