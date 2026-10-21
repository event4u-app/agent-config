<!-- evidence-type: analysis -->

<!-- A prompt given to the council on 2026-10-21 for branch drain/self-modification-20261021,
     round 5, committed verbatim so the verdict recorded beside it can be checked
     against what was actually asked. Not edited after the run. -->

# Review branch drain/self-modification-20261021, round 5 — the ratification gate prints the user's question

Step 5.2 of `road-to-self-modification-that-a-council-must-pass`. It changes `src/scripts/check_kernel_edit_ratified.ts` (the ratification gate itself, gated), two paragraphs of `docs/contracts/ratification-artifact.md` (not gated) and one test file. The full diff against `origin/main` is below; nothing is omitted.

**What the step is, and what it is not.** The contract (§ When the user decides) says that when the council cannot pass a change, or the change is to the reviewer itself, the run stops with one question for the user. This step makes the gate PRINT that question when it can see the case. It does not change any exit code, any verdict, any record rule, or who may merge. Under ADR-281 as amended the merge of such a change is the owner's act on the forge; no step of this roadmap claims to enforce that in CI, and this step's text now says so.

The gate prints the block (`escalationMessage`) on a `refused` or `non-convergent` record, on a record whose only problem is `diversity-required`, and on a change to the ratification mechanism (`gated.self`) that carries a council answer, passing or not. It fills in the verdict, non-passing seats and gated paths and asks for gain, risk and rollback. Authoring defects (no record, stale subject, self-ratified) stay silent, on mechanism paths too.

History. Round 1 (2026-10-18) refused 2/2 (an unqualified "the user decides" over exit 0, `gated.self` escalating authoring defects, raw record text in CI output) — fixed. Round 2 refused 2/2 (sanitizer range list missed U+061C, U+2028, U+2029) — it now escapes the classes `Cc`, `Cf`, `Zl`, `Zp`. Round 3 (2026-10-21) refused 2/2 on `--quiet` suppressing a passing run's question — `GateResult.escalated` and an end-to-end `main(['--quiet', …])` test, seen red with the fix removed. One correction to round 3's premise, found while preparing this round: it took "CI passes --quiet" from a code comment, and the GitHub workflow step in `.github/workflows/consistency.yml` does NOT pass the flag; the local `task` pipeline does (`taskfiles/ci-fast.yml`, `{{.QUIET_FLAG}}`). The fix stands for that log; the comment, contract and test wording added by this branch now say which pipeline it is. Round 4 split: anthropic `ratified`, openai `refused` with a dealbreaker. This round answers round 4:

- **High, accepted: the advisory overclaimed.** It said "the merge gate holds these paths as needs-owner". What the tree holds is narrower: `/pr:merge`'s classifier routes them `needs-owner` when an agent merges, and no required CI status enforces the owner's approval. The line now reads "this exit code does not carry the decision, and no CI check enforces it — the merge is the owner's (ADR-281 § 5); /pr:merge routes these paths needs-owner", the contract paragraph says the same in full, and the test is renamed to what it pins (the classifier), not a hold it cannot see. Building forge enforcement (a required blocking status bound to an authenticated owner approval) is not this step: the contract records that no owner acknowledgment exists that a gate could authenticate, and the owner chose the forge act as the route (ADR-281 § 5).
- **Medium, accepted: unbounded output.** Each printed field is clipped at 200 characters and each list (records, dissenting seats, gated paths) at 50 entries, with the remainder counted ("… and N more"). Tested.
- **Medium, answered rather than changed: `MECHANISM_PATHS` is self-referential.** True of the list before this change too (the predicate was a disjunction over the same constants). The defence against a PR removing a path from the list is not the test: CI runs the BASE revision's copy of this gate with `--root <head>` (`.github/workflows/consistency.yml`), so a removal is judged by the base list, which still contains the path, and the edit to `SELF_PATH` itself needs a record. The test pins the other direction — the classifier never forgetting a member. The polarity case now uses `README.md` rather than freezing `prompts.ts`, whose status is the open question of step 4.1.
- **Rollback and falsification.** Rollback is reverting this branch's commits: nothing is stored, no exit code or verdict depends on the block. The claimed benefit is false if a passing change to `SELF_PATH` run as CI runs it (`--quiet`) prints no `⏸  The user decides this change` heading, or if a record field can emit a control character or more than the stated bounds.

The subject digest of this diff's gated content at `84f9752a0` is `24ecf494d173cebbc4ad070774f33d537455ac76fed5b3002b5d6f4ab026c03b`, covering `src/scripts/check_kernel_edit_ratified.ts`.

Answer, for this diff: what behaviour changes, including what follows from it; which authority or safety boundary becomes wider or narrower; whether the change weakens anything that judges it — a test, a gate, a threshold, this review; whether another host or projection is left as a way around it; whether it can be undone and how; what observation would show the claimed benefit to be false; whether a smaller change would do; what it adds to standing instruction weight; whether untrusted content could steer the path.

Report any defect with file:line, the failure scenario and a severity. Do not close on an APPROVE / REQUEST_CHANGES line; close your reply with EXACTLY this line, and nothing after it:

STANCE: <label> | CONFIDENCE: high|med|low | DEALBREAKER: yes|no

where `<label>` is one of `ratified`, `confirmed-non-expanding`, `refused`.

```diff
diff --git a/docs/contracts/ratification-artifact.md b/docs/contracts/ratification-artifact.md
index 7518638ff..96b48ff6e 100644
--- a/docs/contracts/ratification-artifact.md
+++ b/docs/contracts/ratification-artifact.md
@@ -725,6 +725,35 @@ recommendation, the dissent, the exact change, what it is expected to gain,
 what it risks, and how it is undone. A run never decides such a case alone,
 and a subagent fan-out is never a substitute for the council here.
 
+`check_kernel_edit_ratified` prints that question when it can see the case: on
+a `refused` or `non-convergent` record, on a record short only of provider
+diversity, and on a change to the ratification mechanism itself that carries a
+council answer, passing or not — under `--quiet` too, which is how the local
+`task` pipeline runs it (the GitHub workflow does not pass the flag), so a
+passing change to the mechanism does not reach that log as silence. It fills in the verdict, the dissenting seats
+and the gated paths, and asks for the expected gain, the risk and the rollback,
+which it does not know. It stays silent on an authoring defect — no record, a
+self-ratified one, a stale `subject` — on the mechanism's own files too,
+because that is not the user's question. Record fields are printed with every
+control, format and line/paragraph-separator character (`Cc`, `Cf`, `Zl`,
+`Zp`) escaped.
+
+**The printed question is advisory, and says so.** The gate's exit code does
+not carry the user's decision: a failing record fails already, and a passing
+record over the mechanism passes here. The merge is the owner's act on the
+forge (ADR-281 § 5), and **no required CI status enforces it**: what the tree
+holds is that `/pr:merge`'s risk classifier, `classify_merge_risk`, routes
+every mechanism path `needs-owner` when an agent merges — pinned path by path,
+for additions, deletions and both sides of a rename, in
+`check_kernel_edit_ratified_escalation_message.test.ts` — and nothing stops a
+merge made outside that command. A blocking status in this gate would need an
+owner acknowledgment it could authenticate, and none exists. The block is
+bounded — each field at 200 characters, each list at 50 entries, with what was
+left out counted — so candidate-controlled text cannot bury the question.
+Whether a different provider was tried (condition 1) and whether a row of
+the owner-reserved table is touched (condition 3) are judgements the gate
+cannot make from a diff; a run states them itself.
+
 ### The owner-permission-route
 
 Where the council cannot conclude, the owner's permission is **his own
diff --git a/src/scripts/check_kernel_edit_ratified.ts b/src/scripts/check_kernel_edit_ratified.ts
index 47df197dc..b9709bfc3 100644
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
@@ -345,20 +347,27 @@ export interface GatedPaths {
     self: boolean;
 }
 
+/**
+ * Every file of the ratification mechanism itself, as one enumerable list, so
+ * a caller that must hold a claim for EACH of them — the escalation block's
+ * `needs-owner` line — iterates the same set the predicate below decides by.
+ */
+export const MECHANISM_PATHS: readonly string[] = [
+    SELF_PATH,
+    READER_PATH,
+    CLOSURE_READER_PATH,
+    POLICY_PATH,
+    WORKFLOW_PATH,
+    ...ANCHOR_PATHS,
+    ...MECHANISM_IMPORT_PATHS,
+];
+
 /**
  * True for a file of the ratification mechanism itself — the one list both the
  * classification and the subject digest read.
  */
 export function isMechanismPath(p: string): boolean {
-    return (
-        p === SELF_PATH ||
-        p === READER_PATH ||
-        p === CLOSURE_READER_PATH ||
-        p === POLICY_PATH ||
-        p === WORKFLOW_PATH ||
-        ANCHOR_PATHS.includes(p) ||
-        MECHANISM_IMPORT_PATHS.includes(p)
-    );
+    return MECHANISM_PATHS.includes(p);
 }
 
 /** Partition a changed-file list into the surfaces this gate watches. */
@@ -513,11 +522,153 @@ export function expectedSubjectFor(
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
+ * mechanism passes here, and the merge is the owner's act on the forge
+ * (ADR-281 § 5). The line claims no more than the tree holds: the
+ * `/pr:merge` risk classifier routes these paths `needs-owner` when an agent
+ * merges, and NO required CI status enforces the owner's approval — a
+ * blocking status here would need an owner acknowledgment the gate could
+ * authenticate, and none exists.
+ */
+const ESCALATION_ADVISORY =
+    '  advisory: this exit code does not carry the decision, and no CI check enforces it — ' +
+    'the merge is the owner\'s (ADR-281 § 5); /pr:merge routes these paths needs-owner.';
+
+/** Output bounds: record text is candidate-controlled, and a flooded log hides the question. */
+export const ESCALATION_FIELD_MAX = 200;
+export const ESCALATION_LIST_MAX = 50;
+
+/** A field as printed: escaped, then clipped, with the clip said rather than hidden. */
+function field(s: string): string {
+    const out = printable(s);
+    return out.length > ESCALATION_FIELD_MAX
+        ? `${out.slice(0, ESCALATION_FIELD_MAX)}… (${out.length - ESCALATION_FIELD_MAX} more characters)`
+        : out;
+}
+
+/** The first `ESCALATION_LIST_MAX` items, and a count of the rest. */
+function bounded<T>(items: readonly T[]): { shown: readonly T[]; omitted: number } {
+    return {
+        shown: items.slice(0, ESCALATION_LIST_MAX),
+        omitted: Math.max(0, items.length - ESCALATION_LIST_MAX),
+    };
+}
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
+    const records = bounded(input.records);
+    for (const r of records.shown) {
+        const verdict = field(r.verdict ?? 'unreadable');
+        out.push(`  record ${field(r.path)} — verdict: ${verdict}`);
+        const dissent = bounded(
+            Object.entries(r.seats).filter(([, v]) => v !== 'ratified' && v !== 'confirmed-non-expanding'),
+        );
+        out.push(
+            dissent.shown.length === 0
+                ? '    dissent: none recorded'
+                : `    dissent: ${dissent.shown.map(([p, v]) => field(`${p}: ${v}`)).join(', ')}` +
+                      (dissent.omitted > 0 ? ` … and ${dissent.omitted} more` : ''),
+        );
+    }
+    if (records.omitted > 0) {
+        out.push(`  … and ${records.omitted} more record(s)`);
+    }
+    out.push('  the exact change (gated paths):');
+    const paths = bounded(input.gatedPaths);
+    for (const p of paths.shown) {
+        out.push(`    · ${field(p)}`);
+    }
+    if (paths.omitted > 0) {
+        out.push(`    … and ${paths.omitted} more path(s)`);
+    }
+    const where =
+        records.shown.length > 0
+            ? records.shown.map((r) => field(r.path)).join(', ')
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
     /** Number of changed paths inspected — the honest `scanned:` count. */
     scanned: number;
+    /**
+     * True when `lines` carries the user's question. `--quiet` hides a passing
+     * run's lines, and the local `task` pipeline passes `--quiet`
+     * (`taskfiles/ci-fast.yml`, `QUIET_FLAG`), so without this a passing change
+     * to the mechanism — the case the question exists for — printed nothing there.
+     */
+    escalated?: boolean;
 }
 
 export function evaluate(
@@ -673,6 +824,13 @@ export function evaluate(
 
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
@@ -702,25 +860,56 @@ export function evaluate(
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
-        return { exitCode: 1, lines, scanned };
+        return { exitCode: 1, lines, scanned, escalated: escalation.length > 0 };
     }
 
     if (failures.length > 0) {
@@ -730,8 +919,9 @@ export function evaluate(
             lines.push(`  · ${f}`);
         }
     }
+    lines.push(...escalation);
     close(true);
-    return { exitCode: 0, lines, scanned };
+    return { exitCode: 0, lines, scanned, escalated: escalation.length > 0 };
 }
 
 export function main(argv: readonly string[] = process.argv.slice(2)): number {
@@ -834,7 +1024,10 @@ export function main(argv: readonly string[] = process.argv.slice(2)): number {
             'real state, and there is then no kernel rule, governance hook, plumbing source or ' +
             'mechanism file to ratify — the gate has read everything there was.',
     });
-    if (!quiet || result.exitCode !== 0) {
+    // `--quiet` keeps a passing run to its verdict line, except when the run
+    // carries the user's question: a passing change to the mechanism exits 0
+    // and is exactly the case that question is for.
+    if (!quiet || result.exitCode !== 0 || result.escalated === true) {
         for (const l of result.lines) {
             process.stdout.write(`${l}\n`);
         }
diff --git a/tests/scripts/check_kernel_edit_ratified_escalation_message.test.ts b/tests/scripts/check_kernel_edit_ratified_escalation_message.test.ts
new file mode 100644
index 000000000..87bcf919c
--- /dev/null
+++ b/tests/scripts/check_kernel_edit_ratified_escalation_message.test.ts
@@ -0,0 +1,409 @@
+import * as fs from 'node:fs';
+import * as os from 'node:os';
+import * as path from 'node:path';
+
+import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
+    it('says it is advisory, that no CI check enforces it, and whose the merge is', () => {
+        expect(msg).toContain('advisory');
+        expect(msg).toContain('no CI check enforces it');
+        expect(msg).toContain('ADR-281 § 5');
+        expect(msg).toContain('needs-owner');
+    });
+
+    it('bounds what candidate-controlled text can print, and says what it left out', () => {
+        const many = Array.from({ length: gate.ESCALATION_LIST_MAX + 10 }, (_, i) => `p/${i}.md`);
+        const long = 'v'.repeat(gate.ESCALATION_FIELD_MAX * 5);
+        const out = escalationMessage({
+            triggers: ['refused'],
+            records: [{ path: 'r.md', verdict: long, seats: { openai: 'refused' } }],
+            gatedPaths: many,
+        });
+        expect(out.filter((l) => l.startsWith('    · ')).length).toBe(gate.ESCALATION_LIST_MAX);
+        expect(out.join('\n')).toContain('… and 10 more path(s)');
+        const verdictLine = out.find((l) => l.includes('verdict:')) ?? '';
+        expect(verdictLine.length).toBeLessThan(gate.ESCALATION_FIELD_MAX + 100);
+        expect(verdictLine).toContain(`${gate.ESCALATION_FIELD_MAX * 4} more characters`);
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
+describe('the /pr:merge classifier routes every mechanism path needs-owner', () => {
+    // Iterates `MECHANISM_PATHS`, the list `isMechanismPath` decides by, so a
+    // path added to the mechanism is covered here without an edit to this test.
+    const changes = (p: string) => [
+        { status: 'M', path: p },
+        { status: 'A', path: p },
+        { status: 'D', path: p },
+        { status: 'R', oldPath: p, path: 'src/elsewhere/renamed.ts' },
+        { status: 'R', oldPath: 'src/elsewhere/renamed.ts', path: p },
+    ];
+
+    it('every mechanism path is needs-owner at merge, modified, added, deleted or renamed', () => {
+        expect(gate.MECHANISM_PATHS.length).toBeGreaterThan(0);
+        for (const p of gate.MECHANISM_PATHS) {
+            expect(isMechanismPath(p), p).toBe(true);
+            for (const change of changes(p)) {
+                const verdict = classifyChanges([change], {
+                    dirExistsInHead: () => true,
+                    decisionPolicy: () => 'other',
+                    consequenceMembers: new Set(),
+                }).verdict;
+                expect(verdict, `${change.status} ${p}`).toBe('needs-owner');
+            }
+        }
+    });
+
+    it('polarity: a path outside the mechanism is not in the list', () => {
+        expect(isMechanismPath('README.md')).toBe(false);
+    });
+});
+
+describe('main --quiet — the question reaches the log of a quiet run', () => {
+    /**
+     * The local `task` pipeline runs this gate with `--quiet`, which keeps a passing run to nothing.
+     * A passing change to the mechanism exits 0 and is the case the question
+     * is for, so the block has to be printed through the CLI, not only placed
+     * in `GateResult.lines`. The assertions read what `main` WROTE.
+     */
+    function runMain(files: readonly string[]): { code: number; out: string } {
+        const writes: string[] = [];
+        const spy = vi.spyOn(process.stdout, 'write').mockImplementation((chunk: unknown) => {
+            writes.push(String(chunk));
+            return true;
+        });
+        const errSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
+        try {
+            const head = commitAll(root, 'change');
+            const code = gate.main([
+                '--quiet',
+                '--root',
+                root,
+                '--rev',
+                head,
+                '--base-ref',
+                `${head}~1`,
+                '--files',
+                ...files,
+            ]);
+            return { code, out: writes.join('') };
+        } finally {
+            spy.mockRestore();
+            errSpy.mockRestore();
+        }
+    }
+
+    beforeEach(() => {
+        fs.writeFileSync(path.join(root, 'README.md'), 'base\n');
+        commitAll(root, 'base');
+    });
+
+    it('a passing record over the mechanism prints the question under --quiet, exit 0', () => {
+        const rel = writeRecord('q.md', GOOD, BOTH_RATIFIED, [SELF_PATH]);
+        const r = runMain([SELF_PATH, rel]);
+        expect(r.code).toBe(0);
+        expect(r.out).toContain(ESCALATION_HEADING);
+        expect(r.out).toContain('the reviewer itself');
+    });
+
+    it('polarity: a passing record over an ordinary gated surface stays quiet', () => {
+        const rel = writeRecord('qk.md', GOOD, BOTH_RATIFIED);
+        const r = runMain([KERNEL, rel]);
+        expect(r.code).toBe(0);
+        expect(r.out).not.toContain(ESCALATION_HEADING);
+        expect(r.out).not.toContain('ratified by');
+    });
+});
```
