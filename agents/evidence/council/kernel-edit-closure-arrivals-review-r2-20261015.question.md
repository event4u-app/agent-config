<!-- evidence-type: analysis -->

<!-- A prompt given to the council on 2026-10-15 for branch fix/kernel-edit-closure-arrivals,
     committed verbatim so the verdict recorded beside it can be checked against
     what was actually asked. Not edited after the run. -->

# Review branch fix/kernel-edit-closure-arrivals — round 2, delta since round 1

Round 1 reviewed commit `c240e47f2` (prompt: `agents/evidence/council/kernel-edit-closure-arrivals-review-20261015.question.md`). Both seats returned REQUEST_CHANGES. This round shows the delta `c240e47f2..d6f436404` in full and how each round-1 finding was handled. Review the delta, and say whether each disposition below holds.

Round-1 findings and dispositions:

1. (both seats, High) Local and CI could still classify different sets: in the CI branch `--base-ref` was ignored and the script checkout stood in for the base, so the same `--base-ref` could yield two classifications. **Changed:** both sides are now read from Git objects in `--root` in every shape — head at the resolved `--rev`, base at the resolved `--base-ref` (`derivedFor`). `main` resolves the base to a commit id once and uses it for both the diff and the closure. Only a direct call naming another `--root` with no `--base-ref` (including `--files` without one) still compares against the script checkout; the CI workflow always passes `--base-ref "$BASE_SHA"` and builds its own diff.
2. (openai, Medium) Head closure read from the working tree while the digest reads the commit. **Changed:** the head side is the commit at `--rev`. The revision is resolved once in `evaluate` and in `expectedSubjectFor` and that id is passed to both the closure and the digest.
3. (openai, Medium) The test passed `--base-ref` to the CI-shaped run where it had no effect. **Changed:** new test — a judging copy checked out at HEAD (which already contains the arrival) given `--base-ref <base>` must gate the arrival; it fails on the round-1 code.
4. (both seats) The test exercised only an explicit base. **Changed:** new test with no `--base-ref`, `refs/remotes/origin/main` pointing at the base; writer and gate agree. (This one also passes on the round-1 code; it is coverage, not a regression proof.) Also a dirty-tree test: an uncommitted edit dropping the import must not hide the committed arrival; it fails on the round-1 code.
5. (openai, Medium) The contract overclaimed. **Changed:** the paragraph now states the guarantee as a function of the two commits and says when the local default equals CI's base and when to pass `--base-ref`.
6. (openai, Low) `tree.read(rel) ?? ''` could mask a file vanishing mid-walk. **Changed:** the walk reads each path at most once (memo), so the source a module was resolved by is the source it is classified from; the gate's own runs now read only immutable object trees.
7. (anthropic) Use the merge-base instead of the base-branch tip. **Not adopted:** CI's base is the PR's `base.sha`, the base branch tip at event time, not the merge base; a local merge-base would diverge from CI whenever the base branch moved. The diff itself is `base...head` (three-dot), so the changed-file list already uses the merge base, as before.
8. (anthropic) "The CI workflow does not pass `--base-ref`." **Not adopted, factually incorrect:** the step runs `npx tsx "$BASE_DIR/$GATE" --root "$PWD" --base-ref "$BASE_SHA"`.
9. (anthropic) `HEAD~1` fallback is fragile. **Unchanged, pre-existing:** the same fallback chain already chose the diff's base before this branch; both now use it once.

A behaviour change introduced by item 2, stated so it is reviewed: an invalid `--rev` with no gated path used to pass (documented exception); it now refuses in every shape, because the gated set depends on the closure at `--rev`. The contract paragraph is rewritten accordingly.

Omitted, named: the round-1 diff (shown in the round-1 prompt, unchanged where not in this delta); the CI workflow step (unchanged); `src/scripts/_lib/ratification_subject.ts` (unchanged since round 1; it hosts `treeAtRevision`, shown in round 1); `src/scripts/ratification_subject.ts` (unchanged since round 1). Gated files of the whole branch under both the base and the head gate: `src/scripts/_lib/dispatch_import_closure.ts`, `src/scripts/check_kernel_edit_ratified.ts`.

For each defect report file:line, the failure scenario and a severity. State your stance (APPROVE or REQUEST_CHANGES) and the single highest-leverage change.

```diff
diff --git a/docs/contracts/ratification-artifact.md b/docs/contracts/ratification-artifact.md
index e165bf2a0..52f0924ff 100644
--- a/docs/contracts/ratification-artifact.md
+++ b/docs/contracts/ratification-artifact.md
@@ -84,17 +84,21 @@ whose `subject` is absent (`subject-absent`), not a digest
 (`subject-malformed`) or a different one (`subject-mismatch`). Both default to
 `HEAD`.
 
-**The local run and the CI run classify the same gated set.** Which files are
-gated includes every module that newly enters the hook dispatcher's import
-closure, so the base side of the change has to be read. CI runs the base
-revision's copy of the gate with `--root <head>`, whose own tree is the base. A
-run whose `--root` is the gate's own checkout — pre-push, `task ci`, the subject
-CLI — reads the base side from Git objects at `--base-ref` (default
-`origin/main`, then `origin/master`, `main`, `master`, `HEAD~1`), so both print
-and check one digest. Give `ratification_subject` the same `--base-ref` as the
-gate; a base that does not resolve is a refusal. Until PR #2371 surfaced it, the
-local run compared the head with itself, saw no arrivals and refused the record
-CI required.
+**The gated set is a function of two commits.** Which files are gated includes
+every module that newly enters the hook dispatcher's import closure, so both
+sides of the change are read — the head at `--rev`, the base at `--base-ref`
+(default `origin/main`, then `origin/master`, `main`, `master`, `HEAD~1`, the
+same resolution the diff uses), both from Git objects, whichever copy of the
+gate runs. So the CI run (the base revision's gate, `--root <head> --base-ref
+<base.sha>`) and a local run classify the same set **when they are given the
+same base commit**: locally that holds when `origin/main` is fetched and the PR
+targets `main`; otherwise pass `--base-ref` explicitly, to the gate and to
+`ratification_subject` alike. A base that does not resolve is a refusal. An
+uncommitted edit changes neither side. The one call that still compares against
+the gate's own checkout is one naming another `--root` with no `--base-ref` (a
+direct call, or `--files` without one). Until PR #2371 surfaced it, a local run
+compared the head with itself, saw no arrivals and refused the record CI
+required.
 
 **The digest is read from Git objects, never from the working tree.** The
 revision is resolved to a commit, each gated path is looked up in that commit's
@@ -128,12 +132,13 @@ from the step and runs that older diff call under them. An option that takes a v
 `--root`, `--base-ref`, `--policy-root` — and is given none is a refusal
 (exit 1), as in the subject CLI, never a fall-back to the default.
 
-**The one exception: an empty gated set reads no commit.** When no changed path
-is gated, the digest is the digest of nothing and no record is owed, so neither
-`ratification_subject` nor the gate under `--files` resolves the revision, and
-an invalid `--rev` then passes rather than refusing. Without `--files` the gate
-still resolves it, because the diff needs a commit. The exception is
-deliberate: there is no content whose reading the revision could change.
+**An empty gated set still reads the commit.** It used not to: when no changed
+path was gated, neither `ratification_subject` nor the gate under `--files`
+resolved the revision, and an invalid `--rev` passed. Which paths are gated now
+depends on the dispatcher closure at `--rev`, so the revision is resolved before
+the gated set exists, and an invalid `--rev` is a refusal in every shape. The
+digest of an empty gated set is still the digest of nothing, and no record is
+owed.
 
 A gated path that is absent in the commit is a deletion. A gated path whose
 tree entry is a regular file (`100644`, `100755`) is hashed. **Every other entry
diff --git a/src/scripts/_lib/dispatch_import_closure.ts b/src/scripts/_lib/dispatch_import_closure.ts
index 3687f1d28..0b71129e6 100644
--- a/src/scripts/_lib/dispatch_import_closure.ts
+++ b/src/scripts/_lib/dispatch_import_closure.ts
@@ -137,7 +137,16 @@ export function dispatchImportClosure(
     root: string | ClosureTree,
     entry: string = DISPATCHER_PATH,
 ): ClosureEntry[] {
-    const tree = typeof root === 'string' ? checkoutTree(root) : root;
+    // Each path is read at most once per walk, so the source a module was
+    // resolved by is the source it is classified and walked from.
+    const backing = typeof root === 'string' ? checkoutTree(root) : root;
+    const memo = new Map<string, string | null>();
+    const tree: ClosureTree = {
+        read(rel: string): string | null {
+            if (!memo.has(rel)) memo.set(rel, backing.read(rel));
+            return memo.get(rel) ?? null;
+        },
+    };
     if (tree.read(entry) === null) {
         return [];
     }
diff --git a/src/scripts/check_kernel_edit_ratified.ts b/src/scripts/check_kernel_edit_ratified.ts
index cc72532ad..f22c1f89a 100644
--- a/src/scripts/check_kernel_edit_ratified.ts
+++ b/src/scripts/check_kernel_edit_ratified.ts
@@ -270,12 +270,18 @@ export function derivedPlumbing(root: string = REPO): readonly string[] {
  * strips the names that classed it, so declassifying one is itself a gated
  * edit of it.
  *
- * `baseRoot` is the base side: a checkout (in CI, the gate's own tree is the
- * base revision's) or a commit's objects (a local run, see `derivedFor`). A
+ * Each side is a checkout path or a commit's objects (see `derivedFor`). A
  * checkout equal to `root` is the same tree on both sides and has no arrivals.
  */
-export function closureArrivals(root: string, baseRoot: string | ClosureTree = REPO): string[] {
-    if (typeof baseRoot === 'string' && path.resolve(root) === path.resolve(baseRoot)) {
+export function closureArrivals(
+    root: string | ClosureTree,
+    baseRoot: string | ClosureTree = REPO,
+): string[] {
+    if (
+        typeof root === 'string' &&
+        typeof baseRoot === 'string' &&
+        path.resolve(root) === path.resolve(baseRoot)
+    ) {
         return [];
     }
     const base = new Set(dispatchImportClosure(baseRoot).map((e) => e.path));
@@ -404,26 +410,36 @@ function resolveBaseRef(explicit: string | null, root: string): string {
  * modules, the head side's, and every module arriving in the closure — so a
  * module present on either side is watched.
  *
- * Which tree is the base depends on where the gate runs. In CI the workflow
- * runs the BASE revision's copy with `--root <head>`, so this script's own tree
- * is the base. A local run (pre-push, `task ci`) executes the head's copy, whose
- * own tree is `root` itself: compared with itself it saw no arrivals, digested
- * fewer files than CI, and refused the record CI requires (PR #2371). So when
- * `root` is this script's tree, the base side is read from Git objects at
- * `baseRef` — resolved the same way as the diff's base, the commit CI's base
- * checkout is — and both runs classify one gated set.
+ * BOTH SIDES ARE COMMITS, READ FROM GIT OBJECTS IN `root`, in every execution
+ * shape. The head is `revision`, the commit the digest and the record are read
+ * at, so an uncommitted import edit cannot add or hide a module. The base is
+ * `baseRef`, resolved the way the diff's base is. The same two commits
+ * therefore yield the same gated set whichever copy of this script runs.
  *
- * THROWS a {@link GatedSubjectRefusal} when that base does not resolve.
+ * Why the base is not this script's checkout: CI runs the base revision's copy
+ * with `--root <head>`, where that checkout IS the base, but a local run
+ * (pre-push, `task ci`, the subject CLI) executes the head's copy, whose
+ * checkout is the head. Compared with itself it saw no arrivals, digested fewer
+ * files than CI and refused the record CI required (PR #2371).
+ *
+ * One residue keeps the old base: a call with no `baseRef` over a `root` that
+ * is not this checkout — a direct call, or `--files` without `--base-ref` —
+ * compares against this script's checkout. A run that builds its own diff
+ * always passes the base it diffed against.
+ *
+ * THROWS a {@link GatedSubjectRefusal} when either commit does not resolve.
  */
-function derivedFor(root: string, baseRef: string | null): readonly string[] {
-    if (path.resolve(root) !== REPO) {
-        return [...new Set([...derivedPlumbing(), ...derivedPlumbing(root), ...closureArrivals(root)])];
+function derivedFor(root: string, baseRef: string | null, revision: string): readonly string[] {
+    const verdictsOf = (tree: ClosureTree): string[] =>
+        dispatchImportClosure(tree)
+            .filter((e) => e.class === 'verdict')
+            .map((e) => e.path);
+    const head = treeAtRevision(root, resolveRevision(root, revision));
+    if (baseRef === null && path.resolve(root) !== REPO) {
+        return [...new Set([...derivedPlumbing(), ...verdictsOf(head), ...closureArrivals(head)])];
     }
     const base = treeAtRevision(root, resolveRevision(root, resolveBaseRef(baseRef, root)));
-    const baseVerdicts = dispatchImportClosure(base)
-        .filter((e) => e.class === 'verdict')
-        .map((e) => e.path);
-    return [...new Set([...baseVerdicts, ...derivedPlumbing(root), ...closureArrivals(root, base)])];
+    return [...new Set([...verdictsOf(base), ...verdictsOf(head), ...closureArrivals(head, base)])];
 }
 
 /**
@@ -456,7 +472,8 @@ export function expectedSubjectFor(
     revision: string = DEFAULT_REVISION,
     baseRef: string | null = null,
 ): SubjectReading {
-    return subjectOf(root, files, derivedFor(root, baseRef), revision);
+    const commit = resolveRevision(root, revision);
+    return subjectOf(root, files, derivedFor(root, baseRef, commit), commit);
 }
 
 export interface GateResult {
@@ -482,18 +499,21 @@ export function evaluate(
     const ledger = new GateLedger('check_kernel_edit_ratified');
     ledger.plan(files.map((f) => f.replace(/\\/g, '/').trim()).filter((f) => f !== ''));
 
-    // Computed once and handed to the digest below, so the classification and
-    // the digest cannot read two different base sides.
+    // The revision is resolved once and the closure computed once, then both
+    // are handed to the digest below, so the classification and the digest
+    // read one head commit and one base.
     let derived: readonly string[];
+    let headCommit: string;
     try {
-        derived = derivedFor(root, baseRef);
+        headCommit = resolveRevision(root, revision);
+        derived = derivedFor(root, baseRef, headCommit);
     } catch (err) {
         if (!(err instanceof GatedSubjectRefusal)) {
             throw err;
         }
         lines.push(`❌  ${err.message}`);
         for (const target of ledger.unaccountedTargets()) {
-            ledger.fail(target, 'the base side of the dispatcher closure could not be read');
+            ledger.fail(target, 'the dispatcher closure could not be read at the named commits');
         }
         const tally = ledger.finalize();
         lines.push('', `ledger: planned ${tally.planned} · completed 0 · failed ${tally.failed} · out_of_scope 0`);
@@ -550,7 +570,7 @@ export function evaluate(
     let expectedSubject: string;
     let commit: string | null;
     try {
-        ({ digest: expectedSubject, revision: commit } = subjectOf(root, files, derived, revision));
+        ({ digest: expectedSubject, revision: commit } = subjectOf(root, files, derived, headCommit));
     } catch (err) {
         // ONE boundary for EVERY failure of the subject computation: each is
         // a subclass of `GatedSubjectRefusal`, so a gate that advertises a
@@ -744,7 +764,10 @@ export function main(argv: readonly string[] = process.argv.slice(2)): number {
             return 1;
         }
         try {
-            changed = changedFilesBetween(root, resolveBaseRef(baseRef, root), commit);
+            // The base, too, is resolved once: the diff and the closure's base
+            // side read the same commit.
+            baseRef = resolveRevision(root, resolveBaseRef(baseRef, root));
+            changed = changedFilesBetween(root, baseRef, commit);
         } catch (err) {
             if (!(err instanceof GatedSubjectRefusal)) {
                 throw err;
diff --git a/tests/scripts/check_kernel_edit_ratified_local_base.test.ts b/tests/scripts/check_kernel_edit_ratified_local_base.test.ts
index a19c14e62..9776ab825 100644
--- a/tests/scripts/check_kernel_edit_ratified_local_base.test.ts
+++ b/tests/scripts/check_kernel_edit_ratified_local_base.test.ts
@@ -77,37 +77,81 @@ afterEach(() => {
     fs.rmSync(baseDir, { recursive: true, force: true });
 });
 
+function git(args: readonly string[]): void {
+    const res = spawnSync('git', ['-C', root, ...args], { encoding: 'utf8' });
+    expect(res.status, res.stderr).toBe(0);
+}
+
+/**
+ * A base commit whose dispatcher imports one module, and a head commit that
+ * brings a second one into the closure — the shape of PR #2371. Returns the
+ * base commit id.
+ */
+function buildChange(): string {
+    for (const rel of GATE_FILES) {
+        write(rel, fs.readFileSync(path.join(REPO, rel), 'utf8'));
+    }
+    write(DISPATCHER, "import { save } from './state_io.js';\nsave();\n");
+    write('src/scripts/hooks/state_io.ts', 'export function save(): void {}\n');
+    const base = commitAll(root, 'base');
+    write(
+        DISPATCHER,
+        "import { save } from './state_io.js';\nimport { stage } from './egress_stage.js';\nsave();\nstage();\n",
+    );
+    write(ARRIVAL, 'export function stage(): void {}\n');
+    commitAll(root, 'head');
+    return base;
+}
+
+/** Commit a record carrying `subject`. */
+function commitRecord(subject: string): void {
+    write(
+        path.join(RATIFICATION_DIR, 'closure-arrival.md'),
+        [
+            '---',
+            'proposed_by: claude/session-a',
+            'implemented_by: claude/session-a',
+            'reviewed_by: council/anthropic+openai',
+            `subject: ${subject}`,
+            'verdict: ratified',
+            'effective_after: merge',
+            'providers:',
+            '  - anthropic',
+            '  - openai',
+            'seats:',
+            '  anthropic: ratified',
+            '  openai: ratified',
+            '---',
+            '',
+            '<!-- evidence-type: ratification -->',
+            '',
+            'Review body.',
+            '',
+        ].join('\n'),
+    );
+    commitAll(root, 'record');
+}
+
+function lastLine(out: string): string {
+    return out.trim().split('\n').pop() as string;
+}
+
+const CHANGED = [DISPATCHER, ARRIVAL];
+
 describe('a module joining the dispatcher closure', () => {
     it('is gated by the local run exactly as by the base-revision run', () => {
-        for (const rel of GATE_FILES) {
-            write(rel, fs.readFileSync(path.join(REPO, rel), 'utf8'));
-        }
-        write(DISPATCHER, "import { save } from './state_io.js';\nsave();\n");
-        write('src/scripts/hooks/state_io.ts', 'export function save(): void {}\n');
-        const base = commitAll(root, 'base');
-
-        write(
-            DISPATCHER,
-            "import { save } from './state_io.js';\nimport { stage } from './egress_stage.js';\nsave();\nstage();\n",
-        );
-        write(ARRIVAL, 'export function stage(): void {}\n');
-        commitAll(root, 'head');
-
-        const git = spawnSync('git', ['-C', root, 'worktree', 'add', '--detach', baseDir, base], {
-            encoding: 'utf8',
-        });
-        expect(git.status).toBe(0);
-
-        const changed = [DISPATCHER, ARRIVAL];
+        const base = buildChange();
+        git(['worktree', 'add', '--detach', baseDir, base]);
+
         const writer = run(path.join(baseDir, 'src/scripts/ratification_subject.ts'), [
             '--root',
             root,
             '--quiet',
             '--files',
-            ...changed,
+            ...CHANGED,
         ]);
         expect(writer.code).toBe(0);
-        const subject = writer.out.trim().split('\n').pop() as string;
+        const subject = lastLine(writer.out);
         expect(subject).toMatch(/^[0-9a-f]{64}$/u);
 
         // The writer run locally, as an author would before pushing, prints
@@ -117,37 +161,12 @@ describe('a module joining the dispatcher closure', () => {
             base,
             '--quiet',
             '--files',
-            ...changed,
+            ...CHANGED,
         ]);
         expect(localWriter.code).toBe(0);
-        expect(localWriter.out.trim().split('\n').pop()).toBe(subject);
-
-        write(
-            path.join(RATIFICATION_DIR, 'closure-arrival.md'),
-            [
-                '---',
-                'proposed_by: claude/session-a',
-                'implemented_by: claude/session-a',
-                'reviewed_by: council/anthropic+openai',
-                `subject: ${subject}`,
-                'verdict: ratified',
-                'effective_after: merge',
-                'providers:',
-                '  - anthropic',
-                '  - openai',
-                'seats:',
-                '  anthropic: ratified',
-                '  openai: ratified',
-                '---',
-                '',
-                '<!-- evidence-type: ratification -->',
-                '',
-                'Review body.',
-                '',
-            ].join('\n'),
-        );
-        commitAll(root, 'record');
+        expect(lastLine(localWriter.out)).toBe(subject);
 
+        commitRecord(subject);
         const ci = run(path.join(baseDir, 'src/scripts/check_kernel_edit_ratified.ts'), [
             '--root',
             root,
@@ -164,4 +183,48 @@ describe('a module joining the dispatcher closure', () => {
         expect(gated(local.out)).toEqual(gated(ci.out));
         expect(local.code).toBe(0);
     }, 60_000);
+
+    it('the default base, with no --base-ref, is the one the diff is taken against', () => {
+        const base = buildChange();
+        git(['update-ref', 'refs/remotes/origin/main', base]);
+        const writer = run(path.join(root, 'src/scripts/ratification_subject.ts'), [
+            '--quiet',
+            '--files',
+            ...CHANGED,
+        ]);
+        expect(writer.code).toBe(0);
+        commitRecord(lastLine(writer.out));
+
+        const local = run(path.join(root, 'src/scripts/check_kernel_edit_ratified.ts'), []);
+        expect(local.out).toContain(`hook-plumbing source ${ARRIVAL}`);
+        expect(local.code).toBe(0);
+    }, 60_000);
+
+    it('an uncommitted edit dropping the import does not hide the committed arrival', () => {
+        const base = buildChange();
+        write(DISPATCHER, "import { save } from './state_io.js';\nsave();\n");
+
+        const local = run(path.join(root, 'src/scripts/check_kernel_edit_ratified.ts'), [
+            '--base-ref',
+            base,
+        ]);
+        expect(local.out).toContain(`hook-plumbing source ${ARRIVAL}`);
+        expect(local.code).toBe(1);
+    }, 60_000);
+
+    it('a judging copy checked out at another commit still compares against --base-ref', () => {
+        const base = buildChange();
+        // The judging script's own tree is the HEAD, which already contains the
+        // arrival; only the supplied base can reveal it.
+        git(['worktree', 'add', '--detach', baseDir, 'HEAD']);
+
+        const ci = run(path.join(baseDir, 'src/scripts/check_kernel_edit_ratified.ts'), [
+            '--root',
+            root,
+            '--base-ref',
+            base,
+        ]);
+        expect(ci.out).toContain(`hook-plumbing source ${ARRIVAL}`);
+        expect(ci.code).toBe(1);
+    }, 60_000);
 });
```
