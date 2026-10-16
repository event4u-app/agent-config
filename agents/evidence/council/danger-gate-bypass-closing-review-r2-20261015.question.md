<!-- evidence-type: analysis -->

<!-- A prompt given to the council on 2026-10-15 for branch drain/danger-gate-governs-20261015,
     round 2, committed verbatim so the verdict recorded beside it can be checked
     against what was actually asked. Not edited after the run. -->

# Modification review, round 2 — the bypass record and its reader, after round 1

Same change as round 1 (`danger-gate-bypass-closing-review-20261015.question.md`): a bypass of the ratification gate gets a record with a closing, and `check_platform_anchor` reads it. Gated files: `src/scripts/_lib/platform_anchor.ts`, `src/scripts/check_platform_anchor.ts`; the contract `docs/contracts/ratification-artifact.md` is also edited.

Round 1, two seats. Reviewer A: ratified, two low findings (a malformed record suppresses the timing findings; the quote-stripping regex is simple). Reviewer B: refused, findings: (1) an unreadable directory read as no records; (2) the checker trusts mutable branch-local files, no forge or protected ledger anchors them; (3) `restored_at` and `council_review` were optional; (4) any non-empty `council_review` closed the record; (5) no chronology validation, a future `restored_at` postpones review; (6) the frontmatter parser accepts duplicate keys and odd lines; (7) `Date.parse` accepts impossible dates such as February 30; (8) the check is local and voluntarily invoked; (9) `>` instead of `>=` at the deadlines; (10) the evidence-type marker is not checked; (11) test coverage for those cases; plus no size or count bound, symlinks, and record deletion.

What this delta does, per finding:

- (1) `ENOENT` is no records; any other directory error, and any record file that cannot be read, is a `bypass-record-unreadable` finding.
- (3) all nine fields are required; only `restored_at` and `council_review` may read the literal `pending`.
- (4) `council_review` must be `pending` or name a file that exists in the checkout under `agents/evidence/` with no `..`.
- (5) `restore_by` or `restored_at` before `time`, and `restored_at` after now, are malformed.
- (6) one `key: value` per line, lower-case keys only; a repeated key, an unknown key or any other line is malformed.
- (7) the instant's components are read back after parsing; a date the calendar does not have is malformed.
- (9) both deadlines use `>=`.
- (10) the marker must appear in the five lines after the frontmatter.
- record deletion: a `.md` path under the record directory that the diff names and that no longer exists is a `bypass-record-removed` finding.
- (11) the test file now has 17 cases; 11 of them failed against the round-1 code and pass now.
- Not changed, with the reason: (2) and (8) are the anchor's stated limit — the forge's ruleset history needs the repository `administration` permission, which no workflow token carries, and the acting account is an administrator, so the same party controls both sides; the contract now says in a paragraph "What that check does not establish" that a branch can rewrite a record to look closed and that the check makes a forgotten closing visible, not a dishonest one impossible. No size or count bound was added: records are owner-written, rare, and read from the local checkout. Reviewer A's first finding stands as designed: a malformed record is reported as malformed and its timing is not trusted.

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

The delta since round 1, complete for the three files, follows.

```diff
diff --git a/docs/contracts/ratification-artifact.md b/docs/contracts/ratification-artifact.md
index 0921515e8..69cfec8b2 100644
--- a/docs/contracts/ratification-artifact.md
+++ b/docs/contracts/ratification-artifact.md
@@ -379,11 +379,24 @@ token carries (`src/config/platform-anchor.json`, `enforcement_boundary_note`),
 while the version ids are what the anchor's own notes already cite for the
 2026-09-11 episode (`49393554` → `49500777`).
 
-`check_platform_anchor` reads every record on every run and fails while one is
-past `restore_by` with no `restored_at`, or restored with `council_review:
-pending` seven days on, or missing a field. That check is what the rest of the
-anchor is — **local and voluntarily invoked** — so an open bypass reds the next
-run that someone chooses to make, not the forge.
+All nine fields are required; only `restored_at` and `council_review` may read
+the literal `pending`. `check_platform_anchor` reads every record on every run
+and fails while one is at or past `restore_by` with `restored_at: pending`, or
+restored with `council_review: pending` seven days on. It fails closed on a
+record that cannot show it closed: a missing, repeated or unknown field, no
+marker, an instant that is not a real calendar instant with a timezone,
+`restore_by` or `restored_at` before `time`, `restored_at` in the future, a
+`council_review` that names no committed file under `agents/evidence/`, a
+record or a record directory that cannot be read, and a record the diff
+deletes.
+
+**What that check does not establish.** The records are files in the branch it
+runs on, so a branch can rewrite one to look closed; the check reads them, it
+does not verify them against the forge, which needs the `administration`
+permission no workflow token carries. And it is what the rest of the anchor is
+— **local and voluntarily invoked** — so an open bypass reds the next run that
+someone chooses to make, not the forge. It makes a forgotten closing visible;
+it does not make a dishonest one impossible.
 
 ### The measurement this section was written from
 
diff --git a/src/scripts/_lib/platform_anchor.ts b/src/scripts/_lib/platform_anchor.ts
index 35b447ac4..a7e449390 100644
--- a/src/scripts/_lib/platform_anchor.ts
+++ b/src/scripts/_lib/platform_anchor.ts
@@ -1058,10 +1058,13 @@ export function evaluateAnchor(
  */
 export const BYPASS_RECORD_DIR = 'agents/evidence/bypass-records';
 
+/** The marker every bypass record carries below its frontmatter. */
+export const BYPASS_RECORD_MARKER = '<!-- evidence-type: bypass-record -->';
+
 /** A review of a restored bypass is overdue this long after `restored_at`. */
 export const BYPASS_REVIEW_DAYS = 7;
 
-/** The fields every bypass record carries; `restored_at` and `council_review` may read `pending`. */
+/** The nine fields every bypass record carries; `restored_at` and `council_review` may read `pending`. */
 export const BYPASS_RECORD_FIELDS = [
     'reason',
     'subject',
@@ -1074,39 +1077,76 @@ export const BYPASS_RECORD_FIELDS = [
     'council_review',
 ] as const;
 
-const BYPASS_OPEN_FIELDS: ReadonlySet<string> = new Set(['restored_at', 'council_review']);
+export type BypassFindingCode =
+    | 'bypass-record-malformed'
+    | 'bypass-record-unreadable'
+    | 'bypass-record-removed'
+    | 'bypass-not-restored'
+    | 'bypass-unreviewed';
 
 export interface BypassFinding {
-    code: 'bypass-record-malformed' | 'bypass-not-restored' | 'bypass-unreviewed';
+    code: BypassFindingCode;
     path: string;
     message: string;
 }
 
-const INSTANT_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})$/u;
+/** One record as the caller found it: its text, or `null` when it could not be read. */
+export interface BypassRecordInput {
+    path: string;
+    text: string | null;
+}
+
+const INSTANT_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/u;
 
-function instant(value: string | undefined): number | null {
-    if (value === undefined || !INSTANT_RE.test(value)) {
+/**
+ * An ISO-8601 instant with a timezone, as epoch milliseconds — or `null` when
+ * the text is not one or names a date the calendar does not have. `Date.parse`
+ * alone would roll February 30 into March, so the components are read back.
+ */
+export function bypassInstant(value: string | undefined): number | null {
+    const m = value === undefined ? null : INSTANT_RE.exec(value);
+    if (m === null) {
         return null;
     }
-    const ms = Date.parse(value);
-    return Number.isNaN(ms) ? null : ms;
+    const ms = Date.parse(value as string);
+    if (Number.isNaN(ms)) {
+        return null;
+    }
+    const zone = m[7] as string;
+    const offset = zone === 'Z' ? 0 : (zone.startsWith('-') ? -1 : 1) * (Number(zone.slice(1, 3)) * 60 + Number(zone.slice(4, 6)));
+    const local = new Date(ms + offset * 60_000);
+    const same =
+        local.getUTCFullYear() === Number(m[1]) &&
+        local.getUTCMonth() + 1 === Number(m[2]) &&
+        local.getUTCDate() === Number(m[3]) &&
+        local.getUTCHours() === Number(m[4]) &&
+        local.getUTCMinutes() === Number(m[5]);
+    return same ? ms : null;
 }
 
-function bypassFields(text: string): Map<string, string> | null {
+/** The frontmatter's `key: value` lines, or a reason the block is not one. */
+function bypassFields(text: string): Map<string, string> | string {
     if (!text.startsWith('---\n')) {
-        return null;
+        return 'no frontmatter';
     }
-    const end = text.indexOf('\n---', 4);
+    const end = text.indexOf('\n---\n', 4);
     if (end === -1) {
-        return null;
+        return 'the frontmatter is not closed';
+    }
+    if (!text.slice(end + 5).split('\n').slice(0, 5).some((l) => l.trim() === BYPASS_RECORD_MARKER)) {
+        return `no \`${BYPASS_RECORD_MARKER}\` marker below the frontmatter`;
     }
     const fields = new Map<string, string>();
     for (const line of text.slice(4, end).split('\n')) {
-        const i = line.indexOf(':');
-        if (i <= 0) {
-            continue;
+        const m = /^([a-z_]+):[ \t]*(.*)$/u.exec(line);
+        if (m === null) {
+            return `unreadable frontmatter line \`${line}\` — one \`key: value\` per line, nothing else`;
+        }
+        const key = m[1] as string;
+        if (fields.has(key)) {
+            return `field \`${key}\` is recorded more than once`;
         }
-        fields.set(line.slice(0, i).trim(), line.slice(i + 1).trim().replace(/^(["'])(.*)\1$/u, '$2'));
+        fields.set(key, (m[2] as string).trim().replace(/^(["'])(.*)\1$/u, '$2'));
     }
     return fields;
 }
@@ -1114,59 +1154,82 @@ function bypassFields(text: string): Map<string, string> | null {
 /**
  * The bypass records that leave the route without a closing.
  *
- * Two findings, each the absence of a step the contract makes the record's
- * job: still open past `restore_by` (no `restored_at`), and restored with no
- * council review recorded {@link BYPASS_REVIEW_DAYS} days later. A record
- * missing one of the owner's fields, or carrying an instant that does not
- * parse, is a finding too: an unreadable record cannot show it closed.
+ * Read fail-closed: a record that cannot be read, lacks one of the nine
+ * fields, repeats a key, carries an instant that is not a real calendar
+ * instant with a timezone, puts `restore_by` or `restored_at` before the
+ * bypass or `restored_at` after `now`, or names a council review that does not
+ * exist is `bypass-record-malformed` — an unreadable record cannot show it
+ * closed. Of the readable ones: still open at or after `restore_by` is
+ * `bypass-not-restored`; restored with `council_review: pending`
+ * {@link BYPASS_REVIEW_DAYS} days on is `bypass-unreviewed`.
+ *
+ * `reviewExists` answers whether a `council_review` path names a committed
+ * file; it is injected so this module stays free of I/O.
  */
 export function evaluateBypassRecords(
-    records: readonly { path: string; text: string }[],
+    records: readonly BypassRecordInput[],
     now: Date,
+    reviewExists: (rel: string) => boolean = () => false,
 ): BypassFinding[] {
     const findings: BypassFinding[] = [];
     const t = now.getTime();
+    const malformed = (p: string, why: string): void => {
+        findings.push({ code: 'bypass-record-malformed', path: p, message: `${p} is not a readable bypass record — ${why}` });
+    };
     for (const { path: p, text } of records) {
+        if (text === null) {
+            findings.push({ code: 'bypass-record-unreadable', path: p, message: `${p} could not be read` });
+            continue;
+        }
         const f = bypassFields(text);
-        const missing =
-            f === null
-                ? ['frontmatter']
-                : BYPASS_RECORD_FIELDS.filter((k) => !BYPASS_OPEN_FIELDS.has(k) && (f.get(k) ?? '') === '');
-        const restoredRaw = f?.get('restored_at') ?? 'pending';
-        const restoredOpen = restoredRaw === '' || restoredRaw === 'pending';
-        const restored = restoredOpen ? null : instant(restoredRaw);
-        const restoreBy = instant(f?.get('restore_by'));
-        if (
-            f === null ||
-            missing.length > 0 ||
-            !/^[0-9a-f]{64}$/u.test(f.get('subject') ?? '') ||
-            !/^[0-9a-f]{40}$/u.test(f.get('commit') ?? '') ||
-            instant(f.get('time')) === null ||
-            restoreBy === null ||
-            (restored === null && !restoredOpen)
-        ) {
-            findings.push({
-                code: 'bypass-record-malformed',
-                path: p,
-                message:
-                    `${p} is not a readable bypass record — it needs ${BYPASS_RECORD_FIELDS.join(', ')}, ` +
-                    'a 64-hex `subject`, a 40-hex `commit`, and ISO-8601 instants with a timezone' +
-                    (missing.length > 0 ? ` (missing: ${missing.join(', ')})` : ''),
-            });
+        if (typeof f === 'string') {
+            malformed(p, f);
+            continue;
+        }
+        const missing = BYPASS_RECORD_FIELDS.filter((k) => (f.get(k) ?? '') === '');
+        const unknown = [...f.keys()].filter((k) => !(BYPASS_RECORD_FIELDS as readonly string[]).includes(k));
+        if (missing.length > 0 || unknown.length > 0) {
+            malformed(
+                p,
+                [missing.length > 0 ? `missing: ${missing.join(', ')}` : '', unknown.length > 0 ? `unknown: ${unknown.join(', ')}` : '']
+                    .filter((s) => s !== '')
+                    .join('; '),
+            );
+            continue;
+        }
+        const time = bypassInstant(f.get('time'));
+        const restoreBy = bypassInstant(f.get('restore_by'));
+        const restoredRaw = f.get('restored_at') as string;
+        const restored = restoredRaw === 'pending' ? null : bypassInstant(restoredRaw);
+        const review = f.get('council_review') as string;
+        const problem = !/^[0-9a-f]{64}$/u.test(f.get('subject') ?? '')
+            ? '`subject` is not a 64-hex digest'
+            : !/^[0-9a-f]{40}$/u.test(f.get('commit') ?? '')
+              ? '`commit` is not a full 40-hex revision'
+              : time === null || restoreBy === null || (restored === null && restoredRaw !== 'pending')
+                ? 'an instant is not ISO-8601 with a timezone, or names a date the calendar does not have'
+                : restoreBy < time
+                  ? '`restore_by` is before the bypass'
+                  : restored !== null && (restored < time || restored > t)
+                    ? '`restored_at` is before the bypass or in the future'
+                    : review !== 'pending' && !reviewExists(review)
+                      ? `\`council_review\` names \`${review}\`, which is not a committed file`
+                      : null;
+        if (problem !== null || time === null || restoreBy === null) {
+            malformed(p, problem ?? 'unreadable instant');
             continue;
         }
         if (restored === null) {
-            if (t > restoreBy) {
+            if (t >= restoreBy) {
                 findings.push({
                     code: 'bypass-not-restored',
                     path: p,
-                    message: `${p}: the bypass is past \`restore_by\` ${String(f.get('restore_by'))} and records no \`restored_at\``,
+                    message: `${p}: the bypass is at or past \`restore_by\` ${String(f.get('restore_by'))} and records no \`restored_at\``,
                 });
             }
             continue;
         }
-        const review = f.get('council_review') ?? '';
-        if ((review === '' || review === 'pending') && t > restored + BYPASS_REVIEW_DAYS * 86_400_000) {
+        if (review === 'pending' && t >= restored + BYPASS_REVIEW_DAYS * 86_400_000) {
             findings.push({
                 code: 'bypass-unreviewed',
                 path: p,
diff --git a/src/scripts/check_platform_anchor.ts b/src/scripts/check_platform_anchor.ts
index 60d169a7b..bc484f92c 100644
--- a/src/scripts/check_platform_anchor.ts
+++ b/src/scripts/check_platform_anchor.ts
@@ -49,6 +49,8 @@ import {
     checkAnchorIdentity,
     evaluateAnchor,
     evaluateBypassRecords,
+    type BypassFinding,
+    type BypassRecordInput,
     readAnchorPolicy,
     readWaivers,
     type AnchorReading,
@@ -168,22 +170,45 @@ export function touchesPolicy(files: readonly string[]): boolean {
  * open bypass is a fact about the repository, not about the change under test.
  * A directory that cannot be read is no records, never a failure of the gate.
  */
-export function readBypassRecords(root: string): { path: string; text: string }[] {
+export function readBypassRecords(root: string): BypassRecordInput[] {
     let names: string[];
     try {
         names = fs.readdirSync(path.join(root, BYPASS_RECORD_DIR));
-    } catch {
-        return [];
+    } catch (err) {
+        // No directory means no bypass was ever recorded. Any other failure is
+        // a directory that exists and cannot be read, which shows nothing closed.
+        return (err as NodeJS.ErrnoException).code === 'ENOENT' ? [] : [{ path: BYPASS_RECORD_DIR, text: null }];
     }
     return names
         .filter((n) => n.endsWith('.md'))
         .sort()
         .map((n) => {
             const rel = `${BYPASS_RECORD_DIR}/${n}`;
-            return { path: rel, text: fs.readFileSync(path.join(root, rel), 'utf8') };
+            try {
+                return { path: rel, text: fs.readFileSync(path.join(root, rel), 'utf8') };
+            } catch {
+                return { path: rel, text: null };
+            }
         });
 }
 
+/**
+ * Bypass records the diff deletes. A record is the route's only trace, so
+ * removing one on a branch is a finding of its own rather than a quiet green.
+ */
+export function removedBypassRecords(changed: readonly string[], root: string): BypassFinding[] {
+    return changed
+        .map((f) => f.replace(/\\/g, '/').trim())
+        .filter((f) => f.startsWith(`${BYPASS_RECORD_DIR}/`) && f.endsWith('.md') && !fs.existsSync(path.join(root, f)))
+        .map((f) => ({ code: 'bypass-record-removed' as const, path: f, message: `${f} is deleted by this diff` }));
+}
+
+/** A `council_review` path names a committed evidence file inside the checkout. */
+function reviewExists(root: string, rel: string): boolean {
+    const norm = path.posix.normalize(rel);
+    return norm.startsWith('agents/evidence/') && !norm.includes('..') && fs.existsSync(path.join(root, norm));
+}
+
 export interface AnchorGateResult {
     exitCode: 0 | 1;
     lines: string[];
@@ -396,7 +421,10 @@ export function main(argv: readonly string[] = process.argv.slice(2), source = l
     }
 
     const result = evaluateGate(changed, policyText, source, repo);
-    const open = evaluateBypassRecords(readBypassRecords(root), asOf());
+    const open = [
+        ...evaluateBypassRecords(readBypassRecords(root), asOf(), (rel) => reviewExists(root, rel)),
+        ...removedBypassRecords(changed, root),
+    ];
     if (open.length > 0) {
         result.lines.push('', `❌  ${String(open.length)} bypass record(s) without a closing:`);
         for (const f of open) {
```
