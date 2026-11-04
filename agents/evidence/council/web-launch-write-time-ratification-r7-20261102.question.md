<!-- evidence-type: original-review -->

# Ratification prompt, round 7 — web-launch write-time carrier and its chunk ceiling (verbatim, as sent 2026-11-02)

~~~text
Ratification review, round 7, of one change touching src/config/hook-bundle-budget.json, a file on this repository's ratification watched set.

subject: c8ed9c1350cc667c7623e4d5d4ea49e64ad0a6fcb63ea88e6853ee9980c82497

Closed verdicts (ADR-268 § 4): ratified (an approved expansion of what an agent may do) · confirmed-non-expanding (no authority expanded, no gate weakened, no enforcing step made non-enforcing) · refused (must not land).

Context: rounds 2 to 6 carried the change and its scanning functions (agents/evidence/council/web-launch-write-time-ratification-r{2,3,4,5,6}-20261102.question.md; round 6 carries the full diff since round 5). Round 6: the seats split, one confirmed-non-expanding with no dealbreaker, one refused with a dealbreaker. The points they named, and what this round does about each:

1. "The gt state variable bug means a file with an unclosed tag followed by closed tags will incorrectly mark all subsequent tags as unclosed." Not changed in the code; a test is added for the exact case. gt is the position of the first '>' at or after the current tag start, recomputed whenever it lies before that start. It is -1 only when text.indexOf('>', at) found no '>' in the rest of the text, so no later tag can be closed either. An unclosed tag followed by a closed one: the closed tag's start lies after the unclosed tag's start and before gt, so for the unclosed tag gt >= next (unclosed), and for the following tag gt is that tag's own '>' (closed). Test added: '<link ... href="https://fonts.googleapis.com/a"' unclosed on line 1, then '<script src="https://www.youtube.com/s.js"></script>' on line 2 — the script on line 2 is read as a load, and line 1 is reported as unread.
2. "The linear claim is only true for densely packed tags; sparse unclosed tags could be O(n × m)." Not changed in the code; a test is added. gt only moves forward: each indexOf starts at the current tag start, which is after the previous gt whenever it is recomputed, so all searches together read each character at most once. Test added, each shape about 1,000,000 characters through writeTimeFindings: ten unclosed <link> tags 100,000 characters apart, the same with one final '>', one unclosed <link> followed by 999,000 characters, and '<link ' repeated 166,000 times. Each under 500 ms (measured 0-52 ms). Sensitivity: with the forward-only condition replaced by a fresh indexOf from every tag start, the megabyte test fails at 2,562 ms; restored, it passes.
3. "Missing rollback criterion: maximum scan time for a 1MB file (should be <500ms, not validated)." Now validated by the test in 2.
4. "Smaller change: raise MAX_TAG to 50,000 instead of removing it." Not taken. A fixed window reintroduces the padding path round 5 named (pad past the window, the tag is skipped), only at a larger size; with the scan linear and the file capped at 1,000,000 characters (WEB_LAUNCH_MAX_CHARS, an over-cap file is reported as an unchecked gap), the window bounds nothing the cap does not.
5. "No explicit timeout on tagsOf()." Not added; the bound is the 1,000,000-character cap plus the linear scan, measured in 2.
6. "Adding a test for very large single unclosed tags would strengthen confidence." Added: the 999,000-character case in 2.

Current tagsOf (src/scripts/web_launch_third_party.ts), unchanged since round 6:
export function tagsOf(text: string): Tag[] {
    const starts: number[] = [0];
    for (let i = text.indexOf('\n'); i >= 0; i = text.indexOf('\n', i + 1)) starts.push(i + 1);
    const lineAt = (pos: number): number => { /* binary search over starts */ };
    const found = [...text.matchAll(TAG_START_RE)];
    const out: Tag[] = [];
    let gt = -2;
    found.forEach((m, k) => {
        const at = m.index ?? 0;
        if (gt !== -1 && gt < at) gt = text.indexOf('>', at);
        const next = found[k + 1]?.index ?? Number.POSITIVE_INFINITY;
        const name = (m[1] ?? '').toLowerCase();
        const closed = gt !== -1 && gt < next;
        out.push({ name, tag: closed ? text.slice(at, gt + 1) : '', line: lineAt(at), closed });
    });
    return out;
}

Diff since round 6 (src and tests; src is unchanged):
diff --git a/tests/scripts/web_launch_linear.test.ts b/tests/scripts/web_launch_linear.test.ts
index df95fe8a01..34d7c4a3c8 100644
--- a/tests/scripts/web_launch_linear.test.ts
+++ b/tests/scripts/web_launch_linear.test.ts
@@ -111,6 +111,21 @@ describe('a long tag is read, an unclosed one is never a silent pass (round-5 ra
         expect(c.undecided).toHaveLength(1);
     });
 
+    it('an unclosed tag before a closed one leaves the closed one read', () => {
+        const page = '<link rel="stylesheet" href="https://fonts.googleapis.com/a"\n<script src="https://www.youtube.com/s.js"></script>';
+        expect(loads('index.html', page)).toEqual(['2']);
+        expect(unread('index.html', page)).toEqual(['1']);
+    });
+
+    it('sparse unclosed tags in a megabyte file read the text once, with or without a final closer', () => {
+        const gap = 'x'.repeat(99_990);
+        const sparse = Array.from({ length: 10 }, () => `<link href=x${gap}`).join('');
+        const dense = '<link '.repeat(166_000);
+        for (const body of [sparse, `${sparse}>`, `<link href=x${'x'.repeat(999_000)}`, dense]) {
+            expect(timed(() => writeTimeFindings('index.html', body, register, table))).toBeLessThan(500);
+        }
+    });
+
     it('a page of unclosed link tags yields one hit, linearly', () => {
         const body = '<link rel=stylesheet href=x'.repeat(N / 28);
         expect(timed(() => expect(unread('index.html', body)).toHaveLength(1))).toBeLessThan(1_000);

Answer each of these, one at a time, keyed by number:
1. What behaviour changes, including what follows from it that the diff does not state?
2. Which authority or safety boundary becomes wider or narrower, and in which direction?
3. Does the change weaken anything that judges it — a test, a gate, a threshold, this review? The standard is quoted rather than paraphrased: the implementer never silently weakens an assertion, deletes, skips or xfails a failing test, lowers a threshold, or changes fixture semantics to fit the code. Does this change do any of those?
4. Is another host or projection left as a way around the control this change touches?
5. Can it be undone, and how — by whom, with what authority, and against which revision?
6. What observation would show the claimed benefit to be false, and what rollback / kill-switch criteria does the change omit?
7. Would a smaller change do, and what does the larger one buy that the smaller one does not?
8. What does it add to standing instruction weight that every later session pays?
9. Could untrusted content steer the path this change opens, and what bounds it if so?

Close with exactly one line, as the last line of your reply, in plain text: no markdown, no bold, no bullet, all three fields on that one line, separated by " | ", in this shape:
STANCE: <ratified|confirmed-non-expanding|refused> | CONFIDENCE: <high|med|low> | DEALBREAKER: <yes|no>
~~~
