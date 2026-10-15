<!-- evidence-type: analysis -->

<!-- A prompt given to the council on 2026-10-15 for branch fix/kernel-edit-closure-arrivals,
     committed verbatim so the verdict recorded beside it can be checked against
     what was actually asked. Not edited after the run. -->

# Review branch fix/kernel-edit-closure-arrivals — round 3

Round 2 reviewed `c240e47f2..d6f436404` (prompt: `agents/evidence/council/kernel-edit-closure-arrivals-review-r2-20261015.question.md`). Both seats returned REQUEST_CHANGES on one blocker: that `derivedFor`'s normal path dropped a `LITERAL_PLUMBING` set which `derivedPlumbing()` was said to contribute, so a name-matched plumbing file such as `src/scripts/hooks/hook_dispatcher.ts` would go ungated.

The round-2 prompt did not show the body of `derivedPlumbing` or of the name-matching classifier; that omission was not named, and is corrected here. The tree at `e31314353`, verbatim:

`src/scripts/check_kernel_edit_ratified.ts:246-253` — `derivedPlumbing` returns closure verdict modules only:

```ts
let _repoDerived: readonly string[] | null = null;
export function derivedPlumbing(root: string = REPO): readonly string[] {
    if (root === REPO) {
        _repoDerived ??= verdictModules(REPO);
        return _repoDerived;
    }
    return verdictModules(root);
}
```

`src/scripts/_lib/dispatch_import_closure.ts:189-194`:

```ts
/** The verdict-deciding modules of the closure — the part the gate watches. */
export function verdictModules(root: string): string[] {
    return dispatchImportClosure(root)
        .filter((e) => e.class === 'verdict')
        .map((e) => e.path);
}
```

Name-matched plumbing is decided in `classifyPaths`, independently of the derived list (`check_kernel_edit_ratified.ts:224-225` and `:358-360`, unchanged by this branch):

```ts
const PLUMBING_SOURCE_RE =
    /^(?:src\/scripts\/hook_manifest\.(?:yaml|json)|src\/scripts\/hooks\/host_lowering\.(?:yaml|json)|src\/scripts\/hooks\/dispatch_hook\.ts|src\/scripts\/_lib\/kernel_rules\.ts|src\/scripts\/hooks\/[a-z0-9-]+-dispatcher\.sh|src\/config\/hook-(?:token|latency|bundle)-budget\.json)$/;
// …
        if (PLUMBING_SOURCE_RE.test(p) || derivedSet.has(p)) {
            plumbing.push(p);
        }
```

A search of `src/` for `LITERAL_PLUMBING` returns no match, and `src/scripts/hooks/hook_dispatcher.ts` does not exist. So the blocker as stated describes code that is not in the tree. Judge that claim against the code above.

Independently of whether the claim holds, both seats asked for a regression test, and this delta adds it: a fixture change touching only `src/config/hook-bundle-budget.json` (a name-matched plumbing file outside any closure) must be reported as `hook-plumbing source` and refused without a record, by the CI-shaped run (base-revision copy, `--root <head> --base-ref <base>`) and by the local run alike; the fixture's `dispatch_hook.ts` change is asserted gated in the same runs. Both seats also asked for a direct test of the invalid-`--rev` refusal over an ungated change; added. The redundant second `resolveRevision` inside `derivedFor` that one seat noted is removed: it now takes the already-resolved head commit.

Omitted, named: everything outside this delta, shown in rounds 1 and 2 and unchanged since. Gated files of the whole branch under both the base and the head gate: `src/scripts/_lib/dispatch_import_closure.ts`, `src/scripts/check_kernel_edit_ratified.ts`.

For each defect report file:line, the failure scenario and a severity. State your stance (APPROVE or REQUEST_CHANGES) on the branch as a whole and the single highest-leverage change.

```diff
diff --git a/src/scripts/check_kernel_edit_ratified.ts b/src/scripts/check_kernel_edit_ratified.ts
index f22c1f89a..3c4f22f72 100644
--- a/src/scripts/check_kernel_edit_ratified.ts
+++ b/src/scripts/check_kernel_edit_ratified.ts
@@ -427,14 +427,17 @@ function resolveBaseRef(explicit: string | null, root: string): string {
  * compares against this script's checkout. A run that builds its own diff
  * always passes the base it diffed against.
  *
- * THROWS a {@link GatedSubjectRefusal} when either commit does not resolve.
+ * `headCommit` is already a commit id; the base ref is resolved here.
+ *
+ * THROWS a {@link GatedSubjectRefusal} when the base does not resolve or the
+ * object store cannot be read.
  */
-function derivedFor(root: string, baseRef: string | null, revision: string): readonly string[] {
+function derivedFor(root: string, baseRef: string | null, headCommit: string): readonly string[] {
     const verdictsOf = (tree: ClosureTree): string[] =>
         dispatchImportClosure(tree)
             .filter((e) => e.class === 'verdict')
             .map((e) => e.path);
-    const head = treeAtRevision(root, resolveRevision(root, revision));
+    const head = treeAtRevision(root, headCommit);
     if (baseRef === null && path.resolve(root) !== REPO) {
         return [...new Set([...derivedPlumbing(), ...verdictsOf(head), ...closureArrivals(head)])];
     }
diff --git a/tests/scripts/check_kernel_edit_ratified_local_base.test.ts b/tests/scripts/check_kernel_edit_ratified_local_base.test.ts
index 9776ab825..7cbb1a902 100644
--- a/tests/scripts/check_kernel_edit_ratified_local_base.test.ts
+++ b/tests/scripts/check_kernel_edit_ratified_local_base.test.ts
@@ -212,6 +212,49 @@ describe('a module joining the dispatcher closure', () => {
         expect(local.code).toBe(1);
     }, 60_000);
 
+    it('a plumbing file matched by name, outside any closure, is gated in both shapes', () => {
+        const base = buildChange();
+        const budget = 'src/config/hook-bundle-budget.json';
+        write(budget, '{ "ceiling": 1 }\n');
+        commitAll(root, 'budget');
+        git(['worktree', 'add', '--detach', baseDir, base]);
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
+        for (const r of [ci, local]) {
+            expect(r.out).toContain(`hook-plumbing source ${budget}`);
+            expect(r.out).toContain(`hook-plumbing source ${DISPATCHER}`);
+            expect(r.code).toBe(1);
+        }
+    }, 60_000);
+
+    it('an invalid --rev refuses even when no changed path is gated', () => {
+        buildChange();
+        const gate = run(path.join(root, 'src/scripts/check_kernel_edit_ratified.ts'), [
+            '--rev',
+            'no-such-revision',
+            '--files',
+            'README.md',
+        ]);
+        const writer = run(path.join(root, 'src/scripts/ratification_subject.ts'), [
+            '--rev',
+            'no-such-revision',
+            '--files',
+            'README.md',
+        ]);
+        expect(gate.out).toContain('no-such-revision');
+        expect(gate.code).toBe(1);
+        expect(writer.code).toBe(1);
+    }, 60_000);
+
     it('a judging copy checked out at another commit still compares against --base-ref', () => {
         const base = buildChange();
         // The judging script's own tree is the HEAD, which already contains the
```
