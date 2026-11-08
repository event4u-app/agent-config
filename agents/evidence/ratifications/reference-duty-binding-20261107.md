---
proposed_by: claude-opus-5-5
implemented_by: claude-opus-5-5
reviewed_by: ai-council
subject: 42e651c333f7587c91ce5fca9eccfac45345ca0895e35923d9f4cb2c496fa476
providers: [anthropic, openai]
verdict: ratified
seats:
  anthropic: ratified
  openai: ratified
effective_after: merge
---

<!-- evidence-type: ratification -->

# Modification review

Bind reread-guard on claude post_tool_use (completed cat credited from the tool result, byte-identical, bounded non-blocking read) and claude pre_compact (clears recorded reads), with a capped duty map.

Verdict `ratified`, derived from each seat's stance line; the prompt every seat answered is `agents/evidence/council/reference-duty-ratification-r13-20261107.question.md`, committed at `35b8e05b660453244194c32d5894d7d16bf09b4d` and naming this record's subject.

What this record does not establish: that a council produced the session it was rendered from. That file is the caller’s and council output is not kept, so on that point this record is exactly as trustworthy as a typed one. What it does establish is that the header says no more than the replies below, and that the prompt showed this content.

## Each seat, verbatim

### anthropic — `ratified`

```text
Looking at this pull request through correctness, security, and shipping-risk lenses, starting fresh:

## 1. Behavior changes

**Explicit:**
- Bash added to `reread-guard` tools; `result` added to payload bodies
- `reread-guard` now bound on claude `post_tool_use` and `pre_compact`
- Bash `cat <absolute file>` credited only at `post_tool_use`, after execution completes
- Credit requires: non-zero exit, empty stderr, not interrupted, stdout bytes identical to current file
- Duty map capped at 256 keys; overflow counted
- pre_compact clears reads map

**Implicit:**
- Every Bash post_tool_use triggers regex match + potential bounded read
- Verification opens O_NONBLOCK (FIFOs/devices return immediately, then rejected)
- File replacement during verification detected via inode/device comparison

## 2. Authority boundaries

**Widens:** Hook runs on more events, inspects tool results, reads files during verification.

**Narrows:** Duty map size hard-capped, only regular files verified, 50ms deadline bounds loop, byte-identical match required (not just size), path replacement detected.

## 3. Weakened assertions?

No. All changes tighten constraints. Tests are additive. No thresholds lowered, no tests skipped/deleted. The FIFO test explicitly asserts mkfifo succeeded and path is a FIFO. Deadline checked both in-loop and after final validation.

## 4. Bypass routes?

Binding is claude-specific by design. Advisory nature (fail_closed: false) means no enforcement bypass issue.

## 5. Reversibility

Declarative in manifest YAML. Remove entries to revert. Ledger format forward-compatible. Authority: merge rights. Clean git revert.

## 6. Falsifying observations / Kill-switch gaps

Claims verified by tests. **Gap:** No circuit breaker if duty_errors grows unbounded (though each attempt is bounded). Advisory nature limits impact but CPU waste possible in pathological cases.

## 7. Smaller change?

Could split duty cap / pre_compact / post_tool_use, but these complete one atomic feature. Splitting creates incomplete states.

## 8. Standing instruction weight

Runtime: +0.4-0.8ms per Edit/Write, <0.5% of 250ms budget. Code: ~150 lines. Tests: ~100 lines. **Critical:** Hook bundle 1,584,855/1,585,000 bytes = 145 bytes headroom. Next hook change needs shrink or raise_log first.

## 9. Untrusted content steering?

All inputs validated: stdout length-checked pre-allocation, only regular files, 2MB/50ms bounds, content compared not executed, duty keys capped, ledger corruption handled. No injection vectors.

## Critical finding

Line 345's final `now() > deadline` check after inode validation addresses round 12's concern (successful verification exceeding deadline post-loop). The algorithm is sound:
- O_NONBLOCK prevents FIFO hang
- isFile() rejects devices
- Buffer sized to detect growth (size + 1)
- Size/mtime checked pre and post read
- Inode/device checked to detect path replacement
- Deadline enforced throughout AND after loop

Test coverage comprehensive: FIFO, deadline expiry mid-read, path replacement, truncation, stderr, interrupt, exit codes, byte mismatch all exercised.

---

## Comparison with Reviewer A

**Agree:**
- All behavior changes identified correctly
- Authority boundaries correctly characterized
- No weakening of assertions
- Test coverage is comprehensive
- 145-byte bundle headroom is the real constraint
- Circuit breaker suggestion for duty_errors overflow

**Disagree:**
None. Reviewer A's analysis is accurate.

**New points:**
The bundle constraint should be documented in PR description or TODO so next author knows shrink is required. The circuit breaker is nice-to-have but not essential—advisory nature plus per-attempt bounds prevent blocking, and repeated failures indicate misconfiguration worth investigating rather than silently suppressing.

**STANCE: ratified | CONFIDENCE: high | DEALBREAKER: no**

Highest-leverage change: Add prominent note in PR description that hook bundle is at 99.99% capacity (145B headroom), requiring next hook-touching change to shrink first or add raise_log entry. This is more actionable than the circuit breaker, which is optional given advisory nature and existing per-attempt bounds.
```

### openai — `ratified`

```text
The diff supports **approval with medium confidence**. I see no demonstrated blocking defect, but the supplied tests establish the verifier’s behavior more strongly than they establish its integration with the installed host.

**Prior critique**

- **Agree with Reviewer A:** post-execution credit, byte comparison, regular-file checks, and pruning loaded duty maps strengthen the implementation. The final deadline check fixes the specific late-success path described in round 12.
- **Disagree with Reviewer A’s circuit-breaker recommendation:** `duty_errors` measures duty-computation failures; `_readRegularFileBounded` returns `null` without incrementing it. A breaker based on that counter would not address repeated verification failures. Permanently disabling scanning also sacrifices observation without evidence that its measured cost warrants that tradeoff.
- **Qualify Reviewer A’s coverage claims:** the diff does not prove that tests passed, and coverage is not comprehensive. It shows synthetic envelopes and YAML routing tests, but no installed-host result flowing through payload projection into the ledger.
- **Qualify the scope claim:** the new event bindings are Claude-specific, but `tools: [Read, Edit, Write, Bash]` and `needs_payload_bodies: [input, result]` belong to the shared concern declaration.

1. **Behavior changes and consequences**

   In `main()`, Bash credit moves from pre-execution recognition to `post_tool_use` verification. `recordCompletedCat()` requires matching current bytes, rejects explicit nonzero exit statuses, and accepts an absent exit status. That last distinction should remain explicit: the implementation verifies successful-looking output rather than requiring affirmative exit-zero metadata.

   The manifest activates compaction clearing and completed-cat credit. `boundedDuty()` additionally prunes oversized loaded maps, while `recordDuty()` refuses new keys at capacity.

   The upside is meaningful: legitimate shell reads can satisfy the existing ledger, while compaction removes stale assumptions about retained context. This improves observation without adding another instruction or blocking decision.

2. **Authority and safety boundaries**

   The hook gains access to tool results and more event slots. A recognized command can trigger another filesystem read, including outside the workspace; `_readRegularFileBounded()` imposes no workspace restriction. The requested command already names that path, which limits the incremental exposure.

   Byte equality, regular-file checks, and bounded retained duty keys narrow false-credit and resource-growth paths. The 50 ms deadline does **not** bound total hook execution; the code now states that accurately.

3. **Does it weaken its judges?**

   No silent weakening is visible. The former pre-execution cat test is replaced with a stronger behavioral requirement: no credit before execution, credit after verified output. That is a justified semantic correction.

   The omitted compiled JSON twin prevents checking projection parity here. The reported bundle size and successful test runs are evidence claims, not independently verified results.

4. **Other hosts or projections**

   Other hosts lack the added event bindings, so this remains partial coverage across the advertised tool ecosystem. That is acceptable for a deliberately Claude-scoped advisory feature.

   However, the shared payload declaration deserves inspection across projections. The routing tests exercise YAML resolution, not compiled JSON parity or actual result-body delivery.

5. **Reversibility**

   Maintainers authorized to change gated hook plumbing can remove the added event bindings, restore the concern declaration, regenerate JSON, and ship the rollback. For a clean code rollback, revert this PR’s changes against its merge revision; do not blindly reset the broader work already merged as #2912.

   Removing bindings does not itself remove persisted ledger state.

6. **Falsification and rollback criteria**

   The benefit would be undermined if real successful cats never receive credit, failed/truncated results receive credit, or compaction leaves reads available afterward.

   The measurements omit end-to-end dispatch and result-projection costs. The evidence document also supplies no operational rollback threshold for latency regressions or host incompatibility. Those are useful rollout criteria; a new circuit breaker is not yet justified.

7. **Smaller change and reuse**

   Compaction binding and duty-cap hardening could ship separately. Completed-cat binding needs the verifier to preserve trustworthy credit, making those pieces cohesive.

   The implementation appropriately reuses the existing ledger, key derivation, and dispatcher. Small functions fit this codebase; classes or a generalized verification framework would add speculative structure.

8. **Standing instruction weight**

   No new duty instruction injection is shown. The recurring costs are runtime work, payload availability, ledger writes, and bundle size.

   The reported **145 bytes of bundle headroom** is a concrete maintenance constraint. Also, the Edit/Write scan already exists on main; its full measured cost should not be attributed to this incremental binding change.

9. **Untrusted steering and remaining coverage**

   Commands steer the verification path; stdout steers comparison work. Neither is executed by the added code. The 2 MB cap limits allocation inside verification, but cannot undo result allocation or parsing already performed upstream.

   Highest-value missing coverage is a representative installed-host payload passed through the dispatcher’s real projection path. Additional useful cases are in-place modification during verification and retention of the newest keys when pruning; the current pruning test checks count and overflow only.

**APPROVE** — the visible change is cohesive and strengthens advisory read accounting; the single highest-leverage pre-merge improvement is a dispatcher-level regression test proving a real Claude completed-cat result reaches the ledger through the shipped manifest and payload projection.

STANCE: ratified | CONFIDENCE: med | DEALBREAKER: no
```
