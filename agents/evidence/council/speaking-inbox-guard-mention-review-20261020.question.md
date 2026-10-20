<!-- evidence-type: analysis -->

<!-- A prompt given to the council on 2026-10-20 for branch drain/gates-read-written-20261020,
     round 1, committed verbatim so the verdict recorded beside it can be checked
     against what was actually asked. Not edited after the run. -->

# Review branch drain/gates-read-written-20261020, round 1 — the speaking-inbox guard

Context, from the tree:

- `src/scripts/hooks/block_speaking_inbox_dir.ts` is a blocking `pre_tool_use` guard (`fail_closed: false`). It refuses the creation of a new first-level directory under `agents/tmp/` or `agents/tmp.old/` whose name is not an opaque round identifier, because such a name gets quoted into tracked files and leaks the source it was named after. For a shell command it judges every whitespace token, the raw command (heredoc bodies included) and redirect targets. A directory that already exists is allowed ("rename, do not re-refuse").
- Roadmap `road-to-gates-that-read-what-was-written` Phase 3 records two refusals from a real inbox round: a read-only `ls -la` of an existing round directory, and the remediation the guard's own deny message prescribes (`printf '%s' '<the real source>' | ./scripts-run src/scripts/_lib/link_crypto encrypt`) when the plaintext names a directory that had already been renamed. Decision D2 keeps the conservative token scan and forbids a command classifier.
- A first build was refused 2/2 on 2026-10-19 (record `agents/evidence/ratifications/drain-road-to-gates-that-read-what-was-written-20261019z.md`) and reverted. Its findings: F1 the exemption admitted a bare `scripts-run` (resolved through `PATH`); F2 a shared base cascade let `project_dir` outrank the `cwd` a Bash command runs in; F3 no tests with conflicting base fields. The seats asked for a tool-specific base, an executable anchored to the repository, suppression of the plaintext occurrence rather than the whole command, and conflicting-field regressions.
- Base facts: the dispatcher (`src/scripts/hooks/dispatch_hook.ts`) `chdir`s to `--project-dir` (on Claude Code `$CLAUDE_PROJECT_DIR`, which in a worktree session is the parent checkout), sets `workspace_root` to that cwd, and wraps the host's native payload under `payload`; Claude Code's native PreToolUse payload carries `cwd`, the session working directory where the Bash tool runs and where a relative file path resolves. No producer sets `project_dir` in the envelope. The guard at the base read only `envelope.project_dir`, so its exists-probe resolved against the hook process cwd.

This change (gated file: `src/scripts/hooks/block_speaking_inbox_dir.ts`, subject `6109a592e0a94c9e8f826539b80007d2d1f7827c064810f6c66daa1c94b34c2b` at `5f1ed1604`):

1. The exists-probe base is `payload.cwd` only (the wrapped native payload's, or the envelope's own when unwrapped), and only when absolute. `project_dir`, `workspace_root`, and an envelope-level `cwd` beside a wrapped payload are never read. With no `cwd` the base is `''`, which is the hook process cwd — the behaviour at the base. The same base serves path-keyed tools and Bash, because both resolve a relative path against the tool's working directory.
2. A shell command that moves off that cwd — a `cd`/`pushd`/`popd` word, or a `-C`/`--directory`/`--git-dir`/`--work-tree`/`--chdir` flag — gets no exists-probe for its relative tokens; an absolute token is still probed.
3. The remediation is exempt only when the whole command is exactly `printf '%s' '<literal without quote or newline>' | ./scripts-run src/scripts/_lib/link_crypto encrypt` (`./` mandatory), the tool cwd is known, and `lstat` reports both `<cwd>/scripts-run` and `<cwd>/src/scripts/_lib/link_crypto.ts` as regular files (a symlink is not). Then the literal alone is emptied and the resulting command still goes through the unchanged token scan.

Measured at `5f1ed1604`: `tests/hooks/block_speaking_inbox_dir.test.ts` 93/93 pass. At the base `418a09379` the new suite had 7 red: 5 allow-cases, plus 2 conflicting-field block-cases (with `project_dir` naming a tree that holds the directory, the base guard ALLOWED `mkdir -p` in a cwd where it does not exist). Neutralising each mechanism re-reds its cases: the anchor check 2, the directory-change rule 1, the cwd-only base 5. `link_crypto.ts` contains no filesystem write call; `scripts-run` is a 9-line bash shim that execs `tsx` on `src/scripts/run.ts` relative to its own location. The hook bundle measures 1,450,501 B at the base against a 1,550,000 B ceiling.

Review the diff below. For each defect report file:line, the failure scenario and a severity. Questions a review should answer include: whether any change lets a new speaking directory be created that the base refused, and by what command; whether the base is correct for relative paths in Write and Bash calls; whether the anchor establishes the executable's identity well enough; and whether this is authority-expanding, non-expanding, or touches an owner-reserved floor (lowering a recorded security, privacy or safety floor). Give a final verdict from exactly one of `ratified`, `confirmed-non-expanding`, `refused`, `non-convergent`, and the single highest-leverage change.

```diff
diff --git a/src/scripts/hooks/block_speaking_inbox_dir.ts b/src/scripts/hooks/block_speaking_inbox_dir.ts
index d61f9c54e..e8c78c103 100644
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
@@ -105,6 +106,14 @@ const _READ_ONLY_TOOLS: ReadonlySet<string> = new Set([
     'read_file', 'list_dir', 'semantic_search',
 ]);
 
+function _isRegularFile(p: string): boolean {
+    try {
+        return fs.lstatSync(p).isFile();
+    } catch {
+        return false;
+    }
+}
+
 function _isObject(v: JsonValue | undefined): v is JsonObject {
     return v !== null && v !== undefined && typeof v === 'object' && !Array.isArray(v);
 }
@@ -200,6 +209,57 @@ function _redirectTargets(segment: string): string[] {
     return out;
 }
 
+/**
+ * The remediation {@link denyMessage} prescribes, spelled exactly as printed.
+ *
+ * Its plaintext IS the real source, which names the directory being renamed,
+ * so after the rename the guard refused the command it had just asked for.
+ * One single-quoted literal (no expansion), `./` so `PATH` is never consulted,
+ * and no second segment, redirect, substitution or newline. Matched on the
+ * whole command, not by classifying verbs — that axis was removed, see
+ * {@link isGlobOverAcceptableInboxDir}.
+ */
+const ENCRYPT_REMEDIATION_RE =
+    /^\s*printf '%s' '[^'\n]*' \| \.\/scripts-run src\/scripts\/_lib\/link_crypto encrypt\s*$/;
+const ENCRYPT_REMEDIATION_EMPTY = "printf '%s' '' | ./scripts-run src/scripts/_lib/link_crypto encrypt";
+
+/**
+ * The command with the remediation's plaintext emptied, when — and only
+ * when — `./scripts-run` resolves to a regular file in the tool's own `cwd`
+ * beside `link_crypto.ts`. A bare name, a symlink, or no known `cwd` is not
+ * that executable, and the command is returned unchanged.
+ *
+ * Only the literal is suppressed: the rest of the command still goes through
+ * {@link creatableTokens}, so nothing but the quoted plaintext stops being read.
+ */
+export function withoutRemediationPlaintext(
+    command: string,
+    cwd: string,
+    isRegularFile: (p: string) => boolean,
+): string {
+    if (cwd === '' || !ENCRYPT_REMEDIATION_RE.test(command)) {
+        return command;
+    }
+    const anchored =
+        isRegularFile(path.join(cwd, 'scripts-run')) &&
+        isRegularFile(path.join(cwd, 'src', 'scripts', '_lib', 'link_crypto.ts'));
+    return anchored ? ENCRYPT_REMEDIATION_EMPTY : command;
+}
+
+/**
+ * Whether a shell command moves off the `cwd` it was handed before a relative
+ * path in it resolves: a `cd`/`pushd`/`popd` segment, or a directory flag
+ * (`-C`, `--directory`, `--git-dir`, `--work-tree`, `--chdir`). Then no field
+ * names the base, so the already-exists carve-out is not offered to a
+ * relative token. Errs toward refusing, and only for a speaking name.
+ */
+export function changesDirectory(command: string): boolean {
+    return (
+        /(?:^|[\s;&|(`{])(?:cd|pushd|popd)(?=$|[\s;&|)])/.test(command) ||
+        /(?:^|\s)(?:-C|--directory|--git-dir|--work-tree|--chdir)(?=$|[\s=])/.test(command)
+    );
+}
+
 /**
  * The tokens of a shell command whose CREATION this guard should judge.
  *
@@ -395,7 +455,16 @@ export function main(): number {
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
@@ -417,13 +486,26 @@ export function main(): number {
         // decision logic is shared rather than duplicated — see
         // `creatableTokens` for why "every whitespace token" was too many.
         const cmd = ti['command'] ?? (_isObject(envelope['payload']) ? (envelope['payload'] as JsonObject)['command'] : undefined);
+        const baseless: string[] = [];
         if (typeof cmd === 'string' && cmd) {
-            candidates.push(...creatableTokens(cmd));
+            const tokens = creatableTokens(withoutRemediationPlaintext(cmd, cwd, _isRegularFile));
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
index 1f8582252..e9697261f 100644
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
 
@@ -501,2 +505,157 @@ describe('main() — the envelope surface', () => {
     });
 });
+
+/**
+ * A mention is not a creation. A first build of this was refused for trusting
+ * a command's spelling and a base field the shell does not run in, so the
+ * three boundaries are pinned here as polarity pairs:
+ * the base is the tool's own `cwd` and no other field can outrank it; the
+ * remediation is exempt only when `./scripts-run` is a regular file in that
+ * `cwd` (never a bare name, never a symlink); and only the plaintext literal
+ * is suppressed, so every other byte of the command is still scanned.
+ *
+ * Every name is invented and assembled at runtime.
+ */
+describe('a mention is not a creation — the commands a real round was refused', () => {
+    const speaking = ['a', 'speaking', 'round'].join('-');
+    const renamed = ['an', 'old', 'speaking', 'name'].join('-');
+    const fresh = ['a', 'new', 'speaking', 'round'].join('-');
+    const inbox = ['agents', 'tmp'].join('/');
+    const mk = (tag: string): string => fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), `speaking-${tag}-`)));
+    // `tree` holds the round and a trusted remediation executable; `other`
+    // holds neither. A conflicting field always points at the tree that would
+    // make the guard ALLOW, so a guard reading that field fails the case.
+    const tree = mk('tree');
+    fs.mkdirSync(path.join(tree, inbox, speaking), { recursive: true });
+    fs.writeFileSync(path.join(tree, 'scripts-run'), '#!/bin/sh\n');
+    fs.mkdirSync(path.join(tree, 'src', 'scripts', '_lib'), { recursive: true });
+    fs.writeFileSync(path.join(tree, 'src', 'scripts', '_lib', 'link_crypto.ts'), '');
+    const other = mk('other');
+    // A tree whose `scripts-run` is a symlink: the name is right, the identity is not.
+    const linked = mk('linked');
+    fs.symlinkSync('/bin/sh', path.join(linked, 'scripts-run'));
+    fs.mkdirSync(path.join(linked, 'src', 'scripts', '_lib'), { recursive: true });
+    fs.writeFileSync(path.join(linked, 'src', 'scripts', '_lib', 'link_crypto.ts'), '');
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
+        it('the remediation naming a renamed directory, with a trusted ./scripts-run in cwd', () => {
+            expect(run(bash(remediation(`renamed from ${inbox}/${renamed}/`)))).toBe(0);
+        });
+        it('the remediation printed in the deny message executes unblocked as written', () => {
+            const line = denyMessage(renamed)
+                .split('\n')
+                .find((l) => l.includes('link_crypto encrypt'));
+            const command = (line as string).trim().replace('<the real source>', `renamed from ${inbox}/${renamed}/`);
+            expect(command).toBe(remediation(`renamed from ${inbox}/${renamed}/`));
+            expect(run(bash(command))).toBe(0);
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
+        it('a command that changes directory first has no knowable base for a relative token', () => {
+            for (const command of [
+                `cd ${other} && ${mkRound}`,
+                `(cd ${other}; ${mkRound})`,
+                `pushd ${other} && ${mkRound}`,
+                `git -C ${other} mv x ${inbox}/${speaking}`,
+                `make --directory=${other} ${inbox}/${speaking}`,
+            ]) {
+                expect(run(bash(command)), command).toBe(1);
+            }
+        });
+        it('the remediation needs the trusted executable in THIS cwd', () => {
+            expect(
+                run(bash(remediation(`${inbox}/${fresh}`), { cwd: other, project_dir: tree, workspace_root: tree })),
+            ).toBe(1);
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
+        it('a bare scripts-run resolves through PATH and is not the anchored executable', () => {
+            expect(run(bash(remediation(`${inbox}/${fresh}`, 'scripts-run')))).toBe(1);
+        });
+        it('a ./scripts-run that is a symlink is not the anchored executable', () => {
+            expect(run(bash(remediation(`${inbox}/${fresh}`), { cwd: linked }))).toBe(1);
+        });
+        it('no cwd at all means no anchor, so no exemption', () => {
+            expect(run(bash(remediation(`${inbox}/${fresh}`), {}))).toBe(1);
+        });
+        it('the remediation shape is exempt only exactly as written', () => {
+            const enc = './scripts-run src/scripts/_lib/link_crypto';
+            for (const command of [
+                `printf '%s' '${inbox}/${fresh}' | xargs mkdir -p`,
+                `${remediation('x')} > ${inbox}/${fresh}/note`,
+                `printf '%s' "$(mkdir -p ${inbox}/${fresh})" | ${enc} encrypt`,
+                `${remediation(`${inbox}/${fresh}`)}; mkdir -p ${inbox}/${fresh}`,
+                `${remediation(`${inbox}/${fresh}`)} && mkdir -p ${inbox}/${fresh}`,
+                `${remediation(`${inbox}/${fresh}`)}\nmkdir -p ${inbox}/${fresh}`,
+                `printf '%s' '${inbox}/${fresh}' | ${enc} decrypt`,
+                `printf '%s' '${inbox}/${fresh}' | ${enc} encrypt | sh`,
+                `printf '%s' '${inbox}/${fresh}' | ${enc} encrypt ${inbox}/${fresh}`,
+            ]) {
+                expect(run(bash(command)), command).toBe(1);
+            }
+        });
+    });
+});
```
