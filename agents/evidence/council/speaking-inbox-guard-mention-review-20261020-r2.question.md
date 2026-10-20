<!-- evidence-type: analysis -->

<!-- A prompt given to the council on 2026-10-20 for branch drain/gates-read-written-20261020,
     round 2, committed verbatim so the verdict recorded beside it can be checked
     against what was actually asked. Not edited after the run. -->

# Review branch drain/gates-read-written-20261020, round 2 — the speaking-inbox guard

Context, from the tree:

- `src/scripts/hooks/block_speaking_inbox_dir.ts` is a blocking `pre_tool_use` guard (`fail_closed: false`). It refuses the creation of a new first-level directory under `agents/tmp/` or `agents/tmp.old/` whose name is not an opaque round identifier, because such a name gets quoted into tracked files and leaks the source it was named after. For a shell command it judges every whitespace token, the raw command (heredoc bodies included) and redirect targets. A directory that already exists is allowed ("rename, do not re-refuse"); at the base this carve-out is offered to every token of every command.
- Roadmap `road-to-gates-that-read-what-was-written` Phase 3 records two refusals from a real inbox round: a read-only `ls -la` of an existing round directory, and the remediation the deny message prescribes (`printf '%s' '<the real source>' | ./scripts-run src/scripts/_lib/link_crypto encrypt`) when the operator typed a plaintext naming a directory that had already been renamed. Decision D2 keeps the conservative token scan and forbids a command classifier.
- Base facts: the dispatcher (`src/scripts/hooks/dispatch_hook.ts`) `chdir`s to `--project-dir` (on Claude Code `$CLAUDE_PROJECT_DIR`, the parent checkout in a worktree session), sets `workspace_root` to that cwd, and wraps the host's native payload under `payload`; Claude Code's native PreToolUse payload carries `cwd`, the session working directory where Bash runs and where a relative file path resolves. No producer sets `project_dir` in the envelope. The guard at the base read only `envelope.project_dir`, so its exists-probe resolved against the hook process cwd.

History: a first build (2026-10-19) was refused 2/2 for a bare `scripts-run` exemption and a base cascade led by `project_dir`. Round 1 of this branch (2026-10-20) was refused 2/2. Both seats accepted the cwd-only base and its conflicting-field tests as correct and tightening. Both refused the remediation exemption: a `lstat` regular-file check on `<cwd>/scripts-run` is shape, not identity, because the same agent can write that file. The openai seat also found that the directory-change rule cannot prove the effective base (a sourced script can `cd`), and asked that when shell semantics make the base uncertain the carve-out be declined.

Disposition in this round (head `f65646b17`, gated file `src/scripts/hooks/block_speaking_inbox_dir.ts`, subject `1a214c18722d850952cfc852b131e1b8b7d9bbf4cd7538007c9685f16a4ea252`):

1. **Kept:** the exists-probe base is the native payload's `cwd` only, and only when absolute. `project_dir`, `workspace_root`, and an envelope-level `cwd` beside a wrapped payload are never read. No `cwd` → `''` → hook process cwd, the base behaviour.
2. **Removed:** the remediation exemption, entirely. No command shape bypasses the token scan; `creatableTokens(cmd)` is called on the raw command exactly as at the base.
3. **Changed instead:** the deny message now says to encrypt "the source itself (its URL or name), never an agents/tmp path, which this guard judges". With a source as plaintext the prescribed command carries no inbox token and passes the unchanged scan. A plaintext that names a NEW speaking path is still refused.
4. **Directory-change rule kept and widened** (`source` and `.` added to `cd`/`pushd`/`popd`, plus `-C`/`--directory`/`--git-dir`/`--work-tree`/`--chdir`): when a command visibly changes directory, its relative tokens get no exists-probe; absolute tokens still do. The docstring now states it is a narrowing, not a proof: the base offered the carve-out to every token of every command, so a script or function that changes directory unseen is the base's residual, not a new one — and it can only re-create a name that already exists in the tool's `cwd`. Declining the carve-out for every Bash relative token would re-break the measured `ls -la` of an existing round, which is the defect this phase exists to fix.

Measured at `f65646b17`: `tests/hooks/block_speaking_inbox_dir.test.ts` 92/92 pass. Against the base guard the suite has 7 red: 5 allow-cases and 2 conflicting-field block-cases (with `project_dir` naming a tree that holds the directory, the base ALLOWED `mkdir -p` in a cwd where it does not exist). Neutralising each mechanism re-reds its cases: the directory-change rule 1, the cwd-only base 4, the absolute-cwd check 1.

Review the diff below (against `origin/main`). For each defect report file:line, the failure scenario and a severity. Questions a review should answer include: whether any change lets a new speaking directory be created that the base refused, and by what command; whether the base is correct for relative paths in Write and Bash calls; whether the residual stated in item 4 is correctly characterised as the base's; and whether this is authority-expanding, non-expanding, or touches an owner-reserved floor (lowering a recorded security, privacy or safety floor). Give a final verdict from exactly one of `ratified`, `confirmed-non-expanding`, `refused`, `non-convergent`, and the single highest-leverage change.

```diff
diff --git a/src/scripts/hooks/block_speaking_inbox_dir.ts b/src/scripts/hooks/block_speaking_inbox_dir.ts
index d61f9c54e..cc834fa41 100644
--- a/src/scripts/hooks/block_speaking_inbox_dir.ts
+++ b/src/scripts/hooks/block_speaking_inbox_dir.ts
@@ -37,8 +37,9 @@
  * 2. **A directory that already exists.** Blocking every later write into an
  *    already-created speaking directory would wedge a session mid-round without
  *    removing the name — the fix there is a rename, which the deny message of
- *    the creating call already asked for. This is the one filesystem read the
- *    guard performs.
+ *    the creating call already asked for. A relative path is probed against
+ *    the tool's own `cwd` and nothing else; a shell command that changes
+ *    directory first gets no probe for its relative tokens.
  * 3. **An opaque round identifier** — `isOpaqueRoundId` in
  *    `_lib/source_shape.ts` is the single authority, shared with the gate, so
  *    the guard and the CI check can never disagree about what "opaque" means.
@@ -200,6 +201,24 @@ function _redirectTargets(segment: string): string[] {
     return out;
 }
 
+/**
+ * Whether a shell command visibly moves off the `cwd` it was handed: a
+ * `cd`/`pushd`/`popd`/`source`/`.` word, or a directory flag (`-C`,
+ * `--directory`, `--git-dir`, `--work-tree`, `--chdir`). Then the
+ * already-exists carve-out is not offered to a relative token.
+ *
+ * A narrowing, not a proof: a script or function can change directory without
+ * any of these appearing. The base offered the carve-out to every token of
+ * every command, so that residual is the base's, not new — and it can only
+ * re-create a name that already exists in the tool's `cwd`.
+ */
+export function changesDirectory(command: string): boolean {
+    return (
+        /(?:^|[\s;&|(`{])(?:cd|pushd|popd|source|\.)(?=$|[\s;&|)])/.test(command) ||
+        /(?:^|\s)(?:-C|--directory|--git-dir|--work-tree|--chdir)(?=$|[\s=])/.test(command)
+    );
+}
+
 /**
  * The tokens of a shell command whose CREATION this guard should judge.
  *
@@ -363,7 +382,8 @@ export function denyMessage(dir: string): string {
         '  round-a91f3c         content-free hex (also set-, src-set-, source-set-)\n' +
         '  S17                  a set number\n' +
         '\n' +
-        'Record the true source ONCE, encrypted, in the round\'s intake note:\n' +
+        'Record the true source ONCE, encrypted, in the round\'s intake note — the source\n' +
+        'itself (its URL or name), never an agents/tmp path, which this guard judges:\n' +
         "  printf '%s' '<the real source>' | ./scripts-run src/scripts/_lib/link_crypto encrypt\n" +
         '\n' +
         'Naming rule: /analyze:inbox Phase 1. Rule: src/rules/source-confidentiality.md.\n' +
@@ -395,7 +415,16 @@ export function main(): number {
         if (ti === null) {
             return 0;
         }
-        const repoRoot = typeof envelope['project_dir'] === 'string' ? envelope['project_dir'] : '';
+        // The base a relative path resolves against is the tool's own working
+        // directory: the native payload's `cwd`, which is where Bash runs and
+        // where a relative file path lands. `project_dir` (no producer sets it)
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
@@ -417,13 +446,26 @@ export function main(): number {
         // decision logic is shared rather than duplicated — see
         // `creatableTokens` for why "every whitespace token" was too many.
         const cmd = ti['command'] ?? (_isObject(envelope['payload']) ? (envelope['payload'] as JsonObject)['command'] : undefined);
+        const baseless: string[] = [];
         if (typeof cmd === 'string' && cmd) {
-            candidates.push(...creatableTokens(cmd));
+            const tokens = creatableTokens(cmd);
+            (changesDirectory(cmd) ? baseless : candidates).push(...tokens);
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
+        for (const v of baseless) {
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
index 1f8582252..997f22809 100644
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
 
@@ -501,2 +505,139 @@ describe('main() — the envelope surface', () => {
     });
 });
+
+/**
+ * A mention is not a creation. Two builds of this were refused for trusting a
+ * command's spelling, a mutable file's shape, and a base field the shell does
+ * not run in. What is pinned here: the base is the tool's own `cwd` and no
+ * other field can outrank it; a command that visibly changes directory gets no
+ * exists-probe for a relative token; and no command shape is exempt from the
+ * token scan — the remediation passes because it names the source, not a path.
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
+    const lsRound = `ls -la ${inbox}/${speaking}/`;
+    const mkRound = `mkdir -p ${inbox}/${speaking}`;
+
+    describe('allowed', () => {
+        it('a read-only ls of an EXISTING inbox directory, resolved against the tool cwd', () => {
+            expect(run(bash(lsRound))).toBe(0);
+        });
+        it('the same when the dispatcher wraps the native payload', () => {
+            expect(
+                run({ workspace_root: other, payload: { tool_name: 'Bash', cwd: tree, tool_input: { command: lsRound } } }),
+            ).toBe(0);
+        });
+        it('a relative Write into the existing round resolves against the tool cwd', () => {
+            expect(run({ tool_name: 'Write', cwd: tree, tool_input: { file_path: `${inbox}/${speaking}/x.md` } })).toBe(0);
+        });
+        it('a printf naming an EXISTING inbox directory inside a quoted literal', () => {
+            expect(run(bash(remediation(`renamed from ${inbox}/${speaking}/`)))).toBe(0);
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
+    describe('conflicting base fields — only the tool cwd decides', () => {
+        it('project_dir naming the tree that holds the round does not outrank cwd', () => {
+            expect(run(bash(mkRound, { cwd: other, project_dir: tree }))).toBe(1);
+        });
+        it('workspace_root naming the tree that holds the round does not outrank cwd', () => {
+            expect(run(bash(mkRound, { cwd: other, workspace_root: tree }))).toBe(1);
+            expect(
+                run({ workspace_root: tree, payload: { tool_name: 'Bash', cwd: other, tool_input: { command: mkRound } } }),
+            ).toBe(1);
+        });
+        it('an envelope-level cwd does not outrank the wrapped native cwd', () => {
+            expect(run({ cwd: tree, payload: { tool_name: 'Bash', cwd: other, tool_input: { command: mkRound } } })).toBe(1);
+        });
+        it('a relative cwd is not a base', () => {
+            expect(run(bash(mkRound, { cwd: path.relative(process.cwd(), tree) }))).toBe(1);
+        });
+        it('a relative Write resolves from cwd, not from project_dir or workspace_root', () => {
+            expect(
+                run({
+                    tool_name: 'Write',
+                    cwd: other,
+                    project_dir: tree,
+                    workspace_root: tree,
+                    tool_input: { file_path: `${inbox}/${speaking}/x.md` },
+                }),
+            ).toBe(1);
+        });
+        it('a command that visibly changes directory first gets no probe for a relative token', () => {
+            for (const command of [
+                `cd ${other} && ${mkRound}`,
+                `(cd ${other}; ${mkRound})`,
+                `pushd ${other} && ${mkRound}`,
+                `. ./elsewhere.sh && ${mkRound}`,
+                `source ./elsewhere.sh && ${mkRound}`,
+                `git -C ${other} mv x ${inbox}/${speaking}`,
+                `make --directory=${other} ${inbox}/${speaking}`,
+            ]) {
+                expect(run(bash(command)), command).toBe(1);
+            }
+        });
+        it('an absolute token is still probed under a directory change', () => {
+            expect(run(bash(`cd ${other} && ls ${path.join(tree, inbox, speaking)}/`))).toBe(0);
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
