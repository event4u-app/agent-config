<!-- evidence-type: analysis -->

<!-- A prompt given to the council on 2026-10-19 for branch
     test/snapshot-fence-regex-negatives-20261019, committed verbatim so the
     verdict recorded beside it can be checked against what was asked.
     Not edited after the run. -->

# Review branch test/snapshot-fence-regex-negatives-20261019 — the snapshot command warning reads shell words

This is a ratification review under ADR-268 § 4 for a diff touching a governance hook. Please review the complete diff below and return findings.

Context, from the tree:

- `src/scripts/hooks/block_config_weakening.ts` is a PreToolUse governance hook. Its snapshot fence (roadmap `road-to-a-canvas-the-code-owns` step 7.1, ratified `confirmed-non-expanding` 2/2 on 2026-10-19 in `agents/evidence/ratifications/canvas-snapshot-fence-20261019.md`) warns — never blocks — when a shell tool runs a visual runner with a baseline update.
- That ratification left one residue: the command check was a lexical regex (`--update-snapshots` plus the word `playwright` or `test-storybook` anywhere in the string). Measured on the merged code: `echo playwright --update-snapshots`, `# npx playwright test --update-snapshots` and `npx jest --update-snapshots playwright` warned although no visual runner updates anything; `npx playwright test "--update-snapshots"` (quotes removed by the shell, so a real update) did not warn.
- This diff changes only `snapshotUpdateWarning` and adds two helpers. It now splits the command into simple commands (`shellSegments`: quotes and backslash escapes removed, `#` comments dropped, `;` `&` `|` `(` `)` and newline as separators, no expansion), and warns when a segment — after leading `VAR=value` assignments, an optional launcher (`npx`/`bunx`/`pnpx`, or `npm`/`pnpm`/`yarn`/`bun` followed by `exec`/`dlx`/`x`) and its options — starts `playwright` or `test-storybook` (basename, so `./node_modules/.bin/playwright` counts) with an argument `-u`, `--update-snapshots`, or `--update-snapshots=<mode>` other than `false`/`none`.
- How the result is used, unchanged by this diff: `evaluate()` computes it once as `cmdWarn` for every tool. If the tool is not an edit tool (or has no tool input), a non-null `cmdWarn` returns WARN, else ALLOW. For an edit tool, `cmdWarn` is only the initial value of a deferred warning emitted after every path decision, so any path BLOCK returns first. The head of `evaluate()`:

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
```

Tests: 62 pass in the hook's test file, including two new tables — 13 commands that must not warn (quoted mentions in `echo`/`git commit -m`/`grep`, `playwrightx`, `--update-snapshots-dir`, `=none`, `=false`, unquoted `echo`, a comment line, a trailing comment, `npx jest … playwright`, `cat … -u`) and 13 that must (`=changed`, `=missing`, a separate `false` argument, chained with `&&` or `|`, `test-storybook`, the quoted flag, `-u`, `CI=1 pnpm exec`, `npx --yes`, a `.bin` path, after `;`, a backslash-newline continuation). Hook bundle 1,548,859 B of 1,550,000 B. Subject digest `9e600fb1890d1b6c779e1831efb3f5824462de870a99bab4cbe3d98362d0a131` (covers only the hook).

Questions:

1. Does any input that this hook blocked before this diff now reach WARN or ALLOW? Name the input if so.
2. Does any input that this hook allowed before this diff now block? Name the input if so.
3. Is there a command that runs a Playwright or test-storybook baseline update and does not warn, or a command that does not and warns? Name it.
4. Classify the change: `ratified` (authority-expanding but acceptable), `confirmed-non-expanding` (governance surface touched, no expansion of what the agent may do), or `request-changes` (with the concrete defect).

Complete diff, `git diff origin/main...HEAD -- src/scripts/hooks/block_config_weakening.ts`:

```diff
diff --git a/src/scripts/hooks/block_config_weakening.ts b/src/scripts/hooks/block_config_weakening.ts
index ace35f8d0..70e60fe27 100644
--- a/src/scripts/hooks/block_config_weakening.ts
+++ b/src/scripts/hooks/block_config_weakening.ts
@@ -148,8 +148,66 @@ const SHELL_TOOL = /^(bash|bashtool|shell|launch[-_]process)$/i;
 /** A visual-runner baseline update, answered with the acceptance step. Warn only. */
 export function snapshotUpdateWarning(tool: string, command: unknown): string | null {
     if (!SHELL_TOOL.test(tool) || typeof command !== 'string') return null;
-    if (!/--update-snapshots(?!=(false|none)\b)(?==\S|[\s;&|)]|$)/.test(command) || !/\b(playwright|test-storybook)\b/.test(command)) return null;
-    return SNAPSHOT_ACCEPTANCE;
+    return shellSegments(command).some(runsSnapshotUpdate) ? SNAPSHOT_ACCEPTANCE : null;
+}
+
+const VISUAL_RUNNERS = new Set(['playwright', 'test-storybook']);
+const LAUNCHERS = new Set(['npx', 'bunx', 'pnpx']);
+const PACKAGE_MANAGERS = new Set(['npm', 'pnpm', 'yarn', 'bun']);
+
+/** True when the segment starts a visual runner whose own arguments enable a baseline update. */
+function runsSnapshotUpdate(words: string[]): boolean {
+    let i = 0;
+    while (i < words.length && /^[A-Za-z_][A-Za-z0-9_]*=/.test(words[i] ?? '')) i++;
+    if (LAUNCHERS.has(words[i] ?? '')) i++;
+    else if (PACKAGE_MANAGERS.has(words[i] ?? '') && ['exec', 'dlx', 'x'].includes(words[i + 1] ?? '')) i += 2;
+    while ((words[i] ?? '').startsWith('-')) i++;
+    if (!VISUAL_RUNNERS.has((words[i] ?? '').split('/').pop() ?? '')) return false;
+    return words.slice(i + 1).some((w) => w === '-u' || /^--update-snapshots(=(?!(false|none)$).+)?$/.test(w));
+}
+
+/**
+ * Split a shell command into the words of each simple command, with quotes
+ * removed, comments dropped, and `;` `&` `|` `(` `)` and newlines as separators.
+ * Lexical only — no expansion — which is enough to tell running a runner from naming one.
+ */
+export function shellSegments(command: string): string[][] {
+    const segments: string[][] = [];
+    let words: string[] = [];
+    let word: string | null = null;
+    let quote: '"' | "'" | null = null;
+    const endWord = (): void => {
+        if (word !== null) words.push(word);
+        word = null;
+    };
+    const endSegment = (): void => {
+        endWord();
+        if (words.length > 0) segments.push(words);
+        words = [];
+    };
+    for (let i = 0; i < command.length; i++) {
+        const c = command[i] ?? '';
+        if (quote !== null) {
+            if (c === quote) quote = null;
+            else if (c === '\\' && quote === '"' && i + 1 < command.length) word += command[++i] ?? '';
+            else word += c;
+        } else if (c === '"' || c === "'") {
+            quote = c;
+            word ??= '';
+        } else if (c === '\\' && i + 1 < command.length) {
+            word = (word ?? '') + (command[++i] ?? '');
+        } else if (c === '#' && word === null) {
+            while (i + 1 < command.length && command[i + 1] !== '\n') i++;
+        } else if (/[;&|()\n]/.test(c)) {
+            endSegment();
+        } else if (/\s/.test(c)) {
+            endWord();
+        } else {
+            word = (word ?? '') + c;
+        }
+    }
+    endSegment();
+    return segments;
 }
 
 /** Classify a target path into a config surface, or null for everything else. */
```
