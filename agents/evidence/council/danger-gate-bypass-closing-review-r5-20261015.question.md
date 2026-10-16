<!-- evidence-type: analysis -->

<!-- A prompt given to the council on 2026-10-15 for branch drain/danger-gate-governs-20261015,
     round 5, committed verbatim so the verdict recorded beside it can be checked
     against what was actually asked. Not edited after the run. -->

# Modification review, round 5 — the bypass record and its reader, after round 4

Same change as rounds 1 to 4 (`danger-gate-bypass-closing-review-20261015.question.md` and the `-r2` to `-r4` prompts beside it): a bypass of the ratification gate gets a record with a closing, and `check_platform_anchor` reads it. Gated files: `src/scripts/_lib/platform_anchor.ts`, `src/scripts/check_platform_anchor.ts`; the contract `docs/contracts/ratification-artifact.md` is also edited.

Round 4, two seats. Reviewer A: confirmed-non-expanding, no finding above trivial. Reviewer B: requested changes and gave no stance line; findings: (1) `O_NOFOLLOW ?? 0` silently opened a record without the flag where the platform lacks it (medium); (2) the security regressions were not reviewable because the test file was omitted from the prompt (medium); (3) a throwing `closeSync` in `finally` turned a decided result into a crash (low).

What this delta does:

- (1) `readRecordOnce(file, noFollow = O_NOFOLLOW ?? null)`: a `null` flag returns no record, so on such a platform every record is unreadable and the check fails closed. A test passes `null` and gets no record, and shows a link is not followed with the flag.
- (3) `closeSync` is wrapped; its failure is ignored after the result was decided.
- (2) the complete test file, as it stands against the trunk, is appended below the source delta. 25 cases; all pass. Not covered, and stated: a file growing beyond 64 KiB between `fstat` and the read (the read loop stops at 64 KiB + 1 bytes and returns no record, but no test races a writer), and a count of `git ls-tree` invocations through `main()` (the code calls `committedEvidence` once before evaluation and passes the set in).

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

The source delta since round 4, then the whole test file as a diff against the trunk.

```diff
diff --git a/src/scripts/check_platform_anchor.ts b/src/scripts/check_platform_anchor.ts
index ed78359c6..02a02137e 100644
--- a/src/scripts/check_platform_anchor.ts
+++ b/src/scripts/check_platform_anchor.ts
@@ -197,10 +197,14 @@ export function readBypassRecords(root: string): BypassRecordInput[] {
  * through that same descriptor with a byte ceiling — so the object checked is
  * the object read, and a replacement between the two cannot slip in.
  */
-function readRecordOnce(file: string): string | null {
+export function readRecordOnce(file: string, noFollow: number | null = fs.constants.O_NOFOLLOW ?? null): string | null {
+    // Without O_NOFOLLOW the open would follow a link, so no record is trusted.
+    if (noFollow === null) {
+        return null;
+    }
     let fd: number | null = null;
     try {
-        fd = fs.openSync(file, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW ?? 0));
+        fd = fs.openSync(file, fs.constants.O_RDONLY | noFollow);
         const st = fs.fstatSync(fd);
         if (!st.isFile() || st.size > BYPASS_RECORD_MAX_BYTES) {
             return null;
@@ -217,7 +221,13 @@ function readRecordOnce(file: string): string | null {
     } catch {
         return null;
     } finally {
-        if (fd !== null) fs.closeSync(fd);
+        if (fd !== null) {
+            try {
+                fs.closeSync(fd);
+            } catch {
+                // The result was already decided; a failed close must not turn it into a crash.
+            }
+        }
     }
 }
 
```

```diff
diff --git a/tests/scripts/check_platform_anchor_open_bypass.test.ts b/tests/scripts/check_platform_anchor_open_bypass.test.ts
new file mode 100644
index 000000000..f7d3fdd4f
--- /dev/null
+++ b/tests/scripts/check_platform_anchor_open_bypass.test.ts
@@ -0,0 +1,247 @@
+import { spawnSync } from 'node:child_process';
+import * as fs from 'node:fs';
+import * as os from 'node:os';
+import * as path from 'node:path';
+
+import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
+
+import { BYPASS_RECORD_DIR, bypassInstant, evaluateBypassRecords } from '../../src/scripts/_lib/platform_anchor.js';
+import {
+    committedEvidence,
+    main,
+    readRecordOnce,
+    reviewCommitted,
+    type AnchorSource,
+} from '../../src/scripts/check_platform_anchor.js';
+
+/**
+ * A bypass of the ratification gate is the owner's route, and its record is
+ * the only trace it leaves. The check reds while one stays open at or past its
+ * `restore_by`, goes unreviewed seven days after it was restored, cannot be
+ * read, or is deleted — the ways the route can end without a closing.
+ */
+
+const NOW = new Date('2026-10-15T12:00:00Z');
+const REVIEW = 'agents/evidence/council/bypass-review.md';
+
+function record(fields: Partial<Record<string, string | null>> = {}, extra = ''): string {
+    const f: Record<string, string | null> = {
+        reason: 'recorded non-convergence of the modification review, owner asked in-session',
+        subject: 'a'.repeat(64),
+        time: '2026-10-10T09:00:00Z',
+        commit: 'b'.repeat(40),
+        ruleset_version_before: '49393554',
+        ruleset_version_after: '49500777',
+        restore_by: '2026-10-11T09:00:00Z',
+        restored_at: '2026-10-10T18:00:00Z',
+        council_review: REVIEW,
+        ...fields,
+    };
+    const lines = Object.entries(f)
+        .filter(([, v]) => v !== null)
+        .map(([k, v]) => `${k}: ${String(v)}`);
+    return ['---', ...lines, ...(extra === '' ? [] : [extra]), '---', '<!-- evidence-type: bypass-record -->', '', '# Bypass', ''].join('\n');
+}
+
+const one = (text: string | null, now = NOW) =>
+    evaluateBypassRecords([{ path: 'agents/evidence/bypass-records/x.md', text }], now, (rel) => rel === REVIEW);
+const codes = (text: string | null, now = NOW) => one(text, now).map((f) => f.code);
+
+describe('evaluateBypassRecords — an open bypass reds', () => {
+    it('a closed, reviewed bypass is quiet', () => {
+        expect(one(record())).toEqual([]);
+    });
+
+    it('at or past restore_by with no restored_at', () => {
+        expect(codes(record({ restored_at: 'pending', council_review: 'pending' }))).toEqual(['bypass-not-restored']);
+        expect(codes(record({ restored_at: 'pending', council_review: 'pending', restore_by: NOW.toISOString() }))).toEqual([
+            'bypass-not-restored',
+        ]);
+    });
+
+    it('not yet restored and still before restore_by is quiet', () => {
+        expect(one(record({ restored_at: 'pending', council_review: 'pending', restore_by: '2026-10-16T00:00:00Z' }))).toEqual([]);
+    });
+
+    it('restored, unreviewed, seven days on — the boundary included', () => {
+        expect(codes(record({ council_review: 'pending', restored_at: '2026-10-08T11:59:59Z', time: '2026-10-08T09:00:00Z' }))).toEqual([
+            'bypass-unreviewed',
+        ]);
+        expect(codes(record({ council_review: 'pending', restored_at: '2026-10-08T12:00:00Z', time: '2026-10-08T09:00:00Z' }))).toEqual([
+            'bypass-unreviewed',
+        ]);
+    });
+
+    it('restored, unreviewed, inside the seven days is quiet', () => {
+        expect(one(record({ council_review: 'pending', restored_at: '2026-10-10T12:00:01Z' }))).toEqual([]);
+    });
+});
+
+describe('evaluateBypassRecords — a record that cannot show it closed fails closed', () => {
+    it('each of the nine fields is required, the two open ones included', () => {
+        for (const key of ['reason', 'subject', 'time', 'commit', 'ruleset_version_before', 'ruleset_version_after', 'restore_by', 'restored_at', 'council_review']) {
+            expect(codes(record({ [key]: null })), key).toEqual(['bypass-record-malformed']);
+        }
+    });
+
+    it('a repeated key, an unknown key or a missing marker', () => {
+        expect(codes(record({}, 'restored_at: pending'))).toEqual(['bypass-record-malformed']);
+        expect(codes(record({}, 'note: anything'))).toEqual(['bypass-record-malformed']);
+        expect(codes(record().replace('<!-- evidence-type: bypass-record -->', ''))).toEqual(['bypass-record-malformed']);
+    });
+
+    it('an instant that is not ISO-8601 with a timezone, or not a real calendar date', () => {
+        expect(codes(record({ restore_by: 'tomorrow' }))).toEqual(['bypass-record-malformed']);
+        expect(codes(record({ restore_by: '2026-10-11T09:00:00' }))).toEqual(['bypass-record-malformed']);
+        expect(codes(record({ restore_by: '2026-02-30T09:00:00Z' }))).toEqual(['bypass-record-malformed']);
+        expect(bypassInstant('2026-02-28T23:30:00-02:00')).toBe(Date.parse('2026-03-01T01:30:00Z'));
+    });
+
+    it('impossible chronology: restore_by or restored_at before the bypass, restored_at in the future', () => {
+        expect(codes(record({ restore_by: '2026-10-09T00:00:00Z' }))).toEqual(['bypass-record-malformed']);
+        expect(codes(record({ restored_at: '2026-10-09T00:00:00Z' }))).toEqual(['bypass-record-malformed']);
+        expect(codes(record({ restored_at: '2026-12-01T00:00:00Z', council_review: 'pending' }))).toEqual(['bypass-record-malformed']);
+    });
+
+    it('a council review that names no committed file does not close the record', () => {
+        expect(codes(record({ council_review: 'x' }))).toEqual(['bypass-record-malformed']);
+    });
+
+    it('`pending` is accepted only for restored_at and council_review', () => {
+        expect(codes(record({ reason: 'pending' }))).toEqual(['bypass-record-malformed']);
+        expect(codes(record({ ruleset_version_after: 'pending' }))).toEqual(['bypass-record-malformed']);
+    });
+
+    it('restore_by more than seven days after the bypass', () => {
+        expect(codes(record({ restore_by: '2026-10-17T09:00:01Z', restored_at: 'pending', council_review: 'pending' }))).toEqual([
+            'bypass-record-malformed',
+        ]);
+        expect(one(record({ restore_by: '2026-10-17T09:00:00Z', restored_at: 'pending', council_review: 'pending' }))).toEqual([]);
+    });
+
+    it('a control character in a value does not reach the finding', () => {
+        const f = one(record({ council_review: 'x\u001b[2Jy' }));
+        expect(f[0]?.message).not.toMatch(/\p{Cc}/u);
+    });
+
+    it('a record name cannot forge a second line of output, nor can a separator in a value', () => {
+        const f = evaluateBypassRecords(
+            [{ path: `${BYPASS_RECORD_DIR}/x\n✅ fake.md`, text: record({ council_review: 'a\u2028b\u2029c' }) }],
+            NOW,
+            () => false,
+        );
+        expect(f[0]?.message).not.toMatch(new RegExp('[\\n\\u2028\\u2029]', 'u'));
+        expect(f[0]?.path).not.toMatch(/\n/u);
+    });
+
+    it('a record that could not be read', () => {
+        expect(codes(null)).toEqual(['bypass-record-unreadable']);
+    });
+});
+
+describe('check_platform_anchor reds on an open bypass, even on a diff it does not gate', () => {
+    let root: string;
+    const source: AnchorSource = { rulesets: () => null, defaultBranch: () => null };
+
+    beforeEach(() => {
+        root = fs.mkdtempSync(path.join(os.tmpdir(), 'open-bypass-'));
+        vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
+        vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
+        process.env['AC_AS_OF'] = NOW.toISOString();
+    });
+
+    afterEach(() => {
+        vi.restoreAllMocks();
+        delete process.env['AC_AS_OF'];
+        fs.rmSync(root, { recursive: true, force: true });
+    });
+
+    const run = (...files: string[]): number => main(['--files', ...files, '--root', root, '--repo', 'o/r'], source);
+    const put = (rel: string, text: string): void => {
+        fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
+        fs.writeFileSync(path.join(root, rel), text);
+    };
+
+    it('passes with no bypass record', () => {
+        expect(run()).toBe(0);
+    });
+
+    it('fails while a committed bypass record is open', () => {
+        put(`${BYPASS_RECORD_DIR}/open.md`, record({ restored_at: 'pending', council_review: 'pending' }));
+        expect(run()).toBe(1);
+    });
+
+    const git = (...args: string[]): void => {
+        const r = spawnSync('git', ['-C', root, ...args], {
+            encoding: 'utf8',
+            env: { ...process.env, GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@t', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@t' },
+        });
+        if (r.status !== 0) throw new Error(r.stderr);
+    };
+    const commitAll = (): void => {
+        git('add', '-A');
+        git('-c', 'core.hooksPath=/dev/null', 'commit', '-q', '-m', 'x');
+    };
+
+    it('passes once that record is closed and its review is committed', () => {
+        git('init', '-q');
+        put(`${BYPASS_RECORD_DIR}/closed.md`, record());
+        put(REVIEW, '# review\n');
+        commitAll();
+        expect(run()).toBe(0);
+    });
+
+    it('fails when the closed record names a review that is not there', () => {
+        put(`${BYPASS_RECORD_DIR}/closed.md`, record());
+        expect(run()).toBe(1);
+    });
+
+    it('a review that is untracked, a directory or a symbolic link does not count', () => {
+        git('init', '-q');
+        put('agents/evidence/seed.md', 'x\n');
+        commitAll();
+        put(REVIEW, '# review\n');
+        expect(reviewCommitted(root, REVIEW)).toBe(false);
+        expect(reviewCommitted(root, 'agents/evidence/council/')).toBe(false);
+        expect(reviewCommitted(root, 'agents/evidence/council')).toBe(false);
+        fs.rmSync(path.join(root, REVIEW));
+        fs.symlinkSync('/etc/hosts', path.join(root, REVIEW));
+        commitAll();
+        expect(reviewCommitted(root, REVIEW)).toBe(false);
+        expect(reviewCommitted(root, 'agents/evidence/seed.md')).toBe(true);
+        expect(reviewCommitted(root, 'agents/evidence/../evidence/seed.md')).toBe(false);
+    });
+
+    it('without O_NOFOLLOW no record is trusted, and a link is never followed with it', () => {
+        put('plain.md', 'x\n');
+        expect(readRecordOnce(path.join(root, 'plain.md'))).toBe('x\n');
+        expect(readRecordOnce(path.join(root, 'plain.md'), null)).toBeNull();
+        fs.symlinkSync(path.join(root, 'plain.md'), path.join(root, 'link.md'));
+        expect(readRecordOnce(path.join(root, 'link.md'))).toBeNull();
+    });
+
+    it('a tree that cannot be listed gives no committed review', () => {
+        put('agents/evidence/seed.md', 'x\n');
+        expect(committedEvidence(root).size).toBe(0);
+        expect(reviewCommitted(root, 'agents/evidence/seed.md')).toBe(false);
+    });
+
+    it('a record that is a symbolic link, or oversized, is read as unreadable', () => {
+        put('elsewhere.md', record({ restored_at: 'pending', council_review: 'pending', restore_by: '2026-10-16T00:00:00Z' }));
+        fs.mkdirSync(path.join(root, BYPASS_RECORD_DIR), { recursive: true });
+        fs.symlinkSync(path.join(root, 'elsewhere.md'), path.join(root, BYPASS_RECORD_DIR, 'link.md'));
+        expect(run()).toBe(1);
+        fs.rmSync(path.join(root, BYPASS_RECORD_DIR, 'link.md'));
+        put(`${BYPASS_RECORD_DIR}/big.md`, record({ restored_at: 'pending', council_review: 'pending', restore_by: '2026-10-16T00:00:00Z' }) + 'x'.repeat(70_000));
+        expect(run()).toBe(1);
+    });
+
+    it('fails when the record directory exists and cannot be listed', () => {
+        put(BYPASS_RECORD_DIR, 'not a directory');
+        expect(run()).toBe(1);
+    });
+
+    it('fails when the diff deletes a bypass record', () => {
+        expect(run(`${BYPASS_RECORD_DIR}/gone.md`)).toBe(1);
+    });
+});
```
