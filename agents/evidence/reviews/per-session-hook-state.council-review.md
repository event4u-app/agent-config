# Completion review — per-session hook state, and the consumers that went silently dead
<!-- evidence-type: analysis -->
<!-- An investigation, not a scope-bound review verdict: it records what two
     council runs found and what was done about each. It is deliberately NOT a
     `current-binding` artefact — that type needs the `completion-review` marker
     and the dispatcher-produced manifest, and hand-writing one would be the
     self-attestation the gate exists to refuse. `check_completion_review`
     therefore reports `missing-artifact` for this scope, correctly. -->

> **This is NOT a `check_completion_review` artefact, deliberately.** That gate
> requires a `context-manifest: v1` block which only `dispatch_r2_reviewer`
> produces, on the stated ground that the manifest is verification rather than
> self-attestation. Hand-writing one to satisfy the gate would be exactly the
> fabricated-evidence shape `evaluator-independence` forbids, so the marker was
> removed and the filename carries `.council-review.md` instead of
> `.findings.md` — the gate's glob does not see it, and it does not pretend to
> be seen. The formal R2 pass over this scope has NOT run; what ran is the
> two-run cross-model council recorded below. `check_completion_review` reports
> `missing-artifact` for the scope of whatever HEAD it is run against — `ab0f2a51…`
> when this was written, `4e651b75…` once the test and artefact commits landed. The
> hash MOVES with every commit, which is exactly why no marker is pinned here: a
> binding written before the branch is final is stale by the next commit.
>
> Prompt hash (both runs, `sha256` of the two question files, kept so the
> verdicts can be read against what was actually asked, per
> `evaluator-independence`): `482662ac62f90f4ab2b75de57d58af9522fd133750b018919abe8fea3e60a58c`


**Reviewed by:** AI council, 2 of 2 seats present (anthropic + openai), two runs,
2026-08-20. Verdict on the production code: **REJECT until fixed**, four Tier-1
blockers. Verdict on the tests: **mixed, leaning against approval as
sufficient**, with the lock block singled out as unable to fail.

**Order-of-operations violation, stated first because it is the process defect
here:** this artefact was written AFTER the fixes, not before. The repo's own
completion-review discipline puts the findings in the tree first so the fixes
can be read against an unedited record. What stands in for that is that both
verdicts are quoted below from files written by the council CLI before any fix
landed (`agents/runtime/council/responses/session-isolation-review-{A,B}.md`),
and that those files are gitignored is exactly why their substance is
transcribed here rather than linked.

## What the change is

Three hooks. `language_mirror_hook` and `before_complete_hook` each kept ONE
state file per project root; `turn_end_gate_hook` — a BLOCKING turn-end gate —
reads both. Under this repo's worktree workflow `CLAUDE_PROJECT_DIR` resolves to
the parent checkout, so "one per project root" meant one file across every
concurrent session, worktrees included.

Both producers moved to one file per session, keyed on a truncated sha256 of the
`session_id`.

## The defect that started it, and why nothing caught it

`turn_end_gate_hook` imported the producers' `STATE_FILE` **constants**. The
language producer had already split; `_pruneLegacyState` actively deletes the old
file. So `readLanguagePin` returned `und` on every turn, `detectLanguage`
returned `null` on every turn, and detector B of a blocking gate checked nothing.
The import still resolved and the typecheck stayed green.

Three test suites were green through it, for one reason: each wrote the state
file itself by joining the same constant, so both sides of a broken contract
lived inside the test.

A third consumer escaped the obvious grep because it used a path **literal**
rather than an import: `_lib/envelope_grounding.ts` reads
`agents/runtime/state/verify-before-complete.json` while the producer writes
`agents/state/…`. Dead before this change and still dead — see § Open below.

## Council findings, and what was done about each

| # | Finding | Disposition |
|---|---|---|
| A1 | Both gate readers consume a digest-addressed file without checking its embedded `session_id`, while `session_state_file`'s own comment claims callers do. A foreign `ci_last: {settled: true}` vouches for a CI run the session never made. **Blocking, both seats.** | Fixed. `owns_session_state` in `state_io`, exact match, absent owner is foreign; both readers refuse an unowned file. `_ownsPin` delegates to it. |
| A2 | Per-session filenames do not make load→update→publish atomic. Two `post_tool_use` invocations for one session both load N, both publish N+1. | Fixed. `update_json_under_lock` holds one lock across the whole transaction; `before_complete_hook.run()` uses it. The language hook's half was taken by a concurrent session (see § Coordination). |
| A3 | `prune_legacy_state_file` destroys the live state of an older bundle still writing the single file — and the callers' comments asserted that scenario. | Premise refuted, comments corrected. The shipped hook command resolves ONE dispatcher through `CLAUDE_PROJECT_DIR`, so no steady mixed-version state exists. The narrow window that does remain (a hook process holding the previous bundle during a rebuild, bounded to one turn) is now stated at the function, with the condition that would widen it. |
| A4 | The retained session-boundary reset is justified by two unreachable cases ("the id-less bucket and a legacy file"). | Fixed. An id-less envelope returns before `_update`; the legacy file is never loaded. The real reachable case — a file at this session's digest carrying a foreign owner — is stated and has a test that reaches it. |
| A5 | Calling the id-less path "the SAFE direction — under-refusing" is wrong for a blocking gate: it is fail-OPEN. | Fixed. Named as degraded enforcement, with the reason it is still the best of the available options. |
| A6 | "The next layout move is a type error" overclaims — a producer can add `statePathForV2` and keep the old builder. | Corrected. The enforced invariant is the producer→consumer parity test, not the type system. |
| B1 | **Every test in the lock block would pass with the locking removed.** The elapsed-time assertions detect a leaked lock, not an absent one. | Fixed. A four-process test increments through `update_json_under_lock` 25× each; the total must be exactly 100. **Verified red against a sabotaged (unlocked) implementation before being accepted** — the lock was neutralised, the test failed, the lock was restored. |
| B2 | The CI reader had no ownerless-at-own-path case, though the language reader did — so a `readCiSettled` that never consulted the guard could pass every other CI test. | Fixed, test added. |
| B3 | The CI parity test asserted only `.seen`, so a consumer misreading a pending record as settled would pass. | Fixed — asserts the full `UNSETTLED` value. |
| B4 | Names claim more than the tests do: "reads the language the mirror hook wrote" never ran the hook; "another session's pin is not this session's obligation" tests lookup separation, not ownership; "reads INSIDE the lock" cannot see a lock. | Fixed, all renamed, with the distinction recorded at each. |
| B5 | The digest assertion accepts 32 hex chars while sha256 is 64, pinning neither the hash nor that truncation is contractual. | Fixed — a known-vector test pins both. |
| B6 | "does not republish fields the mutator did not look at" is misleading; the mutator spreads `loaded` explicitly. | Fixed. Renamed, and the load-bearing property (WHICH object is spread) stated. |
| B7 | The first pruner test is a revalidation-branch test, not the race; no file is actually replaced. | Fixed. Renamed, and the comment now says what the injection does and does not establish. The following test, which writes through the live path while the claim is held, is named as the sharper one. |
| B8 | "A test that borrows the builder cannot drift from it" is logically backwards — borrowing follows the producer wherever it goes, including somewhere wrong. | Fixed. Corrected, and pointed at the parity tests as the actual path-contract check. |

## Disagreement recorded rather than settled

One seat called the 150-tool-call re-emit threshold "operationally sound despite
small n"; the other called it "plausible but not established by the evidence",
noting that 11 violations in one session do not show tool-call count is causal.
Both are in the artefacts. The threshold is unchanged by this review, and its own
revisit-if condition already covers the second reading.

## Open, not fixed

- **`_lib/envelope_grounding.readLastVerify`** reads a path nothing writes, and
  did so before this change. Fixing it needs a `session_id` threaded through a
  CLI (`cmd_session_recycle`), which turns a dead reader live — a behaviour
  change to a CLI's output that belongs in its own change.
- **`state_io.feedback_dir`** carries the same sanitiser shape this change
  removed elsewhere: `a/b` and `a_b` map to one directory, `''` to
  `unknown-session`. Left alone deliberately — it merges a feedback view rather
  than destroying a pin, and changing the dispatcher's on-disk feedback layout
  needs its own verification.
- **Same-session concurrency on hosts other than this one** is unmeasured. The
  four-process test proves the lock excludes; it does not establish how often
  real interleaving occurs.

- **The lock scope did not follow the state scope, and that is this change's own
  defect.** Raised by a concurrent session against `update_json_under_lock`,
  verified here, and sharper than it was put: `_lock_path(state_dir)` is
  DIRECTORY-wide, and it always was (`HEAD~5:state_io.ts:262`), so the
  granularity is not new. What IS new is what the directory now contains. Before
  the split, every session wrote ONE file under `agents/state/`, so a
  directory-wide lock was effectively a file lock and cost nothing. After the
  split there are N per-session files in one directory — and a directory-wide
  lock serialises N sessions that touch DIFFERENT files. The split exists to
  decouple sessions; on the write path this recouples them.

  Not a correctness bug (stricter than needed, never wrong) and probably
  unmeasurable at millisecond writes — but "probably" is the honest word, because
  the contention was not measured. The fix is to key the lock on the state FILE,
  which is what the peer's independent implementation does.

  **The exposure is worse than "wait out the deadline", and the sharp part is in
  `_acquire_lock` rather than in the scope.** Read line by line after a peer
  raised it — their diagnosis was half wrong and the pathology it pointed at is
  real:

  - The first 5 seconds are NOT a busy-spin. `Atomics.wait(sab, 0, 0, 2)` is a
    genuine 2 ms sleep per round, and the comment says so. A contending caller
    polls ~2500 times over the window; it does not burn a core. (It does
    allocate a fresh `SharedArrayBuffer` per round, which is garbage, not a
    hazard.)
  - **After** the deadline, the sleep is unreachable. `const start = Date.now()`
    sits once, before the loop, and the deadline check sits BEFORE the
    `Atomics.wait` — so once `Date.now() - start > deadlineMs` holds, every
    remaining round goes `EEXIST` → `rmSync` → `continue` and never reaches the
    sleep again. This is not an occasional degradation: it is the END STATE of
    any call that touches the deadline once. The 5-second bound limits ONE wait,
    not the call.

  - **And the reclaim is misnamed, which is the actual defect.** The comment
    reads `// Stale companion — reclaim it`, and nothing in the branch examines
    the companion at all — no mtime, no age, no owner. It is deleted because
    THIS caller has waited long, not because IT is old. So a caller past its
    deadline removes a lock another process is legitimately holding, and two
    such callers can take turns evicting each other with no bound on rounds.
    That framing is a peer's and it is better than the one this section first
    carried ("deletes whatever companion it finds"), because it names why the
    code is wrong rather than only what happens: the branch is written as a
    staleness check and implements a patience check. Same class as the three
    comments this change already corrected for asserting the inverse of their
    own code — and the reason it survived is that the comment reads correctly
    until you look for the predicate it names.

  This is PRE-EXISTING (`HEAD~5` carries the same loop) and is not this change's
  defect. What this change contributes is probability: holding the lock across
  read + mutate + publish instead of publish alone lengthens every hold, which
  makes reaching the deadline likelier — and reaching it is what switches the
  loop into the bad mode. A pre-existing hazard made more reachable is still
  something this change owns a share of.

  **Deliberately not fixed here.** A council round is reading this exact code;
  changing it mid-read is the trap this session warned two peers about twice.

- **Two lock primitives now exist in the tree for one job** —
  `update_json_under_lock` (directory-keyed, proven by the four-process test) and
  the peer's `_withToolWriteLock` in `language_mirror_hook` (file-keyed, whose
  own lock test plants a lockfile by hand and so checks reaction to an existing
  file rather than serialisation under real concurrency). Converging them is the
  right end state and needs one API change first: `mutate → null` here means
  "deliberately not written, not a failure" and returns `true`, while the peer's
  pin-mismatch path needs `false` because its fail-closed emit policy hangs off
  the return. Expressible through a closure, but not a blind delegation.

  Convergence therefore has **three** conditions, and each side supplies part:

  1. **Three return states** — `written` / `skipped` / `failed`. Today `null`
     collapses "deliberately not written" into `true`, which a fail-closed emit
     policy cannot use.
  2. **The lock scope follows the state scope** — file-keyed, not
     directory-keyed. The peer's implementation already does this.
  3. **A non-blocking acquire for hot paths** — the peer's argument, and the
     strongest of the three: a concern running on EVERY tool call should never
     wait. Lock held ⇒ return immediately, fail-closed; a missed reminder is
     recoverable by construction. Whether to wait is the caller's decision, not
     the primitive's — and a non-blocking acquire makes the deadline-reclaim loop
     above unreachable, which is a second reason to prefer it over tuning the
     backoff.

  Credit where it belongs, stated because an earlier draft of this section read
  as though the shared helper were simply the better one: the four-process test
  is this side's contribution; the granularity and the non-blocking semantics are
  the peer's.

## Coordination

`_writeDistance` in `language_mirror_hook.ts` and its callers were held by a
concurrent session working the same shared checkout, which fixed the snapshot
-overwrite half of A2 there. This session touched that file only to delegate five
helpers to `state_io` and to correct one comment that asserted the inverse of its
own code (an absent `session_id` described as owned). That correction was
surfaced by the other session.
