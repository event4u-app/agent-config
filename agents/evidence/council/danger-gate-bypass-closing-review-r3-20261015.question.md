<!-- evidence-type: analysis -->

<!-- A prompt given to the council on 2026-10-15 for branch drain/danger-gate-governs-20261015,
     round 3, committed verbatim so the verdict recorded beside it can be checked
     against what was actually asked. Not edited after the run. -->

# Modification review, round 3 — the bypass record and its reader, after round 2

Same change as rounds 1 and 2 (`danger-gate-bypass-closing-review-20261015.question.md`, `…-r2-…`): a bypass of the ratification gate gets a record with a closing, and `check_platform_anchor` reads it. Gated files: `src/scripts/_lib/platform_anchor.ts`, `src/scripts/check_platform_anchor.ts`; the contract `docs/contracts/ratification-artifact.md` is also edited.

Round 2, two seats. Reviewer A: ratified; findings: symlinks pass the review-path check (medium), no record count or size bound (low), the same party creates and closes (acknowledged), no ceiling on `restore_by` (medium), unsanitised values in findings (low), a deleted record reported on every future run (low). Reviewer B: refused; findings: (1) any existing directory or untracked file satisfied `council_review` (high); (2) symlinks escape the evidence boundary for review and record files (medium); (3) `pending` was accepted in fields other than the two open ones (low); (4) no count or size bound (low).

What this delta does:

- `council_review` must be a regular file (mode 100644 or 100755) committed at `HEAD` under `agents/evidence/`, read with `git ls-tree HEAD -- <path>` — never the working tree — so an untracked file, a directory and a symbolic link (mode 120000) do not count. The path must equal its normalised form and contain no `..`.
- A record file that is a symbolic link or not a regular file, larger than 64 KiB, or one of more than 200 records, is read as unreadable; a record directory that is not a directory (a symlink included) is unreadable.
- `pending` in any field other than `restored_at` and `council_review` is a missing field.
- `restore_by` more than seven days after `time` is malformed.
- Values that reach a finding have control characters replaced and are cut at 120 characters.
- The deleted-record finding fires only for a path the current diff against the base deletes, so it does not persist after merge; not changed.
- Not changed, as stated in round 2: the records are branch-local and the check is local and voluntarily invoked; the contract says so, and that it makes a forgotten closing visible, not a dishonest one impossible.
- The test file has 22 cases; the 5 new ones failed against the round-2 code (4 of them through the evaluator, and the review-path case through the missing export) and all 22 pass.

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

For each defect, give file:line, the failure scenario and a severity. Then close with exactly one stance line of the form `STANCE: <label> | CONFIDENCE: <high|medium|low> | DEALBREAKER: <yes|no>`, where `<label>` is one of `ratified` (the change expands an authority and you approve it), `confirmed-non-expanding` (you approve it and it expands no authority) or `refused` (you do not approve it).

The delta since round 2, complete for the three files, follows.

```diff
diff --git a/docs/contracts/ratification-artifact.md b/docs/contracts/ratification-artifact.md
index 69cfec8b2..f8ced44e4 100644
--- a/docs/contracts/ratification-artifact.md
+++ b/docs/contracts/ratification-artifact.md
@@ -383,12 +383,15 @@ All nine fields are required; only `restored_at` and `council_review` may read
 the literal `pending`. `check_platform_anchor` reads every record on every run
 and fails while one is at or past `restore_by` with `restored_at: pending`, or
 restored with `council_review: pending` seven days on. It fails closed on a
-record that cannot show it closed: a missing, repeated or unknown field, no
-marker, an instant that is not a real calendar instant with a timezone,
-`restore_by` or `restored_at` before `time`, `restored_at` in the future, a
-`council_review` that names no committed file under `agents/evidence/`, a
-record or a record directory that cannot be read, and a record the diff
-deletes.
+record that cannot show it closed: a missing, repeated or unknown field, a
+`pending` anywhere but the two open fields, no marker, an instant that is not a
+real calendar instant with a timezone, `restore_by` before `time` or more than
+seven days after it, `restored_at` before `time` or in the future, a
+`council_review` that names anything but a regular file committed at `HEAD`
+under `agents/evidence/` (an untracked file, a directory and a symbolic link do
+not count), a record or a record directory that cannot be read, a record that
+is a symbolic link or larger than 64 KiB, more than 200 records, and a record
+the diff deletes.
 
 **What that check does not establish.** The records are files in the branch it
 runs on, so a branch can rewrite one to look closed; the check reads them, it
diff --git a/src/scripts/_lib/platform_anchor.ts b/src/scripts/_lib/platform_anchor.ts
index a7e449390..c97da1d1c 100644
--- a/src/scripts/_lib/platform_anchor.ts
+++ b/src/scripts/_lib/platform_anchor.ts
@@ -1064,6 +1064,24 @@ export const BYPASS_RECORD_MARKER = '<!-- evidence-type: bypass-record -->';
 /** A review of a restored bypass is overdue this long after `restored_at`. */
 export const BYPASS_REVIEW_DAYS = 7;
 
+/**
+ * `restore_by` may lie at most this long after the bypass. Without a ceiling a
+ * record could set it years ahead and stay open, quietly, for good.
+ */
+export const BYPASS_MAX_OPEN_DAYS = 7;
+
+/** More records than this, or a record larger than this, is read as unreadable. */
+export const BYPASS_RECORD_LIMIT = 200;
+export const BYPASS_RECORD_MAX_BYTES = 64 * 1024;
+
+const DAY_MS = 86_400_000;
+
+/** A value as it may appear inside a one-line finding: no control characters, bounded. */
+function shown(value: string): string {
+    const flat = value.replace(/\p{Cc}/gu, ' ');
+    return flat.length > 120 ? `${flat.slice(0, 117)}...` : flat;
+}
+
 /** The nine fields every bypass record carries; `restored_at` and `council_review` may read `pending`. */
 export const BYPASS_RECORD_FIELDS = [
     'reason',
@@ -1186,7 +1204,9 @@ export function evaluateBypassRecords(
             malformed(p, f);
             continue;
         }
-        const missing = BYPASS_RECORD_FIELDS.filter((k) => (f.get(k) ?? '') === '');
+        const missing = BYPASS_RECORD_FIELDS.filter(
+            (k) => (f.get(k) ?? '') === '' || (f.get(k) === 'pending' && k !== 'restored_at' && k !== 'council_review'),
+        );
         const unknown = [...f.keys()].filter((k) => !(BYPASS_RECORD_FIELDS as readonly string[]).includes(k));
         if (missing.length > 0 || unknown.length > 0) {
             malformed(
@@ -1208,12 +1228,12 @@ export function evaluateBypassRecords(
               ? '`commit` is not a full 40-hex revision'
               : time === null || restoreBy === null || (restored === null && restoredRaw !== 'pending')
                 ? 'an instant is not ISO-8601 with a timezone, or names a date the calendar does not have'
-                : restoreBy < time
-                  ? '`restore_by` is before the bypass'
+                : restoreBy < time || restoreBy - time > BYPASS_MAX_OPEN_DAYS * DAY_MS
+                  ? `\`restore_by\` is before the bypass or more than ${String(BYPASS_MAX_OPEN_DAYS)} days after it`
                   : restored !== null && (restored < time || restored > t)
                     ? '`restored_at` is before the bypass or in the future'
                     : review !== 'pending' && !reviewExists(review)
-                      ? `\`council_review\` names \`${review}\`, which is not a committed file`
+                      ? `\`council_review\` names \`${shown(review)}\`, which is not a committed regular file`
                       : null;
         if (problem !== null || time === null || restoreBy === null) {
             malformed(p, problem ?? 'unreadable instant');
@@ -1224,12 +1244,12 @@ export function evaluateBypassRecords(
                 findings.push({
                     code: 'bypass-not-restored',
                     path: p,
-                    message: `${p}: the bypass is at or past \`restore_by\` ${String(f.get('restore_by'))} and records no \`restored_at\``,
+                    message: `${p}: the bypass is at or past \`restore_by\` ${shown(String(f.get('restore_by')))} and records no \`restored_at\``,
                 });
             }
             continue;
         }
-        if (review === 'pending' && t >= restored + BYPASS_REVIEW_DAYS * 86_400_000) {
+        if (review === 'pending' && t >= restored + BYPASS_REVIEW_DAYS * DAY_MS) {
             findings.push({
                 code: 'bypass-unreviewed',
                 path: p,
diff --git a/src/scripts/check_platform_anchor.ts b/src/scripts/check_platform_anchor.ts
index bc484f92c..68b970984 100644
--- a/src/scripts/check_platform_anchor.ts
+++ b/src/scripts/check_platform_anchor.ts
@@ -46,6 +46,8 @@ import { asOf } from './_lib/as_of.js';
 import { GateLedger } from './_lib/gate_ledger.js';
 import {
     BYPASS_RECORD_DIR,
+    BYPASS_RECORD_LIMIT,
+    BYPASS_RECORD_MAX_BYTES,
     checkAnchorIdentity,
     evaluateAnchor,
     evaluateBypassRecords,
@@ -173,23 +175,32 @@ export function touchesPolicy(files: readonly string[]): boolean {
 export function readBypassRecords(root: string): BypassRecordInput[] {
     let names: string[];
     try {
+        if (!fs.lstatSync(path.join(root, BYPASS_RECORD_DIR)).isDirectory()) {
+            return [{ path: BYPASS_RECORD_DIR, text: null }];
+        }
         names = fs.readdirSync(path.join(root, BYPASS_RECORD_DIR));
     } catch (err) {
         // No directory means no bypass was ever recorded. Any other failure is
         // a directory that exists and cannot be read, which shows nothing closed.
         return (err as NodeJS.ErrnoException).code === 'ENOENT' ? [] : [{ path: BYPASS_RECORD_DIR, text: null }];
     }
-    return names
-        .filter((n) => n.endsWith('.md'))
-        .sort()
-        .map((n) => {
-            const rel = `${BYPASS_RECORD_DIR}/${n}`;
-            try {
-                return { path: rel, text: fs.readFileSync(path.join(root, rel), 'utf8') };
-            } catch {
+    const records = names.filter((n) => n.endsWith('.md')).sort();
+    if (records.length > BYPASS_RECORD_LIMIT) {
+        return [{ path: `${BYPASS_RECORD_DIR} (${String(records.length)} records, above ${String(BYPASS_RECORD_LIMIT)})`, text: null }];
+    }
+    return records.map((n) => {
+        const rel = `${BYPASS_RECORD_DIR}/${n}`;
+        try {
+            // A symbolic link or an oversized file is not a record this reader trusts.
+            const st = fs.lstatSync(path.join(root, rel));
+            if (!st.isFile() || st.size > BYPASS_RECORD_MAX_BYTES) {
                 return { path: rel, text: null };
             }
-        });
+            return { path: rel, text: fs.readFileSync(path.join(root, rel), 'utf8') };
+        } catch {
+            return { path: rel, text: null };
+        }
+    });
 }
 
 /**
@@ -203,10 +214,19 @@ export function removedBypassRecords(changed: readonly string[], root: string):
         .map((f) => ({ code: 'bypass-record-removed' as const, path: f, message: `${f} is deleted by this diff` }));
 }
 
-/** A `council_review` path names a committed evidence file inside the checkout. */
-function reviewExists(root: string, rel: string): boolean {
+/**
+ * A `council_review` path names a regular file committed at `HEAD` inside the
+ * evidence tree — read from the commit's tree, never the working tree, so
+ * a directory, an untracked file or a symbolic link does not count.
+ */
+export function reviewCommitted(root: string, rel: string): boolean {
     const norm = path.posix.normalize(rel);
-    return norm.startsWith('agents/evidence/') && !norm.includes('..') && fs.existsSync(path.join(root, norm));
+    if (norm !== rel || !norm.startsWith('agents/evidence/') || norm.endsWith('/') || norm.split('/').includes('..')) {
+        return false;
+    }
+    const r = spawnSync('git', ['-C', root, 'ls-tree', 'HEAD', '--', norm], { encoding: 'utf8' });
+    const entry = /^(\d{6}) blob [0-9a-f]+\t(.+)$/u.exec((r.stdout ?? '').trim());
+    return r.status === 0 && entry !== null && entry[2] === norm && (entry[1] === '100644' || entry[1] === '100755');
 }
 
 export interface AnchorGateResult {
@@ -422,7 +442,7 @@ export function main(argv: readonly string[] = process.argv.slice(2), source = l
 
     const result = evaluateGate(changed, policyText, source, repo);
     const open = [
-        ...evaluateBypassRecords(readBypassRecords(root), asOf(), (rel) => reviewExists(root, rel)),
+        ...evaluateBypassRecords(readBypassRecords(root), asOf(), (rel) => reviewCommitted(root, rel)),
         ...removedBypassRecords(changed, root),
     ];
     if (open.length > 0) {
```
