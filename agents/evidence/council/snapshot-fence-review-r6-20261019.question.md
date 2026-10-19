<!-- evidence-type: analysis -->

<!-- A prompt given to the council on 2026-10-19 for branch
     drain/road-to-a-canvas-the-code-owns-snapshot-fence-20261018, round 6,
     committed verbatim so the verdict recorded beside it can be checked
     against what was actually asked. Not edited after the run. -->

# Review branch drain/road-to-a-canvas-the-code-owns-snapshot-fence-20261018, round 6 — a snapshot fence in block_config_weakening

This is a ratification review under ADR-268 § 4 for a diff touching a governance hook. Please review the complete diff and the complete decision function below and return findings.

Context, from the tree:

- `src/scripts/hooks/block_config_weakening.ts` is a PreToolUse governance hook. Before this change, a call whose tool is not in `EDIT_TOOLS` returned `EXIT_ALLOW` at once; only edit-tool calls reached the path loop, where `allowlist` and `class-c` paths can block.
- Roadmap step 7.1: snapshot directories (`*-snapshots/`, `__screenshots__/`) are `advisory`; a shell call running a visual runner with `--update-snapshots` warns with the acceptance step; warn, never block.
- Round 5 (`agents/evidence/council/snapshot-fence-review-r5-20261019.question.md`): one seat `confirmed-non-expanding`; one seat `request-changes`, recommending that snapshot detection be separated from config classification so a snapshot path cannot reach any governance check. That seat saw only diff hunks, not the whole loop. What changed:
  - The old body of `classify_target` is now `classify_config`, byte-identical in logic and ending in `return null`. `classify_target(p)` is `classify_config(p) ?? (isSnapshotPath(p) ? 'advisory' : null)`, kept for the roadmap's classification contract.
  - The path loop classifies with `classify_config`. For a path where that is `null`, the loop takes the same `continue` it took before this diff; the only addition is recording a deferred warning when `isSnapshotPath(p)`. The loop body after that point is the pre-diff body unchanged (the round-4 `!isSnap` suppression is gone).
  - The flag match now also matches `--update-snapshots;` and `--update-snapshots=all`, and still not `=false`, `=none`, or `--update-snapshots-foo`.
  - Tests: a snapshot-shaped path escaping the root (`visual-snapshots/../../outside.txt`), a relative and an absolute snapshot path each return WARN (2) for `Write`; an allowlist file inside a snapshot directory over the session cap still returns BLOCK (1). Stated plainly: that escape test also passes against the round-5 head, because the round-5 loop had no check between classification and `decide()` that could block an `advisory` path; it pins the invariant, it was not seen red. The round-4 overlap test (shell name added to a copy of the edit-tool set: command-only call warns, same call with an over-cap allowlist write blocks) was seen red against the pre-round-4 code.

Measured at the head: 60 tests pass in the hook's test file; hook bundle 1,546,036 B of 1,550,000 B; subject digest `d53d9eb6bcac9d3ca50168cb564c5fcdc099ab9ed2cd3b7924f2a785b4a58984` (covers only the hook).

Questions:

1. Does any input that this hook blocked before this diff now reach WARN or ALLOW? Name the input if so.
2. Does any input that this hook allowed before this diff now block? Name the input if so.
3. Classify the change: `ratified` (authority-expanding but acceptable), `confirmed-non-expanding` (governance surface touched, no expansion of what the agent may do), or `request-changes` (with the concrete defect).

The complete `evaluate()` at the head (the whole decision after stdin is parsed):

```ts
export function evaluate(envelope: JsonObject, editTools: ReadonlySet<string> = EDIT_TOOLS): number {
    const { tool, paths, ti } = _extract(envelope);
    // Computed for every tool and emitted only where no path decision is left,
    // so a shell name that is also an edit tool still warns and never pre-empts a block.
    const cmdWarn = snapshotUpdateWarning(tool, ti?.['command']);
    if (!tool || !editTools.has(tool) || ti === null) {
        if (cmdWarn === null) return EXIT_ALLOW;
        process.stdout.write(`${JSON.stringify({ decision: 'warn', reason: cmdWarn })}\n`);
        return EXIT_WARN;
    }

    const cwd = envelope['cwd'];
    const pr = envelope['workspace_root'] ?? envelope['project_root'];
    const root = typeof cwd === 'string' && cwd ? cwd : typeof pr === 'string' && pr ? pr : '.';
    const sidRaw = envelope['session_id'] ?? envelope['sessionId'];
    const session = typeof sidRaw === 'string' && sidRaw ? sidRaw : 'default';

    let snapWarn: string | null = cmdWarn;
    for (const p of paths) {
        const kind = classify_config(p);
        if (kind === null) {
            // A snapshot-only path takes the same skip as before; it only leaves a warning behind.
            if (isSnapshotPath(p)) snapWarn = `${path.relative(root, path.isAbsolute(p) ? p : path.join(root, p)) || p}: ${SNAPSHOT_ACCEPTANCE}`;
            continue;
        }
        const abs = path.isAbsolute(p) ? p : path.join(root, p);
        let on_disk: string | null = null;
        try {
            on_disk = fs.readFileSync(abs, 'utf-8');
        } catch {
            on_disk = null;
        }
        if (kind === 'class-c') {
            const rel_c = path.relative(root, abs) || p;
            const pkg = findPackageRoot(_HERE);
            const verdict = classCVerdict(ti, on_disk, rel_c, pkg === null ? null : readClassIndex(pkg));
            if (verdict === null) continue;
            process.stderr.write(`block-config-weakening: BLOCKED — ${verdict}\n`);
            return EXIT_BLOCK;
        }

        const added = added_entries(ti, on_disk);
        if (added <= 0) {
            continue;
        }
        const rel = path.relative(root, abs) || p;
        const total = kind === 'allowlist' ? bump_session(root, session, rel, added) : added;
        const d = decide(kind, rel, total, added);
        if (d.action === 'block') {
            process.stderr.write(`block-config-weakening: BLOCKED — ${d.reason}\n`);
            return EXIT_BLOCK;
        }
        if (d.action === 'warn') {
            process.stdout.write(`${JSON.stringify({ decision: 'warn', reason: d.reason })}\n`);
            return EXIT_WARN;
        }
    }
    if (snapWarn !== null) {
        process.stdout.write(`${JSON.stringify({ decision: 'warn', reason: snapWarn })}\n`);
        return EXIT_WARN;
    }
    return EXIT_ALLOW;
}
```

The head of the unchanged `decide()`:

```ts
export function decide(kind: ConfigKind, rel_path: string, session_total: number, added: number): Decision {
    if (kind === null || added <= 0) {
        return { action: 'allow', reason: '' };
    }
    if (kind === 'advisory') {
        return {
            action: 'warn',
            reason:
                `${rel_path}: this edit loosens a gate threshold. Whether that is a ` +
                'legitimate ratchet reset or the config being bent around a failing ' +
                'check is a review decision — state which in the diff.',
        };
    }
    if (session_total > SESSION_ENTRY_CAP) {
```

Complete diff, `git diff origin/main...HEAD -- src/scripts/hooks/block_config_weakening.ts`:

```diff
diff --git a/src/scripts/hooks/block_config_weakening.ts b/src/scripts/hooks/block_config_weakening.ts
index 32ea4e8c9..ace35f8d0 100644
--- a/src/scripts/hooks/block_config_weakening.ts
+++ b/src/scripts/hooks/block_config_weakening.ts
@@ -137,8 +137,33 @@ const CLASS_C_BASENAMES: readonly string[] = ['.agent-settings.yml', '.agent-set
 /** Where the class contract lives, relative to the package root. */
 export const SETTINGS_CLASSES_RELATIVE = 'docs/contracts/settings-classes.md';
 
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
+    if (!/--update-snapshots(?!=(false|none)\b)(?==\S|[\s;&|)]|$)/.test(command) || !/\b(playwright|test-storybook)\b/.test(command)) return null;
+    return SNAPSHOT_ACCEPTANCE;
+}
+
 /** Classify a target path into a config surface, or null for everything else. */
 export function classify_target(p: string): ConfigKind {
+    // Last, so a blocking class is never downgraded by its directory.
+    return classify_config(p) ?? (isSnapshotPath(p) ? 'advisory' : null);
+}
+
+export function isSnapshotPath(p: string): boolean {
+    return SNAPSHOT_DIR.test(p.split(path.sep).join('/'));
+}
+
+/** The governance classes only — what the hook may block or warn on. A snapshot path is not one. */
+function classify_config(p: string): ConfigKind {
     const posix = p.split(path.sep).join('/');
     const base = posix.split('/').pop() ?? '';
     if (/_allowlist\.(json|txt)$/.test(base) || /^allowlist[-_.]/.test(base)) {
@@ -592,10 +617,19 @@ export function main(): number {
     if (!_isObject(envelope)) {
         return EXIT_ALLOW;
     }
+    return evaluate(envelope);
+}
 
+/** The decision for one envelope; `editTools` is a parameter only so a test can make a shell name overlap it. */
+export function evaluate(envelope: JsonObject, editTools: ReadonlySet<string> = EDIT_TOOLS): number {
     const { tool, paths, ti } = _extract(envelope);
-    if (!tool || !EDIT_TOOLS.has(tool) || ti === null) {
-        return EXIT_ALLOW;
+    // Computed for every tool and emitted only where no path decision is left,
+    // so a shell name that is also an edit tool still warns and never pre-empts a block.
+    const cmdWarn = snapshotUpdateWarning(tool, ti?.['command']);
+    if (!tool || !editTools.has(tool) || ti === null) {
+        if (cmdWarn === null) return EXIT_ALLOW;
+        process.stdout.write(`${JSON.stringify({ decision: 'warn', reason: cmdWarn })}\n`);
+        return EXIT_WARN;
     }
 
     const cwd = envelope['cwd'];
@@ -604,9 +638,12 @@ export function main(): number {
     const sidRaw = envelope['session_id'] ?? envelope['sessionId'];
     const session = typeof sidRaw === 'string' && sidRaw ? sidRaw : 'default';
 
+    let snapWarn: string | null = cmdWarn;
     for (const p of paths) {
-        const kind = classify_target(p);
+        const kind = classify_config(p);
         if (kind === null) {
+            // A snapshot-only path takes the same skip as before; it only leaves a warning behind.
+            if (isSnapshotPath(p)) snapWarn = `${path.relative(root, path.isAbsolute(p) ? p : path.join(root, p)) || p}: ${SNAPSHOT_ACCEPTANCE}`;
             continue;
         }
         const abs = path.isAbsolute(p) ? p : path.join(root, p);
@@ -641,6 +678,10 @@ export function main(): number {
             return EXIT_WARN;
         }
     }
+    if (snapWarn !== null) {
+        process.stdout.write(`${JSON.stringify({ decision: 'warn', reason: snapWarn })}\n`);
+        return EXIT_WARN;
+    }
     return EXIT_ALLOW;
 }
 
```
