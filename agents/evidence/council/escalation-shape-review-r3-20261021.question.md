<!-- evidence-type: analysis -->

<!-- A prompt given to the council on 2026-10-21 for branch drain/self-modification-20261021,
     round 3, committed verbatim so the verdict recorded beside it can be checked
     against what was actually asked. Not edited after the run. The 2026-10-18
     round-3 prompt beside it was sent and answered by neither seat (the local
     CLI quota counter read exhausted); the diff is unchanged since, and this is
     that round, sent once more. -->

# Review branch drain/self-modification-20261021, round 3 — the ratification gate prints the user's question

Step 5.2 of `road-to-self-modification-that-a-council-must-pass`. It changes `src/scripts/check_kernel_edit_ratified.ts` (the ratification gate itself, gated), two paragraphs of `docs/contracts/ratification-artifact.md` (not gated) and one test file.

The gate prints the contract's "one question for the user" block (`escalationMessage`) on a `refused` or `non-convergent` record, on a record whose only problem is `diversity-required`, and on a change to the ratification mechanism (`gated.self`) that carries a council answer — `ratified`, `confirmed-non-expanding`, or a non-passing one. It fills in the verdict, non-passing seats and gated paths and asks for gain, risk and rollback. An `advisory:` line states that this exit code does not carry the decision and that the merge gate classes these paths `needs-owner`. Authoring defects (no record, stale subject, self-ratified) stay silent, on mechanism paths too. Exit codes are unchanged on every path.

Round 1 refused 2/2 (unqualified "the user decides" over exit 0; `gated.self` escalating authoring defects; raw record text in CI output) — fixed as above. Round 2 refused 2/2 on one point: `printable` used a range list that missed U+061C, U+2028, U+2029 and other Bidi_Control characters, and its test only checked characters from its own list; round 2 also asked whether `confirmed-non-expanding` on the reviewer escalates, and suggested an integration test for the `needs-owner` claim. This round:

- `printable` escapes `/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/gu` (`Cf` contains every Bidi_Control code point), exported as `UNPRINTABLE_RE`. The test feeds code points chosen outside the old list (C0, DEL, C1, U+061C, U+200B, U+200D, U+2028, U+2029, embeddings, overrides, all four isolates, U+FEFF) through every interpolated field, asserts none appears in any output line, and walks every code point to confirm each member of the class is escaped. Reverting to the old range list turns it red. A second test shows ordinary non-Latin text is left alone.
- A test shows a `confirmed-non-expanding` record on `SELF_PATH` escalates with exit 0.
- A test asserts every path `isMechanismPath` accepts is `needs-owner` under `classify_merge_risk.classifyChanges`.

The subject digest of this diff's gated content at `2f69d5077` (the same commits cherry-picked onto the current base; the gated file is byte-identical, and the contract hunk below keeps the 2026-10-18 base's line offsets while its added lines are unchanged) is `7f908906aa1e8a3b1f668da0e5a9c89fd5fb40f12c05f4eae4f6195b46366b29`, covering `src/scripts/check_kernel_edit_ratified.ts`.

Answer, for this diff: what behaviour changes, including what follows from it; which authority or safety boundary becomes wider or narrower; whether the change weakens anything that judges it — a test, a gate, a threshold, this review; whether another host or projection is left as a way around it; whether it can be undone and how; what observation would show the claimed benefit to be false; whether a smaller change would do; what it adds to standing instruction weight; whether untrusted content could steer the path.

Report any defect with file:line, the failure scenario and a severity. Close with exactly one stance line: `ratified`, `confirmed-non-expanding`, or `refused`.

```diff
diff --git a/docs/contracts/ratification-artifact.md b/docs/contracts/ratification-artifact.md
index d8d27c92d..edbab2665 100644
--- a/docs/contracts/ratification-artifact.md
+++ b/docs/contracts/ratification-artifact.md
@@ -725,6 +725,28 @@ recommendation, the dissent, the exact change, what it is expected to gain,
 what it risks, and how it is undone. A run never decides such a case alone,
 and a subagent fan-out is never a substitute for the council here.
 
+`check_kernel_edit_ratified` prints that question when it can see the case: on
+a `refused` or `non-convergent` record, on a record short only of provider
+diversity, and on a change to the ratification mechanism itself that carries a
+council answer, passing or not. It fills in the verdict, the dissenting seats
+and the gated paths, and asks for the expected gain, the risk and the rollback,
+which it does not know. It stays silent on an authoring defect — no record, a
+self-ratified one, a stale `subject` — on the mechanism's own files too,
+because that is not the user's question. Record fields are printed with every
+control, format and line/paragraph-separator character (`Cc`, `Cf`, `Zl`,
+`Zp`) escaped.
+
+**The printed question is advisory, and says so.** The gate's exit code does
+not carry the user's decision: a failing record fails already, and a passing
+record over the mechanism passes here and is held at merge, where
+`classify_merge_risk` classes the same paths `needs-owner` — pinned path by
+path in `check_kernel_edit_ratified_escalation_message.test.ts` — and the
+owner's forge act is the approval (ADR-281 § 5). A blocking status in this gate would
+need an owner acknowledgment it could authenticate, and none exists.
+Whether a different provider was tried (condition 1) and whether a row of
+the owner-reserved table is touched (condition 3) are judgements the gate
+cannot make from a diff; a run states them itself.
+
 ### The owner-permission-route
 
 Where the council cannot conclude, the owner's permission is **his own
diff --git a/src/scripts/check_kernel_edit_ratified.ts b/src/scripts/check_kernel_edit_ratified.ts
index 47df197dc..eeee5a4ca 100644
--- a/src/scripts/check_kernel_edit_ratified.ts
+++ b/src/scripts/check_kernel_edit_ratified.ts
@@ -85,6 +85,7 @@ import * as fs from 'node:fs';
 import * as path from 'node:path';
 import { fileURLToPath, pathToFileURL } from 'node:url';
 
+import { readAdrFrontmatter } from './_lib/adr_frontmatter.js';
 import { GateLedger } from './_lib/gate_ledger.js';
 import {
     dispatchImportClosure,
@@ -98,6 +99,7 @@ import {
     RATIFICATION_DIR,
     readRatification,
     readRequiredProviders,
+    readSeats,
     type RatificationProblem,
 } from './_lib/ratification_artifact.js';
 import {
@@ -513,6 +515,110 @@ export function expectedSubjectFor(
     return subjectOf(root, files, derivedFor(root, baseRef, commit), commit);
 }
 
+/** The escalation block's first line — stable, so a test asserts presence, not wording. */
+export const ESCALATION_HEADING =
+    '⏸  The user decides this change ' +
+    '(docs/contracts/ratification-artifact.md § When the user decides):';
+
+/**
+ * ADVISORY, and the block says so: this gate's exit code does not carry the
+ * user's decision. A failing record already fails; a passing record over the
+ * mechanism passes here and is held at merge, where `classify_merge_risk`
+ * classes the same paths `needs-owner` and the owner's forge act is the only
+ * approval (ADR-281 § 5). A blocking status here would need an owner
+ * acknowledgment the gate could authenticate, and none exists.
+ */
+const ESCALATION_ADVISORY =
+    '  advisory: this exit code does not carry the decision — the merge gate holds ' +
+    'these paths as needs-owner, and the owner approves on the forge (ADR-281 § 5).';
+
+/**
+ * Why a run stops for the user. An authoring defect — no record, a malformed or
+ * self-ratified one, a stale `subject` — is deliberately not a trigger, for the
+ * mechanism's own files too: routing it to the owner would spend the escalation
+ * on "write a record". `reviewer` therefore needs a council answer to fire.
+ */
+export type EscalationTrigger = 'refused' | 'non-convergent' | 'diversity-short' | 'reviewer';
+
+/**
+ * Every character `printable` refuses to emit: controls (`Cc`), format
+ * characters (`Cf`, which holds every `Bidi_Control` and the invisible marks),
+ * and the line and paragraph separators (`Zl`, `Zp`). Unicode properties
+ * rather than ranges, so a code point added to a class is covered without an
+ * edit here.
+ */
+export const UNPRINTABLE_RE = /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/gu;
+
+/**
+ * Record text and paths are candidate-controlled, and this block lands in a CI
+ * log a person reads: every {@link UNPRINTABLE_RE} character is shown as a
+ * `\u{…}` escape, never emitted, so a field cannot forge a line, recolour one,
+ * or reorder what is shown.
+ */
+export function printable(s: string): string {
+    return s.replace(UNPRINTABLE_RE, (c) => `\\u{${(c.codePointAt(0) ?? 0).toString(16)}}`);
+}
+
+export interface EscalationRecord {
+    path: string;
+    verdict: string | null;
+    seats: Readonly<Record<string, string>>;
+}
+
+const TRIGGER_TEXT: Record<EscalationTrigger, string> = {
+    refused: 'a seat refused the change',
+    'non-convergent': 'the council did not converge',
+    'diversity-short': 'provider diversity is short of the required count',
+    reviewer:
+        'the change is to the reviewer itself ' +
+        '(condition 4 — the owner decides whatever the seats said)',
+};
+
+/**
+ * The one question the contract names, as the gate can state it: it FILLS IN
+ * the verdict, the dissenting seats and the gated paths, and ASKS FOR the
+ * expected gain, the risk and the rollback, which it does not know. A summary
+ * the gate never computed would be this mechanism's own failure mode.
+ */
+export function escalationMessage(input: {
+    triggers: readonly EscalationTrigger[];
+    records: readonly EscalationRecord[];
+    gatedPaths: readonly string[];
+}): string[] {
+    if (input.triggers.length === 0) {
+        return [];
+    }
+    const out = ['', ESCALATION_HEADING, ESCALATION_ADVISORY];
+    for (const t of input.triggers) {
+        out.push(`  · ${TRIGGER_TEXT[t]}`);
+    }
+    for (const r of input.records) {
+        const verdict = printable(r.verdict ?? 'unreadable');
+        out.push(`  record ${printable(r.path)} — verdict: ${verdict}`);
+        const dissent = Object.entries(r.seats).filter(
+            ([, v]) => v !== 'ratified' && v !== 'confirmed-non-expanding',
+        );
+        out.push(
+            dissent.length === 0
+                ? '    dissent: none recorded'
+                : `    dissent: ${dissent.map(([p, v]) => printable(`${p}: ${v}`)).join(', ')}`,
+        );
+    }
+    out.push('  the exact change (gated paths):');
+    for (const p of input.gatedPaths) {
+        out.push(`    · ${printable(p)}`);
+    }
+    const where =
+        input.records.length > 0
+            ? input.records.map((r) => printable(r.path)).join(', ')
+            : 'the record';
+    out.push(
+        `  this gate does not know the expected gain, the risk, or the rollback — ` +
+            `state each in ${where} and the pull request, then ask the user once.`,
+    );
+    return out;
+}
+
 export interface GateResult {
     exitCode: 0 | 1 | 3;
     lines: string[];
@@ -673,6 +779,13 @@ export function evaluate(
 
     let anyRatified = false;
     const failures: string[] = [];
+    const triggers = new Set<EscalationTrigger>();
+    const escalated: EscalationRecord[] = [];
+    const seatsOf = (text: string): Record<string, string> => {
+        const fm = readAdrFrontmatter(text);
+        const seats = fm === null ? null : readSeats(fm, text);
+        return seats?.kind === 'present' ? Object.fromEntries(seats.seats) : {};
+    };
     for (const rel of artifacts) {
         // The record is read at the same commit as the content it answers
         // for: a record rewritten in the working tree and never committed is
@@ -702,23 +815,54 @@ export function evaluate(
                     `effective after ${reading.artifact?.effective_after}; ` +
                     `subject ${String(reading.artifact?.subject).slice(0, 12)}…)`,
             );
+            if (gated.self) {
+                escalated.push({
+                    path: rel,
+                    verdict: reading.artifact?.verdict ?? null,
+                    seats: seatsOf(text),
+                });
+            }
             continue;
         }
         if (reading.artifact !== null) {
-            failures.push(`${rel}: verdict is \`${reading.artifact.verdict}\`, not \`ratified\``);
+            const v = reading.artifact.verdict;
+            if (v === 'refused' || v === 'non-convergent') {
+                triggers.add(v);
+                escalated.push({ path: rel, verdict: v, seats: seatsOf(text) });
+            }
+            failures.push(`${rel}: verdict is \`${v}\`, not \`ratified\``);
             continue;
         }
+        // Diversity short and nothing else wrong is the council's answer, not a defect.
+        const problems = reading.problems;
+        if (problems.length > 0 && problems.every((p) => p.code === 'diversity-required')) {
+            triggers.add('diversity-short');
+            escalated.push({
+                path: rel,
+                verdict: readAdrFrontmatter(text)?.scalars['verdict'] ?? null,
+                seats: seatsOf(text),
+            });
+        }
         for (const p of reading.problems as RatificationProblem[]) {
             failures.push(`${rel}: ${p.message}`);
         }
     }
 
+    if (gated.self && (anyRatified || escalated.length > 0)) {
+        triggers.add('reviewer');
+    }
+    const escalation = escalationMessage({
+        triggers: [...triggers],
+        records: escalated,
+        gatedPaths: [...gatedSet],
+    });
     if (!anyRatified) {
         lines.push('');
         lines.push('❌  no valid `verdict: ratified` artifact for this diff:');
         for (const f of failures) {
             lines.push(`  · ${f}`);
         }
+        lines.push(...escalation);
         close(false);
         return { exitCode: 1, lines, scanned };
     }
@@ -730,6 +874,7 @@ export function evaluate(
             lines.push(`  · ${f}`);
         }
     }
+    lines.push(...escalation);
     close(true);
     return { exitCode: 0, lines, scanned };
 }
diff --git a/tests/scripts/check_kernel_edit_ratified_escalation_message.test.ts b/tests/scripts/check_kernel_edit_ratified_escalation_message.test.ts
new file mode 100644
index 000000000..5e2a0ebbb
--- /dev/null
+++ b/tests/scripts/check_kernel_edit_ratified_escalation_message.test.ts
@@ -0,0 +1,328 @@
+import * as fs from 'node:fs';
+import * as os from 'node:os';
+import * as path from 'node:path';
+
+import { afterEach, beforeEach, describe, expect, it } from 'vitest';
+
+import * as gate from '../../src/scripts/check_kernel_edit_ratified.js';
+import {
+    ESCALATION_HEADING,
+    escalationMessage,
+    isMechanismPath,
+    printable,
+    SELF_PATH,
+    UNPRINTABLE_RE,
+} from '../../src/scripts/check_kernel_edit_ratified.js';
+import { classifyChanges } from '../../src/scripts/classify_merge_risk.js';
+import { RATIFICATION_DIR } from '../../src/scripts/_lib/ratification_artifact.js';
+import { commitAll } from './ratification_git_fixture.js';
+
+/**
+ * Step 5.2 of `road-to-self-modification-that-a-council-must-pass`: when the
+ * user decides, the gate's output carries the one question the contract names
+ * — the council's verdict, the per-seat dissent, the exact change, and an ask
+ * for the expected gain, the risk and the rollback, which the gate does not
+ * know and does not guess.
+ *
+ * Every firing case has a polarity partner: an authoring defect (no record, a
+ * self-ratified record, a stale subject) is not the owner's question, and a
+ * passing record over an ordinary gated surface needs no escalation at all.
+ */
+
+let root: string;
+
+const KERNEL = 'src/rules/commit-policy.md';
+
+const GOOD = {
+    proposed_by: 'claude/session-a',
+    implemented_by: 'claude/session-a',
+    reviewed_by: 'ai-council',
+    verdict: 'ratified',
+    effective_after: 'merge',
+};
+
+function evaluate(files: readonly string[], providers: number | null = 2): gate.GateResult {
+    commitAll(root);
+    return gate.evaluate(files, root, providers);
+}
+
+function subjectFor(gated: readonly string[]): string {
+    commitAll(root);
+    return gate.expectedSubjectFor(gated, root).digest;
+}
+
+function writeRecord(
+    name: string,
+    fields: Record<string, string>,
+    seats: Record<string, string>,
+    gated: readonly string[] = [KERNEL],
+    subject: string = subjectFor(gated),
+): string {
+    const rel = path.join(RATIFICATION_DIR, name);
+    const abs = path.join(root, rel);
+    fs.mkdirSync(path.dirname(abs), { recursive: true });
+    const lines = ['---'];
+    for (const [k, v] of Object.entries(fields)) {
+        lines.push(`${k}: ${v}`);
+    }
+    lines.push(`subject: ${subject}`, 'providers:');
+    for (const p of Object.keys(seats)) {
+        lines.push(`  - ${p}`);
+    }
+    lines.push('seats:');
+    for (const [p, v] of Object.entries(seats)) {
+        lines.push(`  ${p}: ${v}`);
+    }
+    lines.push('---', '', '<!-- evidence-type: ratification -->', '', 'Review body.', '');
+    fs.writeFileSync(abs, lines.join('\n'));
+    return rel;
+}
+
+function text(r: gate.GateResult): string {
+    return r.lines.join('\n');
+}
+
+const BOTH_RATIFIED = { anthropic: 'ratified', openai: 'ratified' };
+
+beforeEach(() => {
+    root = fs.mkdtempSync(path.join(os.tmpdir(), 'ker-esc-'));
+});
+
+afterEach(() => {
+    fs.rmSync(root, { recursive: true, force: true });
+});
+
+describe('escalationMessage — the shape of the one question', () => {
+    const msg = escalationMessage({
+        triggers: ['refused'],
+        records: [
+            {
+                path: `${RATIFICATION_DIR}/x.md`,
+                verdict: 'refused',
+                seats: { anthropic: 'ratified', openai: 'refused' },
+            },
+        ],
+        gatedPaths: [KERNEL],
+    }).join('\n');
+
+    it('fills in what the gate knows: the verdict, the dissent and the exact change', () => {
+        expect(msg).toContain(ESCALATION_HEADING);
+        expect(msg).toContain('verdict: refused');
+        expect(msg).toContain('openai: refused');
+        expect(msg).toContain(KERNEL);
+    });
+
+    it('asks for gain, risk and rollback instead of inventing them', () => {
+        for (const ask of ['expected gain', 'risk', 'rollback']) {
+            expect(msg).toContain(ask);
+        }
+        expect(msg).toContain('this gate does not know');
+        expect(msg).toContain(`${RATIFICATION_DIR}/x.md`);
+    });
+
+    it('names only dissenting seats as dissent', () => {
+        expect(msg).not.toContain('anthropic: ratified');
+    });
+
+    it('says it is advisory and where the decision is actually held', () => {
+        expect(msg).toContain('advisory');
+        expect(msg).toContain('needs-owner');
+    });
+
+    // Chosen from OUTSIDE the implementation's own list: C0, DEL, C1, the
+    // Arabic letter mark, the line and paragraph separators, an embedding, an
+    // override, every isolate, a zero-width joiner and a BOM.
+    const ADVERSARIAL = [
+        0x0a, 0x0d, 0x1b, 0x7f, 0x85, 0x9b, 0x061c, 0x200b, 0x200d, 0x200e, 0x2028, 0x2029,
+        0x202a, 0x202e, 0x2066, 0x2067, 0x2068, 0x2069, 0xfeff,
+    ];
+
+    it('never emits a control, format or separator character from a record field', () => {
+        for (const cp of ADVERSARIAL) {
+            const c = String.fromCodePoint(cp);
+            const out = escalationMessage({
+                triggers: ['refused'],
+                records: [
+                    { path: `r${c}.md`, verdict: `refused${c}`, seats: { [`o${c}`]: 'refused' } },
+                ],
+                gatedPaths: [`a${c}b`],
+            });
+            for (const line of out) {
+                expect(line.includes(c), `U+${cp.toString(16)} leaked`).toBe(false);
+            }
+            expect(printable(c)).toBe(`\\u{${cp.toString(16)}}`);
+        }
+        // The checked set is the whole class, not only the sample above.
+        for (let cp = 0; cp <= 0x10ffff; cp += 1) {
+            if (cp >= 0xd800 && cp <= 0xdfff) continue;
+            const c = String.fromCodePoint(cp);
+            UNPRINTABLE_RE.lastIndex = 0;
+            if (UNPRINTABLE_RE.test(c)) {
+                expect(printable(c).includes(c)).toBe(false);
+            }
+        }
+    });
+
+    it('leaves ordinary text, including non-Latin letters, alone', () => {
+        expect(printable('agents/evidence/ratifications/x.md')).toBe(
+            'agents/evidence/ratifications/x.md',
+        );
+        expect(printable('Größe — العربية')).toBe('Größe — العربية');
+    });
+
+    it('is empty when nothing triggers it', () => {
+        expect(escalationMessage({ triggers: [], records: [], gatedPaths: [KERNEL] })).toEqual([]);
+    });
+});
+
+describe('evaluate — when the user decides, the gate says so', () => {
+    it('a `refused` record escalates and still fails', () => {
+        const rel = writeRecord(
+            'r.md',
+            { ...GOOD, verdict: 'refused' },
+            { anthropic: 'refused', openai: 'refused' },
+        );
+        const r = evaluate([KERNEL, rel]);
+        expect(r.exitCode).toBe(1);
+        expect(text(r)).toContain(ESCALATION_HEADING);
+        expect(text(r)).toContain('verdict: refused');
+    });
+
+    it('a `non-convergent` record escalates and still fails', () => {
+        const rel = writeRecord(
+            'n.md',
+            { ...GOOD, verdict: 'non-convergent' },
+            { anthropic: 'non-convergent', openai: 'non-convergent' },
+        );
+        const r = evaluate([KERNEL, rel]);
+        expect(r.exitCode).toBe(1);
+        expect(text(r)).toContain(ESCALATION_HEADING);
+        expect(text(r)).toContain('verdict: non-convergent');
+    });
+
+    it('diversity short of the required count escalates and still fails', () => {
+        const rel = writeRecord('d.md', GOOD, { anthropic: 'ratified' });
+        const r = evaluate([KERNEL, rel]);
+        expect(r.exitCode).toBe(1);
+        expect(text(r)).toContain(ESCALATION_HEADING);
+        expect(text(r)).toContain('provider diversity');
+    });
+
+    it('a change to the reviewer escalates even on a passing record, exit unchanged', () => {
+        const rel = writeRecord('s.md', GOOD, BOTH_RATIFIED, [SELF_PATH]);
+        const r = evaluate([SELF_PATH, rel]);
+        expect(r.exitCode).toBe(0);
+        expect(text(r)).toContain(ESCALATION_HEADING);
+        expect(text(r)).toContain('the reviewer itself');
+    });
+
+    it('polarity: on the reviewer too, a missing record is an authoring defect', () => {
+        const r = evaluate([SELF_PATH]);
+        expect(r.exitCode).toBe(1);
+        expect(text(r)).not.toContain(ESCALATION_HEADING);
+    });
+
+    it('polarity: on the reviewer too, a stale subject is an authoring defect', () => {
+        const rel = writeRecord('ss.md', GOOD, BOTH_RATIFIED, [SELF_PATH], '0'.repeat(64));
+        const r = evaluate([SELF_PATH, rel]);
+        expect(r.exitCode).toBe(1);
+        expect(text(r)).not.toContain(ESCALATION_HEADING);
+    });
+
+    it('polarity: on the reviewer too, a self-ratified record is an authoring defect', () => {
+        const rel = writeRecord(
+            'sx.md',
+            { ...GOOD, proposed_by: 'x', implemented_by: 'x', reviewed_by: 'x' },
+            BOTH_RATIFIED,
+            [SELF_PATH],
+        );
+        const r = evaluate([SELF_PATH, rel]);
+        expect(r.exitCode).toBe(1);
+        expect(text(r)).not.toContain(ESCALATION_HEADING);
+    });
+
+    it('a refused record on the reviewer names both triggers', () => {
+        const rel = writeRecord(
+            'sr.md',
+            { ...GOOD, verdict: 'refused' },
+            { anthropic: 'refused', openai: 'refused' },
+            [SELF_PATH],
+        );
+        const r = evaluate([SELF_PATH, rel]);
+        expect(r.exitCode).toBe(1);
+        expect(text(r)).toContain('the reviewer itself');
+        expect(text(r)).toContain('a seat refused the change');
+    });
+
+    it('a `confirmed-non-expanding` record on the reviewer escalates too (passing or not)', () => {
+        const rel = writeRecord(
+            'sc.md',
+            { ...GOOD, verdict: 'confirmed-non-expanding' },
+            { anthropic: 'confirmed-non-expanding', openai: 'confirmed-non-expanding' },
+            [SELF_PATH],
+        );
+        const r = evaluate([SELF_PATH, rel]);
+        expect(r.exitCode).toBe(0);
+        expect(text(r)).toContain('the reviewer itself');
+    });
+
+    it('polarity: a passing record over an ordinary gated surface does not escalate', () => {
+        const rel = writeRecord('ok.md', GOOD, BOTH_RATIFIED);
+        const r = evaluate([KERNEL, rel]);
+        expect(r.exitCode).toBe(0);
+        expect(text(r)).not.toContain(ESCALATION_HEADING);
+    });
+
+    it('polarity: a missing record is an authoring defect, not the owner question', () => {
+        const r = evaluate([KERNEL]);
+        expect(r.exitCode).toBe(1);
+        expect(text(r)).not.toContain(ESCALATION_HEADING);
+    });
+
+    it('polarity: a self-ratified record is an authoring defect, not the owner question', () => {
+        const rel = writeRecord(
+            'self.md',
+            { ...GOOD, proposed_by: 'x', implemented_by: 'x', reviewed_by: 'x' },
+            BOTH_RATIFIED,
+        );
+        const r = evaluate([KERNEL, rel]);
+        expect(r.exitCode).toBe(1);
+        expect(text(r)).not.toContain(ESCALATION_HEADING);
+    });
+
+    it('polarity: a stale subject is an authoring defect, not the owner question', () => {
+        const rel = writeRecord(
+            'stale.md',
+            { ...GOOD, verdict: 'refused' },
+            { anthropic: 'refused', openai: 'refused' },
+            [KERNEL],
+            '0'.repeat(64),
+        );
+        const r = evaluate([KERNEL, rel]);
+        expect(r.exitCode).toBe(1);
+        expect(text(r)).not.toContain(ESCALATION_HEADING);
+    });
+});
+
+describe('the advisory line is true: the merge gate holds the mechanism as needs-owner', () => {
+    it('every mechanism path this gate escalates on is needs-owner at merge', () => {
+        const mechanism = [
+            gate.SELF_PATH,
+            gate.READER_PATH,
+            gate.CLOSURE_READER_PATH,
+            gate.POLICY_PATH,
+            gate.WORKFLOW_PATH,
+            ...gate.ANCHOR_PATHS,
+            ...gate.MECHANISM_IMPORT_PATHS,
+        ];
+        for (const p of mechanism) {
+            expect(isMechanismPath(p), p).toBe(true);
+            const verdict = classifyChanges([{ status: 'M', path: p }], {
+                dirExistsInHead: () => true,
+                decisionPolicy: () => 'other',
+                consequenceMembers: new Set(),
+            }).verdict;
+            expect(verdict, p).toBe('needs-owner');
+        }
+    });
+});
```
