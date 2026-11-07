<!-- evidence-type: analysis -->

# Review, round 6: the code graph's review checks as a separate, non-required CI job beside the self-review gate

Rounds 1-5 reviewed placements of the graph checks inside `self_review_gate.ts`; all were refused. In round 5 one seat named "a separate, non-required reporting job" as an alternative. The owner has since narrowed the acceptance criterion to exactly that ("a separate, non-required job reports the three checks beside the gate"). This round reviews an implementation of the narrowed criterion. `self_review_gate.ts` is not changed by this diff.

What the diff does:

- **New job `graph-checks`** in `.github/workflows/self-review-gate.yml`: `pull_request` only, `continue-on-error: true`, `timeout-minutes: 10`, job-level `permissions: contents: read` (replacing the workflow's `pull-requests: write`), no PR comment, its own artifact name `code-graph-checks`. Off switch: repository variable `GRAPH_CHECKS_JOB=off`. It builds the graph (`code-graph build`, measured 23 s on this repository), then runs the report script, appends the script's summary to the job summary, uploads the JSON.
- **New script `src/scripts/graph_checks_report.ts`**: diffs `merge-base(base, HEAD)` against the checkout, runs `reviewRiskAt`, converts the checks with the existing `graphCheckFindings`, and writes `graph-checks.json` (`schema: graph-checks-report/1`, `advisory: true`, `status: analysed | no-analysis`, `reviewed_base`, `reviewed_head`, `graph_checksum`, `omitted`, `graph_findings` — deliberately not `findings`) and `summary.md`. At most 100 findings per check. A missing graph, unresolvable base or thrown check becomes `no-analysis` with a reason, exit 0. Exit 1 only when the report cannot be written; exit 2 on a usage error (a flag without a value is refused).
- **Exhibits** quote `git show <HEAD>:<file>` blobs through an injected `LineReader`; `graphCheckFindings` keeps its working-tree default for the existing caller.
- **Summary escaping**: control characters to spaces, then `&`, `<`, `>`, backtick, `|`, `[`, `]` to HTML entities, applied to every graph-derived string.
- **Tests** (`tests/scripts/graph_checks_report.test.ts`): blob quoting survives a tampered working tree (shown red with the working-tree reader), a witness absent from the commit carries no exhibit, the report has no `findings` key, no-analysis is its own status in JSON and summary, composed comment markers and HTML/link/table characters come out inert, per-check cap, flag parsing, and `main` writing both files with no graph.

Review the change for: anything that could affect the self-review gate's jobs, their exit codes or their artifacts; anything that weakens an existing control; whether the job is genuinely non-required and read-only; correctness of the range read and the evidence; safety of the rendered summary; and test adequacy. State a final verdict as one of `ratified`, `confirmed-non-expanding`, `refused`, `non-convergent`, with reasons and any required changes.

```diff
diff --git a/.github/workflows/self-review-gate.yml b/.github/workflows/self-review-gate.yml
index eea0159ca4..01f66ee582 100644
--- a/.github/workflows/self-review-gate.yml
+++ b/.github/workflows/self-review-gate.yml
@@ -138,3 +138,57 @@ jobs:
           path: /tmp/self-review-findings.json
           retention-days: 30
           if-no-files-found: ignore
+
+  # The code graph's three review checks (untested change, missing co-change
+  # partner, touched entry point), reported BESIDE the gate, never by it —
+  # roadmap `road-to-a-graph-that-wins` AC-8 as the owner narrowed it on
+  # 2026-11-06, after five AI-council rounds refused every placement on the
+  # gate's required path (`agents/evidence/council/graph-checks-self-review-*`).
+  #
+  # Separate job, so nothing here can reach the gate's process, latency or exit
+  # code. Never required (`continue-on-error`), read-only (`contents: read`, no
+  # PR comment), its own artifact name, and that artifact carries
+  # `graph_findings` — never `findings` — so the dispositions ledger cannot
+  # ingest it as review input. A failed graph build reports "no analysis",
+  # which is not a pass. Off switch: repository variable GRAPH_CHECKS_JOB=off.
+  graph-checks:
+    if: github.event_name == 'pull_request' && vars.GRAPH_CHECKS_JOB != 'off'
+    runs-on: ubuntu-latest
+    continue-on-error: true
+    timeout-minutes: 10
+    permissions:
+      contents: read
+    steps:
+      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1  # v7.0.1
+        with:
+          persist-credentials: false
+          # Full history: without it the co-change check reads `unknown`.
+          fetch-depth: 0
+      - uses: actions/setup-node@949feb2413d6458794dcd2491c4babbbce0c15c1  # v7.1.0
+        with:
+          node-version: '22'
+      - run: npm ci --no-audit --no-fund --prefer-offline
+      - name: Build the code graph
+        continue-on-error: true
+        run: ./node_modules/.bin/tsx src/scripts/code_graph/cli.ts build --root . --out "$RUNNER_TEMP/code-graph/graph.json"
+      - name: Report the graph checks (advisory)
+        if: always()
+        env:
+          BASE_REF: ${{ github.base_ref }}
+        run: ./node_modules/.bin/tsx src/scripts/graph_checks_report.ts --base "origin/$BASE_REF" --out "$RUNNER_TEMP/graph-checks" --graph "$RUNNER_TEMP/code-graph/graph.json"
+      - name: Job summary
+        if: always()
+        run: |
+          if [ -f "$RUNNER_TEMP/graph-checks/summary.md" ]; then
+            cat "$RUNNER_TEMP/graph-checks/summary.md" >> "$GITHUB_STEP_SUMMARY"
+          else
+            echo "Code-graph review checks: no report was written. No analysis is not a pass." >> "$GITHUB_STEP_SUMMARY"
+          fi
+      - name: Upload the graph-checks artifact
+        if: always()
+        uses: actions/upload-artifact@cf430e030ddbb5b0abf93d22962f4752f3646cd9  # v7.0.2
+        with:
+          name: code-graph-checks
+          path: ${{ runner.temp }}/graph-checks/graph-checks.json
+          retention-days: 30
+          if-no-files-found: ignore
diff --git a/docs/contracts/branch-protection-policy.md b/docs/contracts/branch-protection-policy.md
index c3c5d6108f..3e4ca1e19e 100644
--- a/docs/contracts/branch-protection-policy.md
+++ b/docs/contracts/branch-protection-policy.md
@@ -91,7 +91,7 @@ the **reported check names** — the strings a required-check list must match.
 | `rule-backstops.yml` | `Rule backstops` |
 | `no-python-in-src.yml` | `no-python-in-src` |
 | `commit-subjects.yml` | `lint commit subjects` |
-| evaluator / originality | `originality-gate` · `gate-dry-run` · `live-advisory` |
+| evaluator / originality | `originality-gate` · `gate-dry-run` · `live-advisory` · `graph-checks` (advisory, `continue-on-error`, never required) |
 | `glama-mcp-smoke.yml` | `glama MCP smoke` |
 | `deploy-mcp-worker.yml` | `MCP worker deploy dry-run` |
 | `consumer-matrix.yml` | `Plugin bootstrap integrity` · `Packed-artifact evaluation (clean container)` |
diff --git a/src/scripts/_lib/graph_check_findings.ts b/src/scripts/_lib/graph_check_findings.ts
index ea09abdd44..f0fec0a0ef 100644
--- a/src/scripts/_lib/graph_check_findings.ts
+++ b/src/scripts/_lib/graph_check_findings.ts
@@ -10,8 +10,9 @@
  * finding of its own, never silence: "no analysis" must not read as "nothing
  * found".
  *
- * Not wired into `self_review_gate.ts` here — that is a gate change and needs
- * its own ratification artifact.
+ * Not wired into `self_review_gate.ts`: an AI-council review (five rounds,
+ * 2026-11-06) refused every placement on the gate's required path. The checks
+ * are reported by a separate, non-required job instead — `graph_checks_report.ts`.
  */
 import * as fs from 'node:fs';
 import * as path from 'node:path';
@@ -28,23 +29,31 @@ const TITLE: Readonly<Record<ReviewCheck['id'], string>> = {
     'touched-entry-point': 'diff reaches an entry point or flow',
 };
 
-function presenceAt(root: string, witness: string, commit: string): PresenceExhibit | null {
+/** One line of `file` (1-based), or undefined when it cannot be read. */
+export type LineReader = (file: string, line: number) => string | undefined;
+
+/** The working tree. A caller quoting a commit passes a reader over that commit's blobs instead. */
+export function workingTreeReader(root: string): LineReader {
+    return (file, line) => {
+        try {
+            return fs.readFileSync(path.join(root, file), 'utf-8').split('\n')[line - 1];
+        } catch {
+            return undefined;
+        }
+    };
+}
+
+function presenceAt(read: LineReader, witness: string, commit: string): PresenceExhibit | null {
     const m = /^(.+):(\d+)$/.exec(witness);
     if (!m) return null;
     const file = m[1] as string;
     const line = Number(m[2]);
-    let text: string | undefined;
-    try {
-        text = fs.readFileSync(path.join(root, file), 'utf-8').split('\n')[line - 1];
-    } catch {
-        return null;
-    }
-    const quote = (text ?? '').trim().slice(0, MAX_QUOTE_CHARS);
+    const quote = (read(file, line) ?? '').trim().slice(0, MAX_QUOTE_CHARS);
     return quote ? { type: 'presence', path: file, line, quote, commit } : null;
 }
 
 /** One finding per flagged item, one per check that could not run; a passing check yields none. */
-export function graphCheckFindings(checks: readonly ReviewCheck[], root: string, commit: string): GraphCheckFinding[] {
+export function graphCheckFindings(checks: readonly ReviewCheck[], root: string, commit: string, read: LineReader = workingTreeReader(root)): GraphCheckFinding[] {
     const out: GraphCheckFinding[] = [];
     for (const c of checks) {
         const base = { severity: 'low', kind: 'correctness', disposition: 'advisory', source: 'code-graph', check: c.id } as const;
@@ -55,7 +64,7 @@ export function graphCheckFindings(checks: readonly ReviewCheck[], root: string,
         if (c.status !== 'finding') continue;
         for (const i of c.items) {
             if (c.id === 'untested-change' && i.verdict !== 'untested') continue;
-            const ex = i.witness ? presenceAt(root, i.witness, commit) : null;
+            const ex = i.witness ? presenceAt(read, i.witness, commit) : null;
             const loc = i.witness ? /^(.+):(\d+)$/.exec(i.witness) : null;
             out.push({
                 ...base,
diff --git a/src/scripts/graph_checks_report.ts b/src/scripts/graph_checks_report.ts
new file mode 100644
index 0000000000..df0c6506f4
--- /dev/null
+++ b/src/scripts/graph_checks_report.ts
@@ -0,0 +1,184 @@
+#!/usr/bin/env node
+/**
+ * The code graph's three review checks, reported by a job of their own beside
+ * the self-review gate (roadmap `road-to-a-graph-that-wins` AC-8, narrowed by
+ * the owner on 2026-11-06 after five council rounds refused every placement on
+ * the gate's required path).
+ *
+ * What keeps it out of the gate, by construction rather than by care:
+ * - it runs in its own CI job (`continue-on-error`, never required), so its
+ *   latency, memory and failures cannot touch the gate's process or exit code;
+ * - its artifact carries `graph_findings`, never `findings`, so the
+ *   dispositions ledger (`check_finding_dispositions --ingest`) cannot read it
+ *   as review input;
+ * - it posts no PR comment — the job summary is its only rendered surface, and
+ *   every graph-derived string is entity-escaped before it reaches it;
+ * - exhibits quote the reviewed commit's blobs, never the working tree.
+ *
+ * Exit 0 whenever a report was written, including "no analysis"; exit 1 only
+ * when the report itself could not be written; exit 2 on a usage error.
+ */
+import { execFileSync } from 'node:child_process';
+import * as fs from 'node:fs';
+import * as path from 'node:path';
+
+import { graphCheckFindings, type GraphCheckFinding, type LineReader } from './_lib/graph_check_findings.js';
+import { cacheFor } from './code_graph/cli_args.js';
+import { diffHunks, reviewRiskAt, type ReviewCheck } from './code_graph/review_risk.js';
+
+/** Per check, so one noisy check cannot crowd the other two out of the report. */
+const MAX_PER_CHECK = 100;
+const MAX_SUMMARY_ROWS = 50;
+const GIT_MAX_BUFFER = 16 * 1024 * 1024;
+
+export interface GraphChecksReport {
+    schema: 'graph-checks-report/1';
+    advisory: true;
+    status: 'analysed' | 'no-analysis';
+    reason?: string;
+    reviewed_base: string;
+    reviewed_head: string | null;
+    graph_checksum: string | null;
+    omitted: number;
+    graph_findings: GraphCheckFinding[];
+}
+
+export interface Analysis {
+    checks: readonly ReviewCheck[];
+    checksum: string;
+}
+
+export interface Args {
+    base: string;
+    out: string;
+    graph: string | null;
+}
+
+/** Every flag takes a value; a flag at the end of argv, or followed by another flag, is a usage error. */
+export function parseArgs(argv: readonly string[]): Args {
+    const value = (name: string): string | null => {
+        const i = argv.indexOf(name);
+        if (i < 0) return null;
+        const v = argv[i + 1];
+        if (v === undefined || v.startsWith('--')) throw new Error(`${name} needs a value`);
+        return v;
+    };
+    const base = value('--base');
+    const out = value('--out');
+    if (base === null) throw new Error('--base <rev> is required');
+    if (out === null) throw new Error('--out <dir> is required');
+    return { base, out, graph: value('--graph') };
+}
+
+function git(root: string, args: string[]): string | null {
+    try {
+        return execFileSync('git', args, { cwd: root, encoding: 'utf-8', maxBuffer: GIT_MAX_BUFFER, stdio: ['ignore', 'pipe', 'ignore'] });
+    } catch {
+        return null;
+    }
+}
+
+/** Lines of `commit:file`, read once per file; a path absent from the commit reads as undefined. */
+function blobReader(root: string, commit: string): LineReader {
+    const cache = new Map<string, string[] | null>();
+    return (file, line) => {
+        if (!cache.has(file)) {
+            const text = file.startsWith('-') ? null : git(root, ['show', `${commit}:${file}`]);
+            cache.set(file, text === null ? null : text.split('\n'));
+        }
+        return cache.get(file)?.[line - 1];
+    };
+}
+
+/** HTML entities for every character that could open markup, a link, code, a table cell or a comment. */
+export function escapeMarkdown(s: string): string {
+    return s
+        .replace(/[\u0000-\u001f\u007f]/g, ' ')
+        .replace(/&/g, '&amp;')
+        .replace(/</g, '&lt;')
+        .replace(/>/g, '&gt;')
+        .replace(/`/g, '&#96;')
+        .replace(/\|/g, '&#124;')
+        .replace(/\[/g, '&#91;')
+        .replace(/\]/g, '&#93;');
+}
+
+export function buildReport(root: string, base: string, analysis: Analysis | null, reason?: string): GraphChecksReport {
+    const head = git(root, ['rev-parse', 'HEAD'])?.trim() || null;
+    const common = { schema: 'graph-checks-report/1', advisory: true, reviewed_base: base, reviewed_head: head } as const;
+    if (analysis === null) {
+        return { ...common, status: 'no-analysis', reason: reason ?? 'no reason recorded', graph_checksum: null, omitted: 0, graph_findings: [] };
+    }
+    const all = head ? graphCheckFindings(analysis.checks, root, head, blobReader(root, head)) : graphCheckFindings(analysis.checks, root, 'unknown', () => undefined);
+    const kept: GraphCheckFinding[] = [];
+    const seen = new Map<string, number>();
+    for (const f of all) {
+        const n = (seen.get(f.check) ?? 0) + 1;
+        seen.set(f.check, n);
+        if (n <= MAX_PER_CHECK) kept.push(f);
+    }
+    return { ...common, status: 'analysed', graph_checksum: analysis.checksum, omitted: all.length - kept.length, graph_findings: kept };
+}
+
+export function renderSummary(r: GraphChecksReport): string {
+    const lines = [
+        '## Code-graph review checks (advisory, separate job)',
+        '',
+        'Reported beside the self-review gate, never by it: these rows cannot block, and nothing ingests them as review findings.',
+        '',
+        `- base: ${escapeMarkdown(r.reviewed_base)} · head: ${escapeMarkdown(r.reviewed_head ?? 'unknown')} · graph: ${escapeMarkdown(r.graph_checksum?.slice(0, 12) ?? 'none')}`,
+    ];
+    if (r.status === 'no-analysis') {
+        lines.push(`- status: **no analysis** — ${escapeMarkdown(r.reason ?? '')}`, '', 'No analysis is not a pass.');
+        return `${lines.join('\n')}\n`;
+    }
+    lines.push(`- findings: ${r.graph_findings.length}${r.omitted ? ` (+${r.omitted} omitted)` : ''}`, '');
+    if (r.graph_findings.length === 0) {
+        lines.push('No check flagged anything.');
+        return `${lines.join('\n')}\n`;
+    }
+    lines.push('| check | finding | at |', '|---|---|---|');
+    for (const f of r.graph_findings.slice(0, MAX_SUMMARY_ROWS)) {
+        const at = f.file ? `${f.file}:${f.line ?? ''}` : '';
+        lines.push(`| ${escapeMarkdown(f.check)} | ${escapeMarkdown(f.title)} | ${escapeMarkdown(at)} |`);
+    }
+    if (r.graph_findings.length > MAX_SUMMARY_ROWS) lines.push('', `${r.graph_findings.length - MAX_SUMMARY_ROWS} more in the artifact.`);
+    return `${lines.join('\n')}\n`;
+}
+
+function analyse(root: string, base: string, graph: string): { analysis: Analysis | null; reason?: string } {
+    if (!fs.existsSync(graph)) return { analysis: null, reason: 'no code graph has been built' };
+    const from = git(root, ['merge-base', base, 'HEAD'])?.trim() || base;
+    const hunks = diffHunks(root, from);
+    if (hunks === null) return { analysis: null, reason: `the base does not resolve: ${base}` };
+    try {
+        const r = reviewRiskAt(graph, root, from, hunks);
+        return { analysis: { checks: r.checks, checksum: r.basis.graph_checksum } };
+    } catch (e) {
+        return { analysis: null, reason: `the checks failed: ${(e as Error).message}`.slice(0, 300) };
+    }
+}
+
+export function main(argv: readonly string[], root = process.cwd()): number {
+    let args: Args;
+    try {
+        args = parseArgs(argv);
+    } catch (e) {
+        process.stderr.write(`graph_checks_report: ${(e as Error).message}\nusage: graph_checks_report.ts --base <rev> --out <dir> [--graph <graph.json>]\n`);
+        return 2;
+    }
+    const { analysis, reason } = analyse(root, args.base, args.graph ?? cacheFor(root));
+    const report = buildReport(root, args.base, analysis, reason);
+    try {
+        fs.mkdirSync(args.out, { recursive: true });
+        fs.writeFileSync(path.join(args.out, 'graph-checks.json'), `${JSON.stringify(report, null, 2)}\n`);
+        fs.writeFileSync(path.join(args.out, 'summary.md'), renderSummary(report));
+    } catch (e) {
+        process.stderr.write(`graph_checks_report: could not write the report: ${(e as Error).message}\n`);
+        return 1;
+    }
+    process.stdout.write(`graph checks: ${report.status}, ${report.graph_findings.length} finding(s)\n`);
+    return 0;
+}
+
+if (import.meta.url === `file://${process.argv[1]}`) process.exit(main(process.argv.slice(2)));
diff --git a/tests/scripts/graph_checks_report.test.ts b/tests/scripts/graph_checks_report.test.ts
new file mode 100644
index 0000000000..b8d475b156
--- /dev/null
+++ b/tests/scripts/graph_checks_report.test.ts
@@ -0,0 +1,112 @@
+/**
+ * The graph-checks reporting job (AC-8, narrowed): a separate, non-required job
+ * beside the self-review gate. Its artifact must not be ingestible as review
+ * findings, its exhibits must quote the reviewed commit, its summary must be
+ * inert markdown, and "no analysis" must never read as a pass.
+ */
+import { execFileSync } from 'node:child_process';
+import * as fs from 'node:fs';
+import * as os from 'node:os';
+import * as path from 'node:path';
+import { describe, expect, it } from 'vitest';
+
+import { buildReport, escapeMarkdown, main, parseArgs, renderSummary } from '../../src/scripts/graph_checks_report.js';
+import type { ReviewCheck } from '../../src/scripts/code_graph/review_risk.js';
+
+function git(root: string, ...args: string[]): string {
+    return execFileSync('git', args, { cwd: root, encoding: 'utf-8', env: { ...process.env, GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@example.com', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@example.com' } }).trim();
+}
+
+function repo(): { root: string; base: string; head: string } {
+    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'graph-checks-report-'));
+    git(root, 'init', '-q', '-b', 'main');
+    fs.mkdirSync(path.join(root, 'app'));
+    fs.writeFileSync(path.join(root, 'app/a.ts'), 'export function lonely() {\n  return 1;\n}\n');
+    git(root, 'add', '.');
+    git(root, 'commit', '-qm', 'base');
+    const base = git(root, 'rev-parse', 'HEAD');
+    fs.writeFileSync(path.join(root, 'app/a.ts'), 'export function lonely() {\n  return 2;\n}\n');
+    git(root, 'commit', '-qam', 'head');
+    return { root, base, head: git(root, 'rev-parse', 'HEAD') };
+}
+
+const flagged = (label: string, witness: string): ReviewCheck[] => [
+    { id: 'untested-change', status: 'finding', items: [{ id: `x#${label}`, label, verdict: 'untested', witness, edges: [] }] },
+    { id: 'missing-co-change', status: 'pass', items: [] },
+    { id: 'touched-entry-point', status: 'pass', items: [] },
+];
+
+describe('graph checks report', () => {
+    it('quotes the reviewed commit, not the working tree', () => {
+        const { root, base, head } = repo();
+        fs.writeFileSync(path.join(root, 'app/a.ts'), 'tampered after commit\n');
+        const r = buildReport(root, base, { checks: flagged('lonely', 'app/a.ts:1'), checksum: 'c0ffee' });
+        expect(r.reviewed_head).toBe(head);
+        expect(r.graph_findings[0]?.exhibits?.[0]).toMatchObject({ type: 'presence', path: 'app/a.ts', line: 1, quote: 'export function lonely() {', commit: head });
+    });
+
+    it('drops the exhibit when the witness is not in the reviewed commit', () => {
+        const { root, base } = repo();
+        const r = buildReport(root, base, { checks: flagged('ghost', 'app/missing.ts:3'), checksum: 'c0ffee' });
+        expect(r.graph_findings).toHaveLength(1);
+        expect(r.graph_findings[0]?.exhibits).toBeUndefined();
+    });
+
+    it('cannot be read as a review-findings ledger', () => {
+        const { root, base } = repo();
+        const r = buildReport(root, base, { checks: flagged('lonely', 'app/a.ts:1'), checksum: 'c0ffee' }) as unknown as Record<string, unknown>;
+        expect(r).not.toHaveProperty('findings');
+        expect(r['schema']).toBe('graph-checks-report/1');
+        expect(r['advisory']).toBe(true);
+    });
+
+    it('records no analysis as its own status, never as an empty pass', () => {
+        const { root, base } = repo();
+        const r = buildReport(root, base, null, 'no code graph has been built');
+        expect(r.status).toBe('no-analysis');
+        expect(r.graph_findings).toEqual([]);
+        expect(renderSummary(r)).toContain('No analysis is not a pass');
+    });
+
+    it('renders hostile strings inert, including composed comment markers', () => {
+        for (const s of ['<!' + '<!--' + '--', '--<!-->', '<script>x</script>', '[a](http://e.example)', '`x`|y', 'a\u0007b']) {
+            const out = escapeMarkdown(s);
+            expect(out).not.toMatch(/[<>`|[\]\u0000-\u001f]/);
+        }
+        const { root, base } = repo();
+        const r = buildReport(root, base, { checks: flagged('<!' + '<!--' + '--', 'app/a.ts:1'), checksum: 'c0ffee' });
+        const md = renderSummary(r);
+        expect(md).not.toContain('<!--');
+        expect(md).toContain('advisory');
+    });
+
+    it('caps per check, so a noisy check cannot crowd the others out', () => {
+        const { root, base } = repo();
+        const many = Array.from({ length: 150 }, (_, k) => ({ id: `x#s${k}`, label: `s${k}`, verdict: 'untested' as const, witness: 'app/a.ts:1', edges: [] }));
+        const checks: ReviewCheck[] = [
+            { id: 'untested-change', status: 'finding', items: many },
+            { id: 'missing-co-change', status: 'unknown', reason: 'shallow clone', items: [] },
+            { id: 'touched-entry-point', status: 'pass', items: [] },
+        ];
+        const r = buildReport(root, base, { checks, checksum: 'c0ffee' });
+        expect(r.graph_findings.filter((f) => f.check === 'untested-change')).toHaveLength(100);
+        expect(r.graph_findings.some((f) => f.check === 'missing-co-change')).toBe(true);
+        expect(r.omitted).toBe(50);
+    });
+
+    it('refuses a flag with no value instead of reading a neighbour', () => {
+        expect(() => parseArgs(['--base'])).toThrow(/--base/);
+        expect(() => parseArgs(['--out', 'x'])).toThrow(/--base/);
+        expect(parseArgs(['--base', 'origin/main', '--out', 'o'])).toEqual({ base: 'origin/main', out: 'o', graph: null });
+    });
+
+    it('main writes the artifact and the summary and exits 0 when no graph exists', () => {
+        const { root, base } = repo();
+        const out = path.join(root, '.out');
+        const code = main(['--base', base, '--out', out, '--graph', path.join(root, 'nope.json')], root);
+        expect(code).toBe(0);
+        const json = JSON.parse(fs.readFileSync(path.join(out, 'graph-checks.json'), 'utf-8')) as { status: string };
+        expect(json.status).toBe('no-analysis');
+        expect(fs.readFileSync(path.join(out, 'summary.md'), 'utf-8')).toContain('No analysis is not a pass');
+    });
+});
```
