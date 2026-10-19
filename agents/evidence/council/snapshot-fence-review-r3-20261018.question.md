<!-- evidence-type: analysis -->

<!-- A prompt given to the council on 2026-10-18 for branch
     drain/road-to-a-canvas-the-code-owns-snapshot-fence-20261018, round 3,
     committed verbatim so the verdict recorded beside it can be checked
     against what was actually asked. Not edited after the run. -->

# Review branch drain/road-to-a-canvas-the-code-owns-snapshot-fence-20261018, round 3 — a snapshot fence in block_config_weakening

Context, from the tree:

- `src/scripts/hooks/block_config_weakening.ts` is a PreToolUse governance hook. Before this change, a call whose tool is not in `EDIT_TOOLS` (imported from `src/scripts/minimal_safe_diff_hook.ts`: `str-replace-editor`, `str_replace_editor`, `save-file`, `save_file`, `remove-files`, `remove_files`, `Edit`, `Write`, `MultiEdit`, `edit_file`, `edit-file`, `create_file`, and similar edit names) returned `EXIT_ALLOW` at once; only edit-tool calls reached the path loop where `allowlist` and `class-c` paths block. Shell tools (`Bash` and friends) never reached the path loop.
- Roadmap step 7.1: snapshot directories are `advisory`; a shell call running a visual runner with `--update-snapshots` warns with the acceptance step; warn, never block.
- Round 1 (`agents/evidence/council/snapshot-fence-review-20261018.question.md`) found two downgrades, both fixed in round 2: snapshot classification now runs last in `classify_target`, and a snapshot write warns only after every path in the envelope is judged.
- Round 2 (`agents/evidence/council/snapshot-fence-review-r2-20261018.question.md`), both seats REQUEST_CHANGES. `anthropic` read the early shell check as a BLOCK-to-WARN bypass of class-C paths. `openai` disagreed: shell tools never entered the path loop, so the case was ALLOW to WARN, and became unsafe only if a shell name ever overlapped `EDIT_TOOLS`; it asked that the code stop depending on that disjointness, for a test pinning it, and noted `--update-snapshots=false` matched.

What changed in response (head `0e5f147db`):

- the shell warning moved INSIDE the branch that returns `EXIT_ALLOW` for non-edit tools, and is additionally skipped for any tool in `EDIT_TOOLS`; the only transition it can produce is ALLOW to WARN, and it can never run where a path decision would;
- a test asserts every shell alias (`Bash`, `bash`, `BashTool`, `shell`, `launch-process`, `launch_process`) is absent from `EDIT_TOOLS` and warns, and every `EDIT_TOOLS` name gets null;
- the flag match is `--update-snapshots(?=\s|$)`, so `--update-snapshots=false` does not warn.

Measured at the head: 58 tests pass in the hook's test file; bundle 1,548,609 B of 1,550,000 B. Subject digest `8682f6a726dd1f6cdd8760531779b7933b82722c144b593b43712c5d01aa64da`, covering only the hook. The relevant hunks of `git diff drain/road-to-a-canvas-the-code-owns-20261018...0e5f147db -- src/scripts/hooks/block_config_weakening.ts`:

```diff
+/** Visual baselines: accepted by a human, never by the run that produced them. */
+const SNAPSHOT_DIR = /(^|\/)([^/]+-snapshots|__screenshots__)\//;
+
+const SNAPSHOT_ACCEPTANCE =
+    'baseline update: show the image diff to the user and land the new baselines in a commit of its own, on the pinned renderer.';
+/** Shell tools only: an edit payload carrying a `command` field must never pre-empt a path decision. */
+const SHELL_TOOL = /^(bash|bashtool|shell|launch[-_]process)$/i;
+
+/** A visual-runner baseline update, answered with the acceptance step. Warn only. */
+export function snapshotUpdateWarning(tool: string, command: unknown): string | null {
+    if (!SHELL_TOOL.test(tool) || typeof command !== 'string') return null;
+    if (!/--update-snapshots(?=\s|$)/.test(command) || !/\b(playwright|test-storybook)\b/.test(command)) return null;
+    return SNAPSHOT_ACCEPTANCE;
+}
@@ classify_target
     if (CLASS_C_BASENAMES.includes(base)) {
         return 'class-c';
     }
-    return null;
+    // Last, so a blocking class above is never downgraded by its directory.
+    return SNAPSHOT_DIR.test(posix) ? 'advisory' : null;
 }
@@ main
     const { tool, paths, ti } = _extract(envelope);
     if (!tool || !EDIT_TOOLS.has(tool) || ti === null) {
-        return EXIT_ALLOW;
+        // Reached only by a call that was ALLOW before this branch existed, so the
+        // shell warning can never stand in for a path decision.
+        const snap = EDIT_TOOLS.has(tool) ? null : snapshotUpdateWarning(tool, ti?.['command']);
+        if (snap === null) return EXIT_ALLOW;
+        process.stdout.write(`${JSON.stringify({ decision: 'warn', reason: snap })}\n`);
+        return EXIT_WARN;
     }
@@ path loop
+    let snapWarn: string | null = null;
     for (const p of paths) {
         const kind = classify_target(p);
 ...
             return EXIT_BLOCK;   // class-c, unchanged
         }
 
+        if (kind === 'advisory' && SNAPSHOT_DIR.test(p.split(path.sep).join('/'))) {
+            snapWarn = `${path.relative(root, abs) || p}: ${SNAPSHOT_ACCEPTANCE}`;
+            continue;
+        }
         const added = added_entries(ti, on_disk);
 ...
     }
+    if (snapWarn !== null) {
+        process.stdout.write(`${JSON.stringify({ decision: 'warn', reason: snapWarn })}\n`);
+        return EXIT_WARN;
+    }
     return EXIT_ALLOW;
```

Review it. For each defect report file:line, the failure scenario and a severity. Questions a review should answer include: whether any call that blocked before can now warn or pass; whether any call that was allowed can now block; whether the round-2 findings are resolved; and whether the change is authority-expanding or non-expanding. State your stance (APPROVE or REQUEST_CHANGES), your classification, and the single highest-leverage change.
