<!-- evidence-type: analysis -->

<!-- A prompt given to the council on 2026-10-16 for branch fix/gate-the-subject-calculator-stage-2-20261016,
     round 2, committed verbatim so the verdict recorded beside it can be checked
     against what was actually asked. Not edited after the run. -->

# Review branch fix/gate-the-subject-calculator-stage-2-20261016, round 2 — delta after round 1

Round 1 (prompt `agents/evidence/council/gate-the-subject-calculator-stage-2-review-20261016.question.md`, reviewed `5dd7b6e6e`): both seats REQUEST_CHANGES on one finding.

Finding (both, HIGH): the pin bound `_lib/ratification_subject.ts` whatever file list a caller passed to `evaluate(files, …)`; once gated, the module is bound through the classification of `files`, so a caller that omits the path would skip it. Requested: show that every production caller derives the change set from `baseRef..headCommit` itself, with a caller-level regression test that an omitted edit of the module is refused.

Disposition — evidence from the tree, then the change:

- `main()` in `src/scripts/check_kernel_edit_ratified.ts` builds the change set itself whenever no `--files` is given: it resolves the head revision once, resolves the base once, and calls `changedFilesBetween(root, baseRef, commit)`; `--files` is the only way a caller supplies a list.
- Production callers, from the tree: `.github/workflows/consistency.yml` runs the BASE revision's copy as `npx tsx "$BASE_DIR/$GATE" --root "$PWD" --base-ref "$BASE_SHA"` and, in the bootstrap branch, `./scripts-run src/scripts/check_kernel_edit_ratified --base-ref "$BASE_SHA"`. A search of `src/`, `Taskfile.yml` and `.github/` finds no invocation of the gate with `--files`.
- This is the same binding every other mechanism file has (`_lib/adr_frontmatter.ts`, `_lib/gate_ledger.ts`, `_lib/scan_scope.ts`, the reader, the gate itself): the module is now bound exactly as strongly as the rest of the gate's closure, no more weakly.
- New test (`638c06dc5`), in `tests/scripts/check_kernel_edit_ratified_mechanism_closure.test.ts`: a fixture repository with a base commit, then a commit whose only change is `src/scripts/_lib/ratification_subject.ts`; `gate.main(['--root', root, '--base-ref', base, '--quiet'])` — no `--files` — returns 1. Sensitivity: removing the module from `MECHANISM_IMPORT_PATHS` turns this test red; restored, the two gate suites pass (37 tests).

```diff
+    // The pin bound the calculator whatever file list a caller passed. Gated, it is
+    // bound through the file list instead, so the entry point CI and pre-push call
+    // must derive that list from the commits itself and never from the caller.
+    it('the CLI derives the diff itself, so an edit of the calculator no caller names is refused', () => {
+        const rel = 'src/scripts/_lib/ratification_subject.ts';
+        fs.writeFileSync(path.join(root, 'README.md'), 'x\n');
+        const base = commitAll(root);
+        fs.mkdirSync(path.join(root, path.dirname(rel)), { recursive: true });
+        fs.writeFileSync(path.join(root, rel), 'export const x = 1;\n');
+        commitAll(root);
+        expect(gate.main(['--root', root, '--base-ref', base, '--quiet'])).toBe(1);
+    });
```

Not changed: `evaluate(files, …)` stays an exported function taking a list, as it is for every other gated file; making the library function derive its own list would change its contract for all of them and is outside this change.

Review the delta and the evidence. For each remaining defect report file:line, the failure scenario and a severity. State your stance (APPROVE or REQUEST_CHANGES) and the single highest-leverage change.
