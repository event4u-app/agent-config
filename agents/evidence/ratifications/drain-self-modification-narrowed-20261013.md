---
proposed_by: claude/drain-self-modification-council-20261012
implemented_by: claude/drain-self-modification-council-20261012
reviewed_by: ai-council
subject: 4174f49a0b16ed8a4d55fec7c4892149f5e2f802e5cab6c8c4a0d8299d0e997e
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
recomputes that digest — since round 6, from Git objects at a commit — and
refuses a record whose `subject` is absent, malformed or different. Steps 2.1 and 2.2 of
`road-to-self-modification-that-a-council-must-pass`.

**Seven rounds, seven refusals. Round 7 (2026-10-14, after round 6's finding
was fixed — the gate resolves `--rev` once and passes the commit id to the
diff, the digest and the record read) was answered by one seat: anthropic
refused, on the CI path's changed-file list, which comes from `gh pr view
--json files` and may report a renamed gated file only under its destination;
openai gave no final verdict (`os_error: ENOBUFS`, a local spawn-buffer
overflow). Round 6 had accepted the object-store design and refused 2/2 on the
gate resolving a mutable revision more than once in one run. This record does
not let the change land.**

**The header is bound to the tree as it stands now, not as rounds 1 and 2 read
it, and that is the binding working rather than a record being rewritten.**
`subject` moved from `6ce10afe…` to `1aff2b49…` when round 2's finding was
fixed in a gated file, to `3317942a…` when a merge of `origin/main` brought
a comment-only edit to `check_kernel_edit_ratified.ts`, to `20a33577…` when
round 4's fixes changed the catch and comments in that file, and to
`f6ac2f8c…` when the gate learned `--rev` and the serialisation gained the
mode, to `6eea14ee…` when the gate resolved `--rev` once (step 2.7), and to
`4174f49a…` when the workflow joined the gated set and the gate's usage
comment changed (step 2.8); `seats:` carries round 8's conclusions. Rounds 1 and
2 are kept verbatim below, headers and all; what the frontmatter asserts is
what the CURRENT content was last reviewed as, which is the whole point of the
field.

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


---

# Round 3 — 2026-10-13, the round-2 defect fixed, and refused on three new ones

Round 2's finding was repaired: one typed boundary in `evaluate()` catching
both `GatedFileUnreadable` and `GatedPathEscapes`, both post-`lstat` reads
wrapped, `O_NOFOLLOW` on the gated read, the two weak test cases strengthened,
and the `expectedSubjectFor` type-break finding measured away (`git show
origin/main:… | grep -c expectedSubjectFor` prints 0 — the function never
shipped). Prompt committed verbatim beside this file as
`drain-self-modification-narrowed-20261013-r3.question.md`.

The round was a split, and the split is recorded as a split rather than
flattened into a number.

## Seat: anthropic — `ratified`

> **Stance: ratified**
>
> Round 2's dealbreaker fixed completely — both error classes caught at one
> boundary, both post-stat reads wrapped with typed translation, CLI honors
> same contract. Three smaller findings addressed with measurements. Symlink
> swap question answered: all three race outcomes shown to fail closed via
> `O_NOFOLLOW` + measured refusals.
>
> **Highest-leverage change before merge**: None. The change is minimal for
> what it accomplishes, addresses all findings with measurements, and documents
> its limits honestly. Ship it.

It also named the error enumeration as the right shape — "a future third error
class won't get silently converted — stays a crash until the catch is updated"
— and the Windows `O_NOFOLLOW` fallback as honestly documented.

## Seat: openai — `refused`

> **Stance: refused** — the intended fail-closed design is sound, but its
> supposedly narrow error discriminator demonstrably admits Node programming
> errors and the close path still escapes the model.

Three findings, quoted rather than summarised because two of them are
demonstrably right and the lane does not get to soften them:

**High — `asErrno()` does not implement the distinction it documents.**

> "That does not establish that the error is an OS errno. Node programming
> errors such as `ERR_INVALID_ARG_TYPE` are typically `TypeError` instances
> with string `code` properties. Consequently, the stated guarantee that 'a
> `TypeError` from a future edit … stays a crash' is false: many such errors
> will become `GatedFileUnreadable`, concealing defects as ordinary refusals."

**This is correct and the lane concedes it without argument.** It is the same
fail-open shape round 1 was refused for, in a new place: the narrowness claim
in the header and the commit message is an overclaim, and the claim is the
thing that was reviewed. The seat names the repair — require numeric `errno`
plus `syscall`, or distinguish `ERR_*` from errno codes, with a regression
test that an `ERR_INVALID_ARG_TYPE`-shaped error is rethrown unchanged.

**Medium — `closeSync()` is outside the translation.**

> "An `EIO`, `EINTR`, or similar close failure therefore escapes as a raw Node
> error. It can also replace a successfully translated read error because an
> exception from `finally` overrides the pending exception. This contradicts
> both 'every failure of the subject computation is one structured refusal' and
> the claim that post-stat filesystem operations are covered."

Also correct. The `finally` block was written as cleanup and is a second
uncovered path, including one that can mask a primary failure.

**Medium — the CLI refusal path has no direct coverage.** Correct: the lane
flagged the CLI catch as an addition the finding did not ask for and invited
the seats to strike it; the seat's answer is that it should carry its own tests
or be split out.

It also corrected one of anthropic's statements: the permission cases use
`skipIf(asRoot)`, so "no tests skipped" is not accurate, though the conditional
skip itself is reasonable and weakens no existing judge.

## What was NOT done, and why

**Nothing was fixed in response to round 3.** The instruction this lane runs on
bounds the narrowed change at a third refusal, and the bound is the point: a
fourth round decided on the agent's own judgement that the next one would pass
is exactly the judgement the bound removes. Two of the three findings are
correct on their face, which makes fixing them tempting and makes the bound
more load-bearing, not less — the editor of a governance surface judging when
its own reviewers have asked enough is the failure this whole mechanism exists
to prevent.

The findings are **not lost**: they are the content of the next step, with the
seats' words, exactly as round 2's finding became step 2.3.

## What happens next

`check_kernel_edit_ratified` is red on this diff, and that is the mechanism
working: an agent changed the surface that governs it, two independent
providers reviewed the change across five rounds in total, and it does not land
on the agent's say-so.

Under § When the user decides this is condition 1 — a refused review — so the
route is `ratification-artifact.md` § The owner-permission-route: the owner's
own recorded act on the forge, preceded by an ask. The ask is now narrower than
it was after round 2, and is stated so it does not have to be reconstructed:

- **The design is not in dispute.** Both seats, all three rounds, said the core
  design is sound and the scope appropriately narrow. Question 7 came back
  "no smaller change would do" every time.
- **One seat holds it ready to ship.** Anthropic's round-3 answer names no
  pre-merge change at all.
- **The other names three defects in the error model's edges** — the `asErrno`
  discriminator, `closeSync` outside the boundary, and the untested CLI path.
  None touches the binding itself; all three are in the refusal plumbing added
  to satisfy round 2.
- So the owner's question is not *is the binding right* but *does this land now
  with three edge defects tracked, or does it wait for a fourth round that the
  agent is not permitted to call for itself.*


---

# Round 4 — 2026-10-14, round 3's three findings fixed, and refused 2/2 on a new one

The owner's decision of 2026-10-14 was to fix round 3's three findings and run
a fourth round, merging only if both seats ratify. The fixes:

- **`asErrno()` admitted Node programming errors.** It now requires a string
  `code` outside `ERR_`, a numeric `errno` and a string `syscall`; one helper,
  `refuseOrRethrow`, applies it at the `lstat`, open, read, close and readlink.
  The `lstat` catch had the same construct and was moved onto the same
  discriminator. Red-proof: reverting the discriminator reds the three new
  cases (3 of 27); reverting the `lstat` catch reds its mocked case.
- **`closeSync()` outside the translation.** No `finally`: a close failure
  after a successful read is a refusal; after a failed read it is discarded and
  the read failure propagates. Red-proof: restoring the `finally` shape reds
  both close cases (2 of 5, `ratification_subject_fs_faults.test.ts`).
- **The CLI refusal path untested.** `ratification_subject_cli.test.ts` invokes
  `main()`: exit 0 with a digest on a readable tree; exit 1, empty stdout, the
  error on stderr for an unreadable file and for an escaping path; a mocked
  `TypeError` propagates unchanged. Red-proof: removing the catch reds 2 of 4;
  making it blanket reds the propagation case.

Prompt committed verbatim beside this file as
`drain-self-modification-narrowed-20261013-r4.question.md`. It was narrowed to
the council's 50 KB bundle ceiling, and says what it omits:
`_lib/ratification_artifact.ts`, the contract, and rounds 1–3's test changes.
Both seats said the omission bounds their whole-PR conclusions.

## Seat: anthropic — `refused`

The response closes `REQUEST_CHANGES` and says "Cannot ratify when a blocking
availability defect exists"; it carries no literal `Stance:` line, and
`REQUEST_CHANGES` with an explicit refusal to ratify is recorded as `refused`.

> "the three round-3 findings are correctly fixed, but treating every
> non-symlink as a regular file leaves a FIFO able to hang the process
> indefinitely; fix by requiring `stat.isFile()` before opening and add a
> regression test for unsupported filesystem object kinds."

Further points, not stated as blocking: the `O_NOFOLLOW` fallback should be an
explicit refusal rather than a documented degradation; the digest describes
the working tree, not the revision; `--quiet` prints a well-formed digest over
an empty gated set with no warning; the `selfSetCache` TDZ fix has no case that
shows the TDZ firing; the review-history docblocks are "the highest-leverage
reduction".

## Seat: openai — `refused`

> "**Stance: refused — add a typed, tested refusal for unsupported filesystem
> object kinds.**"

> "the round-3 defects are fixed, but treating every non-symlink object as a
> regular file can hang the governance gate; the highest-leverage pre-merge
> change is to reject non-regular filesystem objects before opening them."

It qualifies the severity — Git cannot store a FIFO, and an adversary who can
write the checkout can also edit the gate, so it is "primarily a robustness and
availability defect" — and holds it merge-blocking because the fix is small.
New, not stated as blocking: `assertContained()` is POSIX-shaped, so
backslash-separated `..` and UNC / rooted Windows paths are not refused; either
reject both separator forms or restrict the CLI to POSIX. It also asks for the
round-by-round history to move out of production docblocks.

## What was NOT done, and why

The new finding was not fixed in this lane. The owner authorised fixing round
3's three findings and one further round; a fifth round is not the lane's to
call, and re-running round 4 with a different prompt would be verdict
shopping. The finding is carried into the roadmap as step 2.5, with the seats'
words. `check_kernel_edit_ratified` stays red on this diff, so the branch
cannot be pushed through the pre-push preflight or merged; the disposition is
the owner's.


---

# Round 5 — 2026-10-14, round 4's findings fixed, and refused 2/2 on a new one

The owner's decision of 2026-10-14 was to fix round 4's confirmed findings,
re-present, and merge only if both seats ratify. The fixes (commit `d7e34efdd`,
roadmap step 2.5):

- **Non-regular gated paths.** After the `lstat`, only an absent path, a link
  or a regular file is handled; anything else is a `GatedPathUnsupported`
  raised before any `open`. The open adds `O_NONBLOCK` and an `fstat`, so an
  object swapped in after the stat is refused without blocking. All three
  refusal classes extend `GatedSubjectRefusal`, which `evaluate()` and the CLI
  catch as one class.
- **Non-blocking notes, all four done.** A missing `O_NOFOLLOW` or `O_NONBLOCK`
  is a refusal; `--quiet` over an empty gated set warns on stderr;
  `assertContained()` refuses backslash `..` and UNC / rooted /
  drive-qualified paths on its own input (through `gatedFilesOf` those were
  already refused by the backslash normalisation); the round history left the
  three production files' comments.

Red-proof, each mechanism neutralised in place and restored from a copy: kind
check 5 of 16 red, `fstat` check 2 of 16, `O_NONBLOCK` 1 (the flags case, run
alone), missing-flag refusal 2 of 16, containment 1 of 29, `evaluate()` catch
1 of 10, CLI catch 1 of 6, `--quiet` warning 1 of 6. After restoring, the 10
ratification / kernel-edit suites pass (155 tests).

Prompt committed verbatim beside the others as
`drain-self-modification-narrowed-20261013-r5.question.md` (49,228 bytes, under
the 50 KB ceiling). It omits `_lib/ratification_artifact.ts`, the contract,
rounds 1–4's test changes, the roadmap and the evidence files, and says so.
Run once, CLI transport (`--prompt-mode pr --rounds 2`, no peer review), both
seats present, nothing billed.

**What the artefact keeps.** Only the second-pass texts are persisted. Both
quote a first-pass "Reviewer A" whose stance was `ratified`; the run's
`blind_review_map` labels Response-A as anthropic. The first-pass texts are not
in the artefact and are not reconstructed here. The verdicts below are the
second-pass conclusions, which is what the run concluded with.

## Seat: anthropic — `refused`

> "**REFUSED** — the change touches a governance surface and claims a
> containment property it does not deliver."

> "the highest-leverage pre-merge change: refuse paths where any parent
> component is a symbolic link. Walk from root to leaf, `lstat` each parent,
> throw `GatedPathEscapes` if any `isSymbolicLink()`. Add the regression test
> Reviewer B specifies: gated child deleted, parent replaced with symlink to
> attack content; assert refusal. Correct the comment claiming symlinks are
> never dereferenced."

It confirms round 4's finding addressed: "The three-layer refusal (kind before
open, `O_NONBLOCK` at open, kind after open) is appropriate. Round-4's shared
finding is addressed." And it names the comment this round introduced as the
contradiction: the module header's "What it never does is follow a symbolic
link" is "**false**. Intermediate components are dereferenced."

## Seat: openai — `refused`

> "**REQUEST_CHANGES** — the digest can bind content reached through an
> intermediate symlink rather than the reviewed Git path; the
> highest-leverage pre-merge change is to hash an explicit Git revision, or at
> minimum refuse every symlinked ancestor and add the regression test above."

> "**Stance: refused**"

Its required test: "Construct a tree in which a gated child was changed or
deleted, replace one of its parent directories with a symlink to a separate
directory containing a regular file at the remaining suffix, then assert that
subject computation refuses before hashing it." It also judges the new tests
"meaningful and appear additive", and states that question 3 cannot be cleared
for the whole PR because the parser, earlier tests, the workflow and most of
the contract were outside the bundle.

## Honest reading

The finding is correct. The module already said intermediate components are
resolved; what this round added is a header sentence — "What it never does is
follow a symbolic link" — written while moving the history out of the
comments, which states the stronger property the code does not have. Both
seats read that sentence back to the change.

## What was NOT done, and why

The new finding was not fixed in this lane: the owner authorised the round-4
fixes and one round, merging only on a 2/2 ratification, and re-running round 5
with a different prompt would be verdict shopping. It is carried into the
roadmap as step 2.6, in the seats' words. The branch is not pushed:
`check_kernel_edit_ratified` refuses a `refused` record at the pre-push
preflight, and the disposition is the owner's.


---

# Round 6 — 2026-10-14, the digest read from Git objects, and refused 2/2 on a new finding

The owner's decision was again to fix the confirmed findings, re-present, and
merge only on 2/2. Rounds 3, 4 and 5 had each refused the working-tree reader
on a new filesystem defect, so instead of an ancestor walk the author took the
alternative openai named in round 5: the subject is read from Git objects at an
explicit revision (commits `a80f2ce87`, `1efd028cb`, `f6733aa37`, `50d20d11e`;
roadmap step 2.6, decision D13). In short: the revision resolves to a commit,
each gated path is looked up with `git ls-tree` and read with `git cat-file`,
the gate reads the record at the same commit, a gated path committed as a
symbolic link (mode `120000`) is refused, the entry hashes the mode, and git
failures are typed refusals. The working-tree reader and the tests that drove
it are removed; each removal is accounted for in
`agents/evidence/reviews/ratification-subject-git-revision-test-removals.md`.

Red-proof: the new revision suite was run against the round-5 reader before the
change, 16 of 17 red on their assertions (the 17th was replaced, see the
prompt); afterwards the subdirectory-root refusal (1 of 18), the regular-mode
check (2 of 18), the programming-error case (1 of 18), the CLI `--rev` usage
check (1 of 7), and four cases against the round-5 lib and CLI swapped back in
were each seen red and restored from copies. After restoring, the 10
ratification / kernel-edit suites pass (148 tests).

Prompt committed verbatim beside the others as
`agents/evidence/council/drain-self-modification-narrowed-20261013-r6.question.md`
(49,653 bytes, under the 50 KB ceiling). It carries the gated files' diff
against `origin/main`, `_lib/ratification_subject.ts` in full, and the CLI and
contract diffs since round 5; it omits every test file, the roadmap, the
removal account and this record, and says so. Run once, CLI transport
(`--prompt-mode pr --rounds 2`, no peer review), both seats present
(`anthropic/claude-sonnet-4-5`, `openai/codex-default`), nothing billed.

**What the artefact keeps.** As in round 5, only the second-pass texts are
persisted. Both quote a first-pass "Reviewer A" whose stance was `ratified`;
the run's `blind_review_map` labels Response-A as anthropic. The first-pass
texts are not in the artefact and are not reconstructed here. The verdicts
below are the second-pass conclusions.

## Seat: anthropic — `refused`

> "**Stance: refused**"

> "The implementation resolves `revision` independently for: 1. Changed-file
> discovery (`git diff <base>...<revision>`) 2. Content hashing
> (`resolveRevision(root, revision)`) 3. Record reading (same call). A mutable
> revision (HEAD, branch, tag) may therefore identify **different commits**
> during one run, violating the contract's repeated "one commit" claim and the
> operational guarantee that diff, digest, and record agree."

> "**Highest-leverage pre-merge change:** Resolve `--rev` exactly once in
> `main()` to an immutable commit OID [...] Pass that OID through all
> operations."

Secondary: "Validate `--rev` has value in gate CLI (match standalone CLI)" and
"Add test: moving HEAD between operations breaks without fix, passes with
fix". It agrees that the "filesystem attack surface [is] eliminated by
Git-objects approach", that the "symlink/FIFO/ancestor defects [are] resolved
by construction", and that the "larger change [is] justified given three-round
pattern of filesystem findings". On the excluded tests: "Not silent weakening.
Trust the implementer, but note it's trust-based, not evidence-based from this
review."

## Seat: openai — `refused`

> "REQUEST_CHANGES — Stance: refused — the gate does not yet ensure that
> changed-file discovery, hashing, and record reading use one immutable commit;
> the highest-leverage pre-merge change is to resolve `--rev` once before the
> diff and pass that OID through every subsequent operation, with shared strict
> option parsing."

> "The object-store design is sound, but the implementation does not yet
> guarantee the promised “one commit” boundary."

It also asks that the empty-gated-set exception — no git call, so an invalid
`--rev` passes when nothing is gated — be "stated explicitly in the contract",
that `gitChangedFiles()` "share the same Git runner" as the subject's git calls
rather than "maintaining two subtly different subprocess policies", and names
the mutual import between the gate and the subject module as "additional
permanent maintenance cost that extracting shared classification into a neutral
module could remove". On tests: "No visible production assertion is weakened.
[...] However, the omitted tests prevent independent confirmation that every
removed filesystem assertion has an equivalent replacement".

## Honest reading

The finding is correct and the author missed it. `main()` passes the revision
NAME to `git diff <base>...<rev>` and then to `evaluate()`, which resolves it
again; the content and the record do share one resolution, but the
changed-file list does not. On the `--files` path (CI) there is no diff and the
split does not arise; on the pre-push path it does. The gate's `--rev` parsing
also silently keeps `HEAD` when the value is missing, as its older `--root`
and `--base-ref` do, while the subject CLI refuses — the inconsistency the
seats name. No seat disputed the object-store design or the symlink refusal.

## What was NOT done, and why

The new finding was not fixed in this lane: the owner authorised one round,
merging only on 2/2, and re-running round 6 with a different prompt would be
verdict shopping. It is carried into the roadmap as step 2.7, in the seats'
words. The branch is not pushed: `check_kernel_edit_ratified` refuses a
`refused` record at the pre-push preflight, and the disposition is the owner's.


---

# Round 7 — 2026-10-14, one gate run reads one commit, and refused by the one seat that answered

The owner's route was again to fix the confirmed findings, re-present, and
merge only on 2/2. Round 6's shared finding was fixed as roadmap step 2.7
(commits `4d8b8e2b2`, `1448d3b02`, `419f076bd`, `0e207508b`, `820a4eda1`):
`main()` resolves `--rev` once to a commit id and passes that id to the diff,
the digest and the record read; the diff (`changedFilesBetween`) and the
default-base probe (`refExists`) run through the subject's scrubbed git runner;
`optionValue` is shared with the subject CLI, so a valueless `--rev`, `--root`,
`--base-ref` or `--policy-root` is refused (exit 1); the contract states the
one-commit rule and the empty-gated-set exception. Writing the new diff call
the author also found, and fixed, that rename detection listed a gated file
moved to an ungated path only under its destination on the pre-push path
(`--no-renames`). The mutual import was left as it stands.

Red-proof: with the fix neutralised in place (the diff given the revision
NAME, the gate's valueless-option refusal replaced by `continue`), 3 of 21
cases red — the moving-ref case on the subject mismatch, and both valueless
`--rev` shapes; restored from a scratch copy, 21 of 21 green. The rename case
was red before `--no-renames` (`scanned: 1`, "nothing to ratify", exit 0) and
green after. The moving-ref case uses a `git` wrapper on `PATH` that advances
the branch right after the first git call naming it, and asserts the move
happened. After the changes the 10 ratification / kernel-edit suites pass (152
tests).

Prompt committed verbatim beside the others as
`agents/evidence/council/drain-self-modification-narrowed-20261013-r7.question.md`
(39,947 bytes). It carries the gated files' diff against the merge base,
`main()` in full, and the lib, CLI, contract and revision-suite diffs since
round 6; it omits the rest of the lib, CLI and contract, every other test file,
the workflow, the roadmap, the removal account, this record and earlier
prompts, and says so. Run once, CLI transport (`--prompt-mode pr --rounds 2`,
no peer review, as round 6), both seats dispatched
(`anthropic/claude-sonnet-4-5`, `openai/codex-default`), nothing billed. The
quorum line after the run: `1/2 present, needed 1 — concluded. ⚠️ DEGRADED — 1
member(s) did not answer; this is not convergence.`

**What the artefact keeps.** Only the second-pass texts are persisted. The
anthropic text quotes a "Reviewer A" and a "Reviewer B"; the run's
`blind_review_map` lists only Response-A (anthropic). The first-pass texts are
not in the artefact and are not reconstructed here.

## Seat: anthropic — `refused`

> "**REQUEST_CHANGES**"

> "The local race and rename fixes are credible and well-tested. But the
> **authoritative CI projection** can still miss the old side of a rename, and
> no end-to-end test covers it. The highest-leverage change: make CI derive
> paths through the same `--no-renames` Git implementation—or verify inclusion
> and add CI regression test—before merge."

> "If GitHub's file projection reports renamed files only by destination,
> moving `src/rules/kernel-rule.md` to `src/guidelines/moved.md` would produce
> an empty gated set and pass without ratification—the exact bypass the local
> rename test prevents."

On the questions: "Weakening: None. 22 tests, all new seen red, no changed
assertions." "Alternate path: Yes—CI via `gh pr view --json files` bypasses
`changedFilesBetween()` entirely." On the mutual import: "coupling debt, not a
blocker". On the contract's statement that the CI path is unchanged: "A
governance gate whose documented guarantee excludes its production projection
is not production-ready."

## Seat: openai — `no-final-verdict`

The seat did not answer: the artefact records `os_error: ENOBUFS`, a local
spawn-buffer overflow, and no text. The probe record then marked the seat
`other`, which skips it on every later run until the entry is removed.

## Honest reading

The anthropic finding names a path this round deliberately did not touch and
the prompt said so: the CI step passes `gh pr view --json files` to the base
revision's gate under `--files`, so `--no-renames` does not reach it. Whether
that list carries a renamed file's old path was not established by the author
and is not established by the seat, which states it conditionally. The
workflow is itself a gated file (`WORKFLOW_PATH`), so changing it — for
example to let the base gate build the list from Git with `--base-ref`, as the
seat prefers — is a gated change and comes back to this review. No seat
disputed the one-commit fix or the object-store design.

## What was NOT done, and why

The run was not repeated to obtain openai's verdict: one run was authorised,
and with anthropic `refused` no second answer could make it 2/2. The new
finding is carried into the roadmap as step 2.8, in the seat's words. The
branch is not pushed: `check_kernel_edit_ratified` refuses a `refused` record
at the pre-push preflight, and the disposition is the owner's.

# Round 8 — 2026-10-14, CI lists paths through the gate's own diff, and refused 2/2 on its test

Round 7's finding was established before it was fixed. For PR 2344, which moves
a roadmap into `archive/`, `gh pr view --json files` lists the file once, as
`{"additions":5,"changeType":"RENAMED","deletions":4,"path":"agents/roadmaps/archive/…"}`
— no previous path — while REST `pulls/2344/files` carries `previous_filename`.
The list the workflow passed under `--files` did miss the old side of a rename.

Fixed on the owner's route of 2026-10-14 (fix, re-present, merge only on 2/2),
taking the seat's first option: the ratification step passes
`--base-ref "$BASE_SHA"` and no `--files`, so CI lists paths through
`changedFilesBetween()` (`HEAD` resolved once, `--no-renames`); the job already
checks out with `fetch-depth: 0`. The step also sets `diff.renames=false`
through `GIT_CONFIG_*` for a base copy whose own diff predates `--no-renames` —
the `origin/main` copy that judges this PR. Contract and the gate's usage
comment updated. Separately, the council CLI member spawn got
`maxBuffer: 64 MiB` (Node's 1 MiB default had produced round 7's `ENOBUFS`),
and the openai seat's stale probe entry was removed.

Red-proof: `check_kernel_edit_ratified_ci_path.test.ts` reads both gate
invocations out of the workflow step and runs them on a fixture that renames a
kernel rule to an ungated path. Red against the `--files` step (`scanned: 1`,
"nothing to ratify"), green after the switch, red again with `--no-renames`
removed in place, green restored from a scratch copy. The spawn-buffer test was
red before `maxBuffer` and green after. 11 ratification / kernel-edit suites
pass (153 tests). The environment override was checked by hand only: in a
one-rename fixture, plain `git diff --name-only` printed the destination, with
the three variables set it printed both paths.

Prompt committed verbatim as
`agents/evidence/council/drain-self-modification-narrowed-20261013-r8.question.md`
(40,414 bytes). Run once, CLI transport (`--prompt-mode pr --rounds 2`, no peer
review, as round 7), both seats dispatched (`anthropic/claude-sonnet-4-5`,
`openai/codex-default`). Before the run the council printed `cli-skip · openai
· unavailable` from the cleared probe entry and `1/2 present`; after the run:
`2/2 present, needed 1 — concluded.` Both seats answered; no re-run.

## Seat: anthropic — `refused`

> "**REQUEST_CHANGES**"

> "The rename fix is **technically sound** and the `subject` binding is **good
> hardening**. But the CI-path test doesn't exercise what the workflow
> description claims: \"Judging with the BASE revision's gate\" via
> environment compatibility."

> "The test would remain **green** if: Environment variables were misspelled;
> Git ignored them; Base gate didn't inherit them. That's the decisive
> production path, untested."

> "**Single highest-leverage change before merge**: Add an automated test
> verifying the environment-variable mechanism."

Also: the council buffer change is unrelated but "small, isolated, tested,
beneficial", not a blocker; the workflow comment's "round 7, step 2.8"
reference "will age poorly. Should point to ADR or contract instead."

## Seat: openai — `refused`

> "REQUEST_CHANGES — the implementation is credible, but the test does not
> cover the base-revision compatibility mechanism that authoritatively judges
> this PR; before merge, add a stable regression that runs legacy diff
> behavior with workflow-derived `GIT_CONFIG_*` values and proves red without
> the override and green with it."

> "Stance: refused — highest leverage is testing the actual legacy-base
> compatibility path; split Delta 5 if it is not required for this review."

Also: permanently loading the real merge-base gate would make the suite
history-dependent, so "a stable regression should execute a checked-in
legacy-gate fixture, or test the old diff operation under environment values
parsed from the workflow"; the kernel-rule bundle step's use of the same
GitHub list is "pre-existing, non-blocking for this diff" but "a credible
follow-up risk"; the round-specific workflow comment should be replaced by a
contract/ADR reference.

## Honest reading

Both seats accept the rename fix itself and refuse on its evidence: the new
test runs the HEAD gate, which carries `--no-renames`, so it says nothing about
the `GIT_CONFIG_*` override on which the BASE copy judging this PR depends —
the override was verified by hand, not by a test. That is accurate. Neither
seat disputed the design, the scope of the binding, or the one-commit fix.

## What was NOT done, and why

One run was authorised and it produced two verdicts, so it was not repeated.
The finding — a regression test that runs a rename-detecting diff under the
workflow-derived `GIT_CONFIG_*` values, red without them — is carried into the
roadmap as step 2.9 in the seats' words, with the two smaller asks (the
round-specific workflow comment; splitting the council buffer change). The
branch is not pushed: `check_kernel_edit_ratified` refuses a `refused` record
at the pre-push preflight, and the disposition is the owner's.
