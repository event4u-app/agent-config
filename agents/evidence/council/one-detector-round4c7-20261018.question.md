<!-- evidence-type: analysis -->

<!-- A prompt given to the council on 2026-10-18 for branch drain/road-to-one-detector-and-the-senders-we-own-20261018b,
     round 4c, seventh pass, committed verbatim so the verdict recorded beside it can be checked
     against what was actually asked. Not edited after the run. -->

# Review branch drain/road-to-one-detector-and-the-senders-we-own-20261018b, round 4c seventh pass — two readings, words judged as data

A ratification decision under ADR-268 § 4 on a new `pre_tool_use` guard. Reviewed commit
`d431b9004`. The sixth pass (both seats REQUEST_CHANGES) found two false positives: the
second reading (the raw text with every backslash applied as an escape) ignored quoting, so
`cat ".e\\nv"` and `cat '.e\\nv'` — where the shell keeps the backslash and names another file —
were refused; and `credentialAmong` re-serialised parsed words and dropped apostrophes, so
`cat ".e'nv"` was refused.

What changed:

- The quote-blind escape reading is gone. `credentialMention(text)` now reads the raw text with
  backslashes as path separators, and every word `commandWords` builds (quotes joined, escapes
  applied only where the shell applies them).
- `credentialAmong(words)` judges each already-built word as data — it no longer joins and
  re-parses them — once as built and once with backslashes as separators.
- Regressions: every earlier bypass still refuses (the full suite, 25 cases, passes); the three
  sixth-pass false positives now pass.

The question for the decision: does the guard now refuse every bypass the earlier passes named
without refusing a file the shell does not open as a credential file? The full module was in the
fifth-pass prompt; the delta below is everything since the fifth pass.

For each defect report file:line, the failure scenario and a severity. Say whether each
sixth-pass finding is closed. State your stance (APPROVE or REQUEST_CHANGES) and the single
highest-leverage change.

```diff
diff --git a/src/scripts/_lib/credential_files.ts b/src/scripts/_lib/credential_files.ts
index e80e46c78..28ddf1ab6 100644
--- a/src/scripts/_lib/credential_files.ts
+++ b/src/scripts/_lib/credential_files.ts
@@ -187,12 +187,12 @@ const base = (w: string): string => w.replace(/^.*\//, '');
  * read as separators, so a Windows path is a path.
  */
 export function credentialMention(text: string): Verdict {
-    // Three readings of one segment, because neither alone matches the shell:
-    // the raw text with backslashes as path separators (a Windows path), the raw
-    // text with backslashes as shell escapes (`cat .e\nv`), and each word the
-    // shell would build (`cat .e''nv`, `cat<.e\nv`), every one cut at the same
-    // characters.
-    const readings = [text.replace(/\\/g, '/'), text.replace(/\\\n/g, '').replace(/\\(.)/g, '$1'), ...commandWords(text)];
+    // Two readings of one segment, because neither alone matches the shell: the
+    // raw text with backslashes as path separators (a Windows path, an attached
+    // `cat<.env`), and each word the shell would build — quotes joined, escapes
+    // applied only where the shell applies them (`cat .e''nv`, an unquoted
+    // `cat .e\nv`) — each cut at the same characters.
+    const readings = [text.replace(/\\/g, '/'), ...commandWords(text)];
     for (const reading of readings) {
         const v = mentionIn(reading);
         if (v !== null) return v;
@@ -212,9 +212,13 @@ function mentionIn(text: string): Verdict {
     return null;
 }
 
-/** The first credential path among parsed words (each judged as raw text). */
+/** The first credential path among words the shell already built — judged as data, never re-parsed. */
 function credentialAmong(words: readonly string[]): Verdict {
-    return credentialMention(words.map((w) => (/[\s'"\\]/.test(w) ? `'${w.replace(/'/g, '')}'` : w)).join(' '));
+    for (const w of words) {
+        const v = mentionIn(w) ?? mentionIn(w.replace(/\\/g, '/'));
+        if (v !== null) return v;
+    }
+    return null;
 }
 
 /**
diff --git a/tests/scripts/hooks/block_credential_reads.test.ts b/tests/scripts/hooks/block_credential_reads.test.ts
index b40b7029c..e19c2a68c 100644
--- a/tests/scripts/hooks/block_credential_reads.test.ts
+++ b/tests/scripts/hooks/block_credential_reads.test.ts
@@ -177,7 +177,9 @@ describe('the tool and command surface', () => {
         ]) {
             expect(run('Bash', { command: cmd }), JSON.stringify(cmd)).toBe(1);
         }
-        for (const cmd of ["cat .e''nv.example", 'cat notes\\.txt']) {
+        // A backslash the shell keeps (inside single quotes, or before an ordinary
+        // character inside double quotes) and a literal apostrophe name another file.
+        for (const cmd of ["cat .e''nv.example", 'cat notes\\.txt', 'cat ".e\\nv"', "cat '.e\\nv'", 'cat ".e\'nv"']) {
             expect(run('Bash', { command: cmd }), JSON.stringify(cmd)).toBe(0);
         }
     });
```
