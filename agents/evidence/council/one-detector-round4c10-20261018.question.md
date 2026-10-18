<!-- evidence-type: analysis -->

<!-- A prompt given to the council on 2026-10-18 for branch drain/road-to-one-detector-and-the-senders-we-own-20261018b,
     round 4c, tenth pass, committed verbatim so the verdict recorded beside it can be checked
     against what was actually asked. Not edited after the run. -->

# Review branch drain/road-to-one-detector-and-the-senders-we-own-20261018b, round 4c tenth pass — the raw command is the shell's

A ratification decision under ADR-268 § 4 on a new `pre_tool_use` guard. Reviewed commit
`925e2da65`. The ninth pass (2/2 REQUEST_CHANGES) agreed both eighth-pass findings were closed
(host as an explicit argument; no module-level seam) and found one false positive: on a Windows
host the raw-text reading separated on a backslash the shell consumes, so an unquoted
`cat dir\\.env` — which opens `dir.env` — was refused. One seat also asked that the remaining
trade-off be stated rather than implied.

What changed:

- `credentialMention`: the raw text is read with backslashes as filename characters (judged as
  a POSIX path) on every host; the host decides only for the words `commandWords` builds, where a
  surviving backslash is the filesystem's.
- One documented, deliberate conservative exception. `invokedSegments` (shared with the deny
  guards, deliberately not changed here) strips the quotes of the command word, so `npm` written
  `np''m` is still npm. That makes `cat<"C:\\x\\.env"` and `cat<C:\\x\\.env` arrive as the same
  text. A redirection attached to the command word is therefore judged uncooked with the host's
  separator: on Windows both refuse, the unquoted one a false positive accepted so the quoted one
  is never missed. On POSIX nothing changes.
- Tests: `cat dir\\.env`, `cat C:\\x\\.env` and `cat < dir\\.env` pass on both hosts;
  `cat<"C:\\x\\.env"` and `cat --config="dir\\.env"` refuse on Windows and pass on POSIX;
  `cat<dir\\.env` refuses on Windows (the stated false positive) and passes on POSIX. Seen red
  before the fix, and with the head reading removed. All 26 cases pass.

The question for the decision: is the guard ready to ratify, with that one stated conservative
false positive? If you consider the exception a blocker, say what replaces it without narrowing
the quoted case.

For each defect report file:line, the failure scenario and a severity. Say whether the
ninth-pass finding is closed. State your stance (APPROVE or REQUEST_CHANGES) and the single
highest-leverage change.

```diff
diff --git a/src/scripts/_lib/credential_files.ts b/src/scripts/_lib/credential_files.ts
index f4fbb4330..233c0bcd7 100644
--- a/src/scripts/_lib/credential_files.ts
+++ b/src/scripts/_lib/credential_files.ts
@@ -200,14 +200,27 @@ const base = (w: string): string => w.replace(/^.*\//, '');
  */
 export function credentialMention(text: string, host: PathHost = HOST): Verdict {
     // Two readings of one segment, because neither alone matches the shell: the
-    // raw text (a Windows path, an attached `cat<.env`), and each word the shell
+    // raw text (an attached `cat<.env`, `--config=.env`), and each word the shell
     // would build — quotes joined, escapes applied only where the shell applies
     // them (`cat .e''nv`, an unquoted `cat .e\nv`) — each cut at the same
-    // characters. Whether a backslash separates is the host's decision, not the
-    // reading's (see `PathHost`).
-    const readings = [text, ...commandWords(text)];
-    for (const reading of readings) {
-        const v = mentionIn(reading, host);
+    // characters. In the raw text a backslash is still the shell's to consume,
+    // so it never separates there; the host decides only for a built word, where
+    // a surviving backslash is a filename character the filesystem reads.
+    //
+    // One exception, conservative on purpose: the segment arrives with the quotes
+    // of its command word already removed (`invokedSegments` strips them so
+    // `np''m` is npm), so `cat<"C:\x\.env"` and `cat<C:\x\.env` reach here as the
+    // same text. A redirection attached to the command word is therefore judged
+    // as the filesystem would read it, uncooked: on a Windows host it refuses
+    // both, the second a false positive this guard accepts rather than miss the first.
+    const head = /^\S*[<>]\S*/.exec(text.trimStart())?.[0];
+    const readings: ReadonlyArray<readonly [string, PathHost]> = [
+        [text, 'posix'],
+        ...(head === undefined ? [] : [[head, host] as const]),
+        ...commandWords(text).map((w) => [w, host] as const),
+    ];
+    for (const [reading, readingHost] of readings) {
+        const v = mentionIn(reading, readingHost);
         if (v !== null) return v;
     }
     return null;
diff --git a/tests/scripts/hooks/block_credential_reads.test.ts b/tests/scripts/hooks/block_credential_reads.test.ts
index e00e12425..32ee43db4 100644
--- a/tests/scripts/hooks/block_credential_reads.test.ts
+++ b/tests/scripts/hooks/block_credential_reads.test.ts
@@ -206,6 +206,24 @@ describe('the tool and command surface', () => {
             expect(read(p, 'posix'), `posix ${p}`).toBeNull();
         }
         expect(bash('cat "C:\\Users\\someone\\project\\.env.example"', 'windows')).toBeNull();
+        // An unquoted backslash is the shell's before it is the filesystem's: it
+        // escapes the next character, so `cat dir\.env` opens `dir.env` on both hosts
+        // (council round 4c, ninth pass).
+        for (const host of ['posix', 'windows'] as const) {
+            for (const cmd of ['cat dir\\.env', 'cat C:\\x\\.env', 'cat < dir\\.env']) {
+                expect(bash(cmd, host), `${host} ${JSON.stringify(cmd)}`).toBeNull();
+            }
+        }
+        // A redirection attached to the command word arrives with its quotes already
+        // stripped, so on a Windows host it is judged uncooked: the unquoted form is a
+        // false positive the guard accepts so the quoted one is never missed.
+        expect(bash('cat<dir\\.env', 'windows')).not.toBeNull();
+        expect(bash('cat<dir\\.env', 'posix')).toBeNull();
+        // Quoted, the backslash survives and the Windows host separates on it, attached or not.
+        for (const cmd of ['cat<"C:\\x\\.env"', 'cat --config="dir\\.env"']) {
+            expect(bash(cmd, 'windows'), `windows ${JSON.stringify(cmd)}`).not.toBeNull();
+            expect(bash(cmd, 'posix'), `posix ${JSON.stringify(cmd)}`).toBeNull();
+        }
         // A backslash the shell consumes as an escape names the same file on both hosts.
         for (const host of ['posix', 'windows'] as const) {
             for (const cmd of ['cat .e\\nv', 'cat dir\\/.env', "cat 'certs\\tls.key'"]) {
```
