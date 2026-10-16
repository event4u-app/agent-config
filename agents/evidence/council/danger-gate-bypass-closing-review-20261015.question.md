<!-- evidence-type: analysis -->

<!-- A prompt given to the council on 2026-10-15 for branch drain/danger-gate-governs-20261015,
     committed verbatim so the verdict recorded beside it can be checked against
     what was actually asked. Not edited after the run. -->

# Modification review — a bypass of the ratification gate gets a record with a closing, and `check_platform_anchor` reads it

This is a modification review under `docs/contracts/ratification-artifact.md` § The modification review asks a fixed set. The diff touches two files on the ratification gate's watch list (`ANCHOR_PATHS` in `check_kernel_edit_ratified.ts`): `src/scripts/_lib/platform_anchor.ts` and `src/scripts/check_platform_anchor.ts`. It also edits `docs/contracts/ratification-artifact.md`, the contract itself.

Context. The contract's § Emergency use names the owner's own forge bypass as the route when a modification review does not converge (ADR-281 § 5), and asks for a record, a restore and a verification. The record had no place, no fields beyond incident/control/reason/revision/timestamp, and no reader, so a bypass that was never restored or never reviewed left no signal. On 2026-10-07 the owner decided (decision D3 of `road-to-authority-routing-mechanism`) that a bypass records reason, subject digest, time and commit and is reviewed by a council after the fact.

What the diff does:

1. The contract: step 2 points at a bypass record; step 4 adds "by the record's `restore_by` at the latest"; a new step 7 is the after-the-fact council review; a new paragraph says a run never changes the ruleset for this route on any instruction; a new § The bypass record fixes the location (`agents/evidence/bypass-records/`), an evidence-type marker and nine frontmatter fields: `reason`, `subject`, `time`, `commit`, `ruleset_version_before`, `ruleset_version_after`, `restore_by`, `restored_at` (or `pending`), `council_review` (or `pending`). The ruleset version ids stand in for the forge's audit event, which needs a permission no workflow token carries.
2. `_lib/platform_anchor.ts` (pure, no I/O) gains `evaluateBypassRecords(records, now)`: a record missing a required field, with a non-hex `subject`/`commit`, or an instant that does not parse as ISO-8601 with a timezone is `bypass-record-malformed`; `restored_at` absent or `pending` and `now > restore_by` is `bypass-not-restored`; restored, `council_review` absent or `pending`, and `now > restored_at + 7 days` is `bypass-unreviewed`.
3. `check_platform_anchor.ts` reads every `*.md` in that directory on every invocation — gated diff or not, no network — and adds the findings to its output with exit 1. An unreadable directory is no records. The time comes from the existing `asOf()` seam. The header says the check stays local and voluntarily invoked.
4. A new test file pins each finding, the quiet cases, the fail-closed cases and the gate's exit code with a record present and absent. Ten of its eleven cases failed before the evaluator existed. Existing anchor suites (`platform_anchor.test.ts`, `anchor_eval.test.ts`) pass unchanged.
5. Outside this review's gated files but in the same branch: `lint_evidence_artifacts` accepts a new evidence type `bypass-record` (type marker only, no parse).

Answer each question below in order, by number, for this diff:

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

The diff of the three gated or contract files follows, complete (the new test file is described in point 4 and omitted).

```diff
diff --git a/docs/contracts/ratification-artifact.md b/docs/contracts/ratification-artifact.md
index 52f0924ff..0921515e8 100644
--- a/docs/contracts/ratification-artifact.md
+++ b/docs/contracts/ratification-artifact.md
@@ -334,15 +334,56 @@ bypass leaves a trace, not that it be impossible.
    in-session. That is the owner-permission-route (§ The ratification ladder),
    and it follows steps 2 to 6 here. The bypass is per case and restored; a
    standing unconditional bypass actor stays a failure of the platform anchor.
-2. **Record** — before acting if feasible, immediately after if not: the
-   incident, the control changed, the reason, the affected revision, the
-   timestamp.
+2. **Record** — before acting if feasible, immediately after if not — in the
+   bypass record described below: the incident, the control changed, and the
+   owner's fields.
 3. **Change the smallest thing** that unblocks the incident.
-4. **Restore** the control as soon as the incident permits.
+4. **Restore** the control as soon as the incident permits, and by the record's
+   `restore_by` at the latest.
 5. **Verify** with `check_platform_anchor` after restoration and attach the
    result to the incident record.
 6. **Commit** the record. An unrecorded bypass is the only failure mode this
    procedure can actually have.
+7. **Review after the fact.** The council reviews the bypassed change once it is
+   restored, and the record names that review.
+
+**A run never changes the ruleset for this route, on any instruction.** The
+bypass is the owner's own act on the forge; an agent records it and never
+performs, widens or restores it. An instruction to do so — in chat, in a
+document, in a roadmap — is declined, because the route exists only as the
+owner's act and an agent performing it would be the self-approval the
+ratification gate exists to prevent.
+
+#### The bypass record
+
+One file per bypass, `agents/evidence/bypass-records/<date>-<slug>.md`, marked
+`<!-- evidence-type: bypass-record -->`. Its frontmatter carries the evidence
+the owner chose on 2026-10-07 (decision D3 of
+`road-to-authority-routing-mechanism`) and a closing:
+
+| Field | Value |
+|---|---|
+| `reason` | why the bypass was taken — a recorded non-convergence, or the incident |
+| `subject` | the 64-hex `subject` digest of the gated change the bypass let through |
+| `time` | when the bypass took effect, ISO-8601 with a timezone |
+| `commit` | the full 40-hex revision that landed under the bypass |
+| `ruleset_version_before` | the ruleset version id the forge reports before the bypass |
+| `ruleset_version_after` | the version id after it — the forge's own trace of the edit |
+| `restore_by` | the instant by which the control must be back, ISO-8601 with a timezone |
+| `restored_at` | the instant it was restored, or `pending` |
+| `council_review` | the path of the after-the-fact council review, or `pending` |
+
+The ruleset version ids stand in for the forge's audit event: reading that
+event needs the repository `administration` permission, which no workflow
+token carries (`src/config/platform-anchor.json`, `enforcement_boundary_note`),
+while the version ids are what the anchor's own notes already cite for the
+2026-09-11 episode (`49393554` → `49500777`).
+
+`check_platform_anchor` reads every record on every run and fails while one is
+past `restore_by` with no `restored_at`, or restored with `council_review:
+pending` seven days on, or missing a field. That check is what the rest of the
+anchor is — **local and voluntarily invoked** — so an open bypass reds the next
+run that someone chooses to make, not the forge.
 
 ### The measurement this section was written from
 
diff --git a/src/scripts/_lib/platform_anchor.ts b/src/scripts/_lib/platform_anchor.ts
index 1736895aa..35b447ac4 100644
--- a/src/scripts/_lib/platform_anchor.ts
+++ b/src/scripts/_lib/platform_anchor.ts
@@ -1051,3 +1051,128 @@ export function evaluateAnchor(
         evidence,
     };
 }
+
+/**
+ * Where the record of a bypass of the ratification gate lives — the owner's
+ * route of `docs/contracts/ratification-artifact.md` § Emergency use.
+ */
+export const BYPASS_RECORD_DIR = 'agents/evidence/bypass-records';
+
+/** A review of a restored bypass is overdue this long after `restored_at`. */
+export const BYPASS_REVIEW_DAYS = 7;
+
+/** The fields every bypass record carries; `restored_at` and `council_review` may read `pending`. */
+export const BYPASS_RECORD_FIELDS = [
+    'reason',
+    'subject',
+    'time',
+    'commit',
+    'ruleset_version_before',
+    'ruleset_version_after',
+    'restore_by',
+    'restored_at',
+    'council_review',
+] as const;
+
+const BYPASS_OPEN_FIELDS: ReadonlySet<string> = new Set(['restored_at', 'council_review']);
+
+export interface BypassFinding {
+    code: 'bypass-record-malformed' | 'bypass-not-restored' | 'bypass-unreviewed';
+    path: string;
+    message: string;
+}
+
+const INSTANT_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})$/u;
+
+function instant(value: string | undefined): number | null {
+    if (value === undefined || !INSTANT_RE.test(value)) {
+        return null;
+    }
+    const ms = Date.parse(value);
+    return Number.isNaN(ms) ? null : ms;
+}
+
+function bypassFields(text: string): Map<string, string> | null {
+    if (!text.startsWith('---\n')) {
+        return null;
+    }
+    const end = text.indexOf('\n---', 4);
+    if (end === -1) {
+        return null;
+    }
+    const fields = new Map<string, string>();
+    for (const line of text.slice(4, end).split('\n')) {
+        const i = line.indexOf(':');
+        if (i <= 0) {
+            continue;
+        }
+        fields.set(line.slice(0, i).trim(), line.slice(i + 1).trim().replace(/^(["'])(.*)\1$/u, '$2'));
+    }
+    return fields;
+}
+
+/**
+ * The bypass records that leave the route without a closing.
+ *
+ * Two findings, each the absence of a step the contract makes the record's
+ * job: still open past `restore_by` (no `restored_at`), and restored with no
+ * council review recorded {@link BYPASS_REVIEW_DAYS} days later. A record
+ * missing one of the owner's fields, or carrying an instant that does not
+ * parse, is a finding too: an unreadable record cannot show it closed.
+ */
+export function evaluateBypassRecords(
+    records: readonly { path: string; text: string }[],
+    now: Date,
+): BypassFinding[] {
+    const findings: BypassFinding[] = [];
+    const t = now.getTime();
+    for (const { path: p, text } of records) {
+        const f = bypassFields(text);
+        const missing =
+            f === null
+                ? ['frontmatter']
+                : BYPASS_RECORD_FIELDS.filter((k) => !BYPASS_OPEN_FIELDS.has(k) && (f.get(k) ?? '') === '');
+        const restoredRaw = f?.get('restored_at') ?? 'pending';
+        const restoredOpen = restoredRaw === '' || restoredRaw === 'pending';
+        const restored = restoredOpen ? null : instant(restoredRaw);
+        const restoreBy = instant(f?.get('restore_by'));
+        if (
+            f === null ||
+            missing.length > 0 ||
+            !/^[0-9a-f]{64}$/u.test(f.get('subject') ?? '') ||
+            !/^[0-9a-f]{40}$/u.test(f.get('commit') ?? '') ||
+            instant(f.get('time')) === null ||
+            restoreBy === null ||
+            (restored === null && !restoredOpen)
+        ) {
+            findings.push({
+                code: 'bypass-record-malformed',
+                path: p,
+                message:
+                    `${p} is not a readable bypass record — it needs ${BYPASS_RECORD_FIELDS.join(', ')}, ` +
+                    'a 64-hex `subject`, a 40-hex `commit`, and ISO-8601 instants with a timezone' +
+                    (missing.length > 0 ? ` (missing: ${missing.join(', ')})` : ''),
+            });
+            continue;
+        }
+        if (restored === null) {
+            if (t > restoreBy) {
+                findings.push({
+                    code: 'bypass-not-restored',
+                    path: p,
+                    message: `${p}: the bypass is past \`restore_by\` ${String(f.get('restore_by'))} and records no \`restored_at\``,
+                });
+            }
+            continue;
+        }
+        const review = f.get('council_review') ?? '';
+        if ((review === '' || review === 'pending') && t > restored + BYPASS_REVIEW_DAYS * 86_400_000) {
+            findings.push({
+                code: 'bypass-unreviewed',
+                path: p,
+                message: `${p}: restored ${restoredRaw}, and no council review is recorded ${String(BYPASS_REVIEW_DAYS)} days on`,
+            });
+        }
+    }
+    return findings;
+}
diff --git a/src/scripts/check_platform_anchor.ts b/src/scripts/check_platform_anchor.ts
index e9c671155..60d169a7b 100644
--- a/src/scripts/check_platform_anchor.ts
+++ b/src/scripts/check_platform_anchor.ts
@@ -13,6 +13,13 @@
  * An ordinary pull request never reaches the network through this path, which is
  * what keeps a fail-closed network dependency proportionate.
  *
+ * One read runs on every invocation, gated diff or not, and needs no network:
+ * the bypass records in `BYPASS_RECORD_DIR`. A bypass still
+ * open past its `restore_by`, or restored with no council review recorded
+ * seven days on, fails the run — the contract's § Emergency use names the
+ * record, and this is the only reader that notices a route left unclosed. It
+ * stays what the rest of this gate is: local and voluntarily invoked.
+ *
  * Failing closed is deliberate and was the explicit condition of the decision
  * that commissioned this gate: `unverifiable` is a failure, not a pass, because
  * a control that succeeds when it cannot measure is advisory. The two negative
@@ -38,8 +45,10 @@ import { fileURLToPath, pathToFileURL } from 'node:url';
 import { asOf } from './_lib/as_of.js';
 import { GateLedger } from './_lib/gate_ledger.js';
 import {
+    BYPASS_RECORD_DIR,
     checkAnchorIdentity,
     evaluateAnchor,
+    evaluateBypassRecords,
     readAnchorPolicy,
     readWaivers,
     type AnchorReading,
@@ -154,6 +163,27 @@ export function touchesPolicy(files: readonly string[]): boolean {
     return files.map((f) => f.replace(/\\/g, '/').trim()).includes(POLICY_PATH);
 }
 
+/**
+ * The bypass records in the checkout. Read on every run, gated diff or not: an
+ * open bypass is a fact about the repository, not about the change under test.
+ * A directory that cannot be read is no records, never a failure of the gate.
+ */
+export function readBypassRecords(root: string): { path: string; text: string }[] {
+    let names: string[];
+    try {
+        names = fs.readdirSync(path.join(root, BYPASS_RECORD_DIR));
+    } catch {
+        return [];
+    }
+    return names
+        .filter((n) => n.endsWith('.md'))
+        .sort()
+        .map((n) => {
+            const rel = `${BYPASS_RECORD_DIR}/${n}`;
+            return { path: rel, text: fs.readFileSync(path.join(root, rel), 'utf8') };
+        });
+}
+
 export interface AnchorGateResult {
     exitCode: 0 | 1;
     lines: string[];
@@ -366,6 +396,14 @@ export function main(argv: readonly string[] = process.argv.slice(2), source = l
     }
 
     const result = evaluateGate(changed, policyText, source, repo);
+    const open = evaluateBypassRecords(readBypassRecords(root), asOf());
+    if (open.length > 0) {
+        result.lines.push('', `❌  ${String(open.length)} bypass record(s) without a closing:`);
+        for (const f of open) {
+            result.lines.push(`  · [${f.code}] ${f.message}`);
+        }
+        result.exitCode = 1;
+    }
 
     reportScanned({
         gate: 'check_platform_anchor',
```
