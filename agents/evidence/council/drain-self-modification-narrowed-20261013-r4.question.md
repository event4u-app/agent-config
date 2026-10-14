<!-- evidence-type: analysis -->

<!-- Round-4 prompt of the modification review, 2026-10-14, committed
     verbatim beside its record. Not edited after the run. -->

# Modification review, round 4 — the narrowed content binding

Round 4 of the modification review of the narrowed content binding (PR #2325). Round 3 closed
split: one seat `ratified`, one seat `refused` on three findings. The owner
directed that the three findings be addressed and that the change come back
for this round. Each finding is quoted below with what was changed.

## Round 3's findings and what was changed

### 1. `asErrno()` admitted Node programming errors

> "Node programming errors such as `ERR_INVALID_ARG_TYPE` are typically
> `TypeError` instances with string `code` properties. Consequently, the stated
> guarantee that 'a `TypeError` from a future edit … stays a crash' is false
> […] Require OS-error evidence such as numeric `errno` plus `syscall`, or
> explicitly distinguish `ERR_*` Node API errors from filesystem errno codes.
> Add a regression test demonstrating that an `ERR_INVALID_ARG_TYPE`-shaped
> error is rethrown unchanged."

Changed: `asErrno()` (now exported) returns the error only when it is an
`Error` with a string `code` that does not start with `ERR_`, a numeric
`errno`, and a string `syscall`; otherwise `null`, and the caller rethrows the
original value. One helper, `refuseOrRethrow(rel, err)`, applies it, and every
filesystem call in the subject computation goes through it: the `lstat`, the
open, the read, the close and the readlink. The `lstat` catch previously cast
any thrown value to `ErrnoException` and translated everything except
ENOENT/ENOTDIR; it now uses the same discriminator, so a non-OS error from the
`lstat` is rethrown as well. That `lstat` site was not named in the finding;
it had the same construct.

Tests: `readGatedFile` / `readGatedLink` given a non-string path provoke a
real `ERR_INVALID_ARG_TYPE`; asserted to arrive as that `TypeError`, not as
`GatedFileUnreadable`. A third case
checks the discriminator directly: a real ENOENT passes; a real `ERR_*` error,
an `Error` carrying only `code: 'EACCES'`, and a plain object with all three
properties do not. A mocked-`fs` case throws an `ERR_INVALID_ARG_TYPE`
`TypeError` from `lstatSync` and asserts the identical object is rethrown.

### 2. `closeSync()` outside the translation

> "`fs.closeSync(fd)` runs in `finally`, outside the `catch` that translates
> filesystem failures. An `EIO`, `EINTR`, or similar close failure therefore
> escapes as a raw Node error. It can also replace a successfully translated
> read error because an exception from `finally` overrides the pending
> exception. […] The close operation must participate in the same explicit
> error model, preserving any primary read failure if both operations fail."

Changed: `readGatedFile` has no `finally`. Open, read and close are three
separate `try` blocks. If the read fails, the close is attempted, any error
from that close is discarded, and the read's error goes through
`refuseOrRethrow`. If the read succeeds, a close failure goes through
`refuseOrRethrow` and becomes a refusal. Stated so it can be judged: on the
read-failure path the discarded close error is discarded whatever its type,
including a non-OS one; the primary read error is what propagates.

Tests (a separate file mocking `node:fs`, every call delegating to the real
module unless a fault is armed): a close `EIO` after a successful read is a
`GatedFileUnreadable` with code `EIO`; a read `EIO` followed by a close
`EBADF` is a `GatedFileUnreadable` with code `EIO`; with no fault armed the
bytes are returned.

### 3. The CLI refusal path had no direct coverage

> "There is no test that invokes `main()` and verifies: both error classes
> return 1; the error goes to `stderr`; no digest is emitted; an unrelated
> programming error still propagates."

Changed: a new test file invokes `main()`: a readable tree exits 0 with a 64-hex digest on stdout and nothing on
stderr; a gated file with mode `000` exits 1, stdout empty, stderr naming the
path and "could not be read" (`skipIf` when running as root, as the existing
permission cases); a traversing gated path (`GatedPathEscapes`) exits 1,
stdout empty, stderr starting `error: `; with `expectedSubjectFor` mocked to
throw a `TypeError`, `main()` throws that same object and writes nothing to
stderr. The CLI header's exit-code line now lists `1`.

### Other remarks in round 3, not acted on

- `skipIf(asRoot)` remains on the permission cases and on the new CLI case.
- Question 8: "very long historical docblocks impose substantial standing
  reading cost". No docblock was shortened.

## Each new case, seen red

Each mechanism neutralised in place, suite run, file restored:

| Neutralisation | Result |
|---|---|
| `asErrno` back to "any `Error` with a string `code`" | 3 of 27 red in `ratification_subject.test.ts` (the three new cases) |
| `readGatedFile` back to the `finally` shape (with the new translator) | 2 of 5 red in `ratification_subject_fs_faults.test.ts` (both close cases) |
| `lstat` catch back to the cast-and-translate shape | 1 of 5 red in the same file (the `lstat` programming-error case) |
| CLI catch removed (always rethrow) | 2 of 4 red in `ratification_subject_cli.test.ts` (unreadable, escape) |
| CLI catch made blanket (no class check) | 1 of 4 red in the same file (propagation case) |

After restoring: 10 ratification / kernel-edit suites, 139 tests pass; `tsc
--noEmit` and eslint clean.

## A merge since round 3

`origin/main` was merged into the branch (no rebase). It brought one change to
a gated file: `b663b6075` rewrote a doc comment in
`check_kernel_edit_ratified.ts` (the kernel-rule reach paragraph; no code
lines). Because the subject digest binds gated bytes, that comment moved the
digest. Run locally against this branch's full changed-file list,
`ratification_subject` prints `subject: 3317942a1a32508b0fb50aaa422f2c237e9c7c9a695ac9fb493a2ca92f35802f`
over two gated files, `src/scripts/_lib/ratification_artifact.ts` and
`src/scripts/check_kernel_edit_ratified.ts`. The round-4 code changes are in
`src/scripts/_lib/ratification_subject.ts` and `src/scripts/ratification_subject.ts`,
neither of which is in that locally-computed gated set, so they did not move
the digest. (`closureArrivals` is documented as measuring only where base and
head trees differ, i.e. in CI.)

## What is in this bundle, and what is not

The scope of this review is the whole PR against `origin/main`
(`1696ac45b`). The bundle has a 50 KB hard ceiling, and the whole PR is about
360 KB, most of it prior rounds' prompts and records. Included below:

1. **The production-code change in the PR**, `src/` against `origin/main`,
   with no context lines, for three of the four changed source files.
2. **The test changes since round 3**, `tests/` from the round-3 tree to this
   head, with no context lines.

Not included, to fit the ceiling: `src/scripts/_lib/ratification_artifact.ts`
(the `subject` field and its three problem kinds, 65 changed lines, last
changed before round 2 and unchanged since), `docs/contracts/ratification-artifact.md`
(78 changed lines, likewise unchanged since round 2), the test changes from
rounds 1–3 (read in those rounds), the roadmap, and the evidence files (the
three earlier prompts and the ratification records). If a question below cannot be
answered from what you can see, say which part you could not see rather than
answering around it.

## The nine questions

1. What behaviour changes, including what follows from it that the diff does not state?
2. Which authority or safety boundary becomes wider or narrower, and in which direction?
3. Does the change weaken anything that judges it — a test, a gate, a threshold, this review? The standard is quoted rather than paraphrased: the implementer never silently weakens an assertion, deletes, skips or xfails a failing test, lowers a threshold, or changes fixture semantics to fit the code. Does this change do any of those?
4. Is another host or projection left as a way around the control this change touches?
5. Can it be undone, and how — by whom, with what authority, and against which revision?
6. What observation would show the claimed benefit to be false, and what rollback / kill-switch criteria does the change omit?
7. Would a smaller change do, and what does the larger one buy that the smaller one does not?
8. What does it add to standing instruction weight that every later session pays?
9. Could untrusted content steer the path this change opens, and what bounds it if so?

Close with a stance line carrying `ratified`, `confirmed-non-expanding`,
`refused` or `non-convergent`. `confirmed-non-expanding` is for a change that
touches a governance surface without expanding anyone's authority: same bar as
`ratified`, a classification and not a weaker approval.

Answer on the change in front of you. Do not weigh how many rounds this has
taken.

## Delta 1 — production code, PR against `origin/main` (three files)

```diff
diff --git a/src/scripts/_lib/ratification_subject.ts b/src/scripts/_lib/ratification_subject.ts
index 2a81823ed..511cdff4f 100644
--- a/src/scripts/_lib/ratification_subject.ts
+++ b/src/scripts/_lib/ratification_subject.ts
@@ -12,5 +12,6 @@
- * reports the self surface as a BOOLEAN, so the gated list cannot be read back
- * out of it. This module therefore imports the gate's own path constants and
- * re-assembles — it never restates the membership rule, because a second
- * definition of "gated" is a second thing to keep in step, and the first time
- * the two diverged a file would be reviewed by one and digested by the other.
+ * reports the self surface as a BOOLEAN, so that part of the gated list cannot
+ * be read back out of it. This module therefore imports the gate's own path
+ * constants and re-assembles — it never restates the membership rule, because
+ * a second definition of "gated" is a second thing to keep in step, and the
+ * first time the two diverged a file would be reviewed by one and digested by
+ * the other.
@@ -21,0 +23,9 @@
+ *
+ * WHAT IT READS, AND WHAT IT THEREFORE DOES NOT PROVE. It reads the WORKING
+ * TREE, not Git objects. A reviewer of this mechanism asked for revision-based
+ * hashing instead; that remains the stronger shape and is not what ships here,
+ * so against a dirty tree the digest describes the dirty bytes. What the same
+ * review DID change is the symlink case below — a dereferenced link made the
+ * digest depend on content outside the revision entirely, which is a different
+ * and worse defect than depending on an uncommitted edit, because no amount of
+ * cleanliness in the checkout removes it.
@@ -46,9 +56,265 @@ export const DELETED_MARKER = '\u0000deleted\u0000';
-/** The self surface, by the gate's own constants rather than a copy of them. */
-const SELF_SET: ReadonlySet<string> = new Set<string>([
-    SELF_PATH,
-    READER_PATH,
-    CLOSURE_READER_PATH,
-    POLICY_PATH,
-    WORKFLOW_PATH,
-    ...ANCHOR_PATHS,
-]);
+/**
+ * Prefixes the target of a gated path that is a SYMLINK, so the digest records
+ * the link rather than whatever it currently points at.
+ *
+ * A council review of this mechanism found the gap: `readFileSync`
+ * dereferences, so a gated path committed as a symlink was hashed as its
+ * target's bytes — which live outside the reviewed revision and can differ
+ * between two clean checkouts of the same commit. Git stores a symlink as a
+ * blob containing its target string, and that is what is hashed here, so the
+ * digest describes the committed object. A broken link is a link, not a
+ * deletion, and is recorded as one.
+ */
+export const SYMLINK_MARKER = '\u0000symlink\u0000';
+
+/**
+ * Raised when a gated path would resolve outside the tree under review.
+ *
+ * THIS DOC BLOCK USED TO DESCRIBE A DIFFERENT CLASS. It carried
+ * {@link GatedFileUnreadable}'s `lstat` / ENOENT argument verbatim, which says
+ * nothing about path containment and is now where it belongs. A comment that
+ * describes the wrong mechanism is worse than none on a governance surface: it
+ * answers a reader's question with another class's reasoning, and the reader
+ * has no way to know.
+ *
+ * The containment itself fails CLOSED rather than dropping the path —
+ * see {@link assertContained} for why that direction is the safe one.
+ */
+export class GatedPathEscapes extends Error {
+    constructor(readonly rel: string) {
+        super(
+            `gated path \`${rel}\` is absolute or contains a \`..\` segment, so joining it to ` +
+                'the tree root would read outside the revision under review — the digest refuses ' +
+                'rather than describing content that is not in the change',
+        );
+        this.name = 'GatedPathEscapes';
+    }
+}
+
+/**
+ * Refuse a gated path that would read outside `root`.
+ *
+ * FOUND BY THE TEST THAT PINS IT, on a 2026-10-13 council question: the gate's
+ * `KERNEL_RULE_PATH_RE` is `(?:^|\/)rules\/([a-z0-9-]+)\.md$`, which is NOT
+ * anchored at the start, so `../../elsewhere/rules/commit-policy.md` classifies
+ * as a kernel rule. That was harmless while the gate only read path NAMES. It
+ * stopped being harmless the moment this module began joining those names to a
+ * root and reading the bytes, which is what the content binding does — so the
+ * containment belongs here, with the read, and it FAILS CLOSED rather than
+ * dropping the path: dropping it would make the digest cover less than the gate
+ * gated, which is the divergence the same review refused elsewhere.
+ *
+ * Tightening the gate's own regex is a change to the gate's classification and
+ * therefore a separate, gated concern. This bound holds whatever that regex
+ * does.
+ */
+const ESCAPING_SEGMENT = /(?:^|\/)\.\.(?:\/|$)/u;
+
+function assertContained(rel: string): void {
+    if (rel.startsWith('/') || /^[A-Za-z]:[\\/]/u.test(rel) || ESCAPING_SEGMENT.test(rel)) {
+        throw new GatedPathEscapes(rel);
+    }
+}
+
+/**
+ * Raised when a gated path exists but cannot be read.
+ *
+ * A 2026-10-13 council review refused the change over the shape this
+ * replaces: every `lstat` failure became `null`, and `null` is the DELETION
+ * marker — so a permission error, an I/O error or a transient filesystem
+ * failure on a gated file produced the digest of a tree in which that file
+ * had been removed. Both seats named it, and one named the consequence that
+ * makes it more than untidy: anyone who can provoke such an error on a gated
+ * path can force its real content out of the digest.
+ *
+ * Only ENOENT and ENOTDIR mean ABSENT. Everything else is a checkout this
+ * code cannot describe, and describing it anyway is the fail-open move a
+ * previous round of this same review already refused once.
+ *
+ * Round 2 of the same review found the other half: this class was raised
+ * only from the `lstat`, and the reads AFTER it were unwrapped. Both reads
+ * now raise it too, through {@link readGatedFile} and {@link readGatedLink}.
+ */
+export class GatedFileUnreadable extends Error {
+    constructor(
+        readonly rel: string,
+        readonly errno: NodeJS.ErrnoException,
+    ) {
+        super(
+            `gated path \`${rel}\` exists but could not be read ` +
+                `(${errno.code ?? errno.message}) — the digest refuses to describe a tree it ` +
+                'could not read, because an unreadable file is not a deleted one',
+        );
+        this.name = 'GatedFileUnreadable';
+    }
+}
+
+/**
+ * An errno failure, or `null` for anything else.
+ *
+ * THE TRANSLATION IS NARROW ON PURPOSE. The blind peer-review stage of the
+ * 2026-10-13 round named the opposite shape as its own defect: a blanket
+ * `catch` around the read would "conceal programming defects as ordinary
+ * refusals", so a `TypeError` from a future edit of this loop would surface as
+ * "the tree could not be read" and nobody would look for the bug.
+ *
+ * A STRING `code` IS NOT THAT EVIDENCE, and round 3 of the same review refused
+ * the change for treating it as such: Node's own programming errors —
+ * `ERR_INVALID_ARG_TYPE` and the rest of the `ERR_*` family — are `TypeError`s
+ * with a string `code`, so the first version of this check translated exactly
+ * the defects it claimed to rethrow. An OS failure is told apart by what only
+ * the system-call path attaches: a numeric `errno` AND a string `syscall`, and
+ * a `code` outside the `ERR_` namespace. Anything missing one of the three is
+ * rethrown unchanged and stays a crash.
+ */
+export function asErrno(err: unknown): NodeJS.ErrnoException | null {
+    if (!(err instanceof Error)) {
+        return null;
+    }
+    const e = err as NodeJS.ErrnoException;
+    if (
+        typeof e.code === 'string' &&
+        !e.code.startsWith('ERR_') &&
+        typeof e.errno === 'number' &&
+        typeof e.syscall === 'string'
+    ) {
+        return e;
+    }
+    return null;
+}
+
+/**
+ * Translate a filesystem failure on `rel` into a refusal, or rethrow it.
+ *
+ * The one place the discriminator above is applied, so the `lstat`, the open,
+ * the read, the close and the readlink cannot drift into five readings of
+ * "is this a filesystem fact".
+ */
+function refuseOrRethrow(rel: string, err: unknown): never {
+    const errno = asErrno(err);
+    if (errno === null) {
+        throw err;
+    }
+    throw new GatedFileUnreadable(rel, errno);
+}
+
+/**
+ * `O_NOFOLLOW`, or 0 where the platform has no such flag.
+ *
+ * Defined on Linux and macOS, which is where this gate runs — `consistency.yml`
+ * is `ubuntu-latest` and the suites are ubuntu plus macOS. The `0` fallback is
+ * honest rather than silent: on a platform without the flag the open below
+ * degrades to an ordinary one and {@link readGatedFile} loses the containment
+ * property its own case asserts. That is stated here because a reader
+ * otherwise has to infer it from a bitmask.
+ */
+const O_NOFOLLOW: number =
+    typeof fs.constants.O_NOFOLLOW === 'number' ? fs.constants.O_NOFOLLOW : 0;
+
+/**
+ * Read a gated path that {@link fs.lstatSync} has just called a regular file,
+ * WITHOUT following a symbolic link at its final component.
+ *
+ * THE SYMLINK-SWAP QUESTION, ANSWERED RATHER THAN ASSUMED. One seat of the
+ * 2026-10-13 round named a path-substitution race between the stat and the
+ * read and asked whether resisting it is inside this gate's threat model. It
+ * is, for exactly one direction and for a reason that is cheap to state: a
+ * path that is a regular file at `lstat` and a SYMLINK at the read is the only
+ * ordering in which out-of-revision CONTENT can enter the digest, because a
+ * plain `readFileSync` dereferences. `O_NOFOLLOW` makes that open fail with
+ * `ELOOP`, which becomes a refusal — so the race reds the gate instead of
+ * digesting a stranger's bytes.
+ *
+ * WHAT IS NOT CLOSED, SAID PLAINLY. Intermediate directory components are
+ * still resolved, so a symlinked parent directory committed into the tree
+ * redirects the read; that is a property of the checkout rather than a race,
+ * and it is visible in the revision. And an adversary with concurrent write
+ * access to the checkout during a gate run can edit the gated bytes BEFORE the
+ * stat, forge the record, or patch this file — no ordering of stat and read
+ * answers that, and claiming otherwise would be the false assurance this
+ * module exists to prevent.
+ *
+ * Exported because a comment claiming a containment property is not a control.
+ * Its case opens a symlink directly and expects the refusal; neutralising the
+ * flag turns that case red.
+ */
+export function readGatedFile(rel: string, abs: string): Buffer {
+    let fd: number;
+    try {
+        fd = fs.openSync(abs, fs.constants.O_RDONLY | O_NOFOLLOW);
+    } catch (err) {
+        refuseOrRethrow(rel, err);
+    }
+    // THE CLOSE IS INSIDE THE TRANSLATION, and on both paths. Round 3 of the
+    // 2026-10-13 review found it in a `finally`, outside the catch: a close
+    // failure escaped as a raw Node error, and because an exception thrown
+    // from `finally` replaces the pending one, it could also overwrite a read
+    // failure that had already been translated. So the read's failure is
+    // decided first and wins; a close failure after a failed read is dropped
+    // because a refusal is already on its way, and a close failure after a
+    // successful read is itself a refusal.
+    let bytes: Buffer;
+    try {
+        bytes = fs.readFileSync(fd);
+    } catch (err) {
+        try {
+            fs.closeSync(fd);
+        } catch {
+            // The primary failure is the one reported; see above.
+        }
+        refuseOrRethrow(rel, err);
+    }
+    try {
+        fs.closeSync(fd);
+    } catch (err) {
+        refuseOrRethrow(rel, err);
+    }
+    return bytes;
+}
+
+/**
+ * Read the TARGET STRING of a gated path that `lstat` has just called a
+ * symbolic link.
+ *
+ * The other half of the swap answer, and the measurable one: a link replaced
+ * by a regular file between the stat and this call makes `readlinkSync` fail
+ * with `EINVAL`, which becomes a refusal rather than a raw Node error escaping
+ * `evaluate()`. A swap of the link's TARGET is not a leak at all — the digest
+ * records the target STRING and never dereferences it, so the worst a swap can
+ * do is move the digest, which reds the gate. Both directions therefore fail
+ * closed, and the case below proves the `EINVAL` one rather than asserting it.
+ */
+export function readGatedLink(rel: string, abs: string): string {
+    try {
+        return fs.readlinkSync(abs);
+    } catch (err) {
+        refuseOrRethrow(rel, err);
+    }
+}
+
+/**
+ * The self surface, by the gate's own constants rather than a copy of them.
+ *
+ * READ ON FIRST CALL, NOT AT MODULE SCOPE, and the reason is the import cycle
+ * the binding introduced. The gate now imports {@link subjectDigest} and this
+ * module imports the gate's path constants, so whichever of the two Node
+ * evaluates second sees the other half-evaluated; a module-scope
+ * `new Set([SELF_PATH, …])` reads those `const` bindings inside the window and
+ * throws on the temporal dead zone. Deferring to call time moves the read past
+ * both modules' evaluation, where the live bindings are initialised.
+ */
+let selfSetCache: ReadonlySet<string> | null = null;
+
+function selfSet(): ReadonlySet<string> {
+    if (selfSetCache === null) {
+        selfSetCache = new Set<string>([
+            SELF_PATH,
+            READER_PATH,
+            CLOSURE_READER_PATH,
+            POLICY_PATH,
+            WORKFLOW_PATH,
+            ...ANCHOR_PATHS,
+        ]);
+    }
+    return selfSetCache;
+}
@@ -66,0 +333 @@ export function gatedFilesOf(
+    const self = selfSet();
@@ -68 +335,5 @@ export function gatedFilesOf(
-        if (SELF_SET.has(f)) out.add(f);
+        if (self.has(f)) out.add(f);
+    }
+    const sorted = [...out].sort();
+    for (const rel of sorted) {
+        assertContained(rel);
@@ -70 +341,9 @@ export function gatedFilesOf(
-    return [...out].sort();
+    return sorted;
+}
+
+/** A digest and, from the SAME classification, exactly what it covers. */
+export interface SubjectReading {
+    /** The `subject` a record must carry to answer for this change. */
+    readonly digest: string;
+    /** The gated files that digest is taken over, sorted. */
+    readonly gatedFiles: readonly string[];
@@ -75 +354 @@ export function gatedFilesOf(
- * `root`.
+ * `root`, together with the list it covers.
@@ -79 +358,16 @@ export function gatedFilesOf(
- * gated path is a different change, not the same one.
+ * gated path is a different change, not the same one. The separator is NUL,
+ * which no path on any supported filesystem may contain, and the content slot
+ * is a fixed-width 64-character hex digest — so the serialisation is
+ * unambiguous and no crafted path can reproduce another file's framing.
+ *
+ * `derived` is the plumbing closure the caller already computed, passed through
+ * to {@link gatedFilesOf} unchanged. The gate HAS that list and classifies with
+ * it; a digest that classified without it would cover fewer files than the gate
+ * gated, so a record could be bound to a subset of what was reviewed. One list,
+ * handed down, rather than two computed independently.
+ *
+ * RETURNS THE LIST RATHER THAN LETTING A CALLER RE-DERIVE IT. The 2026-10-13
+ * review found the CLI printing `gatedFilesOf(files)` while the digest came
+ * from `gatedFilesOf(files, derivedFor(root))` — two classifications with
+ * different inputs, so the coverage a human copied alongside a digest could
+ * disagree with what that digest actually covered. One call, one answer.
@@ -81 +375,6 @@ export function gatedFilesOf(
-export function subjectDigest(root: string, files: readonly string[]): string {
+export function subjectOf(
+    root: string,
+    files: readonly string[],
+    derived?: readonly string[],
+): SubjectReading {
+    const gatedFiles = gatedFilesOf(files, derived);
@@ -83 +382 @@ export function subjectDigest(root: string, files: readonly string[]): string {
-    for (const rel of gatedFilesOf(files)) {
+    for (const rel of gatedFiles) {
@@ -85 +384,34 @@ export function subjectDigest(root: string, files: readonly string[]): string {
-        const content = fs.existsSync(abs) ? fs.readFileSync(abs) : Buffer.from(DELETED_MARKER);
+        // `lstat` rather than `existsSync`: the latter follows the link and
+        // reports a broken symlink as absent, which would digest a link as a
+        // deletion. One stat, and the three cases are told apart by it.
+        let content: Buffer;
+        let stat: fs.Stats | null = null;
+        try {
+            stat = fs.lstatSync(abs);
+        } catch (err) {
+            // ABSENT is two codes and no more. ENOENT is the file not being
+            // there; ENOTDIR is a parent component not being a directory,
+            // which is the same statement about a path that does not resolve.
+            // EACCES, EPERM, EIO, ELOOP and everything else say the file may
+            // well be there and this process could not look — a different
+            // fact, and not one a deletion marker may stand in for. And a
+            // value that is not an OS failure at all is a defect here and is
+            // rethrown, through the same discriminator as the reads below.
+            const code = asErrno(err)?.code;
+            if (code === 'ENOENT' || code === 'ENOTDIR') {
+                stat = null;
+            } else {
+                refuseOrRethrow(rel, err);
+            }
+        }
+        if (stat === null) {
+            content = Buffer.from(DELETED_MARKER);
+        } else if (stat.isSymbolicLink()) {
+            // Both reads are wrapped. Before the 2026-10-13 round they were
+            // not, and an I/O or permission failure AFTER the stat escaped as
+            // a raw Node error — the exact TOCTOU window the fail-closed
+            // `lstat` above was added to close, left open one line later.
+            content = Buffer.from(SYMLINK_MARKER + readGatedLink(rel, abs));
+        } else {
+            content = readGatedFile(rel, abs);
+        }
@@ -91 +423,15 @@ export function subjectDigest(root: string, files: readonly string[]): string {
-    return h.digest('hex');
+    return { digest: h.digest('hex'), gatedFiles };
+}
+
+/**
+ * The digest alone, for a caller that has no use for the covered list.
+ *
+ * Delegates rather than re-implementing: there is ONE classification and ONE
+ * hashing loop, and this is a projection of its result.
+ */
+export function subjectDigest(
+    root: string,
+    files: readonly string[],
+    derived?: readonly string[],
+): string {
+    return subjectOf(root, files, derived).digest;
diff --git a/src/scripts/check_kernel_edit_ratified.ts b/src/scripts/check_kernel_edit_ratified.ts
index 26d5a22f3..9aec517ca 100644
--- a/src/scripts/check_kernel_edit_ratified.ts
+++ b/src/scripts/check_kernel_edit_ratified.ts
@@ -87,0 +88,6 @@ import {
+import {
+    GatedFileUnreadable,
+    GatedPathEscapes,
+    subjectOf,
+    type SubjectReading,
+} from './_lib/ratification_subject.js';
@@ -389,0 +396,33 @@ function resolveBaseRef(explicit: string | null, root: string): string {
+/**
+ * The plumbing closure this gate classifies with: the union of the list read
+ * from the tree under review and from this script's own tree, so a module
+ * present on either side is watched.
+ */
+function derivedFor(root: string): readonly string[] {
+    return [...new Set([...derivedPlumbing(), ...derivedPlumbing(root), ...closureArrivals(root)])];
+}
+
+/**
+ * The `subject` digest a record must carry to answer for this diff, AND the
+ * gated files it covers — from one classification, never two.
+ *
+ * Exported so that whoever WRITES a record asks the gate for the digest rather
+ * than recomputing it from a second reading of the membership rule. A writer
+ * that derived its own list would be the second definition of "gated" that
+ * `ratification_subject`'s header exists to prevent — and it would fail only
+ * for the diffs where the two lists disagree, which are exactly the diffs that
+ * widen the gated set.
+ *
+ * RETURNS BOTH HALVES because a 2026-10-13 council review found the CLI
+ * printing a coverage list it had classified separately, with a different
+ * `derived` input, beside a digest classified here. A list that can disagree
+ * with the digest it is printed next to is the exact false reassurance that
+ * list exists to prevent, so there is now one call and one answer.
+ *
+ * THROWS {@link GatedFileUnreadable} when a gated path exists and cannot be
+ * read. Callers turn that into a refusal; none of them may continue.
+ */
+export function expectedSubjectFor(files: readonly string[], root: string): SubjectReading {
+    return subjectOf(root, files, derivedFor(root));
+}
+
@@ -406,3 +445,2 @@ export function evaluate(
-    const gated = classifyPaths(files, [
-        ...new Set([...derivedPlumbing(), ...derivedPlumbing(root), ...closureArrivals(root)]),
-    ]);
+    const derived = derivedFor(root);
+    const gated = classifyPaths(files, derived);
@@ -450,0 +489,44 @@ export function evaluate(
+    /**
+     * The digest of this diff's gated content, recomputed from the tree rather
+     * than read from the record.
+     *
+     * WHICH FILES COUNT IS DECIDED BY THIS CODE, AND IN CI THIS CODE IS THE BASE
+     * REVISION'S. The workflow runs the base's copy of this gate with `--root
+     * <head>`, so the membership rule a candidate is judged by is one the
+     * candidate did not write — and the same holds for the digest, which uses
+     * this module's `classifyPaths` and the derived list computed just above.
+     * A change that widens the gated set is therefore judged, and written, by
+     * the same list.
+     */
+    let expectedSubject: string;
+    try {
+        expectedSubject = expectedSubjectFor(files, root).digest;
+    } catch (err) {
+        // ONE boundary for EVERY failure of the subject computation, and the
+        // enumeration is the point. Round 2 of the 2026-10-13 modification
+        // review refused the change because this catch knew only one of the
+        // two error classes the same diff had introduced: "`GatedFileUnreadable`
+        // gets the full treatment (defined → thrown → caught → structured
+        // refusal). `GatedPathEscapes` gets only the first half (defined →
+        // thrown), then escapes." A gate that advertises a refusal and crashes
+        // instead has no refusal.
+        //
+        // Fail closed, and BEFORE the "nothing to ratify" exit: a gated path
+        // this process could not read, or one that points outside the
+        // revision, is a checkout the gate cannot describe, and a gate that
+        // cannot describe the content cannot say a record answers for it.
+        //
+        // NARROW AND TYPED, never a blanket catch. The blind peer-review stage
+        // of the same round named the alternative as its own defect — wrapping
+        // everything would "conceal programming defects as ordinary refusals",
+        // which is the fail-open shape round 1 already refused once. Anything
+        // that is not one of these two classes is a bug in this gate and stays
+        // a crash.
+        if (!(err instanceof GatedFileUnreadable) && !(err instanceof GatedPathEscapes)) {
+            throw err;
+        }
+        lines.push(`❌  ${err.message}`);
+        close(false);
+        return { exitCode: 1, lines, scanned };
+    }
+
@@ -503 +585 @@ export function evaluate(
-        const reading = readRatification(text, providerCount);
+        const reading = readRatification(text, providerCount, expectedSubject);
@@ -510 +592,2 @@ export function evaluate(
-                    `effective after ${reading.artifact?.effective_after})`,
+                    `effective after ${reading.artifact?.effective_after}; ` +
+                    `subject ${String(reading.artifact?.subject).slice(0, 12)}…)`,
diff --git a/src/scripts/ratification_subject.ts b/src/scripts/ratification_subject.ts
new file mode 100644
index 000000000..192646ba8
--- /dev/null
+++ b/src/scripts/ratification_subject.ts
@@ -0,0 +1,139 @@
+#!/usr/bin/env tsx
+/**
+ * ratification_subject — print the `subject:` digest a ratification record must
+ * carry to answer for a given change.
+ *
+ * The record's six original fields say WHO reviewed and never WHAT, so a gated
+ * file edited after its review still landed under that review's record. The
+ * `subject` digest is what closes that, and it has to be the SAME digest the
+ * gate recomputes — which is why this prints it by calling
+ * `check_kernel_edit_ratified.expectedSubjectFor` rather than by re-deriving a
+ * second reading of which files are gated. A writer with its own list would
+ * disagree with the gate exactly on the changes that widen the gated set, which
+ * are the changes a record most needs to be right about.
+ *
+ * Usage: ratification_subject --files <path> [<path> …] [--root DIR]
+ *
+ * `--files` takes the change's WHOLE changed-file list, not its gated subset:
+ * which of them are gated is the gate's decision, not the caller's, and passing
+ * a pre-filtered list is how a caller silently substitutes its own classifier.
+ * Ungated paths are ignored, so `git diff --name-only <base>...HEAD` is the
+ * intended input.
+ *
+ * Exit codes: 0 = digest printed · 1 = refused, a gated path could not be read
+ * or resolves outside the tree (nothing on stdout) · 2 = usage error.
+ */
+
+import * as path from 'node:path';
+import { fileURLToPath, pathToFileURL } from 'node:url';
+
+import { expectedSubjectFor } from './check_kernel_edit_ratified.js';
+import {
+    GatedFileUnreadable,
+    GatedPathEscapes,
+} from './_lib/ratification_subject.js';
+
+const _HERE = fileURLToPath(import.meta.url);
+const REPO = path.resolve(path.dirname(_HERE), '..', '..');
+
+export function main(argv: readonly string[] = process.argv.slice(2)): number {
+    const files: string[] = [];
+    let root = REPO;
+    let collecting = false;
+    let quiet = false;
+
+    for (let i = 0; i < argv.length; i += 1) {
+        const a = argv[i] ?? '';
+        if (a === '--files') {
+            collecting = true;
+            continue;
+        }
+        if (a === '--root') {
+            // A missing value used to resolve `.` silently. For a command whose
+            // output is copied into a governance record, "it quietly used the
+            // current directory" is the wrong failure: the digest would be
+            // taken over a tree the caller never named.
+            const value = argv[i + 1];
+            if (value === undefined || value.startsWith('--')) {
+                process.stderr.write('error: --root takes a directory\n');
+                return 2;
+            }
+            root = path.resolve(value);
+            i += 1;
+            collecting = false;
+            continue;
+        }
+        if (a === '--quiet') {
+            quiet = true;
+            collecting = false;
+            continue;
+        }
+        if (a.startsWith('--')) {
+            process.stderr.write(`error: unknown argument ${a}\n`);
+            return 2;
+        }
+        if (!collecting) {
+            process.stderr.write(`error: stray argument ${a} — paths follow --files\n`);
+            return 2;
+        }
+        files.push(a);
+    }
+
+    if (files.length === 0) {
+        process.stderr.write(
+            'usage: ratification_subject --files <path> [<path> …] [--root DIR]\n' +
+                '       pass the whole changed-file list; the gated subset is this gate’s decision\n',
+        );
+        return 2;
+    }
+
+    // ONE call for both halves. A 2026-10-13 council review found this
+    // function printing `gatedFilesOf(files)` — a second classification, with a
+    // different `derived` input — beside a digest classified by the gate. The
+    // list exists so nobody copies a confident-looking digest over no files;
+    // a list that can disagree with its own digest emits exactly that false
+    // reassurance instead of preventing it.
+    //
+    // The SECOND caller of the subject computation, and it is caught here for
+    // the same reason the gate catches it: step 2.3's title says every failure
+    // of that computation is one structured refusal, and a caller that prints
+    // a Node stack trace instead is a place where that sentence is not true.
+    // The two classes are enumerated, never blanket-caught — a defect in this
+    // file stays a crash.
+    let digest: string;
+    let gated: readonly string[];
+    try {
+        ({ digest, gatedFiles: gated } = expectedSubjectFor(files, root));
+    } catch (err) {
+        if (!(err instanceof GatedFileUnreadable) && !(err instanceof GatedPathEscapes)) {
+            throw err;
+        }
+        process.stderr.write(`error: ${err.message}\n`);
+        return 1;
+    }
+
+    if (quiet) {
+        process.stdout.write(`${digest}\n`);
+        return 0;
+    }
+
+    // The gated list is printed with the digest on purpose: a digest over an
+    // empty list is a well-formed 64 hex characters and says nothing, so a
+    // caller who mistyped a path would otherwise copy a confident-looking
+    // answer about no files at all.
+    process.stdout.write(`subject: ${digest}\n`);
+    process.stdout.write(`\ngated files covered (${String(gated.length)}):\n`);
+    if (gated.length === 0) {
+        process.stdout.write(
+            '  (none — nothing in this change is gated, so no record is owed)\n',
+        );
+    }
+    for (const g of gated) {
+        process.stdout.write(`  · ${g}\n`);
+    }
+    return 0;
+}
+
+if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
+    process.exit(main());
+}
```

## Delta 2 — tests, round-3 tree to this head

```diff
diff --git a/tests/scripts/ratification_subject.test.ts b/tests/scripts/ratification_subject.test.ts
index 81ab0edaf..1ed58118e 100644
--- a/tests/scripts/ratification_subject.test.ts
+++ b/tests/scripts/ratification_subject.test.ts
@@ -6,0 +7 @@ import {
+    asErrno,
@@ -439,0 +441,50 @@ describe('the symlink-swap question, answered by measurement', () => {
+
+describe('only an OS failure is translated — a Node programming error stays a crash', () => {
+    /**
+     * Step 2.4, and round 3 of the 2026-10-13 review in the seat's words:
+     *
+     * > "Node programming errors such as `ERR_INVALID_ARG_TYPE` are typically
+     * > `TypeError` instances with string `code` properties. Consequently, the
+     * > stated guarantee that 'a `TypeError` from a future edit … stays a
+     * > crash' is false."
+     *
+     * Each case below provokes a REAL `ERR_INVALID_ARG_TYPE` from Node rather
+     * than constructing one, so it measures what Node actually attaches.
+     */
+    function thrownBy(fn: () => unknown): unknown {
+        try {
+            fn();
+        } catch (err) {
+            return err;
+        }
+        return expect.unreachable('expected a throw');
+    }
+
+    it('readGatedFile rethrows ERR_INVALID_ARG_TYPE unchanged', () => {
+        const err = thrownBy(() => readGatedFile(KERNEL, 42 as unknown as string));
+        expect(err).toBeInstanceOf(TypeError);
+        expect(err).not.toBeInstanceOf(GatedFileUnreadable);
+        expect((err as NodeJS.ErrnoException).code).toBe('ERR_INVALID_ARG_TYPE');
+    });
+
+    it('readGatedLink rethrows ERR_INVALID_ARG_TYPE unchanged', () => {
+        const err = thrownBy(() => readGatedLink(KERNEL, 42 as unknown as string));
+        expect(err).toBeInstanceOf(TypeError);
+        expect(err).not.toBeInstanceOf(GatedFileUnreadable);
+        expect((err as NodeJS.ErrnoException).code).toBe('ERR_INVALID_ARG_TYPE');
+    });
+
+    it('the discriminator: a real errno passes, a string code alone does not', () => {
+        const real = thrownBy(() => fs.readFileSync(path.join(os.tmpdir(), 'no-such-subj-file')));
+        expect(asErrno(real)?.code).toBe('ENOENT');
+
+        const programming = thrownBy(() => fs.readFileSync(42 as unknown as string, 7 as never));
+        expect((programming as NodeJS.ErrnoException).code).toMatch(/^ERR_/);
+        expect(asErrno(programming)).toBeNull();
+
+        // An errno-looking code with nothing the syscall path attaches is not
+        // evidence either — the check is the three properties, not the name.
+        expect(asErrno(Object.assign(new Error('x'), { code: 'EACCES' }))).toBeNull();
+        expect(asErrno({ code: 'EACCES', errno: -13, syscall: 'open' })).toBeNull();
+    });
+});
diff --git a/tests/scripts/ratification_subject_cli.test.ts b/tests/scripts/ratification_subject_cli.test.ts
new file mode 100644
index 000000000..eeceba74e
--- /dev/null
+++ b/tests/scripts/ratification_subject_cli.test.ts
@@ -0,0 +1,94 @@
+import { afterEach, describe, expect, it, vi } from 'vitest';
+import * as fs from 'node:fs';
+import * as os from 'node:os';
+import * as path from 'node:path';
+
+import { main } from '../../src/scripts/ratification_subject.js';
+
+/**
+ * The CLI's refusal path, invoked directly. Step 2.4, round 3 of the
+ * 2026-10-13 review: the catch around `expectedSubjectFor` in `main()` had no
+ * case of its own — nothing proved it returns 1, writes to stderr, emits no
+ * digest, and still lets an unrelated programming error through.
+ */
+const KERNEL = 'src/rules/commit-policy.md';
+const asRoot = typeof process.getuid === 'function' && process.getuid() === 0;
+
+function tmpKernel(body: string): string {
+    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'subj-cli-'));
+    fs.mkdirSync(path.join(root, 'src/rules'), { recursive: true });
+    fs.writeFileSync(path.join(root, KERNEL), body);
+    return root;
+}
+
+function run(argv: readonly string[]): { code: number; out: string; err: string } {
+    let out = '';
+    let err = '';
+    const o = vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
+        out += String(chunk);
+        return true;
+    });
+    const e = vi.spyOn(process.stderr, 'write').mockImplementation((chunk) => {
+        err += String(chunk);
+        return true;
+    });
+    try {
+        return { code: main(argv), out, err };
+    } finally {
+        o.mockRestore();
+        e.mockRestore();
+    }
+}
+
+afterEach(() => {
+    vi.restoreAllMocks();
+    vi.doUnmock('../../src/scripts/check_kernel_edit_ratified.js');
+    vi.resetModules();
+});
+
+describe('ratification_subject main() — the refusal path', () => {
+    it('prints the digest and exits 0 on a readable tree — polarity', () => {
+        const root = tmpKernel('one\n');
+        const r = run(['--quiet', '--root', root, '--files', KERNEL]);
+        expect(r.code).toBe(0);
+        expect(r.out).toMatch(/^[0-9a-f]{64}\n$/);
+        expect(r.err).toBe('');
+    });
+
+    it.skipIf(asRoot)('an unreadable gated file exits 1, on stderr, with no digest', () => {
+        const root = tmpKernel('one\n');
+        const abs = path.join(root, KERNEL);
+        fs.chmodSync(abs, 0o000);
+        try {
+            const r = run(['--root', root, '--files', KERNEL]);
+            expect(r.code).toBe(1);
+            expect(r.out).toBe('');
+            expect(r.err).toContain('could not be read');
+            expect(r.err).toContain(KERNEL);
+        } finally {
+            fs.chmodSync(abs, 0o644);
+        }
+    });
+
+    it('a gated path escaping the tree exits 1, on stderr, with no digest', () => {
+        const root = tmpKernel('one\n');
+        const r = run(['--root', root, '--files', '../../elsewhere/rules/commit-policy.md']);
+        expect(r.code).toBe(1);
+        expect(r.out).toBe('');
+        expect(r.err).toMatch(/^error: /);
+    });
+
+    it('an unrelated programming error propagates instead of becoming a refusal', async () => {
+        const programming = new TypeError('a defect in the subject computation');
+        vi.resetModules();
+        vi.doMock('../../src/scripts/check_kernel_edit_ratified.js', () => ({
+            expectedSubjectFor: () => {
+                throw programming;
+            },
+        }));
+        const cli = await import('../../src/scripts/ratification_subject.js');
+        const e = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
+        expect(() => cli.main(['--files', KERNEL])).toThrow(programming);
+        expect(e).not.toHaveBeenCalled();
+    });
+});
diff --git a/tests/scripts/ratification_subject_fs_faults.test.ts b/tests/scripts/ratification_subject_fs_faults.test.ts
new file mode 100644
index 000000000..110d4aafb
--- /dev/null
+++ b/tests/scripts/ratification_subject_fs_faults.test.ts
@@ -0,0 +1,129 @@
+import { afterEach, describe, expect, it, vi } from 'vitest';
+import type * as NodeFs from 'node:fs';
+import * as os from 'node:os';
+import * as path from 'node:path';
+
+/**
+ * Filesystem faults a real disk will not produce on demand: a `close` that
+ * fails, a `close` that fails AFTER a read already failed, and a programming
+ * error out of `lstat`. `node:fs` is mocked in this file only, with each fault
+ * armed per case and every call otherwise delegating to the real module, so the
+ * other suites keep a real filesystem.
+ */
+const faults: { close?: unknown; read?: unknown; lstat?: unknown } = {};
+
+vi.mock('node:fs', async (importOriginal) => {
+    const real = await importOriginal<typeof NodeFs>();
+    const wrapped = {
+        ...real,
+        closeSync: (fd: number) => {
+            real.closeSync(fd);
+            if (faults.close !== undefined) {
+                throw faults.close;
+            }
+        },
+        readFileSync: ((...args: Parameters<typeof real.readFileSync>) => {
+            if (faults.read !== undefined && typeof args[0] === 'number') {
+                throw faults.read;
+            }
+            return real.readFileSync(...args);
+        }) as typeof real.readFileSync,
+        lstatSync: ((...args: Parameters<typeof real.lstatSync>) => {
+            if (faults.lstat !== undefined) {
+                throw faults.lstat;
+            }
+            return real.lstatSync(...args);
+        }) as typeof real.lstatSync,
+    };
+    return { ...wrapped, default: wrapped };
+});
+
+const fs = await import('node:fs');
+const { readGatedFile, subjectDigest, GatedFileUnreadable } = await import(
+    '../../src/scripts/_lib/ratification_subject.js'
+);
+
+const KERNEL = 'src/rules/commit-policy.md';
+
+function osError(code: string, errno: number, syscall: string): NodeJS.ErrnoException {
+    return Object.assign(new Error(`${code}: ${syscall}`), { code, errno, syscall });
+}
+
+function tmpKernel(body: string): string {
+    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'subj-fault-'));
+    fs.mkdirSync(path.join(root, 'src/rules'), { recursive: true });
+    fs.writeFileSync(path.join(root, KERNEL), body);
+    return root;
+}
+
+afterEach(() => {
+    delete faults.close;
+    delete faults.read;
+    delete faults.lstat;
+});
+
+describe('the close is inside the translation', () => {
+    /**
+     * Step 2.4, round 3 of the 2026-10-13 review:
+     *
+     * > "An `EIO`, `EINTR`, or similar close failure therefore escapes as a raw
+     * > Node error. It can also replace a successfully translated read error
+     * > because an exception from `finally` overrides the pending exception."
+     */
+    it('a close failure after a successful read is a typed refusal, not a raw error', () => {
+        const root = tmpKernel('one\n');
+        faults.close = osError('EIO', -5, 'close');
+        let caught: unknown = null;
+        try {
+            readGatedFile(KERNEL, path.join(root, KERNEL));
+        } catch (err) {
+            caught = err;
+        }
+        expect(caught).toBeInstanceOf(GatedFileUnreadable);
+        expect((caught as InstanceType<typeof GatedFileUnreadable>).errno.code).toBe('EIO');
+    });
+
+    it('a close failure after a failed read does not replace the read failure', () => {
+        const root = tmpKernel('one\n');
+        faults.read = osError('EIO', -5, 'read');
+        faults.close = osError('EBADF', -9, 'close');
+        let caught: unknown = null;
+        try {
+            readGatedFile(KERNEL, path.join(root, KERNEL));
+        } catch (err) {
+            caught = err;
+        }
+        expect(caught).toBeInstanceOf(GatedFileUnreadable);
+        expect((caught as InstanceType<typeof GatedFileUnreadable>).errno.code).toBe('EIO');
+    });
+
+    it('with no fault armed the bytes come back — the mock delegates', () => {
+        // Polarity: the two cases above are not red-proof if every read through
+        // this mock fails for some other reason.
+        const root = tmpKernel('one\n');
+        expect(readGatedFile(KERNEL, path.join(root, KERNEL)).toString()).toBe('one\n');
+    });
+});
+
+describe('the lstat uses the same discriminator as the reads', () => {
+    it('a programming error out of lstat is rethrown, not called unreadable or deleted', () => {
+        const root = tmpKernel('one\n');
+        const programming = Object.assign(new TypeError('bad argument'), {
+            code: 'ERR_INVALID_ARG_TYPE',
+        });
+        faults.lstat = programming;
+        let caught: unknown = null;
+        try {
+            subjectDigest(root, [KERNEL]);
+        } catch (err) {
+            caught = err;
+        }
+        expect(caught).toBe(programming);
+    });
+
+    it('an OS failure out of lstat is still a typed refusal', () => {
+        const root = tmpKernel('one\n');
+        faults.lstat = osError('EACCES', -13, 'lstat');
+        expect(() => subjectDigest(root, [KERNEL])).toThrow(GatedFileUnreadable);
+    });
+});
```
