<!-- evidence-type: analysis -->

<!-- A prompt given to the council on 2026-10-21 for branch drain/self-modification-20261021,
     round 7, committed verbatim so the verdict recorded beside it can be checked
     against what was actually asked. Not edited after the run. -->

# Review branch drain/self-modification-20261021, round 7 — the ratification gate prints the user's question

Step 5.2 of `road-to-self-modification-that-a-council-must-pass`. It changes `src/scripts/check_kernel_edit_ratified.ts` (the ratification gate itself, gated), two paragraphs of `docs/contracts/ratification-artifact.md` (not gated; its diff below also carries one paragraph about the record writer of step 3.4, which is reviewed separately) and one test file. The diff of those three files against `origin/main` is below in full. The branch carries other, ungated commits (a proposal check, a record writer, a skill change) reviewed separately; they are not part of this question.

**Scope, stated so it can be held to.** The contract (§ When the user decides) says that when the council cannot pass a change, or the change is to the reviewer itself, the run stops with one question for the user. This step makes the gate WRITE that question when it can see the case. It changes no exit code, no verdict, no record rule, no stdout behaviour of any flag, and nothing about who may merge. Building an enforced owner-acknowledgment status is not this step: the contract records that no acknowledgment exists that a gate could authenticate, and ADR-281 § 5 (owner-directed) makes the owner's route an act on the forge. Rounds 4–6 asked for that enforcement; this round does not claim it, and the printed text says "no CI check enforces it".

The block (`escalationMessage`) fires on a `refused` or `non-convergent` record, on a record whose only problem is `diversity-required`, and on a change to the ratification mechanism (`gated.self`) that carries a council answer, passing or not. Authoring defects (no record, stale subject, self-ratified) stay silent: they already fail the gate, so there is no decision to put to the user yet — the contract now states that precedence.

History in one line per round: r1–r2 wording, authoring-defect escalation, raw record text, sanitizer classes — fixed. r3 `--quiet` hid the question; r4 the advisory overclaimed a merge hold — reworded; output unbounded — bounded. r5 (split) making `--quiet` print it changed a CLI contract — withdrawn. r6 (split: anthropic `ratified`, openai `refused`): a candidate workflow could add `--quiet` and hide the question; records listed first could crowd out the gated paths. This round:

- **The question is written to stderr on every run.** `GateResult` carries it as `escalation`, apart from `lines`; `main()` prints `lines` to stdout exactly as on `origin/main` (`!quiet || exitCode !== 0`) and then writes `escalation` to stderr unconditionally. So `--quiet` keeps its stdout contract (r5) and no flag hides the question (r6). Tests drive `main()` with and without `--quiet` on a git fixture and read both streams; removing the stderr write turns both red.
- **Paths first.** The block lists `the exact change (N gated path(s)):` and the paths before any record or seat; the count is printed even when the budget is spent. A test with 100 records asserts every path still appears before the first record.
- **What it still cannot stop, said in the contract:** a change that removes or skips its own workflow step — that edit is itself a mechanism change carrying a record, and nothing in the gate runs when the step does not.

The subject digest of this diff's gated content at `0e262c5c2` is `7f5b65ce7c34ec876e00889c2edc4acc0aac63b2fb26fdc89323c73b81d10d83`, covering `src/scripts/check_kernel_edit_ratified.ts`.

Answer, for this diff: what behaviour changes, including what follows from it; which authority or safety boundary becomes wider or narrower; whether the change weakens anything that judges it — a test, a gate, a threshold, this review; whether another host or projection is left as a way around it; whether it can be undone and how; what observation would show the claimed benefit to be false; whether a smaller change would do; what it adds to standing instruction weight; whether untrusted content could steer the path.

Report any defect with file:line, the failure scenario and a severity. Close your reply with EXACTLY this line, and nothing after it:

STANCE: <label> | CONFIDENCE: high|med|low | DEALBREAKER: yes|no

where `<label>` is one of `ratified`, `confirmed-non-expanding`, `refused`.

```diff
diff --git a/docs/contracts/ratification-artifact.md b/docs/contracts/ratification-artifact.md
index 7518638ff..a09812057 100644
--- a/docs/contracts/ratification-artifact.md
+++ b/docs/contracts/ratification-artifact.md
@@ -72,6 +72,17 @@ pruned, so nothing on a runner could check them. The body's review record and
 the committed prompt package remain the evidence a reader checks the seats
 against.
 
+`./scripts-run src/scripts/ratification_record --session <council-json> --files
+<f> … --proposed-by … --implemented-by … --summary …` renders the whole record
+from the run instead (`_lib/ratification_record_writer.ts`). Each seat's verdict
+is read from its stance line, never typed; the session must name as its
+artefact a prompt committed under `agents/evidence/council/` at the revision the
+subject is read at, and that prompt must contain the exact `subject`; every
+reply is kept verbatim in the body; and the output is read back through the
+reader before it is printed. It does not change what is established above: the
+session file is the caller's, so the record is exactly as trustworthy as a typed
+one about whether a council produced it, and it says so in its own body.
+
 ## `subject:` — the digest of the content the record reviewed
 
 An eighth field, `subject:`, is a sha-256 hex digest over the **gated** files of
@@ -725,6 +736,44 @@ recommendation, the dissent, the exact change, what it is expected to gain,
 what it risks, and how it is undone. A run never decides such a case alone,
 and a subagent fan-out is never a substitute for the council here.
 
+`check_kernel_edit_ratified` prints that question when it can see the case: on
+a `refused` or `non-convergent` record, on a record short only of provider
+diversity, and on a change to the ratification mechanism itself that carries a
+council answer, passing or not. It is written to **stderr on every run**, so
+no flag an invoking workflow passes keeps it out of the log, while `--quiet`
+keeps its contract on stdout — a passing run prints no report. It lists the
+gated paths first, then fills in the verdict and the dissenting seats, and
+asks for the expected gain, the risk and the rollback, which it does not know.
+It stays silent on an authoring defect — no record, a self-ratified one, a
+stale `subject` — on the mechanism's own files too. The precedence is
+deliberate: an authoring defect already fails the gate, so such a change
+cannot land and there is no decision to put to the user yet; the question is
+for a change that carries a council answer. Record fields are clipped to their
+first 200 code points and THEN printed with every control, format and
+line/paragraph-separator character (`Cc`, `Cf`, `Zl`, `Zp`) escaped.
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
+owner acknowledgment it could authenticate, and none exists. What the gate
+cannot stop is a change that removes or skips its own workflow step: that edit
+is itself a mechanism change carrying a record, and nothing in the gate runs
+when the step does not. The block is bounded — paths, records and dissenting
+seats share one budget of 50 listed items, paths first, with the rest counted
+and left in full in the records and the diff — so candidate-controlled text
+cannot flood the log the question is in. Revert the block if it ever changes
+an exit code, or if a passing change to the mechanism reaches the workflow log
+without the heading.
+Whether a different provider was tried (condition 1) and whether a row of
+the owner-reserved table is touched (condition 3) are judgements the gate
+cannot make from a diff; a run states them itself.
+
 ### The owner-permission-route
 
 Where the council cannot conclude, the owner's permission is **his own
diff --git a/src/scripts/check_kernel_edit_ratified.ts b/src/scripts/check_kernel_edit_ratified.ts
index 47df197dc..ff2d4dfa9 100644
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
@@ -513,11 +522,154 @@ export function expectedSubjectFor(
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
+/**
+ * Output bounds. Record text is candidate-controlled and a flooded log hides the
+ * question, so each field is clipped to its first code points BEFORE it is
+ * escaped, and records, dissenting seats and gated paths share ONE item budget
+ * for the whole block — nested caps would multiply. Whatever is not listed is
+ * counted in the output and stays in full in the record and the diff.
+ */
+export const ESCALATION_FIELD_MAX = 200;
+export const ESCALATION_ITEM_MAX = 50;
+
+/** A field as printed: clipped, then escaped, with the clip said rather than hidden. */
+function field(s: string): string {
+    const points = Array.from(s);
+    const head = printable(points.slice(0, ESCALATION_FIELD_MAX).join(''));
+    const rest = points.length - ESCALATION_FIELD_MAX;
+    return rest > 0 ? `${head}… (${rest} more characters)` : head;
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
+    let budget = ESCALATION_ITEM_MAX;
+    let unlisted = 0;
+    const item = (line: string): void => {
+        if (budget > 0) {
+            out.push(line);
+            budget -= 1;
+        } else {
+            unlisted += 1;
+        }
+    };
+    // The gated paths come first: they are the exact change, the paths are the
+    // gate's own classification, and listing them before the candidate's
+    // records means no number of records or seats can crowd them out.
+    out.push(`  the exact change (${input.gatedPaths.length} gated path(s)):`);
+    for (const p of input.gatedPaths) {
+        item(`    · ${field(p)}`);
+    }
+    for (const r of input.records) {
+        item(`  record ${field(r.path)} — verdict: ${field(r.verdict ?? 'unreadable')}`);
+        const dissent = Object.entries(r.seats).filter(
+            ([, v]) => v !== 'ratified' && v !== 'confirmed-non-expanding',
+        );
+        if (dissent.length === 0) {
+            item('    dissent: none recorded');
+        }
+        for (const [p, v] of dissent) {
+            item(`    dissent: ${field(`${p}: ${v}`)}`);
+        }
+    }
+    if (unlisted > 0) {
+        out.push(`  … ${unlisted} more item(s) not listed here; the records and the diff carry them in full`);
+    }
+    const where = input.records.length === 1 ? field(input.records[0]?.path ?? '') : 'the records';
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
+     * The user's question, kept apart from `lines` so `main` can write it to
+     * stderr on every run: `--quiet` governs the report on stdout, and the
+     * question must not depend on which flags the invoking workflow passes.
+     */
+    escalation?: string[];
 }
 
 export function evaluate(
@@ -673,6 +825,13 @@ export function evaluate(
 
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
@@ -702,17 +861,47 @@ export function evaluate(
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
@@ -720,7 +909,7 @@ export function evaluate(
             lines.push(`  · ${f}`);
         }
         close(false);
-        return { exitCode: 1, lines, scanned };
+        return { exitCode: 1, lines, scanned, escalation };
     }
 
     if (failures.length > 0) {
@@ -731,7 +920,7 @@ export function evaluate(
         }
     }
     close(true);
-    return { exitCode: 0, lines, scanned };
+    return { exitCode: 0, lines, scanned, escalation };
 }
 
 export function main(argv: readonly string[] = process.argv.slice(2)): number {
@@ -834,11 +1023,17 @@ export function main(argv: readonly string[] = process.argv.slice(2)): number {
             'real state, and there is then no kernel rule, governance hook, plumbing source or ' +
             'mechanism file to ratify — the gate has read everything there was.',
     });
+    // `--quiet` keeps its contract on stdout — a passing run prints no report.
+    // The question goes to stderr on EVERY run, so no invocation flag a
+    // candidate's workflow passes can keep it out of the log.
     if (!quiet || result.exitCode !== 0) {
         for (const l of result.lines) {
             process.stdout.write(`${l}\n`);
         }
     }
+    for (const l of result.escalation ?? []) {
+        process.stderr.write(`${l}\n`);
+    }
     return result.exitCode;
 }
 
diff --git a/tests/scripts/check_kernel_edit_ratified_escalation_message.test.ts b/tests/scripts/check_kernel_edit_ratified_escalation_message.test.ts
new file mode 100644
index 000000000..5ecfcd0de
--- /dev/null
+++ b/tests/scripts/check_kernel_edit_ratified_escalation_message.test.ts
@@ -0,0 +1,452 @@
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
+    return [...r.lines, ...(r.escalation ?? [])].join('\n');
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
+    it('holds records, seats and paths to ONE item budget, counting what it does not list', () => {
+        const seats = Object.fromEntries(
+            Array.from({ length: gate.ESCALATION_ITEM_MAX }, (_, i) => [`s${i}`, 'refused']),
+        );
+        const records = Array.from({ length: gate.ESCALATION_ITEM_MAX }, (_, i) => ({
+            path: `r${i}.md`,
+            verdict: 'refused',
+            seats,
+        }));
+        const paths = Array.from({ length: gate.ESCALATION_ITEM_MAX }, (_, i) => `p/${i}.md`);
+        const out = escalationMessage({ triggers: ['refused'], records, gatedPaths: paths });
+        const total = paths.length + records.length * (1 + gate.ESCALATION_ITEM_MAX);
+        // heading block (blank, heading, advisory, one trigger) + the change line + budget + count + ask
+        expect(out.length).toBe(4 + 1 + gate.ESCALATION_ITEM_MAX + 2);
+        expect(out.join('\n')).toContain(`… ${total - gate.ESCALATION_ITEM_MAX} more item(s) not listed`);
+        expect(out[1]).toBe(ESCALATION_HEADING);
+        expect(out.at(-1)).toContain('this gate does not know');
+    });
+
+    it('lists the gated paths before any record, so records cannot crowd the change out', () => {
+        const records = Array.from({ length: gate.ESCALATION_ITEM_MAX * 2 }, (_, i) => ({
+            path: `r${i}.md`,
+            verdict: 'refused',
+            seats: { openai: 'refused' },
+        }));
+        const out = escalationMessage({ triggers: ['refused'], records, gatedPaths: [SELF_PATH, KERNEL] });
+        const joined = out.join('\n');
+        expect(joined).toContain('the exact change (2 gated path(s)):');
+        expect(joined.indexOf(SELF_PATH)).toBeLessThan(joined.indexOf('record r0.md'));
+        expect(joined).toContain(KERNEL);
+    });
+
+    it('clips a field to its first code points before escaping it, and says how much', () => {
+        const long = '\u0007'.repeat(gate.ESCALATION_FIELD_MAX * 5);
+        const out = escalationMessage({
+            triggers: ['refused'],
+            records: [{ path: 'r.md', verdict: long, seats: { openai: 'refused' } }],
+            gatedPaths: [KERNEL],
+        });
+        const verdictLine = out.find((l) => l.includes('verdict:')) ?? '';
+        expect(verdictLine.split('\\u{7}').length - 1).toBe(gate.ESCALATION_FIELD_MAX);
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
+describe('main — the question reaches the log whatever the flags', () => {
+    /**
+     * The question is written to stderr on every run, so a workflow that adds
+     * `--quiet` cannot keep it out of the log, while `--quiet` keeps its stdout
+     * contract — a passing run prints no report. These cases read what `main`
+     * WROTE rather than what `evaluate` returned.
+     */
+    function runMain(files: readonly string[], quiet: boolean): { code: number; out: string; err: string } {
+        const writes: string[] = [];
+        const errors: string[] = [];
+        const spy = vi.spyOn(process.stdout, 'write').mockImplementation((chunk: unknown) => {
+            writes.push(String(chunk));
+            return true;
+        });
+        const errSpy = vi.spyOn(process.stderr, 'write').mockImplementation((chunk: unknown) => {
+            errors.push(String(chunk));
+            return true;
+        });
+        try {
+            const head = commitAll(root, 'change');
+            const code = gate.main([
+                ...(quiet ? ['--quiet'] : []),
+                '--root',
+                root,
+                '--rev',
+                head,
+                '--base-ref',
+                `${head}~1`,
+                '--files',
+                ...files,
+            ]);
+            return { code, out: writes.join(''), err: errors.join('') };
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
+    it('a passing record over the mechanism writes the question to stderr, exit 0', () => {
+        const rel = writeRecord('q.md', GOOD, BOTH_RATIFIED, [SELF_PATH]);
+        const r = runMain([SELF_PATH, rel], false);
+        expect(r.code).toBe(0);
+        expect(r.err).toContain(ESCALATION_HEADING);
+        expect(r.err).toContain('the reviewer itself');
+        expect(r.out).toContain('ratified by');
+    });
+
+    it('--quiet keeps its stdout contract and cannot keep the question out of the log', () => {
+        const rel = writeRecord('qq.md', GOOD, BOTH_RATIFIED, [SELF_PATH]);
+        const r = runMain([SELF_PATH, rel], true);
+        expect(r.code).toBe(0);
+        expect(r.out).not.toContain('ratified by');
+        expect(r.out).not.toContain(ESCALATION_HEADING);
+        expect(r.err).toContain(ESCALATION_HEADING);
+    });
+
+    it('polarity: a passing record over an ordinary gated surface writes no question anywhere', () => {
+        const rel = writeRecord('qk.md', GOOD, BOTH_RATIFIED);
+        const r = runMain([KERNEL, rel], false);
+        expect(r.code).toBe(0);
+        expect(r.out).toContain('ratified by');
+        expect(r.out + r.err).not.toContain(ESCALATION_HEADING);
+    });
+});
```
