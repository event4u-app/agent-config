<!-- evidence-type: analysis -->

# Review, round 4: the self-review gate consumes the code graph's review checks

Round 3: both seats `refused`. Each requirement, and where it is now met:

1. **`check` type** — `typeof check === 'string'` before the id lookup (test: `{check: {toString: null}}` → one "did not run" row).
2. **Bounded parent work** — `normaliseGraphRows` slices to `MAX_GRAPH_ROWS` (200) **before** reading any row; a malformed row past the bound is never read (test). Exhibits per row capped at 3 and each filtered through `wellFormedExhibit`; non-positive line numbers dropped; hostile `disposition`/`severity`/`kind` overwritten (test).
3. **Exception safety** — `graphChecksContained`'s whole body is inside one `try`; it never throws. This matters beyond style: `main`'s outer catch turns any exception into a NEUTRAL "nothing was reviewed" result, so a throwing graph step would have discarded the model's findings.
4. **Gate-level conclusion** — the tail of `main` is extracted into `concludeReview(model, graph, ctx)`, which `main` now calls: it writes the findings artifact, renders and posts, and returns the exit code from `gateVerdict(model)` — the graph rows are written and rendered but never decide the code and never enter de-duplication. A test drives it in both modes with no / advisory / blocking model findings against graph outcomes success, malformed, timeout, switched off and none, and checks for each: the exit code equals the model-only run, every model finding is in the artifact and in the posted body, and the artifact holds exactly model + graph rows.
5. **Execution context** — the gate is a maintainer tool run from source by `.github/workflows/self-review-gate.yml` (`tsx src/scripts/self_review_gate.ts`); it is not in the package's `bin` and not shipped to consumers, so an installed-package test does not apply. Stated in the module header.
6. **Cases** — an unresolvable base (`no-such-rev` → "the base … does not resolve"), hostile disposition, malformed exhibits, file/line validation: all tested.
7. **Staleness** — documented: rows come from the cached graph as last built; a stale cache yields stale rows, advisory either way; the CI workflow builds no graph, so there the step reports "did not run".
8. **Latency budget and kill switch** — measured 2026-11-06: 0.4–1.2 s over three runs on this repository's own PR range with a cached graph; the bound is 120 s, killed with SIGKILL. `AGENT_CONFIG_SKIP_GRAPH_CHECKS=1` switches the step off for a run where it costs more than it returns or misbehaves, and the run says so.

Review the revised change for: anything that could make the gate block, fail, hang beyond the bound or change its exit code; anything that weakens an existing control; correctness of the range read and the evidence; and test adequacy. State a final verdict as one of `ratified`, `confirmed-non-expanding`, `refused`, `non-convergent`, with reasons and any required changes.

```diff
diff --git a/src/scripts/_lib/graph_check_findings.ts b/src/scripts/_lib/graph_check_findings.ts
index ea09abdd44..9727556a78 100644
--- a/src/scripts/_lib/graph_check_findings.ts
+++ b/src/scripts/_lib/graph_check_findings.ts
@@ -10,13 +10,18 @@
  * finding of its own, never silence: "no analysis" must not read as "nothing
  * found".
  *
- * Not wired into `self_review_gate.ts` here — that is a gate change and needs
- * its own ratification artifact.
+ * `self_review_gate.ts` runs `graphChecksForRange` in a child process and appends the rows
+ * to the model's findings. The rows come from the checkout's cached graph as last built, so
+ * a stale cache yields stale rows (advisory either way). The gate is a maintainer tool run
+ * from source; its CI workflow builds no graph, so there the step reports "did not run".
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
 
@@ -43,6 +48,45 @@ function presenceAt(root: string, witness: string, commit: string): PresenceExhi
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
+        const dirty = new Set(gitProbe(root, ['diff', '--name-only', '-z', 'HEAD']).split('\0').filter(Boolean));
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
index afd0ec42b5..443f9e2284 100644
--- a/src/scripts/self_review_gate.ts
+++ b/src/scripts/self_review_gate.ts
@@ -43,6 +43,7 @@ import {
     load_anthropic_key,
 } from './ai_council/clients.js';
 import { type Exhibit, splitLineSuffix, wellFormedExhibit } from './_lib/finding_exhibits.js';
+import type { GraphCheckFinding } from './_lib/graph_check_findings.js';
 import { independenceFields } from './_lib/review_independence.js';
 import { riskTier } from './_lib/review_risk_tier.js';
 
@@ -1241,6 +1242,125 @@ function resolveReviewer(): Reviewer | null {
 }
 
 // ── CLI ───────────────────────────────────────────────────────────────
+const GRAPH_CHECKS_SCRIPT = path.join(path.dirname(fileURLToPath(import.meta.url)), '_lib', 'graph_check_findings.ts');
+
+/** At most this many graph rows reach the review; the rest are counted in one summary row. */
+export const MAX_GRAPH_ROWS = 200;
+/** At most this many exhibits per graph row; the checks themselves attach one. */
+export const MAX_GRAPH_EXHIBITS = 3;
+/**
+ * The bound on the whole graph step, child included. Measured 2026-11-06: 0.4–1.2 s over
+ * three runs on this repository's own PR range with a cached graph; the bound leaves room
+ * for a cold or much larger graph read and is what the step may cost at most.
+ */
+export const GRAPH_CHECKS_TIMEOUT_MS = 120_000;
+const GRAPH_CHECK_IDS: ReadonlySet<string> = new Set(['untested-change', 'missing-co-change', 'touched-entry-point']);
+
+const advisoryRow = (check: string, title: string, detail: string): GraphCheckFinding =>
+    ({ severity: 'low', kind: 'correctness', disposition: 'advisory', source: 'code-graph', check, title: title.slice(0, 300), detail: detail.slice(0, 2000) }) as GraphCheckFinding;
+const graphDidNotRun = (why: string): GraphCheckFinding[] => [advisoryRow('untested-change', `graph checks did not run: ${why}`, 'No analysis is not a pass.')];
+
+/**
+ * The child's printed rows, normalised under fixed bounds: truncated BEFORE any row is
+ * read, each row rebuilt field by field (never spread), so nothing printed can make a row
+ * blocking, add a field, or cost the gate more than `MAX_GRAPH_ROWS` rows of work.
+ */
+export function normaliseGraphRows(parsed: unknown): GraphCheckFinding[] {
+    if (!Array.isArray(parsed)) return graphDidNotRun('the graph check process printed no list');
+    const head = parsed.slice(0, MAX_GRAPH_ROWS);
+    const rows: GraphCheckFinding[] = [];
+    for (const raw of head) {
+        if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return graphDidNotRun('the graph check process printed a malformed row');
+        const f = raw as Record<string, unknown>;
+        const check = f['check'];
+        if (typeof check !== 'string' || !GRAPH_CHECK_IDS.has(check) || typeof f['title'] !== 'string' || typeof f['detail'] !== 'string') {
+            return graphDidNotRun('the graph check process printed a malformed row');
+        }
+        const row = advisoryRow(check, f['title'], f['detail']);
+        if (typeof f['file'] === 'string') row.file = f['file'].slice(0, 500);
+        if (typeof f['line'] === 'number' && Number.isInteger(f['line']) && f['line'] > 0) row.line = f['line'];
+        if (Array.isArray(f['exhibits'])) {
+            const exhibits = (f['exhibits'] as unknown[]).slice(0, MAX_GRAPH_EXHIBITS).map((e) => wellFormedExhibit(e)).filter((e): e is Exhibit => e !== null);
+            if (exhibits.length > 0) row.exhibits = exhibits;
+        }
+        rows.push(row);
+    }
+    if (parsed.length > MAX_GRAPH_ROWS) {
+        rows.push(advisoryRow('untested-change', `graph checks: ${String(parsed.length - MAX_GRAPH_ROWS)} more row(s) not shown`, `${String(parsed.length)} rows in total; the first ${String(MAX_GRAPH_ROWS)} are listed.`));
+    }
+    return rows;
+}
+
+/**
+ * The code graph's checks for `base`…working tree, run in a child process with a time
+ * bound. It never throws: a load failure, a crash, a hang, malformed output or an error
+ * here becomes one advisory "did not run" row, so the model's findings, the artifact and
+ * the exit code stay what the review alone made them. Off with
+ * `AGENT_CONFIG_SKIP_GRAPH_CHECKS=1` — for a run where the graph step costs more than it
+ * returns, or misbehaves; the run then says the checks were switched off.
+ */
+export function graphChecksContained(root: string, base: string, opts: { script?: string; timeoutMs?: number; env?: NodeJS.ProcessEnv } = {}): GraphCheckFinding[] {
+    try {
+        const env = opts.env ?? process.env;
+        if (env['AGENT_CONFIG_SKIP_GRAPH_CHECKS'] === '1') return graphDidNotRun('switched off by AGENT_CONFIG_SKIP_GRAPH_CHECKS=1');
+        // `tsx` resolved from this repository, not the caller's loader flags, so the same
+        // launch works under the gate's runner and under a test runner.
+        const r = spawnSync(process.execPath, ['--import', 'tsx', opts.script ?? GRAPH_CHECKS_SCRIPT, '--range', base, '--root', root], {
+            cwd: REPO_ROOT,
+            encoding: 'utf-8',
+            timeout: opts.timeoutMs ?? GRAPH_CHECKS_TIMEOUT_MS,
+            killSignal: 'SIGKILL',
+            maxBuffer: 64 * 1024 * 1024,
+        });
+        if (r.error) return graphDidNotRun(r.error.message);
+        if (r.status !== 0) return graphDidNotRun(`the graph check process exited ${String(r.status ?? r.signal)}`);
+        let parsed: unknown;
+        try {
+            parsed = JSON.parse(r.stdout);
+        } catch {
+            return graphDidNotRun('the graph check process printed unparseable output');
+        }
+        return normaliseGraphRows(parsed);
+    } catch (err) {
+        return graphDidNotRun(`the graph step failed: ${err instanceof Error ? err.message : 'unknown error'}`);
+    }
+}
+
+/**
+ * The end of a completed review: model findings (already de-duplicated and checked
+ * against the tree) plus the graph rows, written, rendered and turned into the exit code.
+ * Graph rows never enter de-duplication and never decide the code.
+ */
+export function concludeReview(
+    model: readonly Finding[],
+    graph: readonly GraphCheckFinding[],
+    ctx: { enforce: boolean; coverage: ReviewCoverage; escalation: readonly string[]; findingsOut?: string; post?: (body: string) => void },
+): { code: 0 | 2; findings: Finding[] } {
+    const reviewed: Finding[] = [...model, ...graph];
+    if (ctx.findingsOut) {
+        writeFileSync(
+            ctx.findingsOut,
+            JSON.stringify(
+                {
+                    schema_version: 1,
+                    ...independenceFields(['anthropic']),
+                    coverage: ctx.coverage,
+                    // Readable, not recomputable: the falsifier for the
+                    // supplied-facts change is a count over the NEXT cut,
+                    // and a number a reader has to re-derive from 50
+                    // findings is a number nobody checks.
+                    fact_claims: factClaimCounts(reviewed),
+                    findings: reviewed.map((f) => ({ finding_id: findingId(f), ...f })),
+                },
+                null,
+                2,
+            ) + '\n',
+        );
+    }
+    (ctx.post ?? postReview)(renderReview(reviewed, ctx.enforce, [...ctx.escalation], ctx.coverage));
+    return { code: gateVerdict(model, { enforce: ctx.enforce }), findings: reviewed };
+}
+
 export function main(argv: string[]): 0 | 2 {
     const dryRun = argv.includes('--dry-run');
     const enforce = argv.includes('--enforce');
@@ -1438,46 +1558,28 @@ export function main(argv: string[]): 0 | 2 {
         // deletion claim the range and the tree both disprove is annotated
         // here and stops being merge-blocking; it is still written to the
         // artifact and still rendered, carrying its disproof.
-        const reviewed = annotateContradicted(
+        const modelReviewed = annotateContradicted(
             dedupeFindings(findings),
             rangeDeletions(baseRef),
             (p) => existsSync(path.join(REPO_ROOT, p)),
             rangeModifications(baseRef),
         );
+        // The code graph's three checks join as advisory rows (low / correctness,
+        // never blocking, never de-duplicated against the model's): the
+        // counterfactual review kept them advisory, and a graph that could not be
+        // read is reported as a check that did not run, never as silence.
+        //
+        // The findings file is durable ingestion input for the disposition ledger
+        // (`check_finding_dispositions --ingest <this file>`); its independence
+        // fields are set at write time from the actual reviewer set — one
+        // Anthropic client — so it declares itself single-member and provisional.
         const outIdx = argv.indexOf('--findings-out');
-        if (outIdx >= 0 && argv[outIdx + 1]) {
-            // Durable ingestion input for the disposition ledger (release-truth
-            // Phase 3): `check_finding_dispositions --ingest <this file>`.
-            // The independence fields are set HERE, at write time, from the
-            // actual reviewer set — which for this gate is one Anthropic client,
-            // so the artifact declares itself single-member and provisional. It
-            // previously said nothing, and silence read as acceptance.
-            writeFileSync(
-                argv[outIdx + 1]!,
-                JSON.stringify(
-                    {
-                        schema_version: 1,
-                        ...independenceFields(['anthropic']),
-                        coverage,
-                        // Readable, not recomputable: the falsifier for the
-                        // supplied-facts change is a count over the NEXT cut,
-                        // and a number a reader has to re-derive from 50
-                        // findings is a number nobody checks.
-                        fact_claims: factClaimCounts(reviewed),
-                        findings: reviewed.map((f) => ({
-                            finding_id: findingId(f),
-                            ...f,
-                        })),
-                    },
-                    null,
-                    2,
-                ) + '\n',
-            );
-        }
-        const body = renderReview(reviewed, enforce, plan.escalation, coverage);
-        postReview(body);
-
-        const code = gateVerdict(reviewed, { enforce });
+        const { code } = concludeReview(modelReviewed, graphChecksContained(REPO_ROOT, baseRef), {
+            enforce,
+            coverage,
+            escalation: plan.escalation,
+            ...(outIdx >= 0 && argv[outIdx + 1] ? { findingsOut: argv[outIdx + 1] as string } : {}),
+        });
         if (code === 2) {
             process.stdout.write('::error::self-review-gate — merge-blocking findings under enforce mode.\n');
         }
diff --git a/tests/scripts/self_review_graph_checks.test.ts b/tests/scripts/self_review_graph_checks.test.ts
index 94cfe1a08c..705e56db69 100644
--- a/tests/scripts/self_review_graph_checks.test.ts
+++ b/tests/scripts/self_review_graph_checks.test.ts
@@ -7,10 +7,24 @@ import * as os from 'node:os';
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
+import {
+    classifyBlocking,
+    concludeReview,
+    type Finding,
+    findingId,
+    gateVerdict,
+    graphChecksContained,
+    MAX_GRAPH_EXHIBITS,
+    MAX_GRAPH_ROWS,
+    normaliseGraphRows,
+} from '../../src/scripts/self_review_gate.js';
 
 const SCHEMA = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../src/scripts/schemas/review-findings.schema.json'), 'utf-8')) as {
     properties: { findings: { items: { required: string[]; properties: Record<string, { enum?: string[] }> } } };
@@ -58,3 +72,163 @@ describe('graph checks as self-review findings', () => {
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
+        fs.writeFileSync(blocker, 'process.stdout.write(JSON.stringify([{severity:"critical",kind:"security",check:"untested-change",title:"hostile row",detail:"d",extra:"x"}]));\n');
+        const malformed = path.join(dir, 'malformed.mjs');
+        fs.writeFileSync(malformed, 'process.stdout.write(JSON.stringify([null, {title:{nested:1}}]));\n');
+        const flood = path.join(dir, 'flood.mjs');
+        fs.writeFileSync(flood, 'process.stdout.write(JSON.stringify(Array.from({length:5000},(_,i)=>({check:"untested-change",title:"row "+i,detail:"d"}))));\n');
+        const stubborn = path.join(dir, 'stubborn.mjs');
+        fs.writeFileSync(stubborn, 'process.on("SIGTERM", () => {}); setInterval(() => {}, 1000);\n');
+        for (const script of [crash, garbled, malformed, path.join(dir, 'missing.mjs')]) {
+            const out = graphChecksContained(dir, 'HEAD', { script });
+            expect(out, script).toHaveLength(1);
+            expect(out[0]!.title).toMatch(/^graph checks did not run: /);
+        }
+        // A child that ignores SIGTERM is killed at the bound, not waited for.
+        const t0 = Date.now();
+        expect(graphChecksContained(dir, 'HEAD', { script: stubborn, timeoutMs: 1500 })[0]!.title).toMatch(/^graph checks did not run: /);
+        expect(Date.now() - t0).toBeLessThan(10_000);
+        // The hostile row arrives, and arrives advisory, with nothing it added.
+        const hostile = graphChecksContained(dir, 'HEAD', { script: blocker });
+        expect(hostile).toHaveLength(1);
+        expect(hostile[0]).toMatchObject({ title: 'hostile row', severity: 'low', kind: 'correctness', disposition: 'advisory' });
+        expect(hostile[0]).not.toHaveProperty('extra');
+        expect(classifyBlocking(hostile[0]!)).toBe(false);
+        const flooded = graphChecksContained(dir, 'HEAD', { script: flood });
+        expect(flooded).toHaveLength(MAX_GRAPH_ROWS + 1);
+        expect(flooded.at(-1)!.title).toBe(`graph checks: ${String(5000 - MAX_GRAPH_ROWS)} more row(s) not shown`);
+        expect(graphChecksContained(dir, 'HEAD', { script: blocker, env: { AGENT_CONFIG_SKIP_GRAPH_CHECKS: '1' } })[0]!.title).toMatch(/switched off/);
+        fs.rmSync(dir, { recursive: true, force: true });
+    });
+
+    it('runs the shipped entrypoint and leaves the verdict untouched by real graph rows', async () => {
+        const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'graph-checks-prod-'));
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
+        expect(graphChecksContained(repo, 'no-such-rev', { timeoutMs: 300_000 })[0]!.title).toBe('graph checks did not run: the base no-such-rev does not resolve');
+        const rows = graphChecksContained(repo, base, { timeoutMs: 300_000 });
+        expect(rows.some((f) => f.title === 'changed symbol has no test path: lonely')).toBe(true);
+        for (const enforce of [false, true]) {
+            for (const model of [[], [advisoryModel], [blocking]]) expect(gateVerdict([...model, ...rows], { enforce })).toBe(gateVerdict(model, { enforce }));
+        }
+        fs.rmSync(repo, { recursive: true, force: true });
+    });
+
+    it('normalises hostile rows under fixed bounds before reading them', () => {
+        const objCheck = normaliseGraphRows([{ check: { toString: null }, title: 't', detail: 'd' }]);
+        expect(objCheck[0]!.title).toMatch(/malformed row/);
+        const rows = normaliseGraphRows([
+            { check: 'untested-change', title: 't', detail: 'd', disposition: 'blocking', severity: 'critical', kind: 'security', file: 'a.ts', line: -3, exhibits: [{ type: 'presence' }, ...Array.from({ length: 50 }, () => ({ type: 'presence', path: 'a.ts', line: 1, quote: 'x', commit: 'abcdef1' }))] },
+        ]);
+        expect(rows[0]).toMatchObject({ severity: 'low', kind: 'correctness', disposition: 'advisory', file: 'a.ts' });
+        expect(rows[0]).not.toHaveProperty('line');
+        expect(rows[0]!.exhibits!.length).toBeLessThanOrEqual(MAX_GRAPH_EXHIBITS);
+        // Truncation happens before any row past the bound is read: a malformed row there is never seen.
+        const many = [...Array.from({ length: MAX_GRAPH_ROWS }, (_, i) => ({ check: 'untested-change', title: `r${String(i)}`, detail: 'd' })), null];
+        expect(normaliseGraphRows(many).at(-1)!.title).toBe('graph checks: 1 more row(s) not shown');
+    });
+
+    it('concludes a review with the model findings intact, whatever the graph step returned', () => {
+        const coverage = { chunks: 1, filesReviewed: 1, filesTotal: 1, unreviewed: [], reviewCopies: 0 };
+        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'graph-checks-conclude-'));
+        const graphOutcomes = {
+            success: [{ ...graphChecksDidNotRun('x')[0]!, title: 'changed symbol has no test path: f', file: 'a.ts' }],
+            malformed: normaliseGraphRows([null]),
+            timeout: graphChecksDidNotRun('spawnSync node ETIMEDOUT'),
+            skipped: graphChecksDidNotRun('switched off by AGENT_CONFIG_SKIP_GRAPH_CHECKS=1'),
+            none: [],
+        };
+        for (const enforce of [false, true]) {
+            for (const model of [[], [advisoryModel], [blocking, advisoryModel]]) {
+                const alone = concludeReview(model, [], { enforce, coverage, escalation: [], post: () => {} }).code;
+                for (const [name, graph] of Object.entries(graphOutcomes)) {
+                    const out = path.join(dir, `${name}.json`);
+                    let posted = '';
+                    const r = concludeReview(model, graph, { enforce, coverage, escalation: [], findingsOut: out, post: (b) => (posted = b) });
+                    expect(r.code, `${name} enforce=${String(enforce)}`).toBe(alone);
+                    const written = JSON.parse(fs.readFileSync(out, 'utf-8')) as { findings: Array<{ title: string }> };
+                    for (const m of model) expect(written.findings.map((f) => f.title)).toContain(m.title);
+                    expect(written.findings).toHaveLength(model.length + graph.length);
+                    for (const m of model) expect(posted).toContain(m.title);
+                }
+            }
+        }
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
