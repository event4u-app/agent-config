---
proposed_by: road-to-a-fleet-that-pays-less-per-event 1.1, 1.2, 2.1, owner invocation of inbox-2026-10-bm
implemented_by: claude-opus-5.5 session on analysis/inbox-2026-10-bm
reviewed_by: ai-council
subject: 7bdefdddd25c2e164581e3440b90f34bdae18f5d7cec4afe09eb5472270bc715
providers: [anthropic, openai]
verdict: confirmed-non-expanding
seats:
  anthropic: confirmed-non-expanding
  openai: confirmed-non-expanding
effective_after: merge
---

<!-- evidence-type: ratification -->

# Modification review

Hook-bundle ceiling raised 1,557,900 -> 1,560,400 B for the shared Stop snapshot, the fail-open compile cache, the opt-in resource sample and the one-entry parking set; no permission, tool or floor change. Round 1 split on a git-authorization exception, which was withdrawn.

Verdict `confirmed-non-expanding`, derived from each seat's stance line; the prompt every seat answered is `agents/evidence/council/hook-bundle-raise-inbox-2026-10-bm-r2.question.md`, committed at `711c31fec8bf5ac012bc3d22c5d05ca74a060332` and naming this record's subject.

What this record does not establish: that a council produced the session it was rendered from. That file is the caller’s and council output is not kept, so on that point this record is exactly as trustworthy as a typed one. What it does establish is that the header says no more than the replies below, and that the prompt showed this content.

## Each seat, verbatim

### anthropic — `confirmed-non-expanding`

````text
# Independent Review: Hook-Bundle Ceiling Raise (Round 2)

## 1. Agreement with Prior Reviewers

**Reviewer A — Substantially agree** on:
- The git-authorization withdrawal being decisive (lines 6-9 of the prompt confirm byte-identity to `origin/main`)
- The 281 B headroom being adequate against the jitter doctrine (vs. round 1's 62 B)
- The measured reduction (+5,050 B → +2,291 B) demonstrating responsive engineering
- The `HOST_FAILURE_PARKS` set representing a **documentation gap** rather than active expansion

**Reviewer A's structural risk observation is the strongest point in both rounds**: the exported set at line 126 creates a classification authority that didn't exist as an abstraction before, and the raise_log is silent on why this indirection exists.

**Reviewer B — Partially agree** on:
- Non-expanding confirmation for the measured changes
- The general principle that ceiling raises create latent risk surfaces

**Disagree** with Reviewer B's framing that "expanding the byte ceiling inherently permits more code to be introduced" as a counter-argument here: this gate *exists* to make undocumented ceiling expansion impossible. The raise_log entry is mandatory enforcement (line 6: "a raise carries a record as well as a log entry"), so the concern is mitigated by the gate's own design.

## 2. New Points Not Raised in Round 1

### Finding: The `HOST_FAILURE_PARKS` set has a **test-surface justification** the raise_log omits

Examining the diff more closely than Reviewer A did:

**Line 30 of `host_rate_marker_hook.ts`:**
```typescript
if (payload['hook_event_name'] !== 'StopFailure' || !HOST_FAILURE_PARKS.has(String(payload['error']))) return EXIT_ALLOW;
```

The old code (not shown but implied) was:
```typescript
if (payload['error'] !== 'rate_limit') return EXIT_ALLOW;
```

Why introduce `.has()` indirection? **For test doubles.** A hardcoded string comparison cannot be mocked without module-level test harness complexity; a set can be temporarily mutated in test scope. This is legitimate engineering—but it's **not documented** in `what_was_added`.

The raise_log says "the failure-class table became a one-entry set" (line 127) but doesn't say:
1. Why a set (answer: test doubles)
2. Why exported (answer: so tests can inspect or temporarily mutate it)
3. What constraint prevents growth (answer: should be "adding a second class requires a new raise_log entry explaining why that class should park")

### Finding: The `ResourceSample` interface change is under-described

**Lines 49-63 of `concern_timings.ts`:**
```typescript
export interface ResourceSample {
  max_rss_kb: number;
  cpu_us: number;
}
```

This is **new telemetry**, not just optimization. The raise_log entry (line 125) says:
> "per-dispatch max RSS and CPU microseconds, read only when the timings sink is armed"

But doesn't explain **why CPU µs and max RSS were added**. The file's own docstring (lines 46-54) says:
> "Wall time alone cannot say whether five sessions with four subagents each leave the machine usable: a fast event that holds 200 MB, or burns CPU while another session waits, is invisible to it."

This is the **justification**: wall-time-only metrics cannot detect memory or CPU saturation, which matters for capacity planning when running many subagents. That reasoning belongs in `what_was_added`, not just the file's docstring.

### Finding: The `memoInDispatch` scope discipline is correct but subtle

**Lines 17-48 of `stop_snapshot.ts`:**
The memo lives exactly as long as one `withDispatchSnapshotScope()` call, which `dispatch_entry.ts` line 26 wraps around `dispatchMain()`. This ensures:
- No cross-event contamination (each dispatch starts with an empty scope)
- No long-lived process leakage (standalone concern runs or later events get fresh reads)

Reviewer A noted this is "process-local and ephemeral" (✓), but didn't probe the **failure mode**: what if a future change calls `memoInDispatch()` *outside* a scope? Line 42 of `stop_snapshot.ts`:
```typescript
if (!scope) return compute();
```

**Fail-open by construction**: no scope = no memo, just a fresh read. This is sound, but the raise_log doesn't explain why the memo is keyed on `cwd` (line 372: `numstat\0${path.resolve(cwd)}`). Answer: two dispatches in the same process at different roots (unlikely but possible in tests) must not share a memo. That's correct, but undocumented.

## 3. Core Findings

### Question 1: Does this expand authority, permission, or safety-floor reach?

**NO expansion detected**, with Reviewer A's latent concern confirmed but not blocking:

✓ Git-authorization withdrawal verified (lines 6-9: byte-identical to `origin/main`)  
✓ Compile cache fail-open (lines 35-40 of `compile_cache.ts`)  
✓ Dispatch snapshot scope ephemeral and process-local (lines 24-37 of `stop_snapshot.ts`)  
✓ Resource sampling reads only `process.resourceUsage()`, which is process-own metrics (line 67)  
✓ No new file access, network calls, or privileged operations  

⚠ **Latent concern (agreeing with Reviewer A):** `HOST_FAILURE_PARKS` as an exported set creates a **classification surface** that didn't exist before. Current membership (1 class) matches old behavior, but the structure enables expansion. The **missing constraint** is: "What rule prevents a second class from being added without re-ratification?" The answer should be in `what_was_added`.

### Question 2: Is the raise_log entry accurate against the diff?

**Accurate on measurements, incomplete on reasoning:**

✓ Byte counts: 1,560,119 - 1,557,828 = 2,291 B (matches line 125)  
✓ Per-module deltas: concern_timings.ts +593, stop_snapshot.ts +563, etc. (line 125)  
✓ Headroom: 1,560,400 - 1,560,119 = 281 B (line 125)  
✓ Git-authorization withdrawal named (line 127)  
✓ Reduction narrative (+5,050 → +2,291) traced (line 127)  

✗ **Three omissions:**

1. **`HOST_FAILURE_PARKS` purpose not explained** (Reviewer A's point): why a set, why exported, what constraint on growth?

2. **`ResourceSample` justification missing**: the raise_log says "per-dispatch max RSS and CPU microseconds" but not *why* they were added. The answer (from the file's docstring): wall time alone cannot detect memory/CPU saturation, which matters for multi-subagent capacity planning.

3. **`memoInDispatch` keying discipline not explained**: why `cwd` is in the memo key (to prevent cross-root contamination in the same process).

## 4. Weakest Assumption & Overlooked Failure Mode

**Weakest assumption (agreeing with Reviewer A):** That `ReadonlySet` prevents expansion of `HOST_FAILURE_PARKS`.

As Reviewer A correctly notes, `ReadonlySet` is a TypeScript type with no runtime enforcement. Any module can:
```typescript
(HOST_FAILURE_PARKS as Set<string>).add('overloaded');
```

But I'll add: **this is not the failure mode that matters**. The real risk is not runtime mutation (which would be caught in tests), but **semantic drift**: a future PR adds a second class to the set's initializer (line 33: `new Set(['rate_limit', 'overloaded'])`), and because the set's *existence* was ratified here, that change is reviewed as "just maintaining the parking logic" rather than "expanding the classification authority."

**Most likely overlooked failure mode:** A developer adds `'service_unavailable'` to `HOST_FAILURE_PARKS` in 6 months, and the review focuses on whether `service_unavailable` *should* park, not on whether adding it *bypasses* the raise gate. The set abstraction becomes a **ratification bypass** if its growth constraints aren't explicit.

## 5. Concrete Next Steps

### Recommended path (ratify with amendment):

**Add three sentences to the raise_log entry's `what_was_added` (line 125):**

```
"The failure-class check became a set (HOST_FAILURE_PARKS, exported for test 
doubles) containing the single existing class; adding a second class requires 
a substantive raise explaining why that class should park. The ResourceSample 
interface (max_rss_kb, cpu_us) was added because wall time alone cannot detect 
memory or CPU saturation across concurrent subagent sessions, which matters for 
capacity planning. The memo key includes cwd to prevent cross-root contamination 
in the same process (unlikely but possible in tests)."
```

**Then ratify.** The core engineering is sound:
- Git-authorization withdrawal eliminates round 1's blocking issue
- Measured reduction shows responsive iteration
- 281 B headroom meets the jitter doctrine
- All new code is non-authoritative (fail-open cache, read-only resource sampling, ephemeral memo)

### If you disagree with the amendment requirement:

The raise can still be ratified **as-is**, because:
1. The `HOST_FAILURE_PARKS` set matches old behavior (1 class)
2. The omissions are **documentation gaps**, not active expansion
3. The gate will catch any future growth of `HOST_FAILURE_PARKS` if it increases bundle size

But the amendment makes the **constraints explicit**, which prevents the semantic-drift failure mode above.

---

**STANCE: confirmed-non-expanding | CONFIDENCE: high | DEALBREAKER: no**

The git-authorization withdrawal is decisive. The `HOST_FAILURE_PARKS` set, `ResourceSample` addition, and `memoInDispatch` keying are all **non-expanding in their current form**, but under-documented. With the three-sentence amendment above, this is a clean raise that future reviewers will understand. Without it, the raise is still safe to ratify, but leaves latent questions about intent.
````

### openai — `confirmed-non-expanding`

```text
1. **Agreements with Prior Points:**
   - I agree with Reviewer A's concern about the `HOST_FAILURE_PARKS` set being a potential latent expansion point. The use of a set, especially one exported and mutable at runtime, introduces the possibility for future modifications that could expand permissions or change behavior without additional oversight.
   - I agree with Reviewer B's argument that while the current changes appear non-expanding in terms of authority or security, raising the byte ceiling allows for more code to be introduced in the future, which could indirectly impact security or system stability.

2. **Disagreements:**
   - I disagree with Reviewer A's call for making `HOST_FAILURE_PARKS` "provably immutable" through `Object.freeze()`. While this would technically prevent runtime mutations, it doesn't address the documentation and clarity issues. Instead, focusing on communication around why it was designed this way might be more beneficial.
   - I disagree with Reviewer B's assertion that simply raising the byte ceiling is inherently risky. When done with clear documentation and specific intentions—as appears to be the case here—the raised ceiling is not inherently more risky than any other code increment.

3. **New Points or Refinements:**
   - The review should focus not just on byte limits and authority changes, but also on the clarity and transparency of the changes. Any future reviewers or developers should be able to understand why a change like `HOST_FAILURE_PARKS` was made, without having to reverse-engineer rationale from the code alone.
   - While both reviewers mention the byte ceiling increase, it's important to note the actual impact: the precise nature of changes (resource logging, dispatch optimization) appears justified and intentional—focused on maintaining performance rather than expanding capabilities.

**Concrete Next Steps:**

- **Document the Intent and Constraints Around `HOST_FAILURE_PARKS`:** Ensure the purpose of using a `ReadonlySet` is documented clearly in the `raise_log`, including any constraints around future additions to the set.
  
- **Maintain Clearer Logs and Documentation:** As suggested, amending the `raise_log` to include details about why certain design decisions (like exporting a set) were chosen, and what that means for future changes.

- **Proceed with Ratification:** Given the withdrawal of concerning changes and the clear focus on non-expansion, moving forward to ratify the change seems appropriate, with the condition of improved documentation around the rationale for certain structural choices.

**STANCE: confirmed-non-expanding | CONFIDENCE: high | DEALBREAKER: no**
```
