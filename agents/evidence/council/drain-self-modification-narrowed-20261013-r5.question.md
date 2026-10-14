<!-- evidence-type: analysis -->

<!-- Round-5 prompt of the modification review, 2026-10-14, committed
     verbatim beside its record. Not edited after the run. -->

# Modification review, round 5 — the narrowed content binding

Round 5 of the modification review of the narrowed content binding (PR #2325).
Round 4 closed `refused` 2/2 on one shared finding. The owner directed that the
confirmed findings be addressed and the change come back for this round. The
round-4 points are quoted below with what was changed. The code under review is
commit `d7e34efdd`.

## Round 4's shared finding and what was changed

> anthropic: "treating every non-symlink as a regular file leaves a FIFO able
> to hang the process indefinitely; fix by requiring `stat.isFile()` before
> opening and add a regression test for unsupported filesystem object kinds."

> openai: "treating every non-symlink object as a regular file can hang the
> governance gate; the highest-leverage pre-merge change is to reject
> non-regular filesystem objects before opening them."

Changed, in `src/scripts/_lib/ratification_subject.ts`:

- After the `lstat`, `subjectOf()` handles exactly three kinds: absent
  (ENOENT/ENOTDIR → deletion marker), symbolic link (`readlinkSync`), regular
  file (`stat.isFile()` → `readGatedFile`). Anything else throws a new
  `GatedPathUnsupported` (fields `rel`, `kind`: `directory`, `FIFO`, `socket`,
  `character device`, `block device`, `unknown object`) before any `open`.
- `readGatedFile()` now opens with `O_RDONLY | O_NOFOLLOW | O_NONBLOCK`, then
  `fstatSync(fd)`; if the descriptor is not a regular file it closes and throws
  `GatedPathUnsupported`. This covers an object swapped in between the `lstat`
  and the `open`, and `readGatedFile` called directly. `fstat` failures go
  through the same errno discriminator as the other calls.
- The three refusal classes (`GatedPathEscapes`, `GatedFileUnreadable`,
  `GatedPathUnsupported`) now extend one base, `GatedSubjectRefusal`. The catch
  in `evaluate()` (`check_kernel_edit_ratified.ts`) and in the CLI `main()`
  (`src/scripts/ratification_subject.ts`) test `instanceof GatedSubjectRefusal`
  instead of listing two classes; anything else is rethrown as before.

## Round 4's other points and what was changed

- anthropic: the `O_NOFOLLOW` fallback "should be an explicit refusal rather
  than a documented degradation". Changed: the flags are read per call; if
  `fs.constants.O_NOFOLLOW` or `O_NONBLOCK` is not a number, `readGatedFile`
  throws `GatedPathUnsupported` (kind `platform`) without opening.
- anthropic: `--quiet` prints a well-formed digest over an empty gated set with
  no warning. Changed: in that case it also writes a warning to stderr; exit 0
  and the digest on stdout are unchanged.
- openai: `assertContained()` is POSIX-shaped. Changed: it is exported, and
  refuses a `..` segment under either separator and any path starting with `/`,
  `\` or a drive letter followed by `:` (covers UNC, rooted and drive-relative
  forms). Stated so it can be judged: `gatedFilesOf()` already replaced `\` with
  `/` before calling it, so through the gate the backslash forms were already
  refused; the change makes the function hold on its own input.
- both seats: round-by-round history out of production docblocks. Changed: the
  comments in the three source files of this delta no longer narrate review
  rounds; the history is in the ratification record and the roadmap. Test files
  still quote review findings beside the cases they motivate.
- `docs/contracts/ratification-artifact.md`: one sentence added stating the
  non-regular-path and missing-flag refusals.

Not acted on: the digest still reads the working tree, not Git objects; the
`selfSetCache` temporal-dead-zone deferral still has no case that shows the
dead zone firing; `skipIf(asRoot)` remains on the permission cases.

## Each new case, seen red

Each mechanism neutralised in place, suite run, file restored from a copy:

| Neutralisation | Result |
|---|---|
| `subjectOf` reads every non-link as a file (kind check removed) | 5 of 16 red in `ratification_subject_fs_faults.test.ts` (FIFO, directory, socket, character device, block device — each asserting `openSync` was never called) |
| `fstat` kind check in `readGatedFile` removed | 2 of 16 red (FIFO and directory reached through `readGatedFile` directly) |
| `O_NONBLOCK` dropped from the open flags | 1 red (the flags assertion; run alone, because the direct-FIFO case would then block rather than fail) |
| missing-flag refusal removed | 2 of 16 red (without `O_NOFOLLOW`, without `O_NONBLOCK`) |
| `assertContained` back to the POSIX-only shape | 1 of 29 red in `ratification_subject.test.ts` |
| `evaluate()` catch treating `GatedPathUnsupported` as not-a-refusal | 1 of 10 red in `check_kernel_edit_ratified_subject.test.ts` (directory at a kernel-rule path) |
| CLI catch, same neutralisation | 1 of 6 red in `ratification_subject_cli.test.ts` |
| `--quiet` warning removed | 1 of 6 red in the same file |

Socket and device kinds are exercised through a mocked `lstatSync` returning a
`Stats`-shaped object; FIFO (`mkfifo`) and directory are real. `openSync` is
trapped in the kind cases, so a regression fails instead of blocking. After
restoring: 10 ratification / kernel-edit suites, 155 tests pass; `tsc --noEmit`,
eslint on the touched files, `lint_code_comments` and `check_test_weakening`
clean; `task sync` and `task generate-tools` produce no drift.

## The digest

Run against this branch's full changed-file list, `ratification_subject` prints
`subject: 20a33577eec696391443290519505e08868ded0f3b619b48399504627c13832c`
over two gated files, `src/scripts/_lib/ratification_artifact.ts` and
`src/scripts/check_kernel_edit_ratified.ts`. It moved from round 4's
`3317942a…` because the catch and comments in `check_kernel_edit_ratified.ts`
changed. `_lib/ratification_subject.ts` and the CLI are not in that
locally-computed gated set. `origin/main` has not moved since round 4's merge.

## What is in this bundle, and what is not

The scope is the PR against `origin/main` (`d23dcec56`). The bundle has a 50 KB
hard ceiling. Included below:

1. **Production code, PR against `origin/main`**, no context lines, for
   `src/scripts/_lib/ratification_subject.ts`, `src/scripts/ratification_subject.ts`
   and `src/scripts/check_kernel_edit_ratified.ts`.
2. **The test changes since round 4** (`e5d395c70` → `d7e34efdd`), no context
   lines.

Not included, to fit the ceiling: `src/scripts/_lib/ratification_artifact.ts`
(the `subject` field and its three problem kinds, 65 changed lines, unchanged
since round 2), the contract (the one sentence is quoted above in substance),
the test changes from rounds 1–4, the roadmap, and the evidence files. If a
question below cannot be answered from what you can see, say which part you
could not see rather than answering around it.

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
index 2a81823ed..9cca69e97 100644
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
@@ -21,0 +23,13 @@
+ *
+ * WHAT IT READS, AND WHAT IT THEREFORE DOES NOT PROVE. It reads the WORKING
+ * TREE, not Git objects, so against a dirty tree the digest describes the
+ * dirty bytes; revision-based hashing is the stronger shape and is not what
+ * ships here. What it never does is follow a symbolic link: a dereferenced
+ * link would make the digest depend on content outside the revision entirely,
+ * which no amount of cleanliness in the checkout removes.
+ *
+ * WHAT IT READS AT ALL. A gated path is absent, a symbolic link, or a regular
+ * file — the three object kinds Git can store and this digest can describe.
+ * Anything else is refused before it is opened. The history of how each of
+ * these properties was arrived at is in the ratification record
+ * `drain-self-modification-narrowed-20261013.md`, not here.
@@ -46,9 +60,317 @@ export const DELETED_MARKER = '\u0000deleted\u0000';
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
+ * Git stores a symlink as a blob containing its target string, and that is
+ * what is hashed here, so the digest describes the committed object rather
+ * than bytes that live outside the revision and can differ between two clean
+ * checkouts of the same commit. A broken link is a link, not a deletion, and is
+ * recorded as one.
+ */
+export const SYMLINK_MARKER = '\u0000symlink\u0000';
+
+/**
+ * Every way the subject computation declines to describe a tree.
+ *
+ * The callers — the gate's `evaluate()` and the CLI — catch THIS class and
+ * nothing broader, so a new refusal is one subclass rather than an edit to
+ * every catch, and an error that is not a refusal (a defect in this code)
+ * still escapes as a crash instead of being reported as a property of the
+ * checkout.
+ */
+export class GatedSubjectRefusal extends Error {
+    constructor(
+        readonly rel: string,
+        message: string,
+    ) {
+        super(message);
+        this.name = 'GatedSubjectRefusal';
+    }
+}
+
+/**
+ * Raised when a gated path would resolve outside the tree under review.
+ *
+ * Fails CLOSED rather than dropping the path — see {@link assertContained}
+ * for why that direction is the safe one.
+ */
+export class GatedPathEscapes extends GatedSubjectRefusal {
+    constructor(rel: string) {
+        super(
+            rel,
+            `gated path \`${rel}\` is absolute or contains a \`..\` segment, so joining it to ` +
+                'the tree root would read outside the revision under review — the digest refuses ' +
+                'rather than describing content that is not in the change',
+        );
+        this.name = 'GatedPathEscapes';
+    }
+}
+
+/**
+ * Raised when a gated path exists but cannot be read.
+ *
+ * Only ENOENT and ENOTDIR mean ABSENT. Every other failure says the file may
+ * well be there and this process could not look, and representing that with
+ * the deletion marker would let anyone who can provoke such an error on a
+ * gated path force its real content out of the digest.
+ */
+export class GatedFileUnreadable extends GatedSubjectRefusal {
+    constructor(
+        rel: string,
+        readonly errno: NodeJS.ErrnoException,
+    ) {
+        super(
+            rel,
+            `gated path \`${rel}\` exists but could not be read ` +
+                `(${errno.code ?? errno.message}) — the digest refuses to describe a tree it ` +
+                'could not read, because an unreadable file is not a deleted one',
+        );
+        this.name = 'GatedFileUnreadable';
+    }
+}
+
+/**
+ * Raised when a gated path is an object the digest does not describe, or when
+ * this platform cannot read it without following a link.
+ *
+ * Refused BEFORE any `open`: opening a FIFO read-only blocks until a writer
+ * appears, so a gate that opened first and checked second could hang instead
+ * of answering. Git cannot commit a FIFO, socket, device or directory at a
+ * file path, so meeting one means the checkout is not a revision this digest
+ * can stand for.
+ */
+export class GatedPathUnsupported extends GatedSubjectRefusal {
+    constructor(
+        rel: string,
+        readonly kind: string,
+        why: string,
+    ) {
+        super(rel, `gated path \`${rel}\` ${why} — the digest refuses rather than reading it`);
+        this.name = 'GatedPathUnsupported';
+    }
+}
+
+/**
+ * `..` as a whole segment, under either separator. The CLI and the gate
+ * normalise `\` to `/` before classifying, but this bound is checked on the
+ * string it is given so that it holds for any caller.
+ */
+const ESCAPING_SEGMENT = /(?:^|[\\/])\.\.(?:[\\/]|$)/u;
+
+/**
+ * POSIX-absolute, UNC (`\\server\share`, `//server/share`), rooted (`\x`) and
+ * drive-qualified (`C:\x`, `C:x`) paths — every shape `path.join` would not
+ * keep under the root on one platform or another.
+ */
+const ABSOLUTE_SHAPE = /^(?:[\\/]|[A-Za-z]:)/u;
+
+/**
+ * Refuse a gated path that would read outside `root`.
+ *
+ * The gate's `KERNEL_RULE_PATH_RE` is not anchored at the start, so a path
+ * such as `../../elsewhere/rules/commit-policy.md` classifies as a kernel rule.
+ * That was harmless while the gate only read path NAMES; it stops being
+ * harmless once those names are joined to a root and read, so the containment
+ * belongs here, with the read. It FAILS CLOSED rather than dropping the path:
+ * dropping it would make the digest cover less than the gate gated.
+ *
+ * Tightening the gate's own regex is a change to the gate's classification and
+ * therefore a separate, gated concern. This bound holds whatever that regex
+ * does.
+ */
+export function assertContained(rel: string): void {
+    if (ABSOLUTE_SHAPE.test(rel) || ESCAPING_SEGMENT.test(rel)) {
+        throw new GatedPathEscapes(rel);
+    }
+}
+
+/**
+ * An errno failure, or `null` for anything else.
+ *
+ * Deliberately narrow: a blanket translation would report a defect in this
+ * code as "the tree could not be read" and nobody would look for the bug. A
+ * string `code` alone is not OS evidence, because Node's own programming
+ * errors (`ERR_INVALID_ARG_TYPE` and the rest of the `ERR_*` family) carry one.
+ * An OS failure is told apart by what only the system-call path attaches: a
+ * numeric `errno`, a string `syscall`, and a `code` outside `ERR_`. Anything
+ * missing one of the three is rethrown unchanged and stays a crash.
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
+ * the `fstat`, the read, the close and the readlink cannot drift into six
+ * readings of "is this a filesystem fact".
+ */
+function refuseOrRethrow(rel: string, err: unknown): never {
+    const errno = asErrno(err);
+    if (errno === null) {
+        throw err;
+    }
+    throw new GatedFileUnreadable(rel, errno);
+}
+
+/** What a non-regular, non-link `Stats` is, for the refusal message. */
+function kindOf(stat: fs.Stats): string {
+    if (stat.isDirectory()) return 'directory';
+    if (stat.isFIFO()) return 'FIFO';
+    if (stat.isSocket()) return 'socket';
+    if (stat.isCharacterDevice()) return 'character device';
+    if (stat.isBlockDevice()) return 'block device';
+    return 'unknown object';
+}
+
+function refuseKind(rel: string, stat: fs.Stats): never {
+    const kind = kindOf(stat);
+    throw new GatedPathUnsupported(
+        rel,
+        kind,
+        `is a ${kind}, not an absent path, a symbolic link or a regular file`,
+    );
+}
+
+/**
+ * The open flags for a gated read, or a refusal where the platform lacks one.
+ *
+ * `O_NOFOLLOW` is what keeps a path that became a symlink after the `lstat`
+ * from pulling out-of-revision content into the digest; without it the open
+ * dereferences, so its absence is a refusal rather than a quiet degradation.
+ * `O_NONBLOCK` is what keeps a path that became a FIFO after the `lstat` from
+ * blocking the open; the `fstat` that follows then refuses it. Read at call
+ * time rather than module scope so that both are checked on every read.
+ */
+function gatedOpenFlags(rel: string): number {
+    const { O_NOFOLLOW, O_NONBLOCK, O_RDONLY } = fs.constants;
+    if (typeof O_NOFOLLOW !== 'number' || typeof O_NONBLOCK !== 'number') {
+        throw new GatedPathUnsupported(
+            rel,
+            'platform',
+            'cannot be read on this platform without following a symbolic link or blocking ' +
+                'on a FIFO, because `O_NOFOLLOW` or `O_NONBLOCK` is unavailable',
+        );
+    }
+    return O_RDONLY | O_NOFOLLOW | O_NONBLOCK;
+}
+
+function closeQuietly(fd: number): void {
+    try {
+        fs.closeSync(fd);
+    } catch {
+        // A refusal is already on its way; that is the failure reported.
+    }
+}
+
+/**
+ * Read a gated path that {@link fs.lstatSync} has just called a regular file,
+ * WITHOUT following a symbolic link at its final component and without
+ * blocking on an object that was swapped in after the stat.
+ *
+ * A path that is a regular file at `lstat` and a SYMLINK at the open is the
+ * only ordering in which out-of-revision CONTENT can enter the digest, and
+ * `O_NOFOLLOW` turns it into `ELOOP`, a refusal. A path swapped to a FIFO,
+ * device or directory opens without blocking and is refused by the `fstat`.
+ *
+ * WHAT IS NOT CLOSED, SAID PLAINLY. Intermediate directory components are
+ * still resolved, so a symlinked parent directory committed into the tree
+ * redirects the read; that is a property of the checkout rather than a race,
+ * and it is visible in the revision. And an adversary with concurrent write
+ * access to the checkout during a gate run can edit the gated bytes BEFORE the
+ * stat, forge the record, or patch this file — no ordering of stat and read
+ * answers that.
+ *
+ * The close is inside the translation on every path: the read's failure is
+ * decided first and wins, a close failure after a failed read is dropped, and
+ * a close failure after a successful read is itself a refusal.
+ */
+export function readGatedFile(rel: string, abs: string): Buffer {
+    const flags = gatedOpenFlags(rel);
+    let fd: number;
+    try {
+        fd = fs.openSync(abs, flags);
+    } catch (err) {
+        refuseOrRethrow(rel, err);
+    }
+    let stat: fs.Stats;
+    try {
+        stat = fs.fstatSync(fd);
+    } catch (err) {
+        closeQuietly(fd);
+        refuseOrRethrow(rel, err);
+    }
+    if (!stat.isFile()) {
+        closeQuietly(fd);
+        refuseKind(rel, stat);
+    }
+    let bytes: Buffer;
+    try {
+        bytes = fs.readFileSync(fd);
+    } catch (err) {
+        closeQuietly(fd);
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
+ * A link replaced by a regular file between the stat and this call makes
+ * `readlinkSync` fail with `EINVAL`, which becomes a refusal. A swap of the
+ * link's TARGET is not a leak at all — the digest records the target STRING
+ * and never dereferences it, so the worst a swap can do is move the digest,
+ * which reds the gate.
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
+ * READ ON FIRST CALL, NOT AT MODULE SCOPE, because of the import cycle: the
+ * gate imports {@link subjectOf} and this module imports the gate's path
+ * constants, so whichever of the two Node evaluates second sees the other
+ * half-evaluated, and a module-scope `new Set([SELF_PATH, …])` would throw on
+ * the temporal dead zone.
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
@@ -66,0 +389 @@ export function gatedFilesOf(
+    const self = selfSet();
@@ -68 +391,34 @@ export function gatedFilesOf(
-        if (SELF_SET.has(f)) out.add(f);
+        if (self.has(f)) out.add(f);
+    }
+    const sorted = [...out].sort();
+    for (const rel of sorted) {
+        assertContained(rel);
+    }
+    return sorted;
+}
+
+/** A digest and, from the SAME classification, exactly what it covers. */
+export interface SubjectReading {
+    /** The `subject` a record must carry to answer for this change. */
+    readonly digest: string;
+    /** The gated files that digest is taken over, sorted. */
+    readonly gatedFiles: readonly string[];
+}
+
+/**
+ * The `lstat` of a gated path, or `null` when it is ABSENT.
+ *
+ * ABSENT is two codes and no more. ENOENT is the file not being there; ENOTDIR
+ * is a parent component not being a directory, which is the same statement
+ * about a path that does not resolve. Everything else says the file may be
+ * there and this process could not look.
+ */
+function lstatGated(rel: string, abs: string): fs.Stats | null {
+    try {
+        return fs.lstatSync(abs);
+    } catch (err) {
+        const code = asErrno(err)?.code;
+        if (code === 'ENOENT' || code === 'ENOTDIR') {
+            return null;
+        }
+        refuseOrRethrow(rel, err);
@@ -70 +425,0 @@ export function gatedFilesOf(
-    return [...out].sort();
@@ -75 +430 @@ export function gatedFilesOf(
- * `root`.
+ * `root`, together with the list it covers.
@@ -79 +434,11 @@ export function gatedFilesOf(
- * gated path is a different change, not the same one.
+ * gated path is a different change, not the same one. The separator is NUL,
+ * which no path on any supported filesystem may contain, and the content slot
+ * is a fixed-width 64-character hex digest — so the serialisation is
+ * unambiguous and no crafted path can reproduce another file's framing.
+ *
+ * `derived` is the plumbing closure the caller already computed, passed through
+ * to {@link gatedFilesOf} unchanged: a digest that classified without it would
+ * cover fewer files than the gate gated. It returns the list with the digest
+ * so that no caller re-derives the coverage from a second classification.
+ *
+ * THROWS a {@link GatedSubjectRefusal} for every tree it declines to describe.
@@ -81 +446,6 @@ export function gatedFilesOf(
-export function subjectDigest(root: string, files: readonly string[]): string {
+export function subjectOf(
+    root: string,
+    files: readonly string[],
+    derived?: readonly string[],
+): SubjectReading {
+    const gatedFiles = gatedFilesOf(files, derived);
@@ -83 +453 @@ export function subjectDigest(root: string, files: readonly string[]): string {
-    for (const rel of gatedFilesOf(files)) {
+    for (const rel of gatedFiles) {
@@ -85 +455,15 @@ export function subjectDigest(root: string, files: readonly string[]): string {
-        const content = fs.existsSync(abs) ? fs.readFileSync(abs) : Buffer.from(DELETED_MARKER);
+        // `lstat` rather than `existsSync`: the latter follows the link and
+        // reports a broken symlink as absent. One stat tells the three
+        // describable kinds apart, and everything else is refused here,
+        // before any open.
+        const stat = lstatGated(rel, abs);
+        let content: Buffer;
+        if (stat === null) {
+            content = Buffer.from(DELETED_MARKER);
+        } else if (stat.isSymbolicLink()) {
+            content = Buffer.from(SYMLINK_MARKER + readGatedLink(rel, abs));
+        } else if (stat.isFile()) {
+            content = readGatedFile(rel, abs);
+        } else {
+            refuseKind(rel, stat);
+        }
@@ -91 +475,15 @@ export function subjectDigest(root: string, files: readonly string[]): string {
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
index 26d5a22f3..aafdb0ec9 100644
--- a/src/scripts/check_kernel_edit_ratified.ts
+++ b/src/scripts/check_kernel_edit_ratified.ts
@@ -87,0 +88,5 @@ import {
+import {
+    GatedSubjectRefusal,
+    subjectOf,
+    type SubjectReading,
+} from './_lib/ratification_subject.js';
@@ -389,0 +395,33 @@ function resolveBaseRef(explicit: string | null, root: string): string {
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
+ * RETURNS BOTH HALVES so that the coverage list printed beside a digest is the
+ * list that digest was taken over: a list classified separately, with a
+ * different `derived` input, could disagree with it — the false reassurance
+ * that list exists to prevent.
+ *
+ * THROWS a {@link GatedSubjectRefusal} when a gated path cannot be described —
+ * unreadable, escaping the tree, or not an absent path, link or regular file.
+ * Callers turn that into a refusal; none of them may continue.
+ */
+export function expectedSubjectFor(files: readonly string[], root: string): SubjectReading {
+    return subjectOf(root, files, derivedFor(root));
+}
+
@@ -406,3 +444,2 @@ export function evaluate(
-    const gated = classifyPaths(files, [
-        ...new Set([...derivedPlumbing(), ...derivedPlumbing(root), ...closureArrivals(root)]),
-    ]);
+    const derived = derivedFor(root);
+    const gated = classifyPaths(files, derived);
@@ -450,0 +488,37 @@ export function evaluate(
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
+        // ONE boundary for EVERY failure of the subject computation: each is
+        // a subclass of `GatedSubjectRefusal`, so a gate that advertises a
+        // refusal cannot crash on one of its own refusal classes instead.
+        //
+        // Fail closed, and BEFORE the "nothing to ratify" exit: a gated path
+        // this process could not read, one that points outside the revision,
+        // or one that is not a file, link or absence is a checkout the gate
+        // cannot describe, and a gate that cannot describe the content cannot
+        // say a record answers for it.
+        //
+        // NARROW AND TYPED, never a blanket catch: wrapping everything would
+        // report a defect in this gate as a property of the checkout. Anything
+        // that is not a refusal is a bug here and stays a crash.
+        if (!(err instanceof GatedSubjectRefusal)) {
+            throw err;
+        }
+        lines.push(`❌  ${err.message}`);
+        close(false);
+        return { exitCode: 1, lines, scanned };
+    }
+
@@ -503 +577 @@ export function evaluate(
-        const reading = readRatification(text, providerCount);
+        const reading = readRatification(text, providerCount, expectedSubject);
@@ -510 +584,2 @@ export function evaluate(
-                    `effective after ${reading.artifact?.effective_after})`,
+                    `effective after ${reading.artifact?.effective_after}; ` +
+                    `subject ${String(reading.artifact?.subject).slice(0, 12)}…)`,
diff --git a/src/scripts/ratification_subject.ts b/src/scripts/ratification_subject.ts
new file mode 100644
index 000000000..32889e00b
--- /dev/null
+++ b/src/scripts/ratification_subject.ts
@@ -0,0 +1,137 @@
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
+ * Usage: ratification_subject --files <path> [<path> …] [--root DIR] [--quiet]
+ *
+ * `--files` takes the change's WHOLE changed-file list, not its gated subset:
+ * which of them are gated is the gate's decision, not the caller's, and passing
+ * a pre-filtered list is how a caller silently substitutes its own classifier.
+ * Ungated paths are ignored, so `git diff --name-only <base>...HEAD` is the
+ * intended input.
+ *
+ * `--quiet` prints the digest alone; over an empty gated set it also warns on
+ * stderr that the digest covers nothing.
+ *
+ * Exit codes: 0 = digest printed · 1 = refused, a gated path could not be read,
+ * resolves outside the tree, or is not an absent path, a symbolic link or a
+ * regular file (nothing on stdout) · 2 = usage error.
+ */
+
+import * as path from 'node:path';
+import { fileURLToPath, pathToFileURL } from 'node:url';
+
+import { expectedSubjectFor } from './check_kernel_edit_ratified.js';
+import { GatedSubjectRefusal } from './_lib/ratification_subject.js';
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
+            'usage: ratification_subject --files <path> [<path> …] [--root DIR] [--quiet]\n' +
+                '       pass the whole changed-file list; the gated subset is this gate’s decision\n',
+        );
+        return 2;
+    }
+
+    // ONE call for both halves, so the printed list is the list the digest
+    // covers. Every refusal of the subject computation is one class and is
+    // caught here as it is in the gate; anything else is a defect in this
+    // file and stays a crash.
+    let digest: string;
+    let gated: readonly string[];
+    try {
+        ({ digest, gatedFiles: gated } = expectedSubjectFor(files, root));
+    } catch (err) {
+        if (!(err instanceof GatedSubjectRefusal)) {
+            throw err;
+        }
+        process.stderr.write(`error: ${err.message}\n`);
+        return 1;
+    }
+
+    // A digest over an empty list is a well-formed 64 hex characters and says
+    // nothing, so a caller who mistyped a path would otherwise copy a
+    // confident-looking answer about no files at all. The full output lists
+    // the coverage; `--quiet` drops the list, so it says so on stderr instead.
+    if (quiet) {
+        if (gated.length === 0) {
+            process.stderr.write(
+                'warning: no gated file in this change — this digest covers nothing, ' +
+                    'and no record is owed\n',
+            );
+        }
+        process.stdout.write(`${digest}\n`);
+        return 0;
+    }
+
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

## Delta 2 — tests, round-4 tree to this head

```diff
diff --git a/tests/scripts/check_kernel_edit_ratified_subject.test.ts b/tests/scripts/check_kernel_edit_ratified_subject.test.ts
index 117e0e3e4..e14b32af0 100644
--- a/tests/scripts/check_kernel_edit_ratified_subject.test.ts
+++ b/tests/scripts/check_kernel_edit_ratified_subject.test.ts
@@ -194,0 +195,16 @@ describe('2.3 — every failure of the subject computation leaves the gate as a
+    it('a gated path that is not a file, link or absence is a refusal, not an exception', () => {
+        // Step 2.5: the third refusal class, through the real gate. The catch
+        // in `evaluate()` names the refusal base class, so a new subclass is
+        // handled without a new clause; this case is what proves it.
+        const abs = path.join(root, KERNEL);
+        fs.rmSync(abs);
+        fs.mkdirSync(abs);
+        let r: ReturnType<typeof evaluate> | null = null;
+        expect(() => {
+            r = evaluate([KERNEL], root, 2);
+        }).not.toThrow();
+        expect(r).not.toBeNull();
+        expect(r!.exitCode).toBe(1);
+        expect(r!.lines.join('\n')).toContain('is a directory');
+    });
+
diff --git a/tests/scripts/ratification_subject.test.ts b/tests/scripts/ratification_subject.test.ts
index 1ed58118e..2339adc82 100644
--- a/tests/scripts/ratification_subject.test.ts
+++ b/tests/scripts/ratification_subject.test.ts
@@ -7,0 +8 @@ import {
+    assertContained,
@@ -264,0 +266,25 @@ describe('a path the caller supplies cannot escape the tree', () => {
+    it('the bound holds on its own input, under either separator and any absolute shape', () => {
+        // `gatedFilesOf` normalises backslashes to `/` before this check, so through it
+        // a backslash `..` is already caught; these cases call the bound
+        // directly so that it is the bound, not the normalisation, that holds.
+        for (const rel of [
+            '..\\..\\elsewhere\\rules\\commit-policy.md',
+            'src\\rules\\..\\..\\x.md',
+            '\\\\server\\share\\rules\\commit-policy.md',
+            '//server/share/rules/commit-policy.md',
+            '\\rules\\commit-policy.md',
+            'C:\\rules\\commit-policy.md',
+            'C:rules/commit-policy.md',
+        ]) {
+            expect(() => assertContained(rel), rel).toThrow(GatedPathEscapes);
+        }
+    });
+
+    it('the bound does not refuse a name that merely contains dots or a colon later on', () => {
+        // Polarity: a bound that refused every `.` or `:` would satisfy the
+        // case above and red ordinary paths.
+        for (const rel of [KERNEL, 'src/rules/..md', 'src/rules/a..b.md', 'src/x:y/rules/a.md']) {
+            expect(() => assertContained(rel), rel).not.toThrow();
+        }
+    });
+
diff --git a/tests/scripts/ratification_subject_cli.test.ts b/tests/scripts/ratification_subject_cli.test.ts
index eeceba74e..a70bf6021 100644
--- a/tests/scripts/ratification_subject_cli.test.ts
+++ b/tests/scripts/ratification_subject_cli.test.ts
@@ -80,0 +81,19 @@ describe('ratification_subject main() — the refusal path', () => {
+    it('a gated path that is a directory exits 1, on stderr, with no digest', () => {
+        const root = tmpKernel('one\n');
+        const abs = path.join(root, KERNEL);
+        fs.rmSync(abs);
+        fs.mkdirSync(abs);
+        const r = run(['--root', root, '--files', KERNEL]);
+        expect(r.code).toBe(1);
+        expect(r.out).toBe('');
+        expect(r.err).toContain('is a directory');
+    });
+
+    it('--quiet over an empty gated set warns on stderr and still prints the digest', () => {
+        const root = tmpKernel('one\n');
+        const r = run(['--quiet', '--root', root, '--files', 'README.md']);
+        expect(r.code).toBe(0);
+        expect(r.out).toMatch(/^[0-9a-f]{64}\n$/);
+        expect(r.err).toContain('covers nothing');
+    });
+
diff --git a/tests/scripts/ratification_subject_fs_faults.test.ts b/tests/scripts/ratification_subject_fs_faults.test.ts
index 110d4aafb..6084b3dca 100644
--- a/tests/scripts/ratification_subject_fs_faults.test.ts
+++ b/tests/scripts/ratification_subject_fs_faults.test.ts
@@ -2,0 +3 @@ import type * as NodeFs from 'node:fs';
+import { execFileSync } from 'node:child_process';
@@ -13 +14,14 @@ import * as path from 'node:path';
-const faults: { close?: unknown; read?: unknown; lstat?: unknown } = {};
+const faults: {
+    close?: unknown;
+    read?: unknown;
+    lstat?: unknown;
+    lstatStats?: unknown;
+    trapOpen?: boolean;
+    withoutFlag?: 'O_NOFOLLOW' | 'O_NONBLOCK';
+} = {};
+
+/** Every `openSync` call this file's cases made, with the flags it was given. */
+const opens: { path: string; flags: unknown }[] = [];
+
+/** Thrown by a trapped `openSync` so a case never actually opens a FIFO. */
+const OPEN_TRAPPED = new Error('openSync was called on a trapped path');
@@ -16,0 +31,9 @@ vi.mock('node:fs', async (importOriginal) => {
+    // A copy, because the real `fs.constants` properties are non-writable and
+    // non-configurable, so a proxy over the original may not hide one.
+    const constants = new Proxy(
+        { ...real.constants },
+        {
+            get: (target, key, receiver) =>
+                key === faults.withoutFlag ? undefined : Reflect.get(target, key, receiver),
+        },
+    );
@@ -18,0 +42,8 @@ vi.mock('node:fs', async (importOriginal) => {
+        constants,
+        openSync: ((...args: Parameters<typeof real.openSync>) => {
+            opens.push({ path: String(args[0]), flags: args[1] });
+            if (faults.trapOpen === true) {
+                throw OPEN_TRAPPED;
+            }
+            return real.openSync(...args);
+        }) as typeof real.openSync,
@@ -34,0 +66,3 @@ vi.mock('node:fs', async (importOriginal) => {
+            if (faults.lstatStats !== undefined) {
+                return faults.lstatStats;
+            }
@@ -42 +76 @@ const fs = await import('node:fs');
-const { readGatedFile, subjectDigest, GatedFileUnreadable } = await import(
+const { readGatedFile, subjectDigest, GatedFileUnreadable, GatedPathUnsupported } = await import(
@@ -62,0 +97,4 @@ afterEach(() => {
+    delete faults.lstatStats;
+    delete faults.trapOpen;
+    delete faults.withoutFlag;
+    opens.length = 0;
@@ -129,0 +168,133 @@ describe('the lstat uses the same discriminator as the reads', () => {
+
+/**
+ * A `Stats` whose only true predicate is `kind` — for the object kinds a test
+ * process cannot create on demand (devices) or that need no real file at all.
+ */
+function statsOf(kind: 'isSocket' | 'isCharacterDevice' | 'isBlockDevice'): NodeFs.Stats {
+    const no = (): boolean => false;
+    return {
+        isFile: no,
+        isDirectory: no,
+        isSymbolicLink: no,
+        isFIFO: no,
+        isSocket: no,
+        isCharacterDevice: no,
+        isBlockDevice: no,
+        [kind]: (): boolean => true,
+    } as unknown as NodeFs.Stats;
+}
+
+function refusalOf(fn: () => unknown): unknown {
+    try {
+        fn();
+    } catch (err) {
+        return err;
+    }
+    return null;
+}
+
+const canMkfifo = process.platform !== 'win32';
+
+describe('only an absent path, a symbolic link or a regular file is read', () => {
+    /**
+     * Step 2.5, opened by round 4 of the modification review, refused 2/2:
+     *
+     * > "treating every non-symlink object as a regular file can hang the
+     * > governance gate; the highest-leverage pre-merge change is to reject
+     * > non-regular filesystem objects before opening them."
+     *
+     * `openSync` is trapped in these cases, so a regression fails on the trap
+     * rather than hanging on a FIFO open.
+     */
+    it.skipIf(!canMkfifo)('a FIFO is refused before any open', () => {
+        const root = tmpKernel('one\n');
+        const abs = path.join(root, KERNEL);
+        fs.rmSync(abs);
+        execFileSync('mkfifo', [abs]);
+        faults.trapOpen = true;
+        const err = refusalOf(() => subjectDigest(root, [KERNEL]));
+        expect(err).toBeInstanceOf(GatedPathUnsupported);
+        expect((err as InstanceType<typeof GatedPathUnsupported>).kind).toBe('FIFO');
+        expect(opens).toEqual([]);
+    });
+
+    it('a directory is refused before any open', () => {
+        const root = tmpKernel('one\n');
+        const abs = path.join(root, KERNEL);
+        fs.rmSync(abs);
+        fs.mkdirSync(abs);
+        faults.trapOpen = true;
+        const err = refusalOf(() => subjectDigest(root, [KERNEL]));
+        expect(err).toBeInstanceOf(GatedPathUnsupported);
+        expect((err as InstanceType<typeof GatedPathUnsupported>).kind).toBe('directory');
+        expect(opens).toEqual([]);
+    });
+
+    it.each([
+        ['isSocket', 'socket'],
+        ['isCharacterDevice', 'character device'],
+        ['isBlockDevice', 'block device'],
+    ] as const)('a %s Stats is refused as a %s before any open', (predicate, kind) => {
+        const root = tmpKernel('one\n');
+        faults.lstatStats = statsOf(predicate);
+        faults.trapOpen = true;
+        const err = refusalOf(() => subjectDigest(root, [KERNEL]));
+        expect(err).toBeInstanceOf(GatedPathUnsupported);
+        expect((err as InstanceType<typeof GatedPathUnsupported>).kind).toBe(kind);
+        expect(opens).toEqual([]);
+    });
+
+    it('a regular file is still opened and digested — the refusal is not a blanket one', () => {
+        // Polarity: a check that refused every kind would satisfy every case above.
+        const root = tmpKernel('one\n');
+        expect(subjectDigest(root, [KERNEL])).toMatch(/^[0-9a-f]{64}$/);
+        expect(opens.map((o) => o.path)).toEqual([path.join(root, KERNEL)]);
+    });
+});
+
+describe('an object swapped in after the stat is refused at the open, without blocking', () => {
+    it('the open carries O_NOFOLLOW and O_NONBLOCK', () => {
+        const root = tmpKernel('one\n');
+        readGatedFile(KERNEL, path.join(root, KERNEL));
+        expect(opens).toHaveLength(1);
+        const flags = opens[0]?.flags as number;
+        expect(flags & fs.constants.O_NOFOLLOW).toBe(fs.constants.O_NOFOLLOW);
+        expect(flags & fs.constants.O_NONBLOCK).toBe(fs.constants.O_NONBLOCK);
+    });
+
+    it.skipIf(!canMkfifo)('a FIFO reached by the read itself is refused by the fstat', () => {
+        // `readGatedFile` called directly stands for the race: the `lstat`
+        // said regular file, the open met a FIFO.
+        const root = tmpKernel('one\n');
+        const abs = path.join(root, KERNEL);
+        fs.rmSync(abs);
+        execFileSync('mkfifo', [abs]);
+        const err = refusalOf(() => readGatedFile(KERNEL, abs));
+        expect(err).toBeInstanceOf(GatedPathUnsupported);
+        expect((err as InstanceType<typeof GatedPathUnsupported>).kind).toBe('FIFO');
+    });
+
+    it('a directory reached by the read itself is refused by the fstat', () => {
+        const root = tmpKernel('one\n');
+        const abs = path.join(root, KERNEL);
+        fs.rmSync(abs);
+        fs.mkdirSync(abs);
+        const err = refusalOf(() => readGatedFile(KERNEL, abs));
+        expect(err).toBeInstanceOf(GatedPathUnsupported);
+        expect((err as InstanceType<typeof GatedPathUnsupported>).kind).toBe('directory');
+    });
+});
+
+describe('a platform without the safe open flags refuses instead of degrading', () => {
+    it.each(['O_NOFOLLOW', 'O_NONBLOCK'] as const)(
+        'without %s the read is refused and nothing is opened',
+        (flag) => {
+            const root = tmpKernel('one\n');
+            faults.withoutFlag = flag;
+            const err = refusalOf(() => readGatedFile(KERNEL, path.join(root, KERNEL)));
+            expect(err).toBeInstanceOf(GatedPathUnsupported);
+            expect((err as InstanceType<typeof GatedPathUnsupported>).kind).toBe('platform');
+            expect(opens).toEqual([]);
+        },
+    );
+});
```
