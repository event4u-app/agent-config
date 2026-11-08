---
proposed_by: claude-opus-5-5
implemented_by: claude-opus-5-5
reviewed_by: ai-council
subject: 20ac7e5eedb06592f158a4a1886395e9d2349be8cf131aa2e91a0b07fb6cd084
providers: [anthropic, openai]
verdict: refused
seats:
  anthropic: refused
  openai: refused
effective_after: merge
---

<!-- evidence-type: ratification -->

# Modification review

Raise the quota_notice lazy chunk ceiling from 41,000 to 49,400 B for the Phase 7 hardening of the agent-switch switch question (back-off, expiry, ordered checkpoint, record lock). Council rounds 1-6 refused (both seats, dealbreaker); each round's defect was fixed and the next round found a deeper edge case. Merged on the owner's word per ADR-282 with the question made opt-in (AGENT_CONFIG_SWITCH_QUESTION=1, D5); residual findings carried into Phase 8 of road-to-a-link-with-agent-switch.

Verdict `refused`, derived from each seat's stance line; the prompt every seat answered is `agents/evidence/council/agent-switch-hardening-ratification-r6-20261108.question.md`, committed at `17eadefe1eada574af0df120943364109ca2624a` and naming this record's subject.

What this record does not establish: that a council produced the session it was rendered from. That file is the caller’s and council output is not kept, so on that point this record is exactly as trustworthy as a typed one. What it does establish is that the header says no more than the replies below, and that the prompt showed this content.

## Each seat, verbatim

### anthropic — `refused`

```text
## Independent Assessment

**1. Honest assessment: DISAGREE (refuse ratification)**

The change does not actually solve the ordering problem that caused round 5's refusal. The locking mechanism is fundamentally flawed: it can allow an older checkpoint to overwrite a newer one despite the added critical section.

**2. Strongest argument for refusal:**

The `locked()` function breaks any lock older than 2 seconds based on mtime, but the checkpoint write happens *inside* that lock via the `write()` callback. Timeline of the race:

1. Stop A: acquires lock, begins `write()` (checkpoint build + write to disk)
2. Stop A: pauses >2s (GC pause, slow disk I/O, CPU scheduling)
3. Stop B: sees stale lock (mtime >2s), breaks it, acquires new lock  
4. Stop B: writes newer checkpoint (snapshot N+1), releases lock
5. Stop A: resumes, finishes writing older checkpoint (snapshot N)
6. Stop A's finally: checks token before releasing lock — **but the write already happened**

The token check (`if (fs.readFileSync(held, 'utf-8') === token)`) only prevents the old holder from removing the new holder's lock file. It does not prevent Step 5. The write is not guarded by a second token check, so a preempted holder that resumes after being evicted can still complete its write operation.

The test `'the checkpoint is written while the record lock is held'` checks `fs.existsSync(held)`, which proves lock presence, not exclusive ownership. A stale lock broken by another process still exists from the old holder's perspective until cleanup.

This reproduces the round 5 dealbreaker: an older snapshot can replace a newer one, which is listed as a rollback criterion in `agents/evidence/metrics/agent-switch-link-latency-20261108.md`.

**3. Strongest counter-argument the developer should consider:**

Perhaps the proposal intends ordering to be best-effort rather than guaranteed, given the explicit disclosure that "the lock is advisory" and "its stale break is a check followed by a removal, so two breakers at the same instant can remove a fresh lock." If write operations complete in well under 2 seconds in normal operation, ordering violations may be rare enough to accept.

However, the proposal lists "an older snapshot over a newer one" as a rollback criterion and describes the round 5 fix as "the checkpoint is now built and written while the record lock is held, and a Stop that finds it completed meanwhile does not write." This frames ordering as a guarantee, not a best-effort attempt.

**4. Concrete next steps (since I refuse):**

**If ordering must be guaranteed:**
- Add a deterministic concurrency test: suspend Stop A mid-write for >2s (simulated slow disk), let Stop B acquire the stale lock and write checkpoint N+1, then resume A. Assert that A's write of N either fails or is no-op, never overwrites N+1.
- Strengthen the mechanism: check the token immediately before every write, not just before lock cleanup. Or use atomic compare-and-swap semantics (write only if current content matches expected prior state). Or use generation numbers in checkpoints and reject writes with generation ≤ what's on disk.
- Alternative: serialize through a coordination service or use filesystem primitives that guarantee exclusive access even across stale-break scenarios.

**If ordering is best-effort:**
- Remove "an older snapshot over a newer one" from rollback criteria
- Document the ordering as best-effort in the contract
- State the expected frequency of violations (bound by how often writes exceed 2s)
- This would still be a weaker guarantee than round 5 asked for

**On the budget increase:**
The 41,000 → 49,400 byte ceiling raise is disclosed but it is the implementer raising their own threshold. Even if the implementation were correct, this two-provider review exists precisely to check such changes. The +20.5% increase should be justified independently of whether the code is correct.

**Separate concerns:**
- The consent gaps (auto mode, repeat calls) remain unaddressed
- Back-off and expiry features appear sound but are entangled with the flawed locking
- The record keeping (done-until-checkpointed) adds complexity that relies on the locking being correct

---

**STANCE: refused | CONFIDENCE: high | DEALBREAKER: yes**
```

### openai — `refused`

```text
1. **Assessment: mixed; refuse ratification as presented.** I agree with Reviewer A’s central finding: round 6 improves ordinary serialization but does not establish the checkpoint ordering guarantee it claims. The disclosed budget increase is a separate, reviewable relaxation; it is not my dealbreaker.

2. **Strongest argument: a live writer can lose its lock and still publish.** In `locked()`, any lock older than `LOCK_STALE_MS = 2000` can be removed. In `checkpointBeforeMove()`, `write()` runs inside that revocable critical section without fencing against another holder. Stop A can pause during checkpoint construction, Stop B can evict A and publish, and A can resume and overwrite B’s newer checkpoint. Checking the token during release protects lock cleanup, not checkpoint publication. I agree with Reviewer A that the new lock-existence test does not exercise this failure.

3. **Strongest counter-argument: the guarantee might reasonably be best effort.** The proposal discloses stale-lock races, and filesystem-only work likely makes long critical sections uncommon. That supports accepting a practical mitigation if occasional ordering failures are explicitly acceptable. However, “two Stops write in order” and the stated rollback criterion establish a stronger expectation. Disclosure alone does not satisfy it.

   One refinement to Reviewer A: the proposed suspension test must actually overlap two processes. The supplied reentrant callbacks and lock-presence assertion cannot establish interprocess exclusion.

4. **Concrete next steps and additional findings:**

   - Add the deterministic two-process stale-holder test Reviewer A proposes, including simultaneous stale breakers. Require the older writer to be unable to replace the newer checkpoint.
   - Use serialization that cannot evict a live publisher, or publish immutable checkpoint generations with an ordering mechanism that prevents readers from selecting an older generation. A token check immediately before replacement is insufficient.
   - **New finding: persistence success is conflated with callback execution.** `updateSwitchRecord()` reports lock acquisition and callback execution; callers set `turn.said` and `wrote.done` before persistence is established. The supplied diff omits `writeSwitchRecord()`’s implementation. If it suppresses write failures, an emitted line can repeat, a newly raised request can become untracked, and a completed checkpoint can remain marked owed. Verify its failure contract and test these cases explicitly.
   - **New finding: cross-hook failure ordering is weaker than the description.** `noteCalls()` folds each hook’s aggregate tally when that hook finishes. Overlapping hooks therefore apply resets and failures in hook-completion order, which need not match individual call-completion order. Define the intended semantics and test an answering hook overlapping a failing hook.
   - Keep the consent gap separate and explicit: the described default-mode first-use prompt does not establish per-call consent. This patch neither supplies that boundary nor closes the documented bypasses.

STANCE: refused | CONFIDENCE: high | DEALBREAKER: yes
```
