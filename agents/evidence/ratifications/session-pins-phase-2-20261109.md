---
proposed_by: claude-opus-5-5
implemented_by: claude-opus-5-5
reviewed_by: ai-council
subject: 51b092005a2adaea9d7e3b1c33e10ae49c1e18eb5eb757d3db27705b191291e4
providers: [anthropic, openai]
verdict: refused
seats:
  anthropic: refused
  openai: refused
effective_after: merge
---

<!-- evidence-type: ratification -->

# Modification review

Raise the dispatch bundle ceiling 1,585,000 -> 1,594,900 B, add the session-pins
lazy chunk row (34,900 B), raise the subagent-constraints chunk 24,500 ->
28,500 B and the `language-mirror` injection row 2,048 -> 6,144 B, for session
pins captured from `pin:` lines and restored after compaction
(road-to-state-and-pins-across-compaction Phase 2).

Council rounds 1-56 reviewed the change. Round 56 (both seats) objected to one
point: strict pin callers inherited the stale-lock reclaim race of
`hooks/state_io.ts`. Both named the same highest-leverage change, and it was
made after the round, with a test seen red first: a strict caller never breaks
a stale guard (commit `8767ad284f`); the worker-output collection in the
concurrency test moved from `exit` to `close`. The general reclaim race, present
on `main` at five sites, is carried in `road-to-verified-stale-lock-reclaim`.
Not re-reviewed after that fix: step 2.5 of the pins roadmap stays open for a
further round. Merged on the owner's word (2026-11-09) per ADR-282, as with
`agent-switch-hardening-20261108`.

The seats answered in the PR-review vocabulary (`REFUSED`, `REQUEST_CHANGES`),
which the record writer does not read as stance lines, so this record is typed
and its header produced by `ratification_header`; `REQUEST_CHANGES` is recorded
as `refused` (should not merge as reviewed). The prompt every seat answered is
`agents/evidence/council/session-pins-phase-2-20261108.round56.question.md`,
committed at `e11e66c111` and naming this record's subject.

What this record does not establish: that a council produced the replies below.
Council output is not kept, so on that point this record is exactly as
trustworthy as any typed one.

## Each seat, verbatim

### anthropic — `refused`

```text
# Independent Review: Session Pins Phase 2

## Agreement with Prior Reviews

**Reviewer B's lock race (HIGH)**: Fully agree. The stat-then-remove race in `_acquire_lock` is real and unresolved. Two callers can both observe the old stale guard, and while one removes it and creates a new guard, the other removes that *new* guard before it even checks freshness again. Both then succeed at creating their own guards. The strict option only changes the non-EEXIST branch—it does nothing for this window. This directly undermines pin capture (silent overwrites when concurrent prompts race) and restore delivery (exceeding the claimed 3-line bound when both tool and prompt paths deliver).

**Reviewer B's test collection timing (LOW)**: Agree. Collecting on `child.on('exit')` rather than waiting for stdio `close` can yield incomplete output, particularly because the test assertion depends on every worker emitting exactly one of three outcomes.

**Reviewer A's bundle headroom (MEDIUM)**: Agree this is tight (462 B / 0.03%), but it's a maintenance burden rather than a correctness defect. The raise_log shows this breaking on tooling updates before.

**Reviewer A's LOCK_FAILED_NOTE (LOW)**: Partially agree. The constant is *used* in the diff but not *defined* in it, so reviewers can't verify its length against the 6,144 B ceiling. Given 242 green tests, it must exist and compile, but it should be visible in the diff or explicitly bounded.

## Disagreement

**None.** Both reviewers identified real issues. Reviewer A's bundle headroom concern is valid but not a ship-blocker on its own. Reviewer B correctly identified the lock race as the critical defect.

## New Points

### 1. The race enables silent pin loss, not just duplicates

Reviewer B noted duplicate deliveries. The worse case: two `capture` calls racing on **different prompts**—e.g., Prompt A adds pin X, Prompt B removes pin Y. If both stat, both see the old state, both compute new state, both write, the second write wins and one operation vanishes. The user is told both succeeded (before the race resolves), but only one is stored. **Silent data loss of user constraints is unacceptable.**

### 2. The 3-line bound is violated by the race

The description claims "at most three pin lines per compaction" (tool restore, prompt delivery, one restatement). But if two prompts race and both deliver (because both got past the lock), then the next prompt restates, yielding **four lines**:
- Tool restore: 1 (marker taken once)  
- Prompt A: 1 (delivers because record says undelivered)  
- Prompt B: 1 (delivers because it read the same undelivered state before A wrote)  
- Next prompt: 1 (restates because one of A/B wrote `pending: true`)  

Total: 4 lines. The bound is a documented contract, not a best-effort estimate—this is a broken invariant.

### 3. Strict-lock reclaim refusal is the minimal fix

Reviewer B suggests making strict callers "decline stale-guard reclamation." Implementation: in the `age_ms >= LOCK_STALE_MS` branch, if `options.strict === true`, skip the reclaim and treat the stale guard as live—sleep, check deadline, give up if timeout. This **eliminates the race** at the cost of requiring manual cleanup of crashed-process guards (they stay locked for ~30s until the acquisition deadline). For user constraints, that trade is correct: inconvenience beats silent data loss.

### 4. Unreadable files accumulate forever in retention

`sessionActivityMs` returns `Date.now()` if the pin file can't be statted (not just ENOENT, but permission denied, filesystem error). This prevents pruning unreadable files—they're treated as active. Over time, such files accumulate. A stricter policy: if both pin file and language-mirror peer are unreadable, prune (treat as stale). Or log and skip.

### 5. Portability: atomic rename on Windows

The marker take uses `fs.renameSync(marker, taken)`. On POSIX this atomically replaces `taken`. On Windows it throws EEXIST if `taken` exists. The cleanup of `taken` is best-effort (`rmSync` with catch-all). If cleanup fails, the next rename fails on Windows. The code logs this, but the compaction isn't restored. This is a degraded-service case on Windows.

### 6. Capture envelope checks are sound but subtle

The linear-time envelope detection (right-to-left scans for next `=`/`>`, prefix sums for paste spans, per-tag-name stacks for regions) is correct and well-tested. One subtlety: `inlineEnvelope` checks for `<name` + space + `=` before next `>`, so `<tag>` with no attributes is allowed in a pin. This is intentional (per the comment: `Array<string>` is not an envelope). The `envelopedLines` check catches multi-line openers. **No bypass found**, but the density of the logic makes it fragile to changes.

### 7. Missing bound assertion for lock-failed note

The `LOCK_FAILED_NOTE` line (unrecorded tool restore) is bounded at ~5,054 B worst case + note, under 6,144 B ceiling. But there's no test that combines the worst-case pins, the language pin, and the lock-failed note to assert they fit. The unit tests check components separately. A dispatcher-level test should drive the combined line through the real budget enforcer.

---

## Verdict

**REFUSED** — The stat-then-remove race in `_acquire_lock` (lines 433-461 of `state_io.ts`) allows two callers to both reclaim the same stale guard and both acquire the lock, enabling silent loss of user pin changes when concurrent captures overwrite each other's writes (observed state → decide → write, both read same state, second write wins, first change vanishes) and violating the stated 3-line-per-compaction bound when concurrent restores both deliver (4 lines: tool + two racing prompts + restatement). For a feature persisting user constraints, silent data loss is a ship-blocker.

**Highest-leverage change**: In `_acquire_lock`, when `options.strict === true`, skip the entire `age_ms >= LOCK_STALE_MS` reclaim branch—treat stale guards as live, wait until deadline, give_up. This eliminates the race at the cost of requiring manual cleanup of crashed-process guards (they lock the file until the 5s deadline expires). Add a deterministic test that spawns three processes: A and B both acquire the lock over a pre-planted stale guard, C observes both succeed—this must fail with the fix, pass without it. The test belongs in the lock-fix change, not this PR, per round 55's own decision to separate the work.
```

### openai — `refused`

```text
The change **expands authority**: it persists prompt text as constraints, injects those constraints after compaction and into subagents, and triples the `language-mirror` injection allowance. That expansion needs reliable exclusion around the new state.

1. **High — strict callers still inherit unsafe stale-lock reclamation.** I agree with **Reviewer B**. In `state_io.ts::_acquire_lock`, the stale branch checks `statSync(held)` and later unconditionally removes that path. Two contenders can inspect the same stale guard; one replaces it with its own fresh guard, and the other then removes the fresh guard. Both can enter their critical sections.

   `strict: true` only changes the non-`EEXIST` failure branch. Consequently, `captureDirectives` can overwrite another successfully acknowledged capture, while `transition` can lose acknowledgements or emit extra restores. The six-process test exercises ordinary contention, without deterministically arranging this stale-guard interleaving.

   Withdrawing the attempted reclaim fix is reasonable scope control, but documenting the inherited race does not establish the new persistence and delivery guarantees. Strict pin callers should decline stale-guard reclamation until a verified protocol ships separately.

2. **Low — the concurrency test collects output too early.** I agree with **Reviewer B** that resolving on child `exit` can precede stdout closure. Resolve on `close` and retain the exit-status check. The current harness can produce misleading failures, particularly given that resolving a reporter-dependent flake is part of the shipping evidence.

3. **Description correction — marker failures are reported repeatedly.** Contrary to **Reviewer A’s** “one stderr line per compaction” characterization, `_onToolUse` retries an untakeable marker on subsequent tool calls, and `_takePinLost` logs each failed attempt. Context injection remains suppressed, but diagnostics are not bounded once per compaction.

I disagree with **Reviewer A’s principal budget objection**. `LOCK_FAILED_NOTE` is explicitly defined in the supplied `session_pins.ts`, and the stated 5,054-byte tool-restore bound already includes it. Even adding roughly 40 bytes would not exceed 6,144 bytes. Tight bundle headroom is a maintenance concern, not sufficient evidence for an arbitrary increase to 1,610,000 bytes.

The implementation appropriately reuses the shared loader, session ownership checks, and locked-update helper. Its functional shape fits the codebase. Whole-record validation and bounded notices are good choices. The main shipping risk is that the feature promises stronger guarantees than its shared locking dependency provides; the changed language restoration behavior also affects sessions with pins disabled.

**REQUEST_CHANGES** — the new persistence and restore bounds depend on exclusion the supplied lock cannot guarantee; the single highest-leverage change is to make strict pin callers decline stale-guard reclamation, backed by a deterministic competing-reclaimer regression test.
```
