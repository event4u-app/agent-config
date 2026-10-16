<!-- evidence-type: analysis -->

<!-- A prompt given to the council on 2026-10-16 for branch fix/gate-the-subject-calculator-stage-2-20261016,
     round 3, committed verbatim so the verdict recorded beside it can be checked
     against what was actually asked. Not edited after the run. -->

# Review branch fix/gate-the-subject-calculator-stage-2-20261016, round 3 — delta after round 2

Round 2 (prompt `agents/evidence/council/gate-the-subject-calculator-stage-2-review-r2-20261016.question.md`, reviewed `638c06dc5`): anthropic APPROVE; openai REQUEST_CHANGES — a caller-supplied `--files` list that omits `_lib/ratification_subject.ts` still removes it from the verdict, so the omission the pin used to prevent remains representable; requested: derive the gated set from `baseRef..headCommit` independently of `--files`, with a regression where `--files` deliberately omits the module.

Disposition (`72ec820a2`): in `main()`, when `--files` is given and the range resolves, the gate judges the UNION of the list and `changedFilesBetween(base, head)`; the list can add paths, never hide one. A range that does not resolve (a fixture repository with no base) leaves the list as given, as before. The revision and base resolved for the union are the ones handed on to `evaluate`, so the diff, the digest and the record read one head and one base. The regression test now also runs `main(['--root', root, '--base-ref', base, '--quiet', '--files', 'README.md'])` over a range whose only change is the calculator and expects 1. Sensitivity: replacing the union with the list alone turns that test red; restored, the three gate suites pass (43 tests, `check_kernel_edit_ratified`, `…_mechanism_closure`, `…_local_base`); `tsc --noEmit` passes.

Note on the digest: production callers run without `--files` (CI's base-revision step and the bootstrap step in `.github/workflows/consistency.yml`), so they are unchanged. A caller that passes a partial list now gets a verdict over the union, which is the point; the writer CLI `ratification_subject` is outside the gated set by owner decision and is not changed here.

```diff
     let changed: string[];
     if (files.length > 0) {
+        // A caller's list may add paths, never hide one: where the range resolves,
+        // every path it changed is judged as well, so omitting a gated file from
+        // `--files` does not take it out of the verdict. A range that does not
+        // resolve (a fixture with no base) leaves the list as given.
         changed = files;
+        try {
+            const commit = resolveRevision(root, revision);
+            const base = resolveRevision(root, resolveBaseRef(baseRef, root));
+            changed = [...new Set([...files, ...changedFilesBetween(root, base, commit)])];
+            revision = commit;
+            baseRef = base;
+        } catch (err) {
+            if (!(err instanceof GatedSubjectRefusal)) {
+                throw err;
+            }
+        }
     } else {
```

```diff
         expect(gate.main(['--root', root, '--base-ref', base, '--quiet'])).toBe(1);
+        // A list that leaves the calculator out cannot hide it either.
+        expect(gate.main(['--root', root, '--base-ref', base, '--quiet', '--files', 'README.md'])).toBe(1);
```

Review the delta. For each remaining defect report file:line, the failure scenario and a severity. State your stance (APPROVE or REQUEST_CHANGES) and the single highest-leverage change.
