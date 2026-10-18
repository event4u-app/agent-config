<!-- evidence-type: analysis -->

<!-- A prompt given to the council on 2026-10-18 for branch drain/road-to-one-detector-and-the-senders-we-own-20261018b,
     round 4c, eighth pass, committed verbatim so the verdict recorded beside it can be checked
     against what was actually asked. Not edited after the run. -->

# Review branch drain/road-to-one-detector-and-the-senders-we-own-20261018b, round 4c eighth pass — where a backslash separates

A ratification decision under ADR-268 § 4 on a new `pre_tool_use` guard. Reviewed commit
`9269020fc`. The seventh pass closed every sixth-pass finding (both seats agreed) and found one
remaining false positive: every backslash was read as a path separator, so on a POSIX host
`cat 'dir\\.env'` — one file whose name contains a backslash — was refused as `.env`. One seat
approved with a documentation caveat; the other asked that separator semantics apply only where
the execution environment or the path syntax warrants them.

What changed:

- `credentialFileClass` reads a backslash as a separator when the host is Windows
  (`process.platform === 'win32'`), or when the path is a drive-letter (`C:\\`) or UNC (`\\\\`)
  path on any host. Elsewhere a backslash is a filename character.
- The raw-text reading no longer rewrites backslashes itself; `credentialAmong` judges each built
  word once. The path decides, not the reading.
- A test seam (`_setBackslashSeparatesForTest`) pins both hosts. On POSIX: `cat 'dir\\.env'`,
  `cat "dir\\.env"`, `cat '.ssh\\id_rsa'` and a Read of `dir\\.env` pass; a drive-letter and a
  UNC path still refuse. On Windows the same four refuse. The test was seen red with the old reading.
- The whole earlier suite (25 cases) still passes.

The question for the decision: is the guard ready to ratify — every named bypass refused, and no
file refused that the host does not open as a credential file? The deliberate conservative
carve-out is the drive-letter/UNC reading on a POSIX host; say if you consider it a defect.

For each defect report file:line, the failure scenario and a severity. Say whether the
seventh-pass finding is closed. State your stance (APPROVE or REQUEST_CHANGES) and the single
highest-leverage change.

```diff
diff --git a/src/scripts/_lib/credential_files.ts b/src/scripts/_lib/credential_files.ts
index 28ddf1ab6..0b52b9445 100644
--- a/src/scripts/_lib/credential_files.ts
+++ b/src/scripts/_lib/credential_files.ts
@@ -68,9 +68,28 @@ const CREDENTIAL_TAILS: ReadonlyArray<readonly [string, CredentialFileClass]> =
 
 const PROC_ENVIRON = /^\/proc\/[^/]+\/environ$/;
 
+/**
+ * Whether a backslash separates path segments. On Windows it does; on a POSIX
+ * host a backslash the shell keeps is a filename character (`'dir\.env'` is one
+ * file), so reading it as a separator there refuses a file that is not a
+ * credential file. A drive-letter or UNC path is read as a Windows path on any
+ * host: its syntax says what it is.
+ */
+let backslashSeparates = process.platform === 'win32';
+const WINDOWS_PATH = /^(?:[A-Za-z]:\\|\\\\)/;
+
+/** Test seam: force the host's backslash reading, or `null` to restore it. */
+export function _setBackslashSeparatesForTest(value: boolean | null): void {
+    backslashSeparates = value ?? process.platform === 'win32';
+}
+
+function separated(p: string): string {
+    return backslashSeparates || WINDOWS_PATH.test(p) ? p.replace(/\\/g, '/') : p;
+}
+
 /** The credential class of a path, or null. Decided from the path alone. */
 export function credentialFileClass(rawPath: string): CredentialFileClass | null {
-    const trimmed = rawPath.trim().replace(/\\/g, '/').replace(/\/+$/, '');
+    const trimmed = separated(rawPath.trim()).replace(/\/+$/, '');
     if (trimmed === '') return null;
     // `.` and `..` segments resolved, so `/proc/self/../self/environ` is the file it names.
     const p = path.posix.normalize(trimmed);
@@ -183,16 +202,17 @@ const base = (w: string): string => w.replace(/^.*\//, '');
  * a path cannot hold unquoted — whitespace, quotes, redirections, pipes,
  * separators, parentheses, `=`, `,`, backticks — so `cat<.env`, `--config=.env`
  * and `<(cat .env)` all expose the path, and an attached short option
- * (`xargs -a.env`) is read both whole and without its `-x` prefix. Backslashes
- * read as separators, so a Windows path is a path.
+ * (`xargs -a.env`) is read both whole and without its `-x` prefix. A Windows
+ * path is a path: `credentialFileClass` reads its backslashes as separators.
  */
 export function credentialMention(text: string): Verdict {
     // Two readings of one segment, because neither alone matches the shell: the
-    // raw text with backslashes as path separators (a Windows path, an attached
-    // `cat<.env`), and each word the shell would build — quotes joined, escapes
-    // applied only where the shell applies them (`cat .e''nv`, an unquoted
-    // `cat .e\nv`) — each cut at the same characters.
-    const readings = [text.replace(/\\/g, '/'), ...commandWords(text)];
+    // raw text (a Windows path, an attached `cat<.env`), and each word the shell
+    // would build — quotes joined, escapes applied only where the shell applies
+    // them (`cat .e''nv`, an unquoted `cat .e\nv`) — each cut at the same
+    // characters. Whether a backslash separates is the path's decision, not the
+    // reading's (see `separated`).
+    const readings = [text, ...commandWords(text)];
     for (const reading of readings) {
         const v = mentionIn(reading);
         if (v !== null) return v;
@@ -215,7 +235,7 @@ function mentionIn(text: string): Verdict {
 /** The first credential path among words the shell already built — judged as data, never re-parsed. */
 function credentialAmong(words: readonly string[]): Verdict {
     for (const w of words) {
-        const v = mentionIn(w) ?? mentionIn(w.replace(/\\/g, '/'));
+        const v = mentionIn(w);
         if (v !== null) return v;
     }
     return null;
diff --git a/tests/scripts/hooks/block_credential_reads.test.ts b/tests/scripts/hooks/block_credential_reads.test.ts
index e19c2a68c..b16d101fb 100644
--- a/tests/scripts/hooks/block_credential_reads.test.ts
+++ b/tests/scripts/hooks/block_credential_reads.test.ts
@@ -9,7 +9,7 @@
  */
 import { afterEach, describe, expect, it } from 'vitest';
 
-import { credentialFileClass, segmentVerdict } from '../../../src/scripts/_lib/credential_files.js';
+import { _setBackslashSeparatesForTest, credentialFileClass, segmentVerdict } from '../../../src/scripts/_lib/credential_files.js';
 import { denyMessage, KILL_SWITCH, main, verdictFor } from '../../../src/scripts/hooks/block_credential_reads.js';
 import { clearHookStdinOverride, setHookStdinOverride } from '../../../src/scripts/hooks/hook_stdin.js';
 import { emitFor, isBlockCapable } from '../../../src/scripts/hooks/host_semantics.js';
@@ -25,6 +25,7 @@ function run(tool: string, input: Record<string, string>): number {
 
 afterEach(() => {
     delete process.env[KILL_SWITCH];
+    _setBackslashSeparatesForTest(null);
 });
 
 // One red and one green path per class: the green is the nearest legitimate neighbour.
@@ -184,6 +185,26 @@ describe('the tool and command surface', () => {
         }
     });
 
+    it('reads a backslash as a separator only where the host or the path syntax makes it one (council round 4c, seventh pass)', () => {
+        // On a POSIX host a backslash the shell keeps is a filename character:
+        // `dir\.env` is one file, not `.env` in `dir`.
+        _setBackslashSeparatesForTest(false);
+        for (const cmd of ["cat 'dir\\.env'", 'cat "dir\\.env"', "cat '.ssh\\id_rsa'"]) {
+            expect(run('Bash', { command: cmd }), JSON.stringify(cmd)).toBe(0);
+        }
+        expect(run('Read', { file_path: 'dir\\.env' })).toBe(0);
+        // A drive-letter or UNC path is a Windows path whatever the host.
+        for (const cmd of ['cat "C:\\Users\\someone\\project\\.env"', "cat '\\\\server\\share\\.env'"]) {
+            expect(run('Bash', { command: cmd }), JSON.stringify(cmd)).toBe(1);
+        }
+        // On a Windows host every backslash separates.
+        _setBackslashSeparatesForTest(true);
+        for (const cmd of ["cat 'dir\\.env'", 'cat "dir\\.env"', "cat '.ssh\\id_rsa'"]) {
+            expect(run('Bash', { command: cmd }), JSON.stringify(cmd)).toBe(1);
+        }
+        expect(run('Read', { file_path: 'dir\\.env' })).toBe(1);
+    });
+
     it('a .pem counts only when a name token says key, and only an absolute /proc path is the environment', () => {
         expect(credentialFileClass('certs/monkey.pem')).toBeNull();
         expect(credentialFileClass('certs/secretary-ca.pem')).toBeNull();
```
