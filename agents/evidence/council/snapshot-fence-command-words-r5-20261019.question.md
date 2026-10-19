<!-- evidence-type: analysis -->

<!-- A prompt given to the council on 2026-10-19 for branch
     test/snapshot-fence-regex-negatives-20261019, round 5, committed verbatim
     so the verdict recorded beside it can be checked against what was asked.
     Not edited after the run. -->

# Review branch test/snapshot-fence-regex-negatives-20261019, round 5 — the snapshot command warning reads shell words

This is a ratification review under ADR-268 § 4 for a diff touching a governance hook. Please review the complete diff below (hook and test file) and return findings.

Context, from the tree:

- `src/scripts/hooks/block_config_weakening.ts` is a PreToolUse governance hook. Its snapshot fence (ratified `confirmed-non-expanding` 2/2 on 2026-10-19, `agents/evidence/ratifications/canvas-snapshot-fence-20261019.md`) warns — never blocks — when a shell tool runs a visual runner with a baseline update. `evaluate()`, untouched here, computes `snapshotUpdateWarning` once as `cmdWarn`: for a non-edit tool a non-null value returns WARN, null returns ALLOW; for an edit tool it only seeds a warning emitted after every path decision, so any path BLOCK returns first.
- Rounds 1–4 (`agents/evidence/council/snapshot-fence-command-words{,-r2,-r3,-r4}-20261019.question.md`): each time one seat `confirmed-non-expanding`, one seat `request-changes` naming concrete commands. All named commands are now in the test tables: `env …`, `env -i …`, `sh -c '…'`, `bash -lc "…"`, `npx --package X …`, `npx -p X …`, `pnpm --filter web exec …`, `yarn playwright …`, `pnpm playwright …`, `bun x …`, and (round 3) `env -u NAME …`, `env --unset NAME …`, `env --chdir DIR …`, and a backslash-newline continuation inside the runner name or a flag, and (round 4) `bash -o pipefail -c …` and `bash -e -x -c …` warn; `-u --list`, `--help -u`, `--version -u`, `yarn run <script> -u`, `pnpm jest -u`, and (round 4) `bash script.sh -c …`, `bash -- -c …` and `sudo npx playwright test -u` do not.
- The recognised shape, stated as the contract: per simple command (split at `;` `&` `|` `(` `)` newline; quotes and backslashes removed, a backslash-newline outside single quotes contributes nothing; `#` comments dropped; no expansion), skip leading options and `VAR=value`; optionally `env` plus its options and assignments; a shell (`sh`/`bash`/`zsh`/`dash`) with a `-…c…` option in its option prefix (options up to the first operand or `--`, `-o` taking a value) reads the word after that option recursively; then optionally `npx`/`bunx`/`pnpx`, or `npm`/`pnpm`/`yarn`/`bun` plus options plus optional `exec`/`dlx`/`x`; then options (`-p`, `--package`, `--filter`, `-F`, `-C`, `--dir`, `--cwd`, `-u`, `--unset`, `--chdir` take a value); then the runner by basename. The runner's arguments must contain `-u`, `--update-snapshots`, or `--update-snapshots=<mode>` other than `false`/`none`, and none of `--list`, `--help`, `-h`, `--version`.
- Outside the contract, deliberately: `sudo`/`time`/`command`/`nohup`/`xargs` wrappers, `env -S`, variable expansion, and npm scripts (`npm run test:visual -- -u`), where the runner is not on the command line at all.

Measured at the head: 62 tests pass in the hook's test file; hook bundle 1,549,546 B of 1,550,000 B; subject digest `2d3fbaf0726037ed344f6876cfc20f7ef3988ce6905b0cfcf83d29615ce55f3a` (covers only the hook).

Questions:

1. Does any input that this hook blocked before this diff now reach WARN or ALLOW? Name the input if so.
2. Does any input that this hook allowed before this diff now block? Name the input if so.
3. Does the implementation deviate from the contract stated above for any input? Name it.
4. Classify the change: `ratified` (authority-expanding but acceptable), `confirmed-non-expanding` (governance surface touched, no expansion of what the agent may do), or `request-changes` (with the concrete defect).

Complete diff, `git diff origin/main...HEAD -- src/scripts/hooks/block_config_weakening.ts tests/scripts/hooks/block_config_weakening.test.ts`:

```diff
diff --git a/src/scripts/hooks/block_config_weakening.ts b/src/scripts/hooks/block_config_weakening.ts
index ace35f8d0..ca124a333 100644
--- a/src/scripts/hooks/block_config_weakening.ts
+++ b/src/scripts/hooks/block_config_weakening.ts
@@ -148,8 +148,91 @@ const SHELL_TOOL = /^(bash|bashtool|shell|launch[-_]process)$/i;
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
+const VALUE_OPTIONS = new Set(['-p', '--package', '--filter', '-F', '-C', '--dir', '--cwd', '-u', '--unset', '--chdir']);
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
+        // Only the option prefix: a `-c` after the script operand or after `--` is an argument.
+        for (let k = i + 1; at(k).startsWith('-') && at(k) !== '--'; k += at(k) === '-o' ? 2 : 1) {
+            if (/^-\w*c\w*$/.test(at(k))) return shellSegments(at(k + 1)).some(runsSnapshotUpdate);
+        }
+        return false;
+    }
+    if (LAUNCHERS.has(at(i))) i++;
+    else if (PACKAGE_MANAGERS.has(at(i))) {
+        i++;
+        skipOptions();
+        // `yarn playwright` and `pnpm playwright` dispatch a binary directly; `run` names a script.
+        if (['exec', 'dlx', 'x'].includes(at(i))) i++;
+    }
+    skipOptions();
+    if (!VISUAL_RUNNERS.has(at(i).split('/').pop() ?? '')) return false;
+    const args = words.slice(i + 1);
+    return !args.some((w) => /^(--list|--help|-h|--version)$/.test(w)) && args.some((w) => w === '-u' || /^--update-snapshots(=(?!(false|none)$).+)?$/.test(w));
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
+        if (c === '\\' && command[i + 1] === '\n' && quote !== "'") {
+            i++; // a line continuation contributes nothing, not even a word break
+        } else if (quote !== null) {
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
index 2b8888acd..d6b696198 100644
--- a/tests/scripts/hooks/block_config_weakening.test.ts
+++ b/tests/scripts/hooks/block_config_weakening.test.ts
@@ -646,6 +646,75 @@ describe('block_config_weakening — snapshot surfaces', () => {
         expect(snapshotUpdateWarning('Bash', 'npx playwright test --update-snapshots-foo')).toBeNull();
     });
 
+    // Residue of the snapshot-fence ratification (2026-10-19): the command check reads
+    // shell words, so pin the shapes that only mention the flag or the runner.
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
+            'npx playwright test --help -u',
+            'npx playwright --version -u',
+            'yarn run test:visual -u',
+            'pnpm jest -u',
+            "bash script.sh -c 'npx playwright test -u'",
+            "bash -- -c 'npx playwright test -u'",
+            'sudo npx playwright test -u',
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
+            'yarn playwright test -u',
+            'pnpm playwright test --update-snapshots',
+            'bun x playwright test -u',
+            'env -u NODE_OPTIONS npx playwright test -u',
+            'env --unset NODE_OPTIONS npx playwright test --update-snapshots',
+            'env --chdir web npx playwright test -u',
+            'npx play\\\nwright test -u',
+            'npx playwright test "-\\\nu"',
+            "bash -o pipefail -c 'npx playwright test -u | tee log'",
+            "bash -e -x -c 'npx playwright test -u'",
+        ]) {
+            expect(snapshotUpdateWarning('Bash', cmd), cmd).not.toBeNull();
+        }
+    });
+
     it('snapshot: no shell-tool name is an edit tool, so the shell warning never meets a path decision', () => {
         for (const t of ['Bash', 'bash', 'BashTool', 'shell', 'launch-process', 'launch_process']) {
             expect(EDIT_TOOLS.has(t), t).toBe(false);
```
