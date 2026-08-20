---
complexity: structural
status: ready
execution:
  mode: phase-checkpoints
---
# Road to hook state that survives concurrency — and to findings that survive the session

> **Source:** five council rounds, 2026-08-20, across three parallel sessions in
> one checkout. Rounds 1-3 landed as PR #1458; round 4 reviewed the counter-write
> protocol in it; round 5 reviewed this roadmap and returned REQUEST_CHANGES from
> both seats. Council findings are inlined with date and seat rather than linked:
> the artefacts are gitignored and pruned after seven days, which is finding 7.1
> of this very file.

## 0. The correctness contract — stated first because everything hangs on it

**Decided by the maintainer, 2026-08-20: the counter is BEST-EFFORT.** A lost
increment is acceptable. A duplicate reminder is acceptable. A missed reminder is
acceptable. None of the three corrupts data; each costs at most one surplus or
absent language injection.

Round 5 named the absence of this sentence as the load-bearing gap in every
earlier draft, and both seats were right: without it the plan was building
serialisation for a requirement nobody had stated. With it, the consequences are
immediate and they SHRINK the work:

- **No stale-reclaiming pathname mutex.** Not "a safer one" — none. Never
  waiting makes the reclaim path unreachable rather than rarer, and an
  unreachable path needs no ownership proof.
- **Phase 3 stays anyway.** One seat proposed dropping the pin nonce under
  best-effort; the other refuted it and is right: the nonce distinguishes
  successive pin *generations*, which a lossy counter still must not cross. It
  is not collision protection.
- **Phase 4 shrinks to the chosen contract.** Tests for two stale breakers and
  for a holder deleting its successor's lock become tests of machinery this
  contract deletes.

## 1. The defect, in two halves

**The mechanism half.** Every failure across five rounds is one shape: **a
decision about a foreign object, taken on a property of the caller rather than of
the object.** A pruner deleting because *it* waited. A lock holder deleting a
path because *it* is done. A counter write replacing a whole object because *its*
snapshot said so. Each was found, fixed, and the fix carried the next instance.

**The process half.** Of ~49 findings this session produced, most existed only in
chat messages between sessions, in gitignored council artefacts with seven-day
retention, or in untracked review documents. One — a fabricated council
attribution — sat in shipped code comments and would have stayed. Nothing in this
package moves a finding into a tracked artefact, and two ratchets oppose creating
one.

## 2. The criterion — corrected, because two properties were not enough

Drafted 2026-08-20 from a peer's refutation of an accusation of mine, then
**refuted itself** by both round-5 seats. The corrected form has three parts, and
the third is the one that was missing:

1. **The claimed name is unique to this run.** `<digest>.json.<pid>.<n>.tomb`
   cannot be produced by a peer. A fixed path has no such property.
2. **The takeover decision reads a property of the OBJECT**, not the caller's
   patience. `rename` preserves mtime, so a tombstone carries the age of its
   content.
3. **The property read must authorise the exact subsequent mutation at its
   linearisation point, revalidated at the action boundary.** This is what the
   first draft missed, and the counter-example is short: a worker reads the
   lock's mtime (property of the object, authentic), finds it old, and deletes —
   while in between a peer broke the lock and created a fresh one at the same
   path. Both earlier properties hold; the deletion still destroys a foreign
   object.

The tombstone sweep satisfies all three, because a unique name makes path reuse
impossible and therefore makes revalidation vacuous. Nothing else in this tree
does. Every claim path added later states its linearisation point.

## 3. Verified non-actions — recorded, deliberately not steps

Round 5, both seats: these are decisions, not work, and an unchecked box reads as
unfinished. Kept here as prose; they move to an ADR when Phase 5 is executed.

- **`O_EXCL` on NFS is a scope-limited claim, not a defect.** The Linux manual
  page carries the restriction historically, for NFS before NFSv3. The manual
  page on the development platform (Darwin) recommends `O_EXCL` for exactly this
  purpose and does not mention NFS — zero occurrences, counted. For a tree whose
  state lives under `agents/` it is an edge case whose relevance must be argued,
  not assumed.
- **`Atomics.wait` is NOT the defect.** In Node it is the recommended synchronous
  sleep; the "cannot block the main thread" error is a browser property. An
  earlier reading of this file called it an antipattern and was wrong. Recorded
  so nobody fixes a non-defect.
- **Kernel-level locking is closed, verified rather than assumed.** It would
  dissolve § 2 entirely — a lock dying with its descriptor makes "abandoned lock"
  not a category. The Darwin manual page lists `O_EXLOCK`; Node does not export
  it (`O_EXLOCK` and `O_SHLOCK` both absent from `fs.constants`, Node v26.7.0,
  darwin). Native addons are disqualifying for a hook that starts per tool call.
- **A cache precedent does not prove counter semantics.** An earlier draft cited
  a lockless content-addressed cache as evidence for the split. Round 5 refused
  it: a cache tolerates a lost write because re-fetching is cheap, a threshold
  does not. The split stands on § 0, not on that analogy.

## 4. Phase 0 — Make the unsafe path unreachable, then measure

- [ ] **0.1** Disable stale reclaim in the shared acquire path before any
      measurement. Round 5, both seats: measurement must not decide whether a
      known-destructive race stays. This is the § 5.1 finding, executed first
      rather than last.
      → verify: the reclaim branch is gone or unreachable; a test asserts a busy
      lock never results in two holders.
- [ ] **0.2** Publish the platform matrix as a required artefact, one row per
      assumption, each marked verified-here / unverified: inode semantics on
      NTFS, `mkdir` atomicity, `rename` over an existing file (differs from POSIX
      on Windows). Phase 1 applies only where every row is verified; elsewhere
      the scope is narrowed explicitly rather than assumed.
      → verify: the table exists in this file and Phase 1 names the platforms it
      claims.
- [ ] **0.3** Measure contention WITH denominators, because a bare conflict count
      decides nothing: total acquisition attempts, host and filesystem, hook
      latency percentiles, parallelism, and whether crashed hooks report at all.
      Instrumentation sitting behind the conflict path systematically misses
      crashes — the cases under investigation.
      → verify: the recorded numbers carry their denominator and the sampling
      bias is stated; a count without both is not an input to any decision.

## 5. Phase 1 — The counter write under a best-effort contract

Shrunk by § 0. What remains is the smallest design both seats accepted: split
state, a pin-generation id, no stale-reclaiming lock, explicitly lossy counting.

- [ ] **1.1** The tool write never waits. A conflict means this increment is
      dropped, silently and by contract. No stale window, no reclaim, no
      ownership proof — the path that needed one does not exist.
      → verify: a test asserting a conflicting write returns the silent value and
      leaves the counter unchanged.
- [ ] **1.2** The tool write reads fresh and builds the write from the fresh
      object, never from the caller's snapshot, and aborts when the pin
      generation no longer matches the one the decision was made against. This is
      § 2 property 3 applied: the read authorises this mutation, revalidated
      immediately before it.
      → verify: counter-probe — remove the revalidation, the matching test reds.
- [ ] **1.3** If duplicate threshold emission turns out to matter after all,
      the mechanism is an atomic unique marker per pin generation, NOT a mutex.
      Held as a conditional rather than built: under § 0 a duplicate reminder is
      acceptable, so this step is only reached if that contract changes.
      → verify: no verification owed unless § 0 changes; the condition is
      recorded so the option is not rediscovered as a new idea.

## 6. Phase 2 — Separate the counter from the pin

- [ ] **2.1** File name is `<digest>.counter.json`. The `.json` suffix is
      load-bearing, verified against all three pruner filters: the orphan regex
      resolves `<digest>.counter.json.<pid>.<n>.tomb`, the retention loop sees
      the file, and a name without `.json` falls through all three **silently**.
      → verify: a test placing a valid and an invalid name in one directory and
      asserting the valid one is processed while the invalid one is reported
      rather than silently skipped. An earlier draft asserted both are "reached",
      which cannot prove the contract it was written for.
- [ ] **2.2** The counter type carries `session_id`, a pin-generation reference,
      a format version and the count — and **no field a language fits into**.
      Round 5 qualified the structural claim correctly and it is adopted: the
      type constrains new typed callers, not the persisted protocol. So it needs
      all three: reject unknown format versions on read, route every counter
      write through the typed API, and reject unknown fields.
      → verify: the type has no language field; a test asserting an unknown
      version is refused rather than coerced.
- [ ] **2.3** Both builders derive the digest through **one shared helper**. The
      existing builder computes `sha256(id).slice(0, 32)` inline; a copy is a
      second truncation that can drift, and a drifted counter points at another
      session while both names stay formally valid and no filter notices.
      → verify: a known-vector test over the shared helper.
- [ ] **2.4** The pruner **does** collect counters whose pin is gone — a counter
      without a pin is garbage and retention should reap it. What it must not do
      is use the counter-to-pin link to decide **pin** retention; that is the
      circular dependency, and the earlier blanket prohibition was too broad.
      The sweep still decides on mtime and name only.
      → verify: a test asserting an orphaned counter is reaped and that no pin
      retention decision reads a counter.

## 7. Phase 3 — The pin generation id, which gates Phase 2's schema

Round 5: 2.2 commits to "a pin reference" while Phase 3 has not yet chosen the
scheme, so the persisted schema cannot be finalised before 3.2. The claimed
independence was too strong.

- [ ] **3.1** `detected_at + language + source` does not identify a pin: two
      same-language prompts in one millisecond collide, and a stale decision
      matches a replacement pin. Phase 2 solves the overwrite structurally and
      **moves** this one.
      → verify: a test where two pins share timestamp and language, and the stale
      decision is refused.
- [ ] **3.2** The reference is a random opaque id (`randomUUID`), generated at
      the **pin** write. Deriving it from time is forbidden and the reason is
      recorded so nobody re-adds it: a timestamp already sits in the state and
      looks sufficient, which is how the same trap returns in new clothing.
      → verify: the generator is not time-seeded; two pins in one millisecond
      receive different ids.

## 8. Phase 4 — The probes, sized to the contract

- [ ] **4.1** The stale-snapshot probe establishes that a changed identity
      aborts. It does **not** establish that a successful write is built from the
      fresh object — an implementation re-reading only for the comparison and
      then writing the snapshot passes every assertion.
      → verify: a matching-identity test where an unrelated field differs between
      snapshot and disk, asserting the disk value survives.
- [ ] **4.2** The locale-dependent suite, found by CI and reproduced locally:
      three tests call `run(...)` without pinning `env`, so the system-locale
      fallback reads the real environment. Under an empty `LANG` they pass; under
      `LANG=en_US.UTF-8` they red. Neither developer machine had an English
      locale and macOS CI does — not flaky, invisibly broken on the machines that
      reported it green. Pinning `env: {}` restores hermeticity but COSTS an
      assertion: the case where an id-less invocation emits a locale pin and must
      still write nothing then stays untested.
      → verify: the three pin `env` explicitly, AND one new test pins
      `env: { LANG: "en_US.UTF-8" }` and asserts no file is created without a
      stable session id.
- [ ] **4.3** Assert what the chosen contract makes assertable: a prompt landing
      between validation and persistence; two simultaneous threshold calls under
      a lossy counter; same-generation repinning; an orphaned counter reaped.
      Tests for stale breakers and successor-lock deletion are NOT written —
      § 0 removes the machinery they would exercise.
      → verify: one test per line, each red against the pre-fix implementation.

## 9. Phase 5 — `_acquire_lock`, pre-existing and shared

At `src/scripts/hooks/state_io.ts`, introduced by the TypeScript port
(`0c24f2ca3`, PR #483). Neither this session's code nor the maintaining session's.

- [ ] **5.1** The reclaim decision measures how long *this caller* waited and
      knows nothing about the companion — no mtime, no inode. § 2 property 2,
      verbatim, on pre-existing code. Two callers past their deadline evict each
      other's fresh companion indefinitely, and the exclusive create then reports
      success to both. Executed as 0.1, listed here for provenance.
      → verify: see 0.1.
- [ ] **5.2** `start` is never reset on reclaim, so once the deadline passes no
      iteration reaches the sleep again — the pauseless spin is the end state of
      any call that touches the deadline once, not its first phase.
      → verify: a test asserting a bounded number of filesystem operations per
      acquire.
- [ ] **5.3** Move the four § 3 non-actions into an ADR on hook-state platform
      assumptions, so they stop living in a roadmap as prose.
      → verify: the ADR exists and § 3 points at it instead of restating it.

## 10. Phase 6 — Rollback and version skew

Round 5, both seats, unregistered in the earlier draft and the largest omission
after the contract itself. Splitting one file into two creates a multi-version
protocol.

- [ ] **6.1** Write the reader/writer compatibility matrix: an old hook writing
      the combined state after a new hook wrote split state; a rollback meeting
      generation-bearing pins; old pruning code seeing new filenames and
      tombstones; new code meeting partially migrated or malformed state.
      → verify: one row per pairing with the resulting behaviour, and a named
      point after which rollback is no longer data-preserving.
- [ ] **6.2** Define the kill switch: disable counter mutation while preserving
      pin reads, so the language pin — the thing this hook exists for — survives
      any abort of this work.
      → verify: a setting or env flag that stops counter writes without stopping
      the pin, with a test.
- [ ] **6.3** Name the abort thresholds before shipping: hook latency, conflict
      rate, orphan growth. Without them "measure it" has no failure branch.
      → verify: three numbers with the reason each was chosen, or an honest
      statement that the number is a guess and what would falsify it.

## 11. Phase 7 — Findings that survive the session

Round 5 split this into two needs, and the split is adopted: **capture is not
triage.** Requiring a recommendation, the cost of inaction and an executable step
at *capture* time suppresses uncertain but valuable findings — which recreates
the original loss in a more structured form.

- [ ] **7.1** Write the retention gap as a decision record: a council artefact is
      gitignored and pruned after seven days, an agent-to-agent message is not
      stored at all, and a review document needs a type declaration to pass the
      pre-push gate. Nothing carries a finding into a tracked artefact.
      → verify: the record names each break in the chain separately.
- [ ] **7.2** Capture layer: append-only, provenance-carrying, **no action fields
      required**. A finding may be recorded while still uncertain.
      → verify: a finding with no recommendation can be captured and is not
      rejected.
- [ ] **7.3** Triage layer: owner, status lifecycle, and the decidability fields
      the blocker ratchet requires — applied when a finding becomes work, not
      when it is observed.
      → verify: a captured finding can be promoted to a blocker entry that passes
      `lint_roadmap_blockers` without the capture step having demanded it.
- [ ] **7.4** Choose the carrier shape by comparison, not by assertion. The
      earlier draft claimed append-into-one-collection was "the only shape that
      survives" the estate and decidability ratchets and never showed the work.
      Alternatives to cost out: per-domain collections, per-severity, structured
      storage with an index, time-bucketed files. Each trades merge conflicts,
      search, ownership and lifecycle differently.
      → verify: a table of at least three shapes against the two ratchets plus
      merge behaviour, and a stated choice with its reason.
- [ ] **7.5** Treat persisted findings as untrusted content. They can carry
      secrets, paths, hostile instructions or commands, and this is a new trust
      boundary the earlier draft did not name.
      → verify: the capture path states what it refuses to store and what it
      redacts, and a test with a planted secret.
- [ ] **7.6** Decide the trigger surface honestly. The self-repair loop already
      records behavioural defects and never moves them into a roadmap; the
      remediation ladder ends in prose and states its own enforcement as none.
      → verify: the decision names the slot and the hosts, and
      `agent-config hooks:status` output is quoted for the host it claims.

## 12. Phase 8 — Two failure classes, named

- [ ] **8.1** False precision — five instances in one day, one shape: an
      assertion that looks more precise than its basis survives review because it
      reads as checked. A scope hash in prose that stopped matching after the next
      commit; a test name asserting an interleaving the test does not stage; a
      council attribution for a finding no seat made; a standard quoted outside
      the platform where it holds; a gate reporting green over a tree that did
      not yet contain the file it was run to check.
      → verify: each instance names how it was caught, and four of five were
      caught by a peer or a deliberate re-run rather than by a gate.
- [ ] **8.2** The counter-rule, corrected by round 5. "Prefer no precision to
      false precision" is too broad — it licenses vagueness. The rule is
      **precision must carry scope, provenance and freshness**, and each of the
      five instances needs its own control rather than the shared label.
      → verify: the rule is stated where authoring guidance lives, with the
      per-instance control named.
- [ ] **8.3** The adjacent class, distinct from 8.1: a measurement whose SCOPE
      nobody stated. Two sessions reported 278 and 88 tests green as verification
      evidence; both numbers were exact and both were false under CI's locale.
      A sister suite already carries the counter-rule in a comment — hermeticity
      is cheap, a works-on-my-machine hook test is not — and the practice did not
      follow it two files away.
      → verify: the rule states that a green count is quoted with the environment
      that produced it, or not quoted as evidence.

## Blockers

### blocker: estate-slot-for-this-roadmap
- **Status:** open
- **Owner:** maintainer
- **Class:** 3 — human-only
- **Question:** the estate ratchet sits at `active_roadmaps 31 / baseline 31`
  with unconditional one-in-one-out, so this file needs a disposition to enter
  the active tree.
- **Recommendation:** move `road-to-inbox-harvest-2026-08-c-evidence-lifecycle`
  to `agents/roadmaps/later/`. Its single open step is explicitly blocked behind
  a maintainer-only bulk-deletion decision, which is the documented definition of
  a later-disposition — it sits in the active tree against that rule, so the move
  is overdue rather than a displacement, and `later/` parks rather than closes.
- **If you do nothing:** this roadmap cannot be committed without reddening a
  remote-sharp gate, and its findings stay in agent chat messages and in council
  artefacts that prune after seven days. **The gate reports green right now and
  that is not evidence:** run against this file while untracked it reports
  `active_roadmaps 31 (baseline 31, +0)`, because it walks the committed tree.
  The red appears at commit time — measured 2026-08-20, and recorded as instance
  five in 8.1.
- **What to do:** `git mv agents/roadmaps/road-to-inbox-harvest-2026-08-c-evidence-lifecycle.md agents/roadmaps/later/`
  then `./agent-config roadmap:progress`, or name a different roadmap to dispose,
  or reject the slot and this file goes to `later/` itself.
- **Blocks:** committing this file to the active tree only. Every phase can be
  executed from `later/` unchanged.
- **Resolved when:** the maintainer records a disposition or rejects the slot.

### blocker: carrier-shape-choice
- **Status:** open
- **Owner:** maintainer
- **Class:** 2 — decision informed by comparison
- **Question:** which carrier shape does the findings layer use, given that the
  estate ratchet is shrink-only and the blocker ratchet is capped?
- **Recommendation:** run 7.4's comparison first and choose from the table.
  Append-into-one-collection is the incumbent candidate but was asserted rather
  than compared, and round 5 refused the claim that it is the only survivor.
- **If you do nothing:** Phase 7 builds the incumbent shape on an unexamined
  premise, and the first thing to break is accountability rather than capacity —
  entries accumulate because no owner, status or review cadence is defined.
- **What to do:** execute 7.4 — the table lives in this file, the two ratchets
  are `src/config/estate-count-budget.json` and the
  `lint_roadmap_blockers:decidability` entry in
  `src/config/gate-violation-baselines.json`. Then pick one:
  (1) one standing collection; (2) per-domain collections; (3) structured storage
  with an index; (4) time-bucketed files.
- **Blocks:** steps 7.2 through 7.5. Steps 7.1 and 7.6 proceed regardless.
- **Resolved when:** the maintainer picks a shape from the completed table.

## Risk Register

<!-- risk-review: v1 | reviewed: 2026-08-20 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Each round's fix carried the next instance of the same shape | product | Five rounds, thirteen blockers, and the newest code carried the newest defect every time — including the criterion written to stop it, which round 5 refuted | § 2 now states three properties with the counter-example that killed the two-property version, so the next claim path is checked against a rule that has survived a refutation | The criterion |
| 2 | An old writer follows a new writer and the split state is corrupted | product | Splitting one file into two creates a multi-version protocol; an old hook writing combined state after a new hook wrote split state is silent data loss, and rollback meets generation-bearing pins it cannot read | Phase 6.1 requires the compatibility matrix and a named point after which rollback stops being data-preserving, before any migration ships | Phase 6 |
| 3 | The counter file falls through all three pruner filters | product | A name without `.json` is never pruned and its tombstones never recovered — both silent, because no gate knows a pattern nobody reads | 2.1 pins the suffix, verified against all three filters including the negative case, and its verify now distinguishes valid from invalid instead of asserting both are reached | Phase 2 |
| 4 | Two digest truncations drift and the counter points at another session | product | The existing builder computes the digest inline; a copied truncation can diverge while both names stay formally valid | 2.3 requires one shared helper and reuses the existing known-vector test | Phase 2 |
| 5 | The findings carrier suppresses the findings it exists to keep | product | Requiring recommendation, cost-of-inaction and an executable step at capture time turns every observation into a work item, and an uncertain finding gets dropped rather than written — the original loss in structured form | 7.2 and 7.3 separate capture from triage, and 7.2's verify is explicitly that a finding with no recommendation is accepted | Phase 7 |
| 6 | The carrier accumulates without accountability | implementation | The first failure is not capacity but ownership: no owner, no status lifecycle, no review cadence, and merge conflicts once three sessions append to one file | 7.3 requires owner and status, 7.4 costs out shapes against merge behaviour rather than assuming one, and blocker `carrier-shape-choice` reserves the decision | Phase 7 |
| 7 | Persisted findings carry secrets or hostile content | product | A findings ledger ingests text from tool output, diffs and peer messages — secrets, paths, commands and injected instructions all reach it, and it is committed | 7.5 makes the trust boundary explicit with a planted-secret test, rather than discovering it after the first commit | Phase 7 |
| 8 | Instrumentation measures the wrong population | implementation | A conflict counter placed behind the conflict path misses crashed hooks — the cases most worth counting — and a bare count without denominators decides nothing | 0.3 requires denominators, latency percentiles and a stated sampling bias, and rejects a count lacking them as an input | Phase 0 |
| 9 | The Windows assumptions are unverified | implementation | Inode semantics on NTFS, `mkdir` atomicity and `rename` over an existing file are unresearched, and the last differs from POSIX | 0.2 makes the matrix a required artefact and Phase 1 applies only where every row is verified; elsewhere the scope narrows explicitly | Phase 0 |
| 10 | A scoped claim is re-broadened by a later reader | product | The NFS restriction is real on one platform and absent on another; stated flatly it justifies a rewrite nobody needs, and three of the five false-precision instances were this shape | § 3 carries the scope with each non-action, including a verified-closed path and a recorded non-defect, so neither is reopened as work | Verified non-actions |
