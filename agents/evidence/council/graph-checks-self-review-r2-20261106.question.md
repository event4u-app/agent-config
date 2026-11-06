# Review, round 2: the self-review gate consumes the code graph's review checks

Round 1 (both seats) refused the first version. This revision answers its findings:

- **Containment.** The gate no longer imports any graph module. `graphChecksContained` runs `_lib/graph_check_findings.ts` in a child process (`process.execPath` + the gate's own `execArgv`) with a 120 s timeout; a spawn error, a non-zero exit, a timeout or unparseable output becomes one advisory "graph checks did not run" finding. Inside the child, `graphHome`, `diffHunks`, the graph read and git all sit inside one `try`.
- **Nothing can block.** The gate re-asserts `severity: low`, `kind: correctness`, `disposition: advisory` on every row the child prints; a test feeds it a child that prints a critical/security finding.
- **Verdict invariance.** A test checks `gateVerdict(model + graph rows) === gateVerdict(model rows)` in advisory and enforce mode, with no, advisory and blocking model findings; a blocking model finding stays blocking.
- **Evidence identity.** The range is base against the working tree (as `diffHunks` reads it). Exhibits name `HEAD`; a finding on a file that differs from `HEAD` in the working tree now carries no exhibit. A test with an unstaged change checks both the finding and the absent exhibit.
- **Deduplication.** Graph rows are appended after the model's deduplication and never pass through it, so an advisory row cannot merge into or replace a model finding.
- Verified for real: the contained path under `tsx` on this repository returned 136 advisory rows.

Review the revised change for: anything that could make the gate block, fail, hang beyond the bound or change its exit code; anything that weakens an existing control; correctness of the range read and the evidence; and test adequacy. State a final verdict as one of `ratified`, `confirmed-non-expanding`, `refused`, `non-convergent`, with reasons and any required changes.

```diff
diff --git a/src/scripts/_lib/graph_check_findings.ts b/src/scripts/_lib/graph_check_findings.ts
index ea09abdd44..ffa6a2dbe5 100644
--- a/src/scripts/_lib/graph_check_findings.ts
+++ b/src/scripts/_lib/graph_check_findings.ts
@@ -10,13 +10,15 @@
  * finding of its own, never silence: "no analysis" must not read as "nothing
  * found".
  *
- * Not wired into `self_review_gate.ts` here — that is a gate change and needs
- * its own ratification artifact.
+ * `self_review_gate.ts` appends `graphChecksForRange` to the model's findings.
  */
 import * as fs from 'node:fs';
 import * as path from 'node:path';
+import { fileURLToPath } from 'node:url';
 
-import type { ReviewCheck } from '../code_graph/review_risk.js';
+import { graphHome } from '../code_graph/graph_home.js';
+import { diffHunks, type ReviewCheck, reviewRiskAt } from '../code_graph/review_risk.js';
+import { gitProbe } from './spawn_env.js';
 import type { Finding } from '../self_review_gate.js';
 import { MAX_QUOTE_CHARS, type PresenceExhibit } from './finding_exhibits.js';
 
@@ -43,6 +45,45 @@ function presenceAt(root: string, witness: string, commit: string): PresenceExhi
     return quote ? { type: 'presence', path: file, line, quote, commit } : null;
 }
 
+/**
+ * The checks for the review range `base`…working tree, read from the checkout's cached
+ * graph. Anything that keeps them from running — no graph, an unresolvable base, a read
+ * failure — is one advisory finding saying so, never an empty list.
+ */
+export function graphChecksForRange(root: string, base: string): GraphCheckFinding[] {
+    try {
+        const cache = graphHome(root).cachePath;
+        if (!fs.existsSync(cache)) return graphChecksDidNotRun('no code graph is built for this checkout');
+        const hunks = diffHunks(root, base);
+        if (hunks === null) return graphChecksDidNotRun(`the base ${base} does not resolve`);
+        const r = reviewRiskAt(cache, root, base, hunks);
+        const commit = gitProbe(root, ['rev-parse', 'HEAD']).trim();
+        // An exhibit names HEAD; a file changed in the working tree is not HEAD's content, so it carries none.
+        const dirty = new Set(gitProbe(root, ['diff', '--name-only', 'HEAD']).split('\n').filter(Boolean));
+        return graphCheckFindings(r.checks, root, commit).map((f) => {
+            if (f.file === undefined || !dirty.has(f.file)) return f;
+            const { exhibits: _dropped, ...rest } = f;
+            return rest as GraphCheckFinding;
+        });
+    } catch (err) {
+        return graphChecksDidNotRun(`reading the graph failed: ${String(err)}`);
+    }
+}
+
+export function graphChecksDidNotRun(why: string): GraphCheckFinding[] {
+    return [{ severity: 'low', kind: 'correctness', disposition: 'advisory', source: 'code-graph', check: 'untested-change', title: `graph checks did not run: ${why}`.slice(0, 300), detail: 'No analysis is not a pass.' }];
+}
+
+/**
+ * `tsx _lib/graph_check_findings.ts --range <base> --root <dir>`: the checks as JSON on
+ * stdout. The gate runs this in a child process so a load failure, a crash or a hang in
+ * the graph modules stays outside the gate's own process.
+ */
+if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
+    const arg = (k: string): string | undefined => process.argv[process.argv.indexOf(k) + 1];
+    process.stdout.write(JSON.stringify(graphChecksForRange(arg('--root') ?? process.cwd(), arg('--range') ?? 'origin/main')));
+}
+
 /** One finding per flagged item, one per check that could not run; a passing check yields none. */
 export function graphCheckFindings(checks: readonly ReviewCheck[], root: string, commit: string): GraphCheckFinding[] {
     const out: GraphCheckFinding[] = [];
diff --git a/src/scripts/self_review_gate.ts b/src/scripts/self_review_gate.ts
index afd0ec42b5..71d90dce5c 100644
--- a/src/scripts/self_review_gate.ts
+++ b/src/scripts/self_review_gate.ts
@@ -43,6 +43,7 @@ import {
     load_anthropic_key,
 } from './ai_council/clients.js';
 import { type Exhibit, splitLineSuffix, wellFormedExhibit } from './_lib/finding_exhibits.js';
+import type { GraphCheckFinding } from './_lib/graph_check_findings.js';
 import { independenceFields } from './_lib/review_independence.js';
 import { riskTier } from './_lib/review_risk_tier.js';
 
@@ -1241,6 +1242,35 @@ function resolveReviewer(): Reviewer | null {
 }
 
 // ── CLI ───────────────────────────────────────────────────────────────
+const GRAPH_CHECKS_SCRIPT = path.join(path.dirname(fileURLToPath(import.meta.url)), '_lib', 'graph_check_findings.ts');
+
+/**
+ * The code graph's checks for `base`…working tree, run in a child process with a time
+ * bound: a load failure, a crash, a hang or unparseable output in the graph code becomes
+ * one advisory "did not run" finding and never reaches this process, its exit code or its
+ * other findings.
+ */
+export function graphChecksContained(root: string, base: string, opts: { script?: string; timeoutMs?: number } = {}): GraphCheckFinding[] {
+    const didNotRun = (why: string): GraphCheckFinding[] => [
+        { severity: 'low', kind: 'correctness', disposition: 'advisory', source: 'code-graph', check: 'untested-change', title: `graph checks did not run: ${why}`.slice(0, 300), detail: 'No analysis is not a pass.' },
+    ];
+    const r = spawnSync(process.execPath, [...process.execArgv, opts.script ?? GRAPH_CHECKS_SCRIPT, '--range', base, '--root', root], {
+        encoding: 'utf-8',
+        timeout: opts.timeoutMs ?? 120_000,
+        maxBuffer: 64 * 1024 * 1024,
+    });
+    if (r.error) return didNotRun(r.error.message);
+    if (r.status !== 0) return didNotRun(`the graph check process exited ${String(r.status)}`);
+    try {
+        const parsed = JSON.parse(r.stdout) as GraphCheckFinding[];
+        if (!Array.isArray(parsed)) return didNotRun('the graph check process printed no list');
+        // Re-asserted here, not trusted from the child: nothing it prints can become blocking.
+        return parsed.map((f) => ({ ...f, severity: 'low', kind: 'correctness', disposition: 'advisory', source: 'code-graph' }));
+    } catch {
+        return didNotRun('the graph check process printed unparseable output');
+    }
+}
+
 export function main(argv: string[]): 0 | 2 {
     const dryRun = argv.includes('--dry-run');
     const enforce = argv.includes('--enforce');
@@ -1438,12 +1468,19 @@ export function main(argv: string[]): 0 | 2 {
         // deletion claim the range and the tree both disprove is annotated
         // here and stops being merge-blocking; it is still written to the
         // artifact and still rendered, carrying its disproof.
-        const reviewed = annotateContradicted(
-            dedupeFindings(findings),
-            rangeDeletions(baseRef),
-            (p) => existsSync(path.join(REPO_ROOT, p)),
-            rangeModifications(baseRef),
-        );
+        // The code graph's three checks join the model's findings as advisory
+        // rows (low / correctness, never blocking): the counterfactual review
+        // (road-to-a-graph-that-wins 3.5) kept them advisory, and a missing
+        // graph is reported as a check that did not run, never as silence.
+        const reviewed = [
+            ...annotateContradicted(
+                dedupeFindings(findings),
+                rangeDeletions(baseRef),
+                (p) => existsSync(path.join(REPO_ROOT, p)),
+                rangeModifications(baseRef),
+            ),
+            ...graphChecksContained(REPO_ROOT, baseRef),
+        ];
         const outIdx = argv.indexOf('--findings-out');
         if (outIdx >= 0 && argv[outIdx + 1]) {
             // Durable ingestion input for the disposition ledger (release-truth
diff --git a/tests/scripts/self_review_graph_checks.test.ts b/tests/scripts/self_review_graph_checks.test.ts
index 94cfe1a08c..7eea10e659 100644
--- a/tests/scripts/self_review_graph_checks.test.ts
+++ b/tests/scripts/self_review_graph_checks.test.ts
@@ -7,10 +7,14 @@ import * as os from 'node:os';
 import * as path from 'node:path';
 import { describe, expect, it } from 'vitest';
 
-import { graphCheckFindings } from '../../src/scripts/_lib/graph_check_findings.js';
+import { execFileSync } from 'node:child_process';
+
+import { graphCheckFindings, graphChecksDidNotRun, graphChecksForRange } from '../../src/scripts/_lib/graph_check_findings.js';
+import { buildFromRepo } from '../../src/scripts/code_graph/build.js';
+import { graphHome } from '../../src/scripts/code_graph/graph_home.js';
 import { wellFormedExhibit } from '../../src/scripts/_lib/finding_exhibits.js';
 import type { ReviewCheck } from '../../src/scripts/code_graph/review_risk.js';
-import { classifyBlocking, findingId } from '../../src/scripts/self_review_gate.js';
+import { classifyBlocking, type Finding, findingId, gateVerdict, graphChecksContained } from '../../src/scripts/self_review_gate.js';
 
 const SCHEMA = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../src/scripts/schemas/review-findings.schema.json'), 'utf-8')) as {
     properties: { findings: { items: { required: string[]; properties: Record<string, { enum?: string[] }> } } };
@@ -58,3 +62,85 @@ describe('graph checks as self-review findings', () => {
         }
     });
 });
+
+describe('the gate stays the gate with graph checks attached', () => {
+    const blocking: Finding = { severity: 'high', kind: 'security', title: 'token logged', detail: 'x', file: 'a.ts' };
+    const advisoryModel: Finding = { severity: 'medium', kind: 'correctness', title: 'edge case', detail: 'x', file: 'b.ts' };
+
+    it('a crashing, failing or garbled graph process is one did-not-run finding, nothing else', () => {
+        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'graph-checks-proc-'));
+        const crash = path.join(dir, 'crash.mjs');
+        fs.writeFileSync(crash, 'throw new Error("module failed to load");\n');
+        const garbled = path.join(dir, 'garbled.mjs');
+        fs.writeFileSync(garbled, 'process.stdout.write("not json");\n');
+        const blocker = path.join(dir, 'blocker.mjs');
+        fs.writeFileSync(blocker, 'process.stdout.write(JSON.stringify([{severity:"critical",kind:"security",title:"t",detail:"d"}]));\n');
+        const hang = path.join(dir, 'hang.mjs');
+        fs.writeFileSync(hang, 'setTimeout(() => {}, 60000);\n');
+        for (const script of [crash, garbled, path.join(dir, 'missing.mjs')]) {
+            const out = graphChecksContained(dir, 'HEAD', { script });
+            expect(out, script).toHaveLength(1);
+            expect(out[0]!.title).toMatch(/^graph checks did not run: /);
+        }
+        expect(graphChecksContained(dir, 'HEAD', { script: hang, timeoutMs: 500 })[0]!.title).toMatch(/^graph checks did not run: /);
+        // Whatever the child prints, nothing it adds can block.
+        expect(graphChecksContained(dir, 'HEAD', { script: blocker }).every((f) => !classifyBlocking(f))).toBe(true);
+        fs.rmSync(dir, { recursive: true, force: true });
+    });
+
+    it('leaves the verdict exactly as the model findings set it, in both modes', () => {
+        const graph = graphChecksDidNotRun('no code graph is built for this checkout');
+        for (const enforce of [false, true]) {
+            for (const model of [[], [advisoryModel], [blocking, advisoryModel]]) {
+                expect(gateVerdict([...model, ...graph], { enforce })).toBe(gateVerdict(model, { enforce }));
+            }
+        }
+        expect(gateVerdict([blocking, ...graph], { enforce: true })).toBe(2);
+    });
+});
+
+describe('graph checks for a review range (AC-8: the gate consumes them)', () => {
+    it('reads base against the working tree: an unstaged change counts, and its file carries no HEAD exhibit', async () => {
+        const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'graph-checks-dirty-'));
+        const git = (...a: string[]) => execFileSync('git', ['-C', repo, '-c', 'user.email=t@example.com', '-c', 'user.name=t', '-c', 'commit.gpgsign=false', ...a], { encoding: 'utf-8' });
+        fs.mkdirSync(path.join(repo, 'src'), { recursive: true });
+        fs.writeFileSync(path.join(repo, 'src/a.ts'), 'export function lonely() {\n  return 1;\n}\n');
+        git('init', '-q');
+        git('add', '-A');
+        git('commit', '-qm', 'base');
+        fs.writeFileSync(path.join(repo, 'src/a.ts'), 'export function lonely() {\n  return 3;\n}\n');
+        await buildFromRepo(repo, graphHome(repo).cachePath, { lanes: true });
+        const findings = graphChecksForRange(repo, 'HEAD');
+        const f = findings.find((x) => x.check === 'untested-change' && x.title.endsWith(': lonely'));
+        expect(f).toBeDefined();
+        expect(f!.exhibits).toBeUndefined();
+        fs.rmSync(repo, { recursive: true, force: true });
+    });
+
+    it('reads the checks for base against a committed change from the cached graph', async () => {
+        const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'graph-checks-range-'));
+        const git = (...a: string[]) => execFileSync('git', ['-C', repo, '-c', 'user.email=t@example.com', '-c', 'user.name=t', '-c', 'commit.gpgsign=false', ...a], { encoding: 'utf-8' });
+        fs.mkdirSync(path.join(repo, 'src'), { recursive: true });
+        fs.writeFileSync(path.join(repo, 'src/a.ts'), 'export function lonely() {\n  return 1;\n}\n');
+        git('init', '-q');
+        git('add', '-A');
+        git('commit', '-qm', 'base');
+        const base = git('rev-parse', 'HEAD').trim();
+        fs.writeFileSync(path.join(repo, 'src/a.ts'), 'export function lonely() {\n  return 2;\n}\n');
+        git('commit', '-qam', 'change');
+        await buildFromRepo(repo, graphHome(repo).cachePath, { lanes: true });
+        const findings = graphChecksForRange(repo, base);
+        expect(findings.some((f) => f.check === 'untested-change' && f.title.endsWith(': lonely'))).toBe(true);
+        expect(findings.every((f) => f.disposition === 'advisory' && !classifyBlocking(f))).toBe(true);
+        fs.rmSync(repo, { recursive: true, force: true });
+    });
+
+    it('reports a missing graph as a check that did not run, never as silence', () => {
+        const bare = fs.mkdtempSync(path.join(os.tmpdir(), 'graph-checks-none-'));
+        const findings = graphChecksForRange(bare, 'origin/main');
+        expect(findings).toHaveLength(1);
+        expect(findings[0]!.title).toMatch(/^graph checks did not run: /);
+        expect(classifyBlocking(findings[0]!)).toBe(false);
+        fs.rmSync(bare, { recursive: true, force: true });
+    });
+});
```
