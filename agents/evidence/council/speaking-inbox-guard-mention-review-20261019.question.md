<!-- evidence-type: analysis -->

<!-- A prompt given to the council on 2026-10-19 for branch drain/road-to-gates-that-read-what-was-written-20261019z,
     round 1, committed verbatim so the verdict recorded beside it can be checked
     against what was actually asked. Not edited after the run. -->

# Review branch drain/road-to-gates-that-read-what-was-written-20261019z, round 1 — the speaking-inbox guard

Context, from the tree:

- `src/scripts/hooks/block_speaking_inbox_dir.ts` is a blocking `pre_tool_use` guard (`fail_closed: false`). It refuses the creation of a new first-level directory under `agents/tmp/` or `agents/tmp.old/` whose name is not an opaque round identifier, because such a name gets quoted into tracked files and leaks the source it was named after. For a shell command it judges every whitespace token, the raw command (heredoc bodies included) and redirect targets. A directory that already exists is allowed ("rename, do not re-refuse").
- Roadmap `road-to-gates-that-read-what-was-written` Phase 3 records two refusals from a real inbox round: a read-only `ls -la` of an existing round directory, and the remediation command the guard's own deny message prescribes (`printf '%s' '<the real source>' | ./scripts-run src/scripts/_lib/link_crypto encrypt`) when the plaintext names a directory that had already been renamed. Its decision D2 keeps the conservative token scan and forbids a command classifier; an earlier verb-classifier attempt was removed after two review rounds found bypasses.
- The dispatcher (`src/scripts/hooks/dispatch_hook.ts`) builds the envelope with `workspace_root` and wraps the host's native payload, which on Claude Code carries `cwd`. Grep finds no producer of `project_dir`.

This change:

1. The exists-probe base becomes the first non-empty of `project_dir`, `payload.cwd`, `envelope.cwd`, `envelope.workspace_root`, instead of `project_dir` alone (which fell back to the hook process cwd).
2. `creatableTokens` returns no tokens when the whole command matches exactly the remediation shape: `printf '%s' '<single-quoted literal without a quote or newline>' | [./]scripts-run src/scripts/_lib/link_crypto encrypt`. Everything else goes through the unchanged scan.

Measured at `0c32dc78d`: `tests/hooks/block_speaking_inbox_dir.test.ts` 84/84 pass. The five new allow-cases were red at the base `1a334dd16` and the block-cases green. Neutralising each mechanism re-reds its cases (2 and 3 respectively). The composed hook bundle measures 1,549,690 B against its 1,550,000 B ceiling. `link_crypto.ts` contains no filesystem write call. The subject digest over the gated file is `8e66972b44b37389763d39aa9edcd391afc4bfbbcc0a92e19b14f772fcfb7350`.

Review the diff below. For each defect report file:line, the failure scenario and a severity. Questions a review should answer include: whether either change lets a new speaking directory be created that the base refused, and by what command; whether the base-resolution order is correct for relative paths in Write and Bash calls; and whether this is authority-expanding, non-expanding, or touches an owner-reserved floor (lowering a recorded security, privacy or safety floor). Give a final verdict from exactly one of `ratified`, `confirmed-non-expanding`, `refused`, `non-convergent`, and the single highest-leverage change.

```diff
diff --git a/src/scripts/hooks/block_speaking_inbox_dir.ts b/src/scripts/hooks/block_speaking_inbox_dir.ts
index d61f9c54e..51ca5d698 100644
--- a/src/scripts/hooks/block_speaking_inbox_dir.ts
+++ b/src/scripts/hooks/block_speaking_inbox_dir.ts
@@ -200,6 +200,20 @@ function _redirectTargets(segment: string): string[] {
     return out;
 }
 
+/**
+ * The remediation {@link denyMessage} prescribes, and nothing wider.
+ *
+ * Its plaintext IS the real source, which names the directory being renamed —
+ * so once the rename has happened the guard refused the command it had just
+ * asked for. Matched on the whole command rather than by classifying verbs
+ * (that axis was tried and removed, see {@link isGlobOverAcceptableInboxDir}):
+ * one single-quoted literal, which the shell cannot expand, piped into an
+ * encrypt that writes only to stdout. Any second segment, redirect,
+ * substitution or newline falls through to the unchanged token scan.
+ */
+const ENCRYPT_REMEDIATION_RE =
+    /^\s*printf '%s' '[^'\n]*' \| (?:\.\/)?scripts-run src\/scripts\/_lib\/link_crypto encrypt\s*$/;
+
 /**
  * The tokens of a shell command whose CREATION this guard should judge.
  *
@@ -222,6 +236,9 @@ function _redirectTargets(segment: string): string[] {
  * without an envelope.
  */
 export function creatableTokens(command: string): string[] {
+    if (ENCRYPT_REMEDIATION_RE.test(command)) {
+        return [];
+    }
     const out: string[] = [];
     const segments = invokedSegments(command);
     for (const seg of segments) {
@@ -395,7 +412,16 @@ export function main(): number {
         if (ti === null) {
             return 0;
         }
-        const repoRoot = typeof envelope['project_dir'] === 'string' ? envelope['project_dir'] : '';
+        // The base a relative path resolves against. `project_dir` alone was
+        // read, and no producer sets it: the dispatcher sends `workspace_root`
+        // and the native payload `cwd`. So the exists-probe fell back to the
+        // hook's own cwd — the parent checkout in a worktree session — and an
+        // existing round was judged new. The shell's `cwd` comes before the
+        // dispatcher's root because a command's relative paths resolve there.
+        const repoRoot =
+            [envelope['project_dir'], payload['cwd'], envelope['cwd'], envelope['workspace_root']].find(
+                (v): v is string => typeof v === 'string' && v.trim() !== '',
+            ) ?? '';
         const rawTool = payload['tool_name'] ?? envelope['tool_name'];
         const toolName = typeof rawTool === 'string' ? rawTool.trim().toLowerCase() : '';
         const candidates: string[] = [];
```

Test diff (`-U2`):

```diff
diff --git a/tests/hooks/block_speaking_inbox_dir.test.ts b/tests/hooks/block_speaking_inbox_dir.test.ts
index 1f8582252..f8375ae1f 100644
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
 
@@ -501,2 +505,113 @@ describe('main() — the envelope surface', () => {
     });
 });
+
+/**
+ * `road-to-gates-that-read-what-was-written` Phase 3 — a mention is not a
+ * creation, measured on the two commands one inbox round was refused.
+ *
+ * Probed before any change (2026-10-19): with the speaking directory present
+ * in the tree the envelope names, `ls -la <dir>/` was ALLOWED only when the
+ * hook process already stood in that tree. The guard read `project_dir`, a key
+ * no producer sets: the dispatcher sends `workspace_root` and the native
+ * payload sends `cwd`, so the exists-probe resolved against the hook's own cwd
+ * — in a worktree session that is the parent checkout, where the round does
+ * not exist. The remediation command in the deny message was refused whenever
+ * its plaintext named a directory that had already been renamed.
+ *
+ * Every name is invented and assembled at runtime.
+ */
+describe('a mention is not a creation — the commands a real round was refused', () => {
+    const speaking = ['a', 'speaking', 'round'].join('-');
+    const renamed = ['an', 'old', 'speaking', 'name'].join('-');
+    const fresh = ['a', 'new', 'speaking', 'round'].join('-');
+    const tree = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'speaking-inbox-')));
+    fs.mkdirSync(path.join(tree, 'agents', 'tmp', speaking), { recursive: true });
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
+    const remediation = (source: string): string =>
+        `printf '%s' '${source}' | ./scripts-run src/scripts/_lib/link_crypto encrypt`;
+
+    describe('allowed', () => {
+        it('a read-only ls of an EXISTING inbox directory, resolved against the envelope cwd', () => {
+            expect(run(bash(`ls -la agents/tmp/${speaking}/`))).toBe(0);
+        });
+
+        it('the same, when only the dispatcher field workspace_root names the tree', () => {
+            expect(run(bash(`ls -la agents/tmp/${speaking}/`, { workspace_root: tree }))).toBe(0);
+        });
+
+        it('the same, when the native payload is wrapped by the dispatcher', () => {
+            expect(
+                run({
+                    workspace_root: '/nonexistent-dispatcher-root',
+                    payload: { tool_name: 'Bash', cwd: tree, tool_input: { command: `ls -la agents/tmp/${speaking}/` } },
+                }),
+            ).toBe(0);
+        });
+
+        it('the remediation command naming a directory that was already renamed', () => {
+            expect(run(bash(remediation(`renamed from agents/tmp/${renamed}/`)))).toBe(0);
+            expect(
+                creatableTokens(remediation(`renamed from agents/tmp/${renamed}/`)).filter((t) =>
+                    t.includes('agents/tmp'),
+                ),
+            ).toEqual([]);
+        });
+    });
+
+    describe('still refused', () => {
+        it('mkdir -p into a NEW speaking directory, with the envelope naming the tree', () => {
+            expect(run(bash(`mkdir -p agents/tmp/${fresh}`))).toBe(1);
+            expect(run(bash(`mkdir -p agents/tmp/${fresh}`, { workspace_root: tree }))).toBe(1);
+        });
+
+        it('a > redirect into a new speaking directory', () => {
+            expect(run(bash(`echo hi > agents/tmp/${fresh}/note.md`))).toBe(1);
+        });
+
+        it('a heredoc body calling makedirs on a new speaking directory', () => {
+            expect(
+                run(bash(`python3 - <<'PY'\nimport os\nos.makedirs('agents/tmp/${fresh}')\nPY`)),
+            ).toBe(1);
+        });
+
+        it('the remediation shape is exempt only exactly as written', () => {
+            for (const command of [
+                `printf '%s' 'agents/tmp/${fresh}' | xargs mkdir -p`,
+                `${remediation('x')} > agents/tmp/${fresh}/note`,
+                `printf '%s' "$(mkdir -p agents/tmp/${fresh})" | ./scripts-run src/scripts/_lib/link_crypto encrypt`,
+                `${remediation(`agents/tmp/${fresh}`)}; mkdir -p agents/tmp/${fresh}`,
+                `${remediation(`agents/tmp/${fresh}`)} && mkdir -p agents/tmp/${fresh}`,
+                `${remediation(`agents/tmp/${fresh}`)}\nmkdir -p agents/tmp/${fresh}`,
+                `printf '%s' 'agents/tmp/${fresh}' | ./scripts-run src/scripts/_lib/link_crypto decrypt`,
+                `printf '%s' 'agents/tmp/${fresh}' | ./scripts-run src/scripts/_lib/link_crypto encrypt | sh`,
+            ]) {
+                expect(run(bash(command)), command).toBe(1);
+            }
+        });
+    });
+
+    it('the remediation printed in the deny message executes unblocked as written', () => {
+        const line = denyMessage(renamed)
+            .split('\n')
+            .find((l) => l.includes('link_crypto encrypt'));
+        expect(line).toBeDefined();
+        const command = (line as string)
+            .trim()
+            .replace('<the real source>', `renamed from agents/tmp/${renamed}/`);
+        expect(command).toBe(remediation(`renamed from agents/tmp/${renamed}/`));
+        expect(run(bash(command))).toBe(0);
+    });
+});
```
