<!-- evidence-type: analysis -->

<!-- A prompt given to the council on 2026-10-15 for branch drain/danger-gate-governs-20261015,
     round 4, committed verbatim so the verdict recorded beside it can be checked
     against what was actually asked. Not edited after the run. -->

# Modification review, round 4 — the bypass record and its reader, after round 3

Same change as rounds 1 to 3 (`danger-gate-bypass-closing-review-20261015.question.md`, `…-r2-…`, `…-r3-…`): a bypass of the ratification gate gets a record with a closing, and `check_platform_anchor` reads it. Gated files: `src/scripts/_lib/platform_anchor.ts`, `src/scripts/check_platform_anchor.ts`; the contract `docs/contracts/ratification-artifact.md` is also edited.

Round 3, two seats. Reviewer A: ratified; findings: the limits carry no evolution mechanism (low), no warning near the limits (low), a constant placed mid-file (trivial). Reviewer B: requested changes and gave no stance line; findings: (1) `lstat` then `readFile` reopens the path, so a symlink or oversized file swapped in between is read (medium); (2) record file names reach findings unsanitised, and U+2028/U+2029 survived the value sanitiser (low); (3) up to 200 `git ls-tree` processes per run (low).

What this delta does:

- (1) each record is opened once with `O_RDONLY | O_NOFOLLOW`, checked with `fstat` on that descriptor (regular file, at most 64 KiB) and read through the same descriptor with a hard byte ceiling; the descriptor is closed on every path.
- (2) one sanitiser, `printable`, replaces every control, format, line-separator and paragraph-separator character and bounds the length; it is applied to record names, to field values and to the quoted unreadable frontmatter line, and to the deleted-record finding. A new test passes a name containing `\n` and values containing U+2028/U+2029; it failed before the frontmatter-line fix and passes now.
- (3) the committed reviews come from one `git ls-tree -r -z HEAD -- agents/evidence/` per run, parsed into a set of regular-file paths (modes 100644 and 100755); a tree that cannot be read is an empty set, so every non-pending review fails closed.
- Not changed: the record directory is checked with `lstat` before it is listed, and the leaf is opened without following a link; a directory swapped for a link between those two steps is not defended against, because whoever can do that controls the checkout the check runs in, which the contract already names as the check's limit. Reviewer A's three findings are not taken: the limits are constants changed by an ordinary reviewed edit, and a warning near a limit would be output nobody reads on a check that is local and voluntarily invoked.
- The test file has 23 cases; all pass.

Answer each question below in order, by number, for the change as it now stands:

1. What behaviour changes, including what follows from it that the diff does not state?
2. Which authority or safety boundary becomes wider or narrower, and in which direction?
3. Does the change weaken anything that judges it — a test, a gate, a threshold, this review? The standard is quoted rather than paraphrased: the implementer never silently weakens an assertion, deletes, skips or xfails a failing test, lowers a threshold, or changes fixture semantics to fit the code. Does this change do any of those?
4. Is another host or projection left as a way around the control this change touches?
5. Can it be undone, and how — by whom, with what authority, and against which revision?
6. What observation would show the claimed benefit to be false, and what rollback / kill-switch criteria does the change omit?
7. Would a smaller change do, and what does the larger one buy that the smaller one does not?
8. What does it add to standing instruction weight that every later session pays?
9. Could untrusted content steer the path this change opens, and what bounds it if so?

For each defect, give file:line, the failure scenario and a severity. Then close with exactly one stance line of the form `STANCE: <label> | CONFIDENCE: <high|medium|low> | DEALBREAKER: <yes|no>`, where `<label>` is one of `ratified` (the change expands an authority and you approve it), `confirmed-non-expanding` (you approve it and it expands no authority) or `refused` (you do not approve it). A reply without that line counts as a seat that did not conclude.

The delta since round 3, complete for the three files, follows.

```diff
diff --git a/docs/contracts/ratification-artifact.md b/docs/contracts/ratification-artifact.md
index f8ced44e4..17a7d2a52 100644
--- a/docs/contracts/ratification-artifact.md
+++ b/docs/contracts/ratification-artifact.md
@@ -391,7 +391,10 @@ seven days after it, `restored_at` before `time` or in the future, a
 under `agents/evidence/` (an untracked file, a directory and a symbolic link do
 not count), a record or a record directory that cannot be read, a record that
 is a symbolic link or larger than 64 KiB, more than 200 records, and a record
-the diff deletes.
+the diff deletes. Each record is opened once without following a link, and
+checked and read through that one descriptor; the committed reviews are read
+from one `HEAD` tree listing per run; a record's name and values reach a finding
+with control and line-separator characters replaced.
 
 **What that check does not establish.** The records are files in the branch it
 runs on, so a branch can rewrite one to look closed; the check reads them, it
diff --git a/src/scripts/_lib/platform_anchor.ts b/src/scripts/_lib/platform_anchor.ts
index c97da1d1c..03e306993 100644
--- a/src/scripts/_lib/platform_anchor.ts
+++ b/src/scripts/_lib/platform_anchor.ts
@@ -1076,12 +1076,18 @@ export const BYPASS_RECORD_MAX_BYTES = 64 * 1024;
 
 const DAY_MS = 86_400_000;
 
-/** A value as it may appear inside a one-line finding: no control characters, bounded. */
-function shown(value: string): string {
-    const flat = value.replace(/\p{Cc}/gu, ' ');
-    return flat.length > 120 ? `${flat.slice(0, 117)}...` : flat;
+/**
+ * A value or a path as it may appear inside a one-line finding: no control,
+ * format, line- or paragraph-separator character, and bounded, so a record's
+ * content or name cannot forge a second line of output.
+ */
+export function printable(value: string): string {
+    const flat = value.replace(/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/gu, ' ');
+    return flat.length > 200 ? `${flat.slice(0, 197)}...` : flat;
 }
 
+const shown = printable;
+
 /** The nine fields every bypass record carries; `restored_at` and `council_review` may read `pending`. */
 export const BYPASS_RECORD_FIELDS = [
     'reason',
@@ -1158,7 +1164,7 @@ function bypassFields(text: string): Map<string, string> | string {
     for (const line of text.slice(4, end).split('\n')) {
         const m = /^([a-z_]+):[ \t]*(.*)$/u.exec(line);
         if (m === null) {
-            return `unreadable frontmatter line \`${line}\` — one \`key: value\` per line, nothing else`;
+            return `unreadable frontmatter line \`${printable(line)}\` — one \`key: value\` per line, nothing else`;
         }
         const key = m[1] as string;
         if (fields.has(key)) {
@@ -1194,7 +1200,8 @@ export function evaluateBypassRecords(
     const malformed = (p: string, why: string): void => {
         findings.push({ code: 'bypass-record-malformed', path: p, message: `${p} is not a readable bypass record — ${why}` });
     };
-    for (const { path: p, text } of records) {
+    for (const { path: rawPath, text } of records) {
+        const p = printable(rawPath);
         if (text === null) {
             findings.push({ code: 'bypass-record-unreadable', path: p, message: `${p} could not be read` });
             continue;
diff --git a/src/scripts/check_platform_anchor.ts b/src/scripts/check_platform_anchor.ts
index 68b970984..ed78359c6 100644
--- a/src/scripts/check_platform_anchor.ts
+++ b/src/scripts/check_platform_anchor.ts
@@ -51,6 +51,7 @@ import {
     checkAnchorIdentity,
     evaluateAnchor,
     evaluateBypassRecords,
+    printable,
     type BypassFinding,
     type BypassRecordInput,
     readAnchorPolicy,
@@ -188,19 +189,36 @@ export function readBypassRecords(root: string): BypassRecordInput[] {
     if (records.length > BYPASS_RECORD_LIMIT) {
         return [{ path: `${BYPASS_RECORD_DIR} (${String(records.length)} records, above ${String(BYPASS_RECORD_LIMIT)})`, text: null }];
     }
-    return records.map((n) => {
-        const rel = `${BYPASS_RECORD_DIR}/${n}`;
-        try {
-            // A symbolic link or an oversized file is not a record this reader trusts.
-            const st = fs.lstatSync(path.join(root, rel));
-            if (!st.isFile() || st.size > BYPASS_RECORD_MAX_BYTES) {
-                return { path: rel, text: null };
-            }
-            return { path: rel, text: fs.readFileSync(path.join(root, rel), 'utf8') };
-        } catch {
-            return { path: rel, text: null };
+    return records.map((n) => ({ path: `${BYPASS_RECORD_DIR}/${n}`, text: readRecordOnce(path.join(root, BYPASS_RECORD_DIR, n)) }));
+}
+
+/**
+ * One record, opened once without following a symbolic link, checked and read
+ * through that same descriptor with a byte ceiling — so the object checked is
+ * the object read, and a replacement between the two cannot slip in.
+ */
+function readRecordOnce(file: string): string | null {
+    let fd: number | null = null;
+    try {
+        fd = fs.openSync(file, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW ?? 0));
+        const st = fs.fstatSync(fd);
+        if (!st.isFile() || st.size > BYPASS_RECORD_MAX_BYTES) {
+            return null;
         }
-    });
+        const buf = Buffer.alloc(BYPASS_RECORD_MAX_BYTES + 1);
+        let total = 0;
+        for (;;) {
+            const read = fs.readSync(fd, buf, total, buf.length - total, null);
+            if (read === 0) break;
+            total += read;
+            if (total > BYPASS_RECORD_MAX_BYTES) return null;
+        }
+        return buf.subarray(0, total).toString('utf8');
+    } catch {
+        return null;
+    } finally {
+        if (fd !== null) fs.closeSync(fd);
+    }
 }
 
 /**
@@ -211,7 +229,7 @@ export function removedBypassRecords(changed: readonly string[], root: string):
     return changed
         .map((f) => f.replace(/\\/g, '/').trim())
         .filter((f) => f.startsWith(`${BYPASS_RECORD_DIR}/`) && f.endsWith('.md') && !fs.existsSync(path.join(root, f)))
-        .map((f) => ({ code: 'bypass-record-removed' as const, path: f, message: `${f} is deleted by this diff` }));
+        .map((f) => ({ code: 'bypass-record-removed' as const, path: printable(f), message: `${printable(f)} is deleted by this diff` }));
 }
 
 /**
@@ -219,14 +237,35 @@ export function removedBypassRecords(changed: readonly string[], root: string):
  * evidence tree — read from the commit's tree, never the working tree, so
  * a directory, an untracked file or a symbolic link does not count.
  */
-export function reviewCommitted(root: string, rel: string): boolean {
+export function reviewCommitted(root: string, rel: string, index: ReadonlySet<string> = committedEvidence(root)): boolean {
     const norm = path.posix.normalize(rel);
     if (norm !== rel || !norm.startsWith('agents/evidence/') || norm.endsWith('/') || norm.split('/').includes('..')) {
         return false;
     }
-    const r = spawnSync('git', ['-C', root, 'ls-tree', 'HEAD', '--', norm], { encoding: 'utf8' });
-    const entry = /^(\d{6}) blob [0-9a-f]+\t(.+)$/u.exec((r.stdout ?? '').trim());
-    return r.status === 0 && entry !== null && entry[2] === norm && (entry[1] === '100644' || entry[1] === '100755');
+    return index.has(norm);
+}
+
+/**
+ * Every regular file committed at `HEAD` in the evidence tree, read once
+ * per run from one tree snapshot. A tree that cannot be read is an empty set,
+ * so every non-pending review then fails closed.
+ */
+export function committedEvidence(root: string): Set<string> {
+    const r = spawnSync('git', ['-C', root, 'ls-tree', '-r', '-z', 'HEAD', '--', 'agents/evidence/'], {
+        encoding: 'utf8',
+        maxBuffer: 64 * 1024 * 1024,
+    });
+    const out = new Set<string>();
+    if (r.status !== 0 || typeof r.stdout !== 'string') {
+        return out;
+    }
+    for (const entry of r.stdout.split('\0')) {
+        const m = /^(100644|100755) blob [0-9a-f]+\t(.+)$/su.exec(entry);
+        if (m !== null) {
+            out.add(m[2] as string);
+        }
+    }
+    return out;
 }
 
 export interface AnchorGateResult {
@@ -441,8 +480,9 @@ export function main(argv: readonly string[] = process.argv.slice(2), source = l
     }
 
     const result = evaluateGate(changed, policyText, source, repo);
+    const evidenceIndex = committedEvidence(root);
     const open = [
-        ...evaluateBypassRecords(readBypassRecords(root), asOf(), (rel) => reviewCommitted(root, rel)),
+        ...evaluateBypassRecords(readBypassRecords(root), asOf(), (rel) => reviewCommitted(root, rel, evidenceIndex)),
         ...removedBypassRecords(changed, root),
     ];
     if (open.length > 0) {
```
