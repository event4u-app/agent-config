---
proposed_by: claude/drain-self-modification-council-20261012
implemented_by: claude/drain-self-modification-council-20261012
reviewed_by: ai-council
subject: 6ce10afe22220f18d2865fb9cd8e2254413f7f8205385bfcf20ef6f87de275ed
providers: [anthropic, openai]
verdict: refused
seats:
  anthropic: refused
  openai: refused
effective_after: merge
---

<!-- evidence-type: ratification -->

# Modification review — the content binding, narrowed

The change: a ratification record carries `subject`, a sha-256 digest over the
gated files of the change it reviewed, and `check_kernel_edit_ratified`
recomputes that digest from the tree it is pointed at and refuses a record whose
`subject` is absent, malformed or different. Steps 2.1 and 2.2 of
`road-to-self-modification-that-a-council-must-pass`.

**Both seats refused, twice. This record does not let the change land, and it
is the second refusal of this narrowed change — which under the instruction
this lane runs on makes the disposition the owner's, by
`ratification-artifact.md` § The owner-permission-route.**

Derived, not typed: `providers`, `verdict` and `seats:` follow
`deriveRatificationHeader` from the seat conclusions below; `subject` is the
gate's own `expectedSubjectFor`. What this does not establish is that the
review happened — the seats below are the caller's, and council responses are
gitignored and pruned, so no runner can check them. The prompt packages ARE
committed, beside this file, so what was asked is checkable even though what
was answered is not.

## How this change got here

It is the remainder of a larger branch this same council refused 2/2 over three
rounds on 2026-10-12
(`drain-self-modification-20261012.md`). That refusal's `smaller-change` answer
asked for the binding to land alone, with governed-surface expansion, proposal
validation and a new standing Iron Law evaluated separately. That was done:
five concerns reverted to `origin/main`, each verified as an empty net diff per
file, each reopened as a `[ ]` roadmap step. This record covers what remained.

| Round | Scope | Outcome |
|---|---|---|
| 1 | The whole narrowed change — code, contract and tests, complete, at `-U1` to fit the 50 KiB bundle | `refused`, 2/2 — four implementation defects, none of them about scope: both seats answered question 7 with "no, appropriately minimal after staging" |
| 2 | The diff of the four fixes, at full context, with each round-1 finding quoted back | `refused`, 2/2 — the error model the fixes introduced is three-quarters implemented |

Round 1's four findings were fixed, each with a test **seen red** by
neutralising its fix — fail-closed `lstat`, path containment, one
classification for list and digest, and the contract-is-ungated assertion. One
of those fixes is what round 2 refused, and the finding is correct.

## What round 2 found, in its own words

> "The error model is three-quarters implemented. `GatedFileUnreadable` gets
> the full treatment (defined → thrown → caught → structured refusal).
> `GatedPathEscapes` gets only the first half (defined → thrown), then escapes.
> The subsequent-read failures get zero coverage. A complete fix needs one
> catch boundary in `evaluate()` that handles all three failure classes."

And the second half of it:

> "Only `lstatSync()` failures are translated into `GatedFileUnreadable`. The
> `readFileSync(abs)` and `readlinkSync(abs)` calls in the unchanged portion of
> `subjectOf()` are not wrapped, so a permission change or I/O error after the
> stat escapes as a raw Node error — exactly the TOCTOU window the fail-closed
> lstat was meant to close."

Both seats converged on it, and the peer-review stage sharpened it in two
directions rather than softening it: one seat warned that a blanket catch would
"conceal programming defects as ordinary refusals" and asked for narrow,
typed translation; the other raised a path-substitution race between the stat
and the read that neither deliberation answer had named.

**It is not disputed here.** The contract this same change writes says an
unreadable or escaping gated path "is a refusal too", and the gate crashes
instead. The reviewers are reading the change's own promise back to it.

## What each seat answered

### anthropic — `refused`

## Agreement with prior reviewers

**I agree with Reviewer B's blocking findings** — both are contract violations:

1. **`GatedPathEscapes` crashes instead of refusing.** The contract says "a gated path... that would resolve outside the tree, is a refusal too" — the word is *refusal*, not crash. Yet `evaluate()` catches only `GatedFileUnreadable`, so a traversing gated path propagates up uncaught. The traversal tests call `gatedFilesOf()` directly and therefore don't cover the gate boundary. Reviewer A's "defensible crash" argument contradicts the contract's explicit promise.

2. **Subsequent read operations are unprotected.** Only `lstatSync()` failures are translated into `GatedFileUnreadable`. The `readFileSync(abs)` and `readlinkSync(abs)` calls in the unchanged portion of `subjectOf()` are not wrapped, so a permission change or I/O error after the stat escapes as a raw Node error — exactly the TOCTOU window the fail-closed lstat was meant to close.

**I also agree with Reviewer B's secondary points:**
- The verbose review-history comments ("FOUND BY THE TEST...", dated council references) belong in commit messages, not production code
- The `it.skipIf(asRoot)` is a legitimate test limitation, but mocking would cover all runners
- Windows UNC paths should be considered if Windows is supported

## Disagreement

**I disagree with Reviewer A** that the uncaught crash is "defensible because git doesn't allow `..` in paths". That reasoning proves too much: if malformed input is impossible, the check itself is unnecessary. The check exists precisely because the gate's own regex (`(?:^|/)rules/...`) is unanchored and *does* classify traversing paths. Once classified as gated, the contract requires a structured refusal, not a crash. Saying "this should never happen" while writing code to detect it is incoherent.

## New points not raised in round 1

1. **The error model is three-quarters implemented.** `GatedFileUnreadable` gets the full treatment (defined → thrown → caught → structured refusal). `GatedPathEscapes` gets only the first half (defined → thrown), then escapes. The subsequent-read failures get zero coverage. A complete fix needs one catch boundary in `evaluate()` that handles all three failure classes.

2. **The test coverage proves less than it claims.** The path-traversal test calls `gatedFilesOf()` and sees the throw, but doesn't test that `evaluate()` turns it into a structured refusal. Similarly, the permission test skips-as-root instead of injecting a filesystem mock that would test the invariant on every CI runner. **The highest-leverage test addition:** an end-to-end gate test with a traversing gated path that asserts `exitCode === 1` and a specific error line, not an uncaught exception.

3. **The contract correction is honest, but incomplete.** Changing "prevents" to "detects" is accurate for author-with-write-access, but the new sentence still claims the binding "detects a gated file edited after its review" — which is only true if the digest computation completes. A crash on an escaping path means the edit is neither detected nor prevented; it's unprocessed.

4. **API break is handled for shown callers but unstated for external ones.** `expectedSubjectFor()` changing from `string` to `SubjectReading` is a type break. All shown callers migrated, but any external consumer will fail type-checking or accidentally stringify an object. Not a blocker (this is internal plumbing), but worth stating as a consequence.

---

**Stance: REQUEST_CHANGES** (refused)

The original four findings are mostly fixed, but the error boundary is incomplete: `GatedPathEscapes` crashes the gate instead of becoming a structured refusal (violates the contract's "is a refusal too"), and `readFileSync`/`readlinkSync` failures escape unprotected (TOCTOU gap). 

**Highest-leverage change:** Wrap the entire `expectedSubjectFor()` call in `evaluate()` with a generic catch that handles both new error classes plus any unforeseen filesystem errors, turning all of them into the promised structured refusal. Add end-to-end tests showing the gate returns `{ exitCode: 1, ... }` rather than crashing on traversing paths and post-stat read failures.

### openai — `refused`

Matze, Reviewer B identifies two blockers that Reviewer A overlooks. The patch improves the design materially, but its implementation still does not consistently fail closed at the public gate boundary.

1. Behaviour changes

The change now:

- Returns `{ digest, gatedFiles }` from one `subjectOf()` operation.
- Treats only `ENOENT` and `ENOTDIR` from `lstatSync()` as deletion.
- Rejects classified absolute paths and paths containing `..`.
- Makes a missing `--root` value a usage error.
- Corrects the contract from prevention claims to detection claims.
- Changes `expectedSubjectFor()` from returning a string to returning `SubjectReading`, which is a public API break for any caller not shown here.

Two important consequences are understated:

- `GatedPathEscapes` escapes `evaluate()` as an exception because the catch handles only `GatedFileUnreadable`.
- Failures after `lstatSync()`—notably `readFileSync()` or `readlinkSync()` failures—remain raw exceptions rather than controlled refusals.

Thus the implementation does not yet fulfill the contract’s statement that unreadable or escaping paths are “a refusal too.”

2. Authority or safety boundary

The filesystem authority narrows appropriately: a classified path can no longer use explicit absolute or `..` syntax to read outside `root`, and an `lstat` error can no longer masquerade as deletion.

The gate’s classification authority does not expand.

However, untrusted path input can now terminate in-process gate evaluation through an uncaught `GatedPathEscapes`. This is a denial-of-service/error-boundary problem, even though it is not a content-binding bypass.

3. Does it weaken anything that judges it?

It does not silently weaken the production rule, threshold, or fixture semantics. Restoring the contract as `UNGATED` and asserting its classification directly is a legitimate correction.

There are nevertheless three test-quality gaps:

- `it.skipIf(asRoot)` leaves the unreadable-file regression untested on privileged runners. Injecting or mocking the filesystem failure would make it deterministic.
- The traversal tests exercise `gatedFilesOf()` directly, not `evaluate()`, so they miss the uncaught-exception defect.
- The purported ENOENT polarity test merely checks that computation does not throw and that the constant contains `"deleted"`; it does not prove the absent file was actually encoded using `DELETED_MARKER`.

The “one classification” test also does not exercise the original divergent case: it supplies no `derived` path that is gated only through the derived closure. The `expectedSubjectFor()` case uses an inherently self-gated script, so it could remain green even if `derived` were accidentally dropped again.

4. Is another host or projection left around the control?

The shown CLI and gate now share `expectedSubjectFor()`, and `subjectDigest()` is correctly only a projection of `subjectOf()`. That closes the digest/list recomputation route.

The error projections remain inconsistent:

- `subjectOf()` throws both custom and raw filesystem errors.
- `evaluate()` converts only `GatedFileUnreadable` into a result.
- The CLI appears to convert neither failure class into a deliberate usage/refusal response.

This is not a way to obtain a false passing digest, but it is a way around the promised controlled-refusal behaviour.

5. Can it be undone?

Yes. An authorized maintainer can revert the implementation and contract.

Because CI runs the base revision’s gate against the head tree, a candidate branch cannot immediately neutralize the currently authoritative check merely by reverting it in that candidate. Effective rollback must land on the governing base branch or change the workflow that selects the gate revision.

Existing subject-bearing records remain, but reverting enforcement would make those fields informational rather than binding.

6. What would falsify the benefit, and what rollback criteria are missing?

The claimed benefit is false if:

- A named covered file changes without changing the digest.
- An unnamed file changes the digest.
- The displayed list differs from the hashed list.
- Any read failure becomes a deletion digest.
- An escaping path is read.
- An ordinary malformed or unreadable input crashes evaluation instead of producing the documented refusal.

No explicit rollback or kill-switch criteria are provided. Appropriate triggers include nondeterministic digests for the same tree, false refusals for valid repository paths, platform-specific containment failures, or uncaught exceptions during normal PR evaluation. The current escaping-path and post-`lstat` cases already violate the last criterion.

7. Would a smaller change do?

The overall scope remains appropriately narrow. Returning the list and digest together buys a real invariant that separate calls cannot provide, and containment belongs at the read boundary.

The smallest complete repair is still missing: normalize all expected subject-computation failures into one controlled refusal boundary. This does not require an elaborate class hierarchy; a common error type, a small union check, or wrapping the complete per-file operation would suffice.

8. What standing instruction weight is added?

The contract adds useful permanent semantics: unreadable is not deleted, paths may not escape the reviewed tree, and subject binding detects mismatches rather than proving or preventing unauthorized edits.

The extensive dated review-history comments—such as “FOUND BY THE TEST THAT PINS IT,” “RETURNS THE LIST…,” and repeated 2026-10-13 council narratives—add substantial maintenance weight without strengthening the executable rule. Preserve the invariant and concise rationale; move the review chronology to the review record or commit history.

9. Could untrusted content steer the opened path?

Yes. Changed-path input controls classification and then participates in `path.join(root, rel)`.

The explicit checks bound forward-slash absolute paths, drive-letter paths, and `..` segments before reading. Remaining concerns are:

- The traversal failure is not converted into a gate refusal.
- Post-`lstat` filesystem failures are not wrapped.
- If Windows is supported, UNC/root-relative forms should be tested using the platform’s path semantics rather than a hand-written partial absolute-path test.

Prior-review assessment:

- I agree with Reviewer B’s two blocking findings: `GatedPathEscapes` is uncaught, and only `lstatSync()` failures are translated.
- I also agree with Reviewer B that the traversal regression stops below the actual gate boundary and that the dated commentary creates reviewer fatigue.
- I agree with Reviewer A that the shared `SubjectReading`, corrected fixture, containment check, and `--root` validation are directionally correct.
- I disagree with Reviewer A’s claim that an uncaught traversal crash is appropriate. The contract explicitly promises a refusal, and public `evaluate()` already defines a structured failure interface.
- I disagree with Reviewer A’s conclusion that there is no false-positive or operational risk; raw read errors and containment errors can currently abort callers.
- New refinement: the derived-classification regression does not actually contain a derived-only file, so it inadequately pins the exact divergence being repaired. The ENOENT polarity test likewise does not verify the deletion-marker digest.

REQUEST_CHANGES — refused: the core design is sound, but escaping paths and post-`lstat` read failures still violate the documented controlled-refusal contract; the highest-leverage change is to centralize every containment and filesystem failure from `subjectOf()` into a structured gate refusal and cover that through `evaluate()` with a derived-only classification regression.

## The blind peer-review stage

Both seats then reviewed the round's answers without knowing whose was whose
(`Response-A` was anthropic to the openai reviewer and openai to the anthropic
reviewer — the map is in the run output).

### anthropic, reviewing blind

### Strongest response

I can only evaluate Response-A as shown; no other labeled responses are visible to compare against. Response-A demonstrates thorough systematic analysis through its 9-question framework, correctly identifies that `GatedPathEscapes` escapes `evaluate()` uncaught and that post-`lstat()` filesystem failures remain unhandled. The diagnosis that "the implementation does not yet fulfill the contract's statement that unreadable or escaping paths are 'a refusal too'" is precise and falsifiable. The reviewer grounds their REQUEST_CHANGES in concrete contract violations rather than style preferences.

### Weakest blind spot

Response-A asserts test coverage gaps exist but does not demonstrate whether those gaps actually admit the defects claimed. Specifically: the reviewer states that traversal tests "miss the uncaught-exception defect" by exercising `gatedFilesOf()` instead of `evaluate()`, yet provides no evidence that `evaluate()` is the public boundary where containment exceptions must be caught. If `gatedFilesOf()` is the documented traversal primitive and `evaluate()` is merely a convenience wrapper, then testing the primitive directly may be architecturally correct. The blind spot is **asserting a test-architecture violation without establishing what the actual public contract boundary is**.

### What everyone missed

The response extensively catalogs what failures are not caught but never asks whether the **intended deployment context** requires catching them at all. If this gate runs in CI with controlled inputs (repository paths from `git diff`), then containment-check failures and post-`lstat` errors may legitimately terminate the process as a configuration error rather than returning a structured refusal. The "controlled refusal" requirement may apply only to the classification logic, not to every filesystem primitive. Without seeing the gate's actual call sites and error-handling expectations, the REQUEST_CHANGES may be solving a problem the system deliberately does not have. *[needs-verification]*

### Refinement

The synthesizer should distinguish **classification failures** (which must be structured refusals per the gate's contract) from **infrastructure failures** (which may legitimately propagate). Before requiring all filesystem errors be wrapped, verify whether the gate's callers actually expect structured refusals for containment violations and I/O errors, or whether those are meant to fail fast. If structured refusal is required, the change should provide one failure boundary covering both containment and read errors; if not, Response-A's REQUEST_CHANGES may be architecturally incorrect.

### openai, reviewing blind

### Strongest response

Matze, Response-A is necessarily the strongest—and its most load-bearing point is that the traversal test exercises `gatedFilesOf()` rather than the public `evaluate()` boundary. That directly supports its claim that the implementation can throw despite a contract promising a structured refusal, and its proposed end-to-end assertion would verify externally observable behavior.

### Weakest blind spot

Response-A recommends a “generic catch” for “any unforeseen filesystem errors.” That is too broad: it could conceal programming defects as ordinary refusals. The catch should translate only known domain errors and recognized filesystem error shapes, while unexpected exceptions remain visible.

### What everyone missed

`needs-verification`: Response-A discusses a permission-change TOCTOU window but misses the more serious path-substitution race between `lstatSync()` and `readFileSync()`/`readlinkSync()`. An attacker able to mutate the tree could replace a validated regular file with a symlink after inspection, causing the subsequent read to follow a path outside the repository. The implementation should use descriptor-based reads with post-open verification, or otherwise establish that concurrent adversarial mutation is outside the threat model.

### Refinement

The synthesizer should request changes, prioritizing an end-to-end structured-refusal test and narrowly scoped error translation, while first verifying whether symlink-swap resistance is part of the gate’s security contract.

## What round 1 answered, kept because round 2 is a correction of it

### anthropic — `refused` (round 1)

Matze, I'll work through this systematically, engaging with both prior reviews.

## Points I agree with

**From Reviewer B:**

1. **The `lstat` error handling is fail-open** — this is CRITICAL and somehow both reviewers under-weighted it. The code:
```typescript
try {
    stat = fs.lstatSync(abs);
} catch {
    stat = null;
}
if (stat === null) {
    content = Buffer.from(DELETED_MARKER);
```
treats a **permission error** or **I/O failure** identically to "file doesn't exist". A gated file that's unreadable would hash as deleted, producing a wrong digest. Should catch only `ENOENT`; everything else fails closed.

2. **The CLI divergence** — `ratification_subject` calls `gatedFilesOf(files)` while `expectedSubjectFor` calls `gatedFilesOf(files, derived)`. The displayed coverage list and the actual digest could classify differently.

3. **The `UNGATED` fixture inconsistency** — the test comment says "step 4.1 put the artifact contract on the reviewer list", past tense, yet the description says "governed-surface expansion... the gated path set is back to origin/main's ~15 paths". These directly contradict. Either the contract IS gated now (expansion not reverted) or the test comment is wrong.

4. **Digest implementation not gated** — acknowledged as known limit #2, but worth emphasizing: a future change to the digest logic itself lands without ratification, changing what subsequent records bind to.

**From Reviewer A:**

5. **The staging verification** — five concerns reverted, each checked as empty net diff per file. This narrowing was done correctly.

6. **The tests verify the core property** — one-byte edits caught, symlinks handled, base movements behave as specified.

## Points I disagree with

**From Reviewer B:**

7. **"Anyone can recalculate subject without evidence reviewers saw it"** — yes, but this is explicitly acknowledged as known limit #3: "records assert rather than prove a review happened". The digest closes *accidental* staleness (file edited after review); it's not a cryptographic proof of reviewer assent. That trade-off is stated.

8. **Symlink absolute targets leaking local paths** — Git stores symlink targets as-is in blobs, but relative targets are the norm in repositories. Absolute targets in a committed symlink are already visible in `git show`, so the digest leaking them isn't a new exposure. Worth documenting but not a security regression.

**From Reviewer A:**

9. No disagreements with A's assessment.

## New points not raised in round 1

10. **The `lstat` bug's blast radius** — beyond wrongly hashing unreadable files as deleted, this creates a **bypass**: an attacker who can trigger a permission error (e.g., platform-dependent file locking) can force a digest to exclude that file's real content. This is fail-open on the enforcement primitive.

11. **Digest framing not explicitly verified** — Reviewer B raised it; neither reviewer tested it. The code hashes `path` then `content` with no visible length prefix. Without framing, collisions are possible:
   - File `a` with content `b\0c`
   - Files `a\0b` and `c`
   
   Could hash identically if the separator appears in content. A regression test should verify one crafted file cannot collide with two framed files.

12. **The `derived` parameter's introduction** — `subjectDigest` now takes `derived?: readonly string[]`, passed through to `gatedFilesOf`. The contract says "one list, handed down". But the CLI (`ratification_subject.ts`) computes its own `derived` separately via `derivedFor(root)`, then calls `gatedFilesOf(files)` *without it* to display coverage. This isn't just a display bug — if the two `derivedFor` calls produce different closures (e.g., one tree has a new module the other doesn't), the coverage list and digest classify differently. The fix: expose `expectedSubjectFor` to return `{ digest, gatedFiles }` and use that in both places.

---

## Answering the nine questions directly:

**1. Behaviour changes:** Gate requires `subject:` matching a SHA-256 digest of gated files. Computed from working tree (not Git objects). Refuses absent/malformed/mismatched digests. `lstat` error handling treats all errors as deletion (fail-open bug).

**2. Authority boundary:** Narrower — records bound to content. But the digest implementation isn't gated (step 4.1 staged), and `readRatification`'s default `expectedSubject = null` allows non-binding reads.

**3. Weakening tests/gates:** No explicit weakening. BUT the `UNGATED` fixture change contradicts the description: test says contract IS gated post-step-4.1, description says expansion was reverted. One of these is wrong.

**4. Other bypass routes:** Yes: (a) digest implementation ungated; (b) `lstat` bug lets permission errors produce wrong digest; (c) CLI/gate divergence.

**5. Undone how:** Clean revert by merge authority. No migration debt (old records stay valid).

**6. Falsifiability:** Test verifies one-byte edits caught. Omitted: (a) digest framing regression test; (b) non-ENOENT stat errors must fail, not hash as deleted; (c) CLI coverage must match gate classification.

**7. Smaller change:** No — appropriately minimal after staging.

**8. Standing instruction weight:** ~40 contract lines, proportionate. Some language ("makes impossible") should weaken to "detects" per limit #3.

**9. Untrusted steering:** The `lstat` catch-all is exploitable. Digest framing unverified. Path normalization via `gatedFilesOf` likely sufficient but not proven.

---

## Stance: **REQUEST_CHANGES**

The direction is sound and the staging correct, but **two critical issues block landing**:

### Blocker 1: Fail-open `lstat` error handling
```diff
-        } catch {
-            stat = null;
+        } catch (err: any) {
+            if (err?.code === 'ENOENT') {
+                stat = null;
+            } else {
+                throw err; // permission/IO errors must fail closed
+            }
```

Add regression test: file with `chmod 000`, verify `expectedSubjectFor` throws rather than hashing as deleted.

### Blocker 2: Resolve `UNGATED` inconsistency
Either:
- The contract IS gated (step 4.1 landed), so description is wrong
- The contract is NOT gated (expansion reverted), so test comment is wrong

This isn't cosmetic — it's evidence about whether the revert was complete.

### Recommended (not blocking):
- Add explicit digest framing test (one file vs two files with embedded path separator)
- Fix CLI divergence: export `{ digest, gatedFiles }` from one call, use in both gate and CLI
- Document symlink absolute-target case (already visible via `git show`, not a new leak)

**Single highest-leverage change:** Fix the `lstat` error handling — that's a correctness bug allowing wrong digests on unreadable files, undermining the entire binding mechanism.

### openai — `refused` (round 1)

Matze, Reviewer B identified multiple merge-blocking defects that Reviewer A missed. The content-binding direction is sound, but the implementation and documentation do not yet justify ratification.

## Prior-round assessment

### 1. Points I agree with

Reviewer A is right that:

- The enforcement path now supplies `expectedSubject`, while legacy/read-only callers may omit it.
- Existing verdict, diversity, provider, and self-review checks remain in place.
- The change is substantially narrower than the earlier branch and is mechanically reversible.
- Symlinks are correctly distinguished from regular files and deletions.

Reviewer B is right that:

- `ratification_subject.ts` displays `gatedFilesOf(files)` but computes the digest through `expectedSubjectFor(files, root)`, which additionally supplies `derivedFor(root)`. The displayed coverage can therefore disagree with the actual digest.
- `_lib/ratification_subject.ts` converts every `lstatSync` failure into a deletion. Permission, I/O, and transient filesystem errors must not be represented as an absent file.
- “A record carries one change” and “makes impossible” overstate what the digest proves. An authorized author can update both content and the typed digest without proving renewed reviewer assent.
- Changing `UNGATED` from the contract to `docs/architecture.md` is suspicious because its comment says step 4.1 gated the contract, while the supplied scope statement says that step was reverted.
- The self-reviewing implementation remains outside the governed surface, leaving a delayed route for changing future digest semantics without ratification.

### 2. Points I disagree with or would qualify

Reviewer A’s statement that there is “no untrusted input” is unsupported. The CLI accepts path arguments, file contents are arbitrary bytes, and the shown filesystem access is `path.join(root, rel)`. Classification may constrain those paths, but that invariant and containment are not established by this diff.

Reviewer A also says it “verified the five reversions produce empty diffs.” That cannot be established from the supplied artifact alone and should not have been claimed.

Reviewer B’s framing concern is plausible but not proven from this `-U1` excerpt: the unchanged hash-update lines after `h.update(rel)` are absent. I would require inspection or a collision-encoding test before calling the serialization defective.

Revision-based hashing would be stronger, but I would not require that broader redesign to merge this narrowly scoped binding. Clean CI checkouts can make working-tree hashing acceptable if read failures are fail-closed and the limitation remains explicit.

## Nine questions

### 1. What behaviour changes?

Changed ratification records must now contain a lowercase 64-character SHA-256 `subject` matching the digest of the changed gated paths and their current working-tree representations. Missing, malformed, and mismatching subjects fail separately. Deletions and symlink target strings receive distinct representations.

Consequences beyond the headline:

- Every candidate artifact is checked against one digest covering the complete gated file set, not necessarily one logical change.
- Authors must regenerate the subject after relevant rebases or edits.
- Existing records are grandfathered only because records outside the changed-file list are not read.
- Non-enforcement callers retain legacy behaviour through `expectedSubject = null`.
- The CLI’s reported coverage can differ from what it actually hashes.
- Some filesystem errors are silently represented as deletion.

### 2. Which authority or safety boundary changes?

The immediate safety boundary narrows: an unchanged record cannot authorize later-modified gated bytes.

Authority does not formally expand, but the control remains incompletely self-protecting. Because the digest implementation, CLI, and contract are not governed, ordinary merge authority can change how future ratifications are bound without passing this control. That is a material residual boundary, even if deliberately staged.

### 3. Does it weaken anything that judges it?

No explicit threshold, assertion, skip, or verdict rule is weakened.

However, the `UNGATED` fixture change deserves correction. Its new comment asserts that the contract became gated in step 4.1, contradicting the stated scope in which step 4.1 was reverted. Replacing the fixture keeps the test green while avoiding an explicit test of the disputed path. Add a direct classification assertion showing whether `docs/contracts/ratification-artifact.md` is gated in this revision.

The import-cycle regression test is also weaker than its prose claims if the module has already been imported in the test worker. A dynamic import is not necessarily “deliberately FIRST” when other test modules or top-level imports have populated Node’s module cache.

### 4. Is another host or projection a way around it?

Yes, or at least insufficiently ruled out:

- The ungated digest implementation can later alter enforcement semantics.
- The CLI presents a different projection of coverage from the digest operation.
- Other callers may use `readRatification(..., expectedSubject = null)`; authoritative callers have not been enumerated here.
- Updating content and typing a newly computed subject bypasses stale-record detection without proving reviewers approved the new bytes. The contract acknowledges the assertion/proof distinction, but its “impossible” language does not.

### 5. Can it be undone?

Yes. A normal merge-authorized revert can atomically remove the reader field, digest enforcement, helper, CLI, contract text, and related tests. Existing records require no data migration; newer records retain an ignored extra field after rollback.

The revert should target a revision whose workflow still uses the pre-binding gate and should not revert only the reader or gate independently, as that would leave policy and implementation inconsistent.

### 6. What would falsify the benefit, and what rollback criteria are missing?

The benefit is falsified if:

- Changed gated bytes pass under an unchanged stale record.
- The displayed coverage differs from the hashed coverage.
- Two clean checkouts of the same revision and file list produce different subjects.
- A non-absence filesystem error is treated as a valid deletion.
- A change to the ungated digest implementation changes later gate outcomes without ratification.

No operational kill-switch or rollback threshold is specified. At minimum, unexplained digest nondeterminism, coverage/reporting disagreement, or any unreadable-file-as-deletion event should block rollout or trigger revert.

### 7. Would a smaller change do?

The reader, digest calculation, enforcement, format documentation, and core regression tests form a coherent minimum feature.

The human-readable coverage projection is separable and currently incorrect. Either omit it for this PR or expose one operation returning both the exact covered paths and digest, then use that result in both the gate and CLI. That is smaller and safer than maintaining two calls with different classifier inputs.

### 8. What standing instruction weight is added?

It adds permanent artifact-format and workflow documentation, but no new general Iron Law. The weight is proportionate to a governance mechanism.

Some of that weight is presently misleading: “a record carries one change,” “makes impossible,” and the fixture comment claiming the contract is gated should be corrected.

### 9. Can untrusted content steer the path?

Potentially. CLI arguments determine candidate paths, and arbitrary repository bytes enter the hash. The shown code does not itself demonstrate that absolute paths and `..` traversal are rejected before `path.join(root, rel)`.

The classifier may already provide that bound, but this security property should be explicit and tested. Digest records should also use unambiguous tagged, length-framed encoding; the omitted unchanged lines prevent confirming that property from this artifact.

## New points and refinements

- The CLI silently accepts a missing `--root` value by resolving `"."`:

  ```ts
  root = path.resolve(argv[i + 1] ?? '.');
  ```

  This should be a usage error, especially for a command whose output is copied into a governance record.

- `catch { stat = null; }` is more than weak error reporting: it can make an unavailable existing file digest-identical to a deletion. This directly violates the claimed deletion semantics.

- The coverage mismatch is not merely cosmetic. The CLI explicitly says its list exists to prevent copying a confident-looking digest over no files, yet the list is not derived using the same closure as the digest. The safeguard can therefore emit the exact false reassurance it claims to prevent.

- The added import cycle is justified only by comments and a fragile cache-sensitive test. A shared classifier/result abstraction would remove the cycle and the coverage divergence together.

**REQUEST_CHANGES** — the direction is correct, but fail-open filesystem classification, divergent CLI coverage, contradictory fixture documentation, and an incompletely protected enforcement implementation make the current gate unreliable; the highest-leverage change is one fail-closed operation returning `{ digest, gatedFiles }`, used unchanged by both gate and CLI, with explicit path-containment and filesystem-error tests.

**Stance: refused — content binding is valuable, but this implementation can misdescribe what it hashed and can encode read failures as valid deletions.**

## What was NOT done after the review, and why that is the honest action

The finding is a defect in code this lane wrote three hours earlier, and the
reflex is to fix it and run a third round. That is not what happened, for two
reasons that point the same way.

**The instruction this lane runs on bounds it at two.** A twice-refused change
is the owner's call, via the owner-permission route, and a third round decided
on the agent's own judgement that the next one would pass is precisely the
judgement the bound removes.

**And fixing it now would break the thing this change is about.**
`evaluate()` lives in `check_kernel_edit_ratified.ts`, a gated file. Editing it
after the seats answered moves the `subject`, so either this record goes stale
or it is rebound to content its reviewers never saw. The second is the exact
defect the binding exists to catch. A change whose first act would be to
launder its own record is not a change that should land.

So the finding is a **tracked open step** on
`road-to-self-modification-that-a-council-must-pass` instead — step 2.3, with
the council's words — which is the second of the two dispositions
`fix-what-you-see` allows, and the one that does not require the record to lie.

## What moved after the seats answered, and what it proves

One file changed between the tree round 2 reviewed (`fa8a3ef93`) and the tree
this record is bound to: `src/scripts/_lib/ratification_subject.ts`, where a
parameter property named `cause` was renamed to `errno` because it shadowed
`Error.cause` and `tsconfig.scripts.json` refused it.

That file is **not gated** — step 4.1, which would have gated it, is staged off
this branch — so the digest is unchanged, and the `subject` above is the digest
of exactly what the seats read. Stated rather than left to be assumed, because
"nothing relevant changed" is the sentence a reader cannot check and this one
is: `git diff --name-only fa8a3ef93 HEAD` returns that one path, and
`ratification_subject` reports the gated set as
`check_kernel_edit_ratified.ts` and `_lib/ratification_artifact.ts`.

## What happens next

`check_kernel_edit_ratified` is red on this diff, and that is the mechanism
working: an agent changed the surface that governs it, two independent
providers reviewed the change across four rounds in total, and it does not land
on the agent's say-so. Nothing an agent writes passes the gate in this case,
and nothing in this change tried to.

Under § When the user decides this is condition 1 — a refused review — so the
route is `ratification-artifact.md` § The owner-permission-route: the owner's
own recorded act on the forge, preceded by an ask. The open question for that
ask is narrow and is stated here so it does not have to be reconstructed: the
design is accepted by both seats in both rounds — "the core design is sound",
"the overall scope remains appropriately narrow" — and what stands between it
and a passing record is one error boundary in `evaluate()` plus the end-to-end
test that proves the gate returns `exitCode 1` rather than a stack trace.
