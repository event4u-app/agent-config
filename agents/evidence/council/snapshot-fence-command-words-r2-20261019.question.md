<!-- evidence-type: analysis -->

<!-- A prompt given to the council on 2026-10-19 for branch
     test/snapshot-fence-regex-negatives-20261019, round 2, committed verbatim
     so the verdict recorded beside it can be checked against what was asked.
     Not edited after the run. -->

# Review branch test/snapshot-fence-regex-negatives-20261019, round 2 — the snapshot command warning reads shell words

This is a ratification review under ADR-268 § 4 for a diff touching a governance hook. Please review the complete diff below, which this time includes the test file, and return findings.

Context, from the tree:

- `src/scripts/hooks/block_config_weakening.ts` is a PreToolUse governance hook. Its snapshot fence (ratified `confirmed-non-expanding` 2/2 on 2026-10-19, `agents/evidence/ratifications/canvas-snapshot-fence-20261019.md`) warns — never blocks — when a shell tool runs a visual runner with a baseline update. `evaluate()` computes `snapshotUpdateWarning` once as `cmdWarn`: for a non-edit tool a non-null value returns WARN and null returns ALLOW; for an edit tool it is only the initial value of a deferred warning emitted after every path decision, so any path BLOCK returns first. This diff does not touch `evaluate()`.
- Round 1 (`agents/evidence/council/snapshot-fence-command-words-20261019.question.md`): one seat `confirmed-non-expanding`; one seat `request-changes`: `env CI=1 npx playwright test --update-snapshots`, `sh -c '…'` and `npx --package @playwright/test playwright test -u` did not warn, and `npx playwright test -u --list` warned although it only lists. It also noted the test file was missing from the prompt.
- What changed: `env` and its options and assignments are skipped; `sh`/`bash`/`zsh`/`dash` with a `-…c…` option has the following word read recursively as a command; `-p`, `--package`, `--filter`, `-F`, `-C`, `--dir`, `--cwd` consume their value; options between a package manager and `exec`/`dlx`/`x` are skipped; an argument list containing `--list` does not warn. All four round-1 commands are now in the test tables.
- Stated plainly: the word reader is a deliberate approximation (no variable expansion, no reserved words, a fixed option-arity list). Forms outside it — for example a runner reached through an npm script (`npm run test:visual -- -u`) — did not warn under the old regex either unless the string happened to contain the runner name.

Measured at the head: 62 tests pass in the hook's test file; hook bundle 1,549,348 B of 1,550,000 B; subject digest `c69de49066621c1880046910869941a0852e9dcbaba944cee4fcf9a17ecd97b2` (covers only the hook).

Questions:

1. Does any input that this hook blocked before this diff now reach WARN or ALLOW? Name the input if so.
2. Does any input that this hook allowed before this diff now block? Name the input if so.
3. Is there a common command that runs a Playwright or test-storybook baseline update and does not warn, or one that does not and warns? Name it.
4. Classify the change: `ratified` (authority-expanding but acceptable), `confirmed-non-expanding` (governance surface touched, no expansion of what the agent may do), or `request-changes` (with the concrete defect).

Complete diff, `git diff origin/main...HEAD -- src/scripts/hooks/block_config_weakening.ts tests/scripts/hooks/block_config_weakening.test.ts`:

```diff
diff --git a/src/scripts/hooks/block_config_weakening.ts b/src/scripts/hooks/block_config_weakening.ts
index ace35f8d0..8654aff82 100644
--- a/src/scripts/hooks/block_config_weakening.ts
+++ b/src/scripts/hooks/block_config_weakening.ts
@@ -148,8 +148,86 @@ const SHELL_TOOL = /^(bash|bashtool|shell|launch[-_]process)$/i;
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
+/** Launcher options whose value is the next word. */
+const VALUE_OPTIONS = new Set(['-p', '--package', '--filter', '-F', '-C', '--dir', '--cwd']);
+
+/** True when the segment starts a visual runner whose own arguments enable a baseline update. */
+function runsSnapshotUpdate(words: string[]): boolean {
+    const at = (k: number): string => words[k] ?? '';
+    let i = 0;
+    const skipOptions = (): void => {
+        while (at(i).startsWith('-') || /^[A-Za-z_]\w*=/.test(at(i))) i += VALUE_OPTIONS.has(at(i)) ? 2 : 1;
+    };
+    skipOptions();
+    if (at(i) === 'env') {
+        i++;
+        skipOptions();
+    }
+    if (/^(ba|z|da)?sh$/.test(at(i))) {
+        const c = words.findIndex((w, k) => k > i && /^-\w*c\w*$/.test(w));
+        return c > 0 && shellSegments(at(c + 1)).some(runsSnapshotUpdate);
+    }
+    if (LAUNCHERS.has(at(i))) i++;
+    else if (PACKAGE_MANAGERS.has(at(i))) {
+        i++;
+        skipOptions();
+        if (!['exec', 'dlx', 'x'].includes(at(i))) return false;
+        i++;
+    }
+    skipOptions();
+    if (!VISUAL_RUNNERS.has(at(i).split('/').pop() ?? '')) return false;
+    const args = words.slice(i + 1);
+    return !args.includes('--list') && args.some((w) => w === '-u' || /^--update-snapshots(=(?!(false|none)$).+)?$/.test(w));
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
diff --git a/tests/scripts/hooks/block_config_weakening.test.ts b/tests/scripts/hooks/block_config_weakening.test.ts
index 2b8888acd..f9cb45a96 100644
--- a/tests/scripts/hooks/block_config_weakening.test.ts
+++ b/tests/scripts/hooks/block_config_weakening.test.ts
@@ -646,6 +646,58 @@ describe('block_config_weakening — snapshot surfaces', () => {
         expect(snapshotUpdateWarning('Bash', 'npx playwright test --update-snapshots-foo')).toBeNull();
     });
 
+    // Council round 6 (2026-10-19) residue: the flag match is lexical, so pin the
+    // shapes that only mention the flag or the runner without running an update.
+    it('snapshot: a command that only mentions the flag or the runner does not warn', () => {
+        for (const cmd of [
+            'echo "playwright --update-snapshots"',
+            "echo 'npx playwright test --update-snapshots'",
+            'git commit -m "playwright --update-snapshots"',
+            'grep -r "--update-snapshots" playwright.config.ts',
+            'npx playwrightx test --update-snapshots',
+            'npx playwright test --update-snapshots-dir out',
+            'npx test-storybook --update-snapshots=none',
+            'npx playwright test --update-snapshots=false --headed',
+            'echo playwright --update-snapshots',
+            '# npx playwright test --update-snapshots',
+            'npx jest --update-snapshots playwright',
+            'npx playwright test # --update-snapshots',
+            'cat playwright.config.ts -u',
+            'npx playwright test -u --list',
+            "sh -c 'echo playwright --update-snapshots'",
+            'env npx jest -u',
+        ]) {
+            expect(snapshotUpdateWarning('Bash', cmd), cmd).toBeNull();
+        }
+    });
+
+    it('snapshot: every enabled update mode and a chained runner still warn', () => {
+        for (const cmd of [
+            'npx playwright test --update-snapshots=changed',
+            'npx playwright test --update-snapshots=missing',
+            'npx playwright test --update-snapshots false',
+            'npx playwright test --update-snapshots && git add .',
+            'npx playwright test --update-snapshots|tee log',
+            'npx test-storybook --update-snapshots',
+            'npx playwright test "--update-snapshots"',
+            'npx playwright test -u',
+            'CI=1 pnpm exec playwright test --update-snapshots',
+            'npx --yes playwright test --update-snapshots',
+            './node_modules/.bin/playwright test --update-snapshots',
+            'git stash; npx playwright test --update-snapshots',
+            'npx playwright test \\\n  --update-snapshots',
+            'env CI=1 npx playwright test --update-snapshots',
+            'env -i PATH=/usr/bin npx playwright test -u',
+            "sh -c 'npx playwright test --update-snapshots'",
+            'bash -lc "cd web && npx playwright test -u"',
+            'npx --package @playwright/test playwright test -u',
+            'npx -p @playwright/test playwright test --update-snapshots',
+            'pnpm --filter web exec playwright test -u',
+        ]) {
+            expect(snapshotUpdateWarning('Bash', cmd), cmd).not.toBeNull();
+        }
+    });
+
     it('snapshot: no shell-tool name is an edit tool, so the shell warning never meets a path decision', () => {
         for (const t of ['Bash', 'bash', 'BashTool', 'shell', 'launch-process', 'launch_process']) {
             expect(EDIT_TOOLS.has(t), t).toBe(false);
```
