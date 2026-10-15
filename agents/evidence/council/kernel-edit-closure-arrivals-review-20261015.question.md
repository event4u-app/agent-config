<!-- evidence-type: analysis -->

<!-- A prompt given to the council on 2026-10-15 for branch fix/kernel-edit-closure-arrivals,
     committed verbatim so the verdict recorded beside it can be checked against
     what was actually asked. Not edited after the run. -->

# Review branch fix/kernel-edit-closure-arrivals — where the ratification gate reads the base side of the dispatcher closure

`src/scripts/check_kernel_edit_ratified.ts` refuses a diff touching kernel rules, governance hooks or hook plumbing unless a committed ratification record carries a `subject:` digest equal to the digest of the diff's gated content. Part of the gated set is derived: every non-concern module that newly enters the static import closure of `src/scripts/hooks/dispatch_hook.ts` (`closureArrivals`), plus the verdict-classed modules of the closure on either side.

CI runs the BASE revision's copy of the gate with `--root <head>`, so the script's own tree is the base. The pre-push hook, `task ci` and the `ratification_subject` writer CLI execute the head's copy with `--root` defaulting to the script's own checkout. Before this change, `closureArrivals(root, REPO)` returned `[]` when the two were the same path, so those runs gated fewer files than CI. Observed on PR #2371: the CI gate gated four files (`hooks/dispatch_hook.ts`, `hooks/egress_stage.ts`, `_lib/agent_settings.ts`, `config/hook-latency-budget.json`), the local gate two, and no single `subject` satisfied both.

This change: when `--root` resolves to the script's own tree, the base side is read from Git objects at the base ref (`--base-ref`, else `origin/main`, `origin/master`, `main`, `master`, `HEAD~1` — the same resolution the diff uses), via a `ClosureTree` reader that `dispatchImportClosure` now accepts. The CI branch (`--root` differs from the script tree) is unchanged. The writer CLI gains `--base-ref`. A new test builds a fixture repository carrying a copy of the gate, runs the CI shape (detached worktree of the base commit, `--root <head>`) and the local shape, and asserts the same gated list, the same digest from both writers, and that a record bound to the CI digest passes both. On the pre-change code that test fails with the local run listing only `dispatch_hook.ts` and refusing the record. Replayed on the real repository at `38542f8ee` (PR #2371's merge), the changed gate run locally now lists the same four files as CI and accepts that PR's record; the pre-change gate listed two and refused it.

Review the diff below. For each defect report file:line, the failure scenario and a severity. Questions a review should answer include: whether the local branch and the CI branch can still classify different sets (for example when the base ref is stale, absent, or differs from the commit CI checks out, which is the PR's `base.sha` — the base branch tip — while the diff is `base...head`); whether reading the head side from the working tree while the base side comes from Git objects opens a gap; whether a refusal path can be turned into a pass; whether any membership is narrowed relative to before; and whether the change itself is correctly classified as needing ratification. State your stance (APPROVE or REQUEST_CHANGES) and the single highest-leverage change.

Omitted, named: nothing of the changed files is omitted — the diff below is complete (7 files, 24,753 bytes). Not shown: the unchanged remainder of the four source files, the CI workflow step (`.github/workflows/consistency.yml`, unchanged), and the test helper `tests/scripts/ratification_git_fixture.ts` (unchanged; it initialises and commits a fixture repository with hooks and signing disabled). `src/scripts/_lib/ratification_subject.ts`, which now hosts the object-store reader, is not itself in the gate's watched set; under both the base and the head gate the gated files of this diff are `src/scripts/_lib/dispatch_import_closure.ts` and `src/scripts/check_kernel_edit_ratified.ts`.

```diff
diff --git a/docs/contracts/ratification-artifact.md b/docs/contracts/ratification-artifact.md
index 33f3b9fac..e165bf2a0 100644
--- a/docs/contracts/ratification-artifact.md
+++ b/docs/contracts/ratification-artifact.md
@@ -84,6 +84,18 @@ whose `subject` is absent (`subject-absent`), not a digest
 (`subject-malformed`) or a different one (`subject-mismatch`). Both default to
 `HEAD`.
 
+**The local run and the CI run classify the same gated set.** Which files are
+gated includes every module that newly enters the hook dispatcher's import
+closure, so the base side of the change has to be read. CI runs the base
+revision's copy of the gate with `--root <head>`, whose own tree is the base. A
+run whose `--root` is the gate's own checkout — pre-push, `task ci`, the subject
+CLI — reads the base side from Git objects at `--base-ref` (default
+`origin/main`, then `origin/master`, `main`, `master`, `HEAD~1`), so both print
+and check one digest. Give `ratification_subject` the same `--base-ref` as the
+gate; a base that does not resolve is a refusal. Until PR #2371 surfaced it, the
+local run compared the head with itself, saw no arrivals and refused the record
+CI required.
+
 **The digest is read from Git objects, never from the working tree.** The
 revision is resolved to a commit, each gated path is looked up in that commit's
 tree (`git ls-tree`) and a blob's bytes come from the object store
diff --git a/src/scripts/_lib/dispatch_import_closure.ts b/src/scripts/_lib/dispatch_import_closure.ts
index 1b20f886f..3687f1d28 100644
--- a/src/scripts/_lib/dispatch_import_closure.ts
+++ b/src/scripts/_lib/dispatch_import_closure.ts
@@ -80,13 +80,31 @@ export function relativeSpecifiers(source: string): string[] {
     return out;
 }
 
-/** Resolve a `.js` specifier from `fromRel` to the `.ts` source on disk. */
-function resolveSpecifier(root: string, fromRel: string, spec: string): string | null {
+/**
+ * Where a walk reads module sources: a checkout on disk, or a commit's objects.
+ * `read` returns `null` when no regular file sits at the repo-relative path.
+ */
+export interface ClosureTree {
+    read(rel: string): string | null;
+}
+
+/** The checkout under `root`, read through the filesystem. */
+export function checkoutTree(root: string): ClosureTree {
+    return {
+        read(rel: string): string | null {
+            const abs = path.join(root, rel);
+            return fs.existsSync(abs) && fs.statSync(abs).isFile() ? fs.readFileSync(abs, 'utf8') : null;
+        },
+    };
+}
+
+/** Resolve a `.js` specifier from `fromRel` to the `.ts` source in `tree`. */
+function resolveSpecifier(tree: ClosureTree, fromRel: string, spec: string): string | null {
     const base = path.posix.join(path.posix.dirname(fromRel), spec);
     const candidates = [base.replace(/\.js$/, '.ts'), base, `${base}.ts`, `${base}/index.ts`];
     for (const c of candidates) {
         const norm = path.posix.normalize(c);
-        if (fs.existsSync(path.join(root, norm)) && fs.statSync(path.join(root, norm)).isFile()) {
+        if (tree.read(norm) !== null) {
             return norm;
         }
     }
@@ -110,13 +128,17 @@ export function classifySource(source: string): Exclude<ModuleClass, 'concern'>
 }
 
 /**
- * Walk the closure from the dispatcher under `root`. Returns `[]` when the
- * dispatcher is absent, so a fixture tree without one yields an empty set
- * rather than an error. The dispatcher itself is not in the result — it is
- * already watched by name.
+ * Walk the closure from the dispatcher under `root`, a checkout path or a
+ * {@link ClosureTree}. Returns `[]` when the dispatcher is absent, so a fixture
+ * tree without one yields an empty set rather than an error. The dispatcher
+ * itself is not in the result — it is already watched by name.
  */
-export function dispatchImportClosure(root: string, entry: string = DISPATCHER_PATH): ClosureEntry[] {
-    if (!fs.existsSync(path.join(root, entry))) {
+export function dispatchImportClosure(
+    root: string | ClosureTree,
+    entry: string = DISPATCHER_PATH,
+): ClosureEntry[] {
+    const tree = typeof root === 'string' ? checkoutTree(root) : root;
+    if (tree.read(entry) === null) {
         return [];
     }
     const seen = new Map<string, ModuleClass>();
@@ -128,13 +150,13 @@ export function dispatchImportClosure(root: string, entry: string = DISPATCHER_P
             continue;
         }
         visited.add(rel);
-        const source = fs.readFileSync(path.join(root, rel), 'utf8');
+        const source = tree.read(rel) ?? '';
         if (rel !== entry) {
             seen.set(rel, classifySource(source));
         }
         const isRegistry = rel === CONCERN_REGISTRY_PATH;
         for (const spec of relativeSpecifiers(source)) {
-            const target = resolveSpecifier(root, rel, spec);
+            const target = resolveSpecifier(tree, rel, spec);
             if (target === null || target === entry) {
                 continue;
             }
diff --git a/src/scripts/_lib/ratification_subject.ts b/src/scripts/_lib/ratification_subject.ts
index 4ffffe347..469316ae3 100644
--- a/src/scripts/_lib/ratification_subject.ts
+++ b/src/scripts/_lib/ratification_subject.ts
@@ -426,6 +426,41 @@ export function fileAtRevision(root: string, commit: string, rel: string): Buffe
     return regularFileAt(treeEntriesAt(root, commit, [rel]).get(rel), root, rel)?.bytes ?? null;
 }
 
+/**
+ * The regular files of `commit` as a source the dispatcher-closure walk reads,
+ * so a run can read the BASE side of a change from Git objects instead of from
+ * a second checkout. One `ls-tree` lists the tree; each blob is read on demand
+ * and kept. A path that is absent or is not a regular file reads as `null`.
+ */
+export function treeAtRevision(root: string, commit: string): { read(rel: string): string | null } {
+    const res = runGit(root, ['ls-tree', '-r', '-z', '--full-tree', commit], '');
+    if (res.status !== 0) {
+        throw new GitReadFailed('', 'ls-tree', stderrOf(res));
+    }
+    const blobs = new Map<string, string>();
+    for (const record of res.stdout.toString('utf8').split('\u0000')) {
+        const tab = record.indexOf('\t');
+        if (tab < 0) continue;
+        const [mode, type, oid] = record.slice(0, tab).split(' ');
+        if (type === 'blob' && mode !== undefined && REGULAR_MODES.has(mode) && oid !== undefined) {
+            blobs.set(record.slice(tab + 1), oid);
+        }
+    }
+    const read = new Map<string, string>();
+    return {
+        read(rel: string): string | null {
+            const oid = blobs.get(rel);
+            if (oid === undefined) return null;
+            let text = read.get(rel);
+            if (text === undefined) {
+                text = blobBytes(root, oid, rel).toString('utf8');
+                read.set(rel, text);
+            }
+            return text;
+        },
+    };
+}
+
 /**
  * The self surface, by the gate's own constants rather than a copy of them.
  *
diff --git a/src/scripts/check_kernel_edit_ratified.ts b/src/scripts/check_kernel_edit_ratified.ts
index 65ffb8836..cc72532ad 100644
--- a/src/scripts/check_kernel_edit_ratified.ts
+++ b/src/scripts/check_kernel_edit_ratified.ts
@@ -86,7 +86,11 @@ import * as path from 'node:path';
 import { fileURLToPath, pathToFileURL } from 'node:url';
 
 import { GateLedger } from './_lib/gate_ledger.js';
-import { dispatchImportClosure, verdictModules } from './_lib/dispatch_import_closure.js';
+import {
+    dispatchImportClosure,
+    verdictModules,
+    type ClosureTree,
+} from './_lib/dispatch_import_closure.js';
 import { is_kernel_rule } from './_lib/kernel_rules.js';
 import { reportScanned } from './_lib/scan_scope.js';
 import {
@@ -105,6 +109,7 @@ import {
     refExists,
     resolveRevision,
     subjectOf,
+    treeAtRevision,
     type SubjectReading,
 } from './_lib/ratification_subject.js';
 
@@ -265,12 +270,12 @@ export function derivedPlumbing(root: string = REPO): readonly string[] {
  * strips the names that classed it, so declassifying one is itself a gated
  * edit of it.
  *
- * Meaningful only where the two trees differ — in CI, where the gate's code is
- * the base revision's and `root` is the head. A local run with `root` equal to
- * the gate's own tree sees no arrivals, and says nothing it cannot measure.
+ * `baseRoot` is the base side: a checkout (in CI, the gate's own tree is the
+ * base revision's) or a commit's objects (a local run, see `derivedFor`). A
+ * checkout equal to `root` is the same tree on both sides and has no arrivals.
  */
-export function closureArrivals(root: string, baseRoot: string = REPO): string[] {
-    if (path.resolve(root) === path.resolve(baseRoot)) {
+export function closureArrivals(root: string, baseRoot: string | ClosureTree = REPO): string[] {
+    if (typeof baseRoot === 'string' && path.resolve(root) === path.resolve(baseRoot)) {
         return [];
     }
     const base = new Set(dispatchImportClosure(baseRoot).map((e) => e.path));
@@ -395,12 +400,30 @@ function resolveBaseRef(explicit: string | null, root: string): string {
 }
 
 /**
- * The plumbing closure this gate classifies with: the union of the list read
- * from the tree under review and from this script's own tree, so a module
- * present on either side is watched.
+ * The plumbing closure this gate classifies with: the base side's verdict
+ * modules, the head side's, and every module arriving in the closure — so a
+ * module present on either side is watched.
+ *
+ * Which tree is the base depends on where the gate runs. In CI the workflow
+ * runs the BASE revision's copy with `--root <head>`, so this script's own tree
+ * is the base. A local run (pre-push, `task ci`) executes the head's copy, whose
+ * own tree is `root` itself: compared with itself it saw no arrivals, digested
+ * fewer files than CI, and refused the record CI requires (PR #2371). So when
+ * `root` is this script's tree, the base side is read from Git objects at
+ * `baseRef` — resolved the same way as the diff's base, the commit CI's base
+ * checkout is — and both runs classify one gated set.
+ *
+ * THROWS a {@link GatedSubjectRefusal} when that base does not resolve.
  */
-function derivedFor(root: string): readonly string[] {
-    return [...new Set([...derivedPlumbing(), ...derivedPlumbing(root), ...closureArrivals(root)])];
+function derivedFor(root: string, baseRef: string | null): readonly string[] {
+    if (path.resolve(root) !== REPO) {
+        return [...new Set([...derivedPlumbing(), ...derivedPlumbing(root), ...closureArrivals(root)])];
+    }
+    const base = treeAtRevision(root, resolveRevision(root, resolveBaseRef(baseRef, root)));
+    const baseVerdicts = dispatchImportClosure(base)
+        .filter((e) => e.class === 'verdict')
+        .map((e) => e.path);
+    return [...new Set([...baseVerdicts, ...derivedPlumbing(root), ...closureArrivals(root, base)])];
 }
 
 /**
@@ -431,8 +454,9 @@ export function expectedSubjectFor(
     files: readonly string[],
     root: string,
     revision: string = DEFAULT_REVISION,
+    baseRef: string | null = null,
 ): SubjectReading {
-    return subjectOf(root, files, derivedFor(root), revision);
+    return subjectOf(root, files, derivedFor(root, baseRef), revision);
 }
 
 export interface GateResult {
@@ -447,13 +471,9 @@ export function evaluate(
     root: string,
     providerCount: number | null,
     revision: string = DEFAULT_REVISION,
+    baseRef: string | null = null,
 ): GateResult {
     const lines: string[] = [];
-    // The union of the closure read from the tree under review and from this
-    // script's own tree: under CI the gate code is the base revision's and
-    // `root` is the head, so a module present on either side is watched.
-    const derived = derivedFor(root);
-    const gated = classifyPaths(files, derived);
     const scanned = files.length;
 
     // Every changed path is a planned target: the gate's denominator is the
@@ -461,6 +481,25 @@ export function evaluate(
     // counting rather than a silence.
     const ledger = new GateLedger('check_kernel_edit_ratified');
     ledger.plan(files.map((f) => f.replace(/\\/g, '/').trim()).filter((f) => f !== ''));
+
+    // Computed once and handed to the digest below, so the classification and
+    // the digest cannot read two different base sides.
+    let derived: readonly string[];
+    try {
+        derived = derivedFor(root, baseRef);
+    } catch (err) {
+        if (!(err instanceof GatedSubjectRefusal)) {
+            throw err;
+        }
+        lines.push(`❌  ${err.message}`);
+        for (const target of ledger.unaccountedTargets()) {
+            ledger.fail(target, 'the base side of the dispatcher closure could not be read');
+        }
+        const tally = ledger.finalize();
+        lines.push('', `ledger: planned ${tally.planned} · completed 0 · failed ${tally.failed} · out_of_scope 0`);
+        return { exitCode: 1, lines, scanned };
+    }
+    const gated = classifyPaths(files, derived);
     const gatedSet = new Set<string>([
         ...gated.kernelRules,
         ...gated.governanceHooks,
@@ -511,7 +550,7 @@ export function evaluate(
     let expectedSubject: string;
     let commit: string | null;
     try {
-        ({ digest: expectedSubject, revision: commit } = expectedSubjectFor(files, root, revision));
+        ({ digest: expectedSubject, revision: commit } = subjectOf(root, files, derived, revision));
     } catch (err) {
         // ONE boundary for EVERY failure of the subject computation: each is
         // a subclass of `GatedSubjectRefusal`, so a gate that advertises a
@@ -716,7 +755,7 @@ export function main(argv: readonly string[] = process.argv.slice(2)): number {
         revision = commit;
     }
 
-    const result = evaluate(changed, root, configuredProviderCount(policyRoot), revision);
+    const result = evaluate(changed, root, configuredProviderCount(policyRoot), revision, baseRef);
 
     // OUTSIDE the quiet guard: CI passes --quiet, and a coverage guard that
     // sees no count reports the gate silent.
diff --git a/src/scripts/ratification_subject.ts b/src/scripts/ratification_subject.ts
index 448c08532..0ab5811db 100644
--- a/src/scripts/ratification_subject.ts
+++ b/src/scripts/ratification_subject.ts
@@ -12,7 +12,12 @@
  * disagree with the gate exactly on the changes that widen the gated set, which
  * are the changes a record most needs to be right about.
  *
- * Usage: ratification_subject --files <path> [<path> …] [--root DIR] [--rev REV] [--quiet]
+ * Usage: ratification_subject --files <path> [<path> …] [--root DIR] [--rev REV]
+ *        [--base-ref REF] [--quiet]
+ *
+ * `--base-ref` names the base the gate's local run reads the dispatcher closure
+ * from (default: the gate's own default, `origin/main` first). It matters only
+ * when `--root` is this checkout; pass the same ref the gate is given.
  *
  * `--files` takes the change's WHOLE changed-file list, not its gated subset:
  * which of them are gated is the gate's decision, not the caller's, and passing
@@ -46,6 +51,7 @@ export function main(argv: readonly string[] = process.argv.slice(2)): number {
     const files: string[] = [];
     let root = REPO;
     let revision = DEFAULT_REVISION;
+    let baseRef: string | null = null;
     let collecting = false;
     let quiet = false;
 
@@ -81,6 +87,17 @@ export function main(argv: readonly string[] = process.argv.slice(2)): number {
             collecting = false;
             continue;
         }
+        if (a === '--base-ref') {
+            const value = optionValue(argv, i);
+            if (value === null) {
+                process.stderr.write('error: --base-ref takes a revision\n');
+                return 2;
+            }
+            baseRef = value;
+            i += 1;
+            collecting = false;
+            continue;
+        }
         if (a === '--quiet') {
             quiet = true;
             collecting = false;
@@ -100,7 +117,7 @@ export function main(argv: readonly string[] = process.argv.slice(2)): number {
     if (files.length === 0) {
         process.stderr.write(
             'usage: ratification_subject --files <path> [<path> …] [--root DIR] [--rev REV] ' +
-                '[--quiet]\n' +
+                '[--base-ref REF] [--quiet]\n' +
                 '       pass the whole changed-file list; the gated subset is this gate’s decision\n',
         );
         return 2;
@@ -114,7 +131,7 @@ export function main(argv: readonly string[] = process.argv.slice(2)): number {
     let gated: readonly string[];
     let commit: string | null;
     try {
-        ({ digest, gatedFiles: gated, revision: commit } = expectedSubjectFor(files, root, revision));
+        ({ digest, gatedFiles: gated, revision: commit } = expectedSubjectFor(files, root, revision, baseRef));
     } catch (err) {
         if (!(err instanceof GatedSubjectRefusal)) {
             throw err;
diff --git a/tests/scripts/check_kernel_edit_ratified_local_base.test.ts b/tests/scripts/check_kernel_edit_ratified_local_base.test.ts
new file mode 100644
index 000000000..a19c14e62
--- /dev/null
+++ b/tests/scripts/check_kernel_edit_ratified_local_base.test.ts
@@ -0,0 +1,167 @@
+// The local run and the CI run classify the same gated set.
+//
+// Found on PR #2371: CI runs the BASE revision's copy of the gate with
+// `--root <head>`, so `closureArrivals` compares the head's dispatcher closure
+// with the base's and gates every module the change brings into it. The local
+// pre-push run executes the head's own copy, whose "base" was its own checkout,
+// so it saw no arrivals: the two runs digested different file sets and no one
+// `subject` satisfied both. A correct record was refused before push.
+//
+// The fixture is a real repository carrying a copy of the gate, so the local
+// run is the gate judging its own tree and the CI run is a detached worktree of
+// the base commit judging the head — the two shapes the workflow and the
+// pre-push hook actually produce. A record whose subject the CI-shaped writer
+// printed must clear both.
+import { spawnSync } from 'node:child_process';
+import * as fs from 'node:fs';
+import * as os from 'node:os';
+import * as path from 'node:path';
+
+import { afterEach, beforeEach, describe, expect, it } from 'vitest';
+
+import { RATIFICATION_DIR } from '../../src/scripts/_lib/ratification_artifact.js';
+import { commitAll } from './ratification_git_fixture.js';
+
+const REPO = process.cwd();
+const TSX = path.join(REPO, 'node_modules', '.bin', 'tsx');
+
+/** The gate's own module graph plus the policy it reads from its tree. */
+const GATE_FILES = [
+    'src/scripts/check_kernel_edit_ratified.ts',
+    'src/scripts/ratification_subject.ts',
+    'src/scripts/_lib/gate_ledger.ts',
+    'src/scripts/_lib/dispatch_import_closure.ts',
+    'src/scripts/_lib/kernel_rules.ts',
+    'src/scripts/_lib/scan_scope.ts',
+    'src/scripts/_lib/adr_frontmatter.ts',
+    'src/scripts/_lib/ratification_artifact.ts',
+    'src/scripts/_lib/ratification_subject.ts',
+    'src/config/ratification-policy.json',
+];
+
+const DISPATCHER = 'src/scripts/hooks/dispatch_hook.ts';
+const ARRIVAL = 'src/scripts/hooks/egress_stage.ts';
+
+let root: string;
+let baseDir: string;
+
+function write(rel: string, body: string): void {
+    const abs = path.join(root, rel);
+    fs.mkdirSync(path.dirname(abs), { recursive: true });
+    fs.writeFileSync(abs, body);
+}
+
+function run(script: string, args: readonly string[]): { code: number; out: string } {
+    const env = { ...process.env };
+    for (const k of ['GIT_DIR', 'GIT_WORK_TREE', 'GIT_INDEX_FILE', 'GIT_COMMON_DIR']) delete env[k];
+    const res = spawnSync(TSX, [script, ...args], { cwd: root, encoding: 'utf8', env });
+    return { code: res.status ?? -1, out: `${res.stdout}${res.stderr}` };
+}
+
+function gated(out: string): string[] {
+    return out
+        .split('\n')
+        .filter((l) => l.trimStart().startsWith('· '))
+        .map((l) => l.trim())
+        .sort();
+}
+
+beforeEach(() => {
+    // Real path: the scripts' entry guard compares against the resolved URL.
+    root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'ker-local-base-')));
+    baseDir = `${root}-base`;
+});
+
+afterEach(() => {
+    fs.rmSync(root, { recursive: true, force: true });
+    fs.rmSync(baseDir, { recursive: true, force: true });
+});
+
+describe('a module joining the dispatcher closure', () => {
+    it('is gated by the local run exactly as by the base-revision run', () => {
+        for (const rel of GATE_FILES) {
+            write(rel, fs.readFileSync(path.join(REPO, rel), 'utf8'));
+        }
+        write(DISPATCHER, "import { save } from './state_io.js';\nsave();\n");
+        write('src/scripts/hooks/state_io.ts', 'export function save(): void {}\n');
+        const base = commitAll(root, 'base');
+
+        write(
+            DISPATCHER,
+            "import { save } from './state_io.js';\nimport { stage } from './egress_stage.js';\nsave();\nstage();\n",
+        );
+        write(ARRIVAL, 'export function stage(): void {}\n');
+        commitAll(root, 'head');
+
+        const git = spawnSync('git', ['-C', root, 'worktree', 'add', '--detach', baseDir, base], {
+            encoding: 'utf8',
+        });
+        expect(git.status).toBe(0);
+
+        const changed = [DISPATCHER, ARRIVAL];
+        const writer = run(path.join(baseDir, 'src/scripts/ratification_subject.ts'), [
+            '--root',
+            root,
+            '--quiet',
+            '--files',
+            ...changed,
+        ]);
+        expect(writer.code).toBe(0);
+        const subject = writer.out.trim().split('\n').pop() as string;
+        expect(subject).toMatch(/^[0-9a-f]{64}$/u);
+
+        // The writer run locally, as an author would before pushing, prints
+        // the digest CI checks.
+        const localWriter = run(path.join(root, 'src/scripts/ratification_subject.ts'), [
+            '--base-ref',
+            base,
+            '--quiet',
+            '--files',
+            ...changed,
+        ]);
+        expect(localWriter.code).toBe(0);
+        expect(localWriter.out.trim().split('\n').pop()).toBe(subject);
+
+        write(
+            path.join(RATIFICATION_DIR, 'closure-arrival.md'),
+            [
+                '---',
+                'proposed_by: claude/session-a',
+                'implemented_by: claude/session-a',
+                'reviewed_by: council/anthropic+openai',
+                `subject: ${subject}`,
+                'verdict: ratified',
+                'effective_after: merge',
+                'providers:',
+                '  - anthropic',
+                '  - openai',
+                'seats:',
+                '  anthropic: ratified',
+                '  openai: ratified',
+                '---',
+                '',
+                '<!-- evidence-type: ratification -->',
+                '',
+                'Review body.',
+                '',
+            ].join('\n'),
+        );
+        commitAll(root, 'record');
+
+        const ci = run(path.join(baseDir, 'src/scripts/check_kernel_edit_ratified.ts'), [
+            '--root',
+            root,
+            '--base-ref',
+            base,
+        ]);
+        const local = run(path.join(root, 'src/scripts/check_kernel_edit_ratified.ts'), [
+            '--base-ref',
+            base,
+        ]);
+
+        expect(ci.out).toContain(`hook-plumbing source ${ARRIVAL}`);
+        expect(ci.code).toBe(0);
+        expect(gated(local.out)).toEqual(gated(ci.out));
+        expect(local.code).toBe(0);
+    }, 60_000);
+});
diff --git a/tests/scripts/ratification_subject.test.ts b/tests/scripts/ratification_subject.test.ts
index 2e8aa19c6..5e23ee55b 100644
--- a/tests/scripts/ratification_subject.test.ts
+++ b/tests/scripts/ratification_subject.test.ts
@@ -333,7 +333,9 @@ describe('the covered list and the digest come from one classification', () => {
         // `host_semantics.ts` is in the plumbing closure and matches no
         // name-based rule, so it is gated if and only if the derived list
         // reached the classifier.
-        const reading = expectedSubjectFor([DERIVED_ONLY, 'README.md'], process.cwd());
+        // An explicit base: this checkout is the gate's own tree, whose base
+        // side is read at a ref, and a shallow CI clone carries no `origin/main`.
+        const reading = expectedSubjectFor([DERIVED_ONLY, 'README.md'], process.cwd(), 'HEAD', 'HEAD');
         expect(reading.gatedFiles).toEqual([DERIVED_ONLY]);
         expect(reading.digest).toMatch(/^[0-9a-f]{64}$/);
 
```
