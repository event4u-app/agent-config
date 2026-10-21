<!-- evidence-type: analysis -->

<!-- A prompt given to the council on 2026-10-20 for branch drain/gates-read-written-20261020,
     round 3, committed verbatim so the verdict recorded beside it can be checked
     against what was actually asked. Not edited after the run. -->

# Review branch drain/gates-read-written-20261020, round 3 — the speaking-inbox guard

Context, from the tree:

- `src/scripts/hooks/block_speaking_inbox_dir.ts` is a blocking `pre_tool_use` guard (`fail_closed: false`). It refuses the creation of a new first-level directory under `agents/tmp/` or `agents/tmp.old/` whose name is not an opaque round identifier, because such a name gets quoted into tracked files and leaks the source it was named after. For a shell command it judges every whitespace token, the raw command (heredoc bodies included) and redirect targets. A directory that already exists is allowed ("rename, do not re-refuse"); at the base this exists-probe is offered to every token, path-keyed or shell, resolved against `envelope.project_dir` — a key no producer sets — so in practice against the hook process cwd.
- Base facts: the dispatcher (`src/scripts/hooks/dispatch_hook.ts`) `chdir`s to `--project-dir` (on Claude Code `$CLAUDE_PROJECT_DIR`, the parent checkout in a worktree session), sets `workspace_root` to that cwd, and wraps the host's native payload under `payload`; Claude Code's native PreToolUse payload carries `cwd`, the session working directory where a path-keyed tool's relative path resolves.
- Roadmap `road-to-gates-that-read-what-was-written` Phase 3 records two refusals from a real inbox round: a read-only `ls -la` of an existing round directory, and the deny message's own remediation (`printf '%s' '<the real source>' | ./scripts-run src/scripts/_lib/link_crypto encrypt`) when the operator typed a plaintext naming a directory that had already been renamed. Decision D2 keeps the conservative token scan and forbids a command classifier.

History, all 2/2 refused: 2026-10-19 (bare `scripts-run` exemption; base cascade led by `project_dir`); this branch round 1 (a regular-file check on a mutable `./scripts-run` is shape, not identity); this branch round 2 (a relative shell token's existence under native `cwd` says nothing about where an invoked helper lands it — `helper agents/tmp/<name>` where `helper` does `cd elsewhere && mkdir -p "$1"` was refused at the base and allowed by round 2). Both round-2 seats converged on the same change: keep the native-`cwd` base for path-keyed tools, ignore `project_dir`/`workspace_root`/a wrapper-level `cwd`, keep the remediation exemption removed, keep the clearer deny message, and offer the exists-probe to a shell token only when it is absolute — with a helper-script regression.

This round (head `18bba1df1`, gated file `src/scripts/hooks/block_speaking_inbox_dir.ts`, subject `f3e5598593fc4ff2c466c065ae4e04e925e6d180f4d404f35dbdc2399385ca8c`) is that change:

1. Path-keyed tools (Write/Edit/NotebookEdit and equivalents): the exists-probe base is the native payload's `cwd`, only when absolute; `project_dir`, `workspace_root` and an envelope-level `cwd` beside a wrapped payload are never read. No `cwd` → `''` → hook process cwd (the base behaviour).
2. Shell commands: `creatableTokens(cmd)` is unchanged and runs on the raw command; a token gets the exists-probe only when `path.isAbsolute(token)`. A relative token naming a speaking directory is refused whether or not it exists anywhere. The directory-change rule from round 2 is deleted — with no relative probe it had nothing left to narrow. No command shape is exempt.
3. The deny message asks for the source itself ("its URL or name, never an agents/tmp path, which this guard judges"), and adds: "Already created? Rename it. Until then a shell command reaches it only by its absolute path: a relative one may land anywhere, so it is judged as new."

Consequence for the roadmap, stated so it can be judged: the measured `ls -la agents/tmp/<existing>/` stays refused when written relatively; it passes written with its absolute path, as it already did at the base. The guard becomes stricter than the base for relative shell tokens (the base allowed one whenever it existed under the hook process cwd).

Measured at `18bba1df1`: `tests/hooks/block_speaking_inbox_dir.test.ts` 92/92 pass. Against the base guard the new suite has 4 red: a relative Write into an existing round under native `cwd` (refused at base), the deny-message wording, `project_dir` outranking `cwd` for a Write (allowed at base), and a relative `mkdir -p` with `project_dir` naming a tree that holds the directory (allowed at base). Neutralising each mechanism re-reds its cases: the absolute-only shell probe 2 (incl. the helper-script case), the native-`cwd` base 2, the absolute-`cwd` check 1.

Review the diff below (against `origin/main`). For each defect report file:line, the failure scenario and a severity. Questions a review should answer include: whether any change lets a new speaking directory be created that the base refused, and by what command; whether the native-`cwd` base is correct for a path-keyed tool's relative path; and whether this is authority-expanding, non-expanding, or touches an owner-reserved floor (lowering a recorded security, privacy or safety floor). Give a final verdict from exactly one of `ratified`, `confirmed-non-expanding`, `refused`, `non-convergent`, and the single highest-leverage change.

```diff
diff --git a/src/scripts/hooks/block_speaking_inbox_dir.ts b/src/scripts/hooks/block_speaking_inbox_dir.ts
index d61f9c54e..a53ce909c 100644
--- a/src/scripts/hooks/block_speaking_inbox_dir.ts
+++ b/src/scripts/hooks/block_speaking_inbox_dir.ts
@@ -37,8 +37,9 @@
  * 2. **A directory that already exists.** Blocking every later write into an
  *    already-created speaking directory would wedge a session mid-round without
  *    removing the name — the fix there is a rename, which the deny message of
- *    the creating call already asked for. This is the one filesystem read the
- *    guard performs.
+ *    the creating call already asked for. A path-keyed tool's relative path
+ *    is probed against the tool's own `cwd` and nothing else; a shell
+ *    command's token is probed only when absolute.
  * 3. **An opaque round identifier** — `isOpaqueRoundId` in
  *    `_lib/source_shape.ts` is the single authority, shared with the gate, so
  *    the guard and the CI check can never disagree about what "opaque" means.
@@ -363,9 +364,13 @@ export function denyMessage(dir: string): string {
         '  round-a91f3c         content-free hex (also set-, src-set-, source-set-)\n' +
         '  S17                  a set number\n' +
         '\n' +
-        'Record the true source ONCE, encrypted, in the round\'s intake note:\n' +
+        'Record the true source ONCE, encrypted, in the round\'s intake note — the source\n' +
+        'itself (its URL or name), never an agents/tmp path, which this guard judges:\n' +
         "  printf '%s' '<the real source>' | ./scripts-run src/scripts/_lib/link_crypto encrypt\n" +
         '\n' +
+        'Already created? Rename it. Until then a shell command reaches it only by its\n' +
+        'absolute path: a relative one may land anywhere, so it is judged as new.\n' +
+        '\n' +
         'Naming rule: /analyze:inbox Phase 1. Rule: src/rules/source-confidentiality.md.\n' +
         `Maintainer kill switch: ${KILL_SWITCH}=1.\n`
     );
@@ -395,7 +400,16 @@ export function main(): number {
         if (ti === null) {
             return 0;
         }
-        const repoRoot = typeof envelope['project_dir'] === 'string' ? envelope['project_dir'] : '';
+        // The base a relative path resolves against is the tool's own working
+        // directory: the native payload's `cwd`, where a path-keyed tool's
+        // relative path lands. `project_dir` (no producer sets it)
+        // and the dispatcher's `workspace_root` (the hook's cwd, the parent
+        // checkout in a worktree session) name other trees, and a field that
+        // can outrank the real base lets `mkdir` create in one tree what the
+        // probe found in another — so neither is read. No `cwd` → '' → the
+        // hook process cwd, the behaviour before this field was read.
+        const rawCwd = payload['cwd'];
+        const cwd = typeof rawCwd === 'string' && path.isAbsolute(rawCwd) ? rawCwd : '';
         const rawTool = payload['tool_name'] ?? envelope['tool_name'];
         const toolName = typeof rawTool === 'string' ? rawTool.trim().toLowerCase() : '';
         const candidates: string[] = [];
@@ -417,13 +431,29 @@ export function main(): number {
         // decision logic is shared rather than duplicated — see
         // `creatableTokens` for why "every whitespace token" was too many.
         const cmd = ti['command'] ?? (_isObject(envelope['payload']) ? (envelope['payload'] as JsonObject)['command'] : undefined);
+        // A shell command's relative token gets no exists-probe: whatever it
+        // invokes may change directory first (a script, a function, an alias),
+        // so its existence under `cwd` says nothing about where it lands. An
+        // absolute token names its own base and is probed.
+        const shellTokens: string[] = [];
         if (typeof cmd === 'string' && cmd) {
-            candidates.push(...creatableTokens(cmd));
+            shellTokens.push(...creatableTokens(cmd));
         }
-        for (const v of candidates) {
-            const verdict = verdictFor(v, (p) => fs.existsSync(p), repoRoot);
+        const judge = (v: string, exists: (p: string) => boolean): boolean => {
+            const verdict = verdictFor(v, exists, cwd);
             if (verdict.block && verdict.dir !== null) {
                 process.stderr.write(denyMessage(verdict.dir));
+                return true;
+            }
+            return false;
+        };
+        for (const v of shellTokens) {
+            if (judge(v, (p) => path.isAbsolute(v) && fs.existsSync(p))) {
+                return 1;
+            }
+        }
+        for (const v of candidates) {
+            if (judge(v, (p) => fs.existsSync(p))) {
                 return 1;
             }
         }
```

Test diff (`-U2`):

```diff
diff --git a/tests/hooks/block_speaking_inbox_dir.test.ts b/tests/hooks/block_speaking_inbox_dir.test.ts
index 1f8582252..df05d0338 100644
--- a/tests/hooks/block_speaking_inbox_dir.test.ts
+++ b/tests/hooks/block_speaking_inbox_dir.test.ts
@@ -16,4 +16,8 @@
  * Every directory name below is invented. Nothing here names a real source.
  */
+import * as fs from 'node:fs';
+import * as os from 'node:os';
+import * as path from 'node:path';
+
 import { describe, expect, it } from 'vitest';
 
@@ -501,2 +505,147 @@ describe('main() — the envelope surface', () => {
     });
 });
+
+/**
+ * A mention is not a creation. Three builds of this were refused for trusting a
+ * command's spelling, a mutable file's shape, a base field the shell does not
+ * run in, and a relative shell token whose landing place no text can show.
+ * What is pinned here: a path-keyed tool's base is its own `cwd` and no other
+ * field can outrank it; a shell command's token is probed only when absolute;
+ * and no command shape is exempt from the token scan — the remediation passes
+ * because it names the source, not a path.
+ *
+ * Every name is invented and assembled at runtime.
+ */
+describe('a mention is not a creation — the commands a real round was refused', () => {
+    const speaking = ['a', 'speaking', 'round'].join('-');
+    const renamed = ['an', 'old', 'speaking', 'name'].join('-');
+    const fresh = ['a', 'new', 'speaking', 'round'].join('-');
+    const inbox = ['agents', 'tmp'].join('/');
+    const mk = (tag: string): string => fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), `speaking-${tag}-`)));
+    // `tree` holds the round, `other` does not. A conflicting field always
+    // points at `tree`, so a guard reading that field ALLOWS and fails the case.
+    const tree = mk('tree');
+    fs.mkdirSync(path.join(tree, inbox, speaking), { recursive: true });
+    const other = mk('other');
+    const absRound = path.join(tree, inbox, speaking);
+
+    const run = (envelope: unknown): number => {
+        setHookStdinOverride(JSON.stringify(envelope));
+        try {
+            return main();
+        } finally {
+            clearHookStdinOverride();
+        }
+    };
+    const bash = (command: string, extra: Record<string, unknown> = { cwd: tree }): unknown => ({
+        tool_name: 'Bash',
+        ...extra,
+        tool_input: { command },
+    });
+    const remediation = (source: string, exe = './scripts-run'): string =>
+        `printf '%s' '${source}' | ${exe} src/scripts/_lib/link_crypto encrypt`;
+    const mkRound = `mkdir -p ${inbox}/${speaking}`;
+
+    describe('allowed', () => {
+        it('a read-only ls of an EXISTING inbox directory named by its absolute path', () => {
+            expect(run(bash(`ls -la ${absRound}/`))).toBe(0);
+            expect(run(bash(`cd ${other} && ls -la ${absRound}/`))).toBe(0);
+        });
+        it('the same when the dispatcher wraps the native payload', () => {
+            expect(
+                run({
+                    workspace_root: other,
+                    payload: { tool_name: 'Bash', cwd: other, tool_input: { command: `ls -la ${absRound}/` } },
+                }),
+            ).toBe(0);
+        });
+        it('a relative Write into the existing round resolves against the tool cwd', () => {
+            expect(run({ tool_name: 'Write', cwd: tree, tool_input: { file_path: `${inbox}/${speaking}/x.md` } })).toBe(0);
+        });
+        it('a printf naming an EXISTING inbox directory by absolute path inside a quoted literal', () => {
+            expect(run(bash(remediation(`renamed from ${absRound}/`)))).toBe(0);
+        });
+        it('the remediation printed in the deny message executes unblocked as written', () => {
+            const line = denyMessage(speaking)
+                .split('\n')
+                .find((l) => l.includes('link_crypto encrypt'));
+            const command = (line as string).trim().replace('<the real source>', 'https://example.org/a-source');
+            expect(command).toBe(remediation('https://example.org/a-source'));
+            expect(run(bash(command))).toBe(0);
+            expect(run(bash(command, {}))).toBe(0);
+        });
+        it('the deny message tells the operator to encrypt the source, not a path', () => {
+            expect(denyMessage(speaking)).toContain('never an agents/tmp path');
+        });
+    });
+
+    describe('conflicting base fields — only the tool cwd decides a path-keyed probe', () => {
+        it('project_dir naming the tree that holds the round does not outrank cwd', () => {
+            expect(
+                run({ tool_name: 'Write', cwd: other, project_dir: tree, tool_input: { file_path: `${inbox}/${speaking}/x.md` } }),
+            ).toBe(1);
+        });
+        it('workspace_root naming the tree that holds the round does not outrank cwd', () => {
+            expect(
+                run({ tool_name: 'Write', cwd: other, workspace_root: tree, tool_input: { file_path: `${inbox}/${speaking}/x` } }),
+            ).toBe(1);
+            expect(
+                run({
+                    workspace_root: tree,
+                    payload: { tool_name: 'Write', cwd: other, tool_input: { file_path: `${inbox}/${speaking}/x` } },
+                }),
+            ).toBe(1);
+        });
+        it('an envelope-level cwd does not outrank the wrapped native cwd', () => {
+            expect(
+                run({ cwd: tree, payload: { tool_name: 'Write', cwd: other, tool_input: { file_path: `${inbox}/${speaking}/x` } } }),
+            ).toBe(1);
+        });
+        it('a relative cwd is not a base', () => {
+            expect(
+                run({
+                    tool_name: 'Write',
+                    cwd: path.relative(process.cwd(), tree),
+                    tool_input: { file_path: `${inbox}/${speaking}/x.md` },
+                }),
+            ).toBe(1);
+        });
+    });
+
+    describe('a shell command: a relative token is never probed', () => {
+        it('a relative mention of a round that exists under cwd is still refused', () => {
+            expect(run(bash(`ls -la ${inbox}/${speaking}/`))).toBe(1);
+            expect(run(bash(mkRound, { cwd: tree, project_dir: tree, workspace_root: tree }))).toBe(1);
+        });
+        it('a helper that changes directory before creating its relative argument', () => {
+            const helper = path.join(tree, 'helper.sh');
+            fs.writeFileSync(helper, `#!/bin/sh\ncd ${other} && mkdir -p "$1"\n`, { mode: 0o755 });
+            expect(run(bash(`./helper.sh ${inbox}/${speaking}`))).toBe(1);
+        });
+        it('an absolute token naming a NEW speaking directory is refused', () => {
+            expect(run(bash(`mkdir -p ${path.join(other, inbox, fresh)}`))).toBe(1);
+        });
+    });
+
+    describe('still refused', () => {
+        it('mkdir -p into a NEW speaking directory', () => {
+            expect(run(bash(`mkdir -p ${inbox}/${fresh}`))).toBe(1);
+        });
+        it('a > redirect into a new speaking directory', () => {
+            expect(run(bash(`echo hi > ${inbox}/${fresh}/note.md`))).toBe(1);
+        });
+        it('a heredoc body calling makedirs on a new speaking directory', () => {
+            expect(run(bash(`python3 - <<'PY'\nimport os\nos.makedirs('${inbox}/${fresh}')\nPY`))).toBe(1);
+        });
+        it('no command shape is exempt: a quoted literal naming a NEW speaking directory', () => {
+            for (const command of [
+                remediation(`renamed from ${inbox}/${renamed}/`),
+                remediation(`${inbox}/${fresh}`, 'scripts-run'),
+                `printf '%s' '${inbox}/${fresh}' | xargs mkdir -p`,
+                `printf '%s' "$(mkdir -p ${inbox}/${fresh})" | ./scripts-run src/scripts/_lib/link_crypto encrypt`,
+            ]) {
+                expect(run(bash(command)), command).toBe(1);
+            }
+        });
+    });
+});
```
