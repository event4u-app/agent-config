<!-- evidence-type: analysis -->

<!-- A prompt given to the council on 2026-10-18 for branch drain/road-to-one-detector-and-the-senders-we-own-20261018b,
     round 4c, sixth pass, committed verbatim so the verdict recorded beside it can be checked
     against what was actually asked. Not edited after the run. -->

# Review branch drain/road-to-one-detector-and-the-senders-we-own-20261018b, round 4c sixth pass — three readings of one segment

A ratification decision under ADR-268 § 4 on a new `pre_tool_use` guard. Reviewed commit
`96c026ab5`. The fifth pass (both seats REQUEST_CHANGES) agreed the raw-text scan closed the
attached-redirection, attached-option and Windows-path cases, and showed that replacing the parsed
reading with the raw one opened escapes and quote joins the shell resolves (`cat .e\\nv`,
`cat /tmp/private\\.key`, `cat .e''nv`, `cat .e"n"v`, `cat<.e\\nv`) and that a backslash-newline
inside double quotes kept its newline. Both seats asked for complementary readings, and openai for
the parsed fallback to read the whole word list, not only the arguments.

What changed:

- `credentialMention(text)` now reads three representations and refuses on the first credential
  path in any of them, each cut at the same characters (whitespace, quotes, `<`, `>`, `|`, `;`,
  `&`, parentheses, backtick, `=`, `,`; a `-`-prefixed piece also without its `-x` prefix):
  1. the raw text with backslashes as path separators (a Windows path);
  2. the raw text with backslash-newline removed and every other backslash as an escape;
  3. every word `commandWords` builds from the whole segment — quotes joined and removed,
     escapes applied — so `cat<.e\\nv` becomes the word `cat<.env`, which the cut then splits.
- `commandWords`: a backslash-newline is a line continuation in both the unquoted and the
  double-quoted state and adds nothing; inside double quotes a backslash escapes only `$`,
  backtick, `"` and `\\`.
- Regressions: the seven forms above refuse; `cat .e''nv.example` and `cat notes\\.txt` pass.

The full module was in the fifth-pass prompt; the delta below is everything since.

For each defect report file:line, the failure scenario and a severity. Say whether each
fifth-pass finding is closed. State your stance (APPROVE or REQUEST_CHANGES) and the single
highest-leverage change.

```diff
diff --git a/src/scripts/_lib/credential_files.ts b/src/scripts/_lib/credential_files.ts
index c75ad7f81..e80e46c78 100644
--- a/src/scripts/_lib/credential_files.ts
+++ b/src/scripts/_lib/credential_files.ts
@@ -144,12 +144,17 @@ export function commandWords(segment: string): string[] {
             // Inside double quotes a backslash escapes only $ ` " \ and a newline.
             let j = i + 1;
             for (; j < segment.length && segment[j] !== '"'; j += 1) {
-                if (segment[j] === '\\' && j + 1 < segment.length && '$`"\\\n'.includes(segment[j + 1] as string)) j += 1;
+                if (segment[j] === '\\' && segment[j + 1] === '\n') {
+                    j += 1; // a line continuation: both characters go
+                    continue;
+                }
+                if (segment[j] === '\\' && j + 1 < segment.length && '$`"\\'.includes(segment[j + 1] as string)) j += 1;
                 word += segment[j];
             }
             i = j;
         } else if (ch === '\\' && i + 1 < segment.length) {
-            word += segment[i + 1];
+            // An escaped character joins the word; an escaped newline is a continuation and adds nothing.
+            if (segment[i + 1] !== '\n') word += segment[i + 1];
             i += 1;
         } else {
             word += ch;
@@ -182,7 +187,21 @@ const base = (w: string): string => w.replace(/^.*\//, '');
  * read as separators, so a Windows path is a path.
  */
 export function credentialMention(text: string): Verdict {
-    for (const raw of text.replace(/\\/g, '/').split(/[\s'"<>|;&()`=,]+/)) {
+    // Three readings of one segment, because neither alone matches the shell:
+    // the raw text with backslashes as path separators (a Windows path), the raw
+    // text with backslashes as shell escapes (`cat .e\nv`), and each word the
+    // shell would build (`cat .e''nv`, `cat<.e\nv`), every one cut at the same
+    // characters.
+    const readings = [text.replace(/\\/g, '/'), text.replace(/\\\n/g, '').replace(/\\(.)/g, '$1'), ...commandWords(text)];
+    for (const reading of readings) {
+        const v = mentionIn(reading);
+        if (v !== null) return v;
+    }
+    return null;
+}
+
+function mentionIn(text: string): Verdict {
+    for (const raw of text.split(/[\s'"<>|;&()`=,]+/)) {
         if (raw === '') continue;
         const candidates = raw.startsWith('-') ? [raw, raw.replace(/^-+[A-Za-z]?/, '')] : [raw];
         for (const c of candidates) {
@@ -195,7 +214,7 @@ export function credentialMention(text: string): Verdict {
 
 /** The first credential path among parsed words (each judged as raw text). */
 function credentialAmong(words: readonly string[]): Verdict {
-    return credentialMention(words.join(' '));
+    return credentialMention(words.map((w) => (/[\s'"\\]/.test(w) ? `'${w.replace(/'/g, '')}'` : w)).join(' '));
 }
 
 /**
diff --git a/tests/scripts/hooks/block_credential_reads.test.ts b/tests/scripts/hooks/block_credential_reads.test.ts
index 14099b6f7..b40b7029c 100644
--- a/tests/scripts/hooks/block_credential_reads.test.ts
+++ b/tests/scripts/hooks/block_credential_reads.test.ts
@@ -165,6 +165,23 @@ describe('the tool and command surface', () => {
         }
     });
 
+    it('reads escapes and quote joins the way the shell does (council round 4c, fifth pass)', () => {
+        for (const cmd of [
+            'cat .e\\nv',
+            'cat /tmp/private\\.key',
+            "cat .e''nv",
+            'cat .e"n"v',
+            'cat<.e\\nv',
+            'cat ".e\\\nnv"',
+            'cat .e\\\nnv',
+        ]) {
+            expect(run('Bash', { command: cmd }), JSON.stringify(cmd)).toBe(1);
+        }
+        for (const cmd of ["cat .e''nv.example", 'cat notes\\.txt']) {
+            expect(run('Bash', { command: cmd }), JSON.stringify(cmd)).toBe(0);
+        }
+    });
+
     it('a .pem counts only when a name token says key, and only an absolute /proc path is the environment', () => {
         expect(credentialFileClass('certs/monkey.pem')).toBeNull();
         expect(credentialFileClass('certs/secretary-ca.pem')).toBeNull();
```
