<!-- evidence-type: analysis -->

# Review: the self-review gate starts consuming the code graph's three review checks

The diff below makes `self_review_gate.ts` append the code graph's three deterministic review checks (`untested-change`, `missing-co-change`, `touched-entry-point`) to the model reviewer's findings, through a new helper `graphChecksForRange` in `_lib/graph_check_findings.ts`. Each appended finding is `severity: low`, `kind: correctness`, `disposition: advisory`. The gate's blocking rule (`classifyBlocking`) blocks only security/claim findings of critical/high severity. When no graph is built, the base does not resolve, or reading fails, the helper returns one advisory finding saying the checks did not run.

Review the change for: anything that could make the gate block, fail, or change its exit code; anything that weakens an existing control; correctness of the range read (`diffHunks(root, base)` compares the base to the working tree); and test adequacy. State a final verdict for the change as one of: `ratified`, `confirmed-non-expanding`, `refused`, `non-convergent`, with reasons and any required changes.

```diff
diff --git a/src/scripts/_lib/graph_check_findings.ts b/src/scripts/_lib/graph_check_findings.ts
index ea09abdd44..3a5f6d877f 100644
--- a/src/scripts/_lib/graph_check_findings.ts
+++ b/src/scripts/_lib/graph_check_findings.ts
@@ -10,13 +10,14 @@
  * finding of its own, never silence: "no analysis" must not read as "nothing
  * found".
  *
- * Not wired into `self_review_gate.ts` here — that is a gate change and needs
- * its own ratification artifact.
+ * `self_review_gate.ts` appends `graphChecksForRange` to the model's findings.
  */
 import * as fs from 'node:fs';
 import * as path from 'node:path';
 
-import type { ReviewCheck } from '../code_graph/review_risk.js';
+import { graphHome } from '../code_graph/graph_home.js';
+import { diffHunks, type ReviewCheck, reviewRiskAt } from '../code_graph/review_risk.js';
+import { gitProbe } from './spawn_env.js';
 import type { Finding } from '../self_review_gate.js';
 import { MAX_QUOTE_CHARS, type PresenceExhibit } from './finding_exhibits.js';
 
@@ -43,6 +44,28 @@ function presenceAt(root: string, witness: string, commit: string): PresenceExhi
     return quote ? { type: 'presence', path: file, line, quote, commit } : null;
 }
 
+/**
+ * The checks for the review range `base`…working tree, read from the checkout's cached
+ * graph. Anything that keeps them from running — no graph, an unresolvable base, a read
+ * failure — is one advisory finding saying so, never an empty list.
+ */
+export function graphChecksForRange(root: string, base: string): GraphCheckFinding[] {
+    const didNotRun = (why: string): GraphCheckFinding[] => [
+        { severity: 'low', kind: 'correctness', disposition: 'advisory', source: 'code-graph', check: 'untested-change', title: `graph checks did not run: ${why}`.slice(0, 300), detail: 'No analysis is not a pass.' },
+    ];
+    const cache = graphHome(root).cachePath;
+    if (!fs.existsSync(cache)) return didNotRun('no code graph is built for this checkout');
+    const hunks = diffHunks(root, base);
+    if (hunks === null) return didNotRun(`the base ${base} does not resolve`);
+    try {
+        const r = reviewRiskAt(cache, root, base, hunks);
+        const commit = gitProbe(root, ['rev-parse', 'HEAD']).trim();
+        return graphCheckFindings(r.checks, root, commit);
+    } catch (err) {
+        return didNotRun(`reading the graph failed: ${String(err)}`);
+    }
+}
+
 /** One finding per flagged item, one per check that could not run; a passing check yields none. */
 export function graphCheckFindings(checks: readonly ReviewCheck[], root: string, commit: string): GraphCheckFinding[] {
     const out: GraphCheckFinding[] = [];
diff --git a/src/scripts/self_review_gate.ts b/src/scripts/self_review_gate.ts
index afd0ec42b5..b119d06e52 100644
--- a/src/scripts/self_review_gate.ts
+++ b/src/scripts/self_review_gate.ts
@@ -43,6 +43,7 @@ import {
     load_anthropic_key,
 } from './ai_council/clients.js';
 import { type Exhibit, splitLineSuffix, wellFormedExhibit } from './_lib/finding_exhibits.js';
+import { graphChecksForRange } from './_lib/graph_check_findings.js';
 import { independenceFields } from './_lib/review_independence.js';
 import { riskTier } from './_lib/review_risk_tier.js';
 
@@ -1438,12 +1439,19 @@ export function main(argv: string[]): 0 | 2 {
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
+            ...graphChecksForRange(REPO_ROOT, baseRef),
+        ];
         const outIdx = argv.indexOf('--findings-out');
         if (outIdx >= 0 && argv[outIdx + 1]) {
             // Durable ingestion input for the disposition ledger (release-truth
diff --git a/tests/scripts/self_review_graph_checks.test.ts b/tests/scripts/self_review_graph_checks.test.ts
index 94cfe1a08c..4ad9b2a28f 100644
--- a/tests/scripts/self_review_graph_checks.test.ts
+++ b/tests/scripts/self_review_graph_checks.test.ts
@@ -7,7 +7,11 @@ import * as os from 'node:os';
 import * as path from 'node:path';
 import { describe, expect, it } from 'vitest';
 
-import { graphCheckFindings } from '../../src/scripts/_lib/graph_check_findings.js';
+import { execFileSync } from 'node:child_process';
+
+import { graphCheckFindings, graphChecksForRange } from '../../src/scripts/_lib/graph_check_findings.js';
+import { buildFromRepo } from '../../src/scripts/code_graph/build.js';
+import { graphHome } from '../../src/scripts/code_graph/graph_home.js';
 import { wellFormedExhibit } from '../../src/scripts/_lib/finding_exhibits.js';
 import type { ReviewCheck } from '../../src/scripts/code_graph/review_risk.js';
 import { classifyBlocking, findingId } from '../../src/scripts/self_review_gate.js';
@@ -58,3 +62,32 @@ describe('graph checks as self-review findings', () => {
         }
     });
 });
+
+describe('graph checks for a review range (AC-8: the gate consumes them)', () => {
+    it('reads the checks for base...HEAD from the cached graph', async () => {
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
