<!-- evidence-type: analysis -->

# Review, round 9: the `graph-checks` job beside the self-review gate

Round 8 (`agents/evidence/council/graph-checks-job-r8-20261108.question.md`): openai `confirmed-non-expanding`, high, no dealbreaker; anthropic `confirmed-non-expanding`, high, **dealbreaker** — the workflow's fallback JSON. Round 7 (`…-r7-…`) reviewed the version shipped on `main`. Both seats requested changes. anthropic voted `confirmed-non-expanding` with a dealbreaker, and openai voted `refused` with a dealbreaker. Their shared, concrete finding was the flagged count, which is fixed below. This round reviews the corrected version.

## What changed since round 8

- **Fallback report.** When the report step never finished, the job summary step wrote `{"schema":"graph-checks-report/1","advisory":true,"status":"no-report","reason":…}`: a status outside the declared union, and none of `revisions`, `graph_provenance`, `graph_checksum`, `checks`, `omitted`, `graph_findings`. openai noted that changing the status alone would not fix it. The step now writes the **complete `no-analysis` shape** with `node -e`, reading the base ref from an environment variable so `JSON.stringify` escapes it. Node is present once `setup-node` ran, even if `npm ci` failed. A new test extracts that `node -e` snippet from the workflow, runs it with `BASE_REF='feat/"odd"'`, and asserts that its keys, and its `revisions` keys, equal those of the script's own `buildReport(…, null, reason)` output. It was shown red before the change (no snippet).
- **Empty-rows wording.** "No check flagged anything." became "No finding rows were produced; see the check statuses above." The old sentence also appeared when a check did not run.
- **Test.** The cap test now also asserts the report's `omitted: 50`.
- Not changed: anthropic's race scenario. openai showed that `main` writes `graph-checks.json` before `summary.md`, so an interruption leaves the opposite ordering; the fallback only runs when `summary.md` is absent.

## What changed since round 7

- **Flagged count.** `buildReport` stated the `untested-change` count from every item, while `capChecks` kept only `untested` items. With 30 tested and 150 untested items the summary therefore said "180 flagged". One function, `flaggedItems`, now feeds both the cap and the count. The existing cap test now asserts `items: 150` and the rendered `untested-change: 150 flagged`. It was shown red (180) before the fix. A sweep for the same construct found no other site; `graphCheckFindings` already filtered.
- **Provenance.** The job comment, the script header and the summary now say that the graph build and the reporter run code from the PR itself. The report is therefore advisory output of PR-controlled code, not independent evidence. The summary no longer says "these rows cannot block".
- **Requiredness.** The dated ruleset observation is gone. The comment and header now say that whether the job is required is the branch ruleset's call, which is outside the repository's files, and that `continue-on-error` alone does not make it optional.
- **Time budget.** The step comment no longer says the summary "always" keeps time. It now says the seven-minute step leaves the rest of the job's ten minutes, unless checkout and install already used them, in which case the job times out with no summary.
- **Not done: a separate workflow file.** Only anthropic asked for it. openai argued it would not isolate runner contention or the external ruleset dependency. A new workflow is also a new CI surface that, per this repository's practice, lands with its own ratification. The job therefore stays in the same file; the coupling that remains is shared YAML parsing.

## The job (`.github/workflows/self-review-gate.yml`, from the comment above it to the end)

```yaml
  # The code graph's three review checks (untested change, missing co-change
  # partner, touched entry point), reported BESIDE the gate, never by it —
  # roadmap `road-to-a-graph-that-wins` AC-8 as the owner narrowed it on
  # 2026-11-06, after five AI-council rounds refused every placement on the
  # gate's required path (`agents/evidence/council/graph-checks-*`).
  #
  # Whether it is required is the branch ruleset's call, which lives outside
  # this file: `continue-on-error` only keeps a red here from failing the
  # workflow run. No step here is a dependency of the gate's jobs.
  #
  # The token is read-only (`contents: read`, no PR comment). That limits the
  # token, not the job: `npm ci`, the graph build and the reporter run code from
  # the PR itself, so the report is advisory output of PR-controlled code, never
  # independent evidence. It checks out the PR's REAL head, never the synthetic
  # merge commit, so every SHA it records exists.
  #
  # Artifact `code-graph-checks` holds `graph_findings`, never `findings`, and
  # the dispositions ledger refuses to ingest it. "No analysis" and "no report"
  # are both stated as such, never as a pass.
  #
  # Off switch: repository variable GRAPH_CHECKS_JOB=off. Turn it off when it
  # times out on consecutive PRs, reports rows that misstate the diff, or
  # contends with the required checks for runners; the maintainer decides.
  graph-checks:
    if: github.event_name == 'pull_request' && vars.GRAPH_CHECKS_JOB != 'off'
    runs-on: ubuntu-latest
    continue-on-error: true
    timeout-minutes: 10
    permissions:
      contents: read
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1  # v7.0.1
        with:
          persist-credentials: false
          ref: ${{ github.event.pull_request.head.sha }}
          # Full history: the merge-base, and the co-change check's history.
          fetch-depth: 0
      - uses: actions/setup-node@949feb2413d6458794dcd2491c4babbbce0c15c1  # v7.1.0
        with:
          node-version: '22'
      - run: npm ci --no-audit --no-fund --prefer-offline
      # Builds the graph itself, from this clean checkout, then reports. Seven
      # minutes (measured: about 25 s to build this repository) leave the rest of
      # the job's ten for the summary and the upload below, unless checkout and
      # install already used them; then the job times out with no summary.
      - name: Build the graph and report its checks (advisory)
        timeout-minutes: 7
        env:
          BASE_REF: ${{ github.base_ref }}
        run: ./node_modules/.bin/tsx src/scripts/graph_checks_report.ts --base "origin/$BASE_REF" --out "$RUNNER_TEMP/graph-checks"
      # When the report step never finished, the fallback is a complete
      # no-analysis report (the same shape the script writes), built with node so
      # the base ref is escaped; node is present once setup-node ran, even if
      # `npm ci` failed.
      - name: Job summary
        if: always()
        env:
          BASE_REF: ${{ github.base_ref }}
          OUT: ${{ runner.temp }}/graph-checks/graph-checks.json
        run: |
          mkdir -p "$RUNNER_TEMP/graph-checks"
          if [ -f "$RUNNER_TEMP/graph-checks/summary.md" ]; then
            cat "$RUNNER_TEMP/graph-checks/summary.md" >> "$GITHUB_STEP_SUMMARY"
          else
            echo "Code-graph review checks: no report was written (the job failed before the report step finished). No analysis is not a pass." >> "$GITHUB_STEP_SUMMARY"
            node -e 'require("fs").writeFileSync(process.env.OUT, JSON.stringify({ schema: "graph-checks-report/1", advisory: true, status: "no-analysis", reason: "no report was written: the job failed before the report step finished", revisions: { base_ref: process.env.BASE_REF ?? "", base_sha: null, merge_base_sha: null, head_sha: null }, graph_provenance: null, graph_checksum: null, checks: [], omitted: 0, graph_findings: [] }) + "\n")'
          fi
      - name: Upload the graph-checks artifact
        if: always()
        uses: actions/upload-artifact@cf430e030ddbb5b0abf93d22962f4752f3646cd9  # v7.0.2
        with:
          name: code-graph-checks
          path: ${{ runner.temp }}/graph-checks/graph-checks.json
          retention-days: 30
          if-no-files-found: ignore
```

## The script (`src/scripts/graph_checks_report.ts`)

```ts
#!/usr/bin/env node
/**
 * The code graph's three review checks, reported by a job of their own beside
 * the self-review gate (roadmap `road-to-a-graph-that-wins` AC-8, narrowed by
 * the owner on 2026-11-06 after five council rounds refused every placement on
 * the gate's required path).
 *
 * What keeps it apart from the gate:
 * - it runs in its own CI job with `continue-on-error`; whether that job is a
 *   required check is the branch ruleset's call, outside this repository's files
 *   — `continue-on-error` alone does not make it optional;
 * - its artifact carries `schema: graph-checks-report/1` and `graph_findings`,
 *   never `findings`, and the dispositions ledger refuses to ingest it
 *   (`check_finding_dispositions.refusesIngest`);
 * - it posts no PR comment — the job summary is its only rendered surface.
 *
 * What it cannot claim: the graph build and this script run code from the PR
 * itself, so the report is advisory output of PR-controlled code, not
 * independent evidence.
 *
 * What makes the report's claims true:
 * - every revision is recorded resolved: base, merge-base and head SHAs. The
 *   job checks out the PR's real head, never the synthetic merge commit;
 * - the graph is built here, from this checkout, and only when the checkout is
 *   clean at that head — so the graph, the diff and the quoted exhibits all
 *   describe one commit. A supplied `--graph` is recorded as `supplied`;
 * - any revision that does not resolve, a dirty checkout, a failed build or a
 *   failed check run is `no-analysis` with its reason, never a silent fallback.
 *
 * Exit 0 whenever a report was written, including "no analysis"; exit 1 only
 * when the report itself could not be written; exit 2 on a usage error.
 */
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { withGitVisibleScopeAsync } from './_lib/git_visible_files.js';
import { graphCheckFindings, type GraphCheckFinding, type LineReader } from './_lib/graph_check_findings.js';
import { buildFromRepo } from './code_graph/build.js';
import { diffHunks, reviewRiskAt, type ReviewCheck } from './code_graph/review_risk.js';

/**
 * Per check, applied BEFORE any exhibit is read, so a noisy check costs at most
 * this many blob reads and cannot crowd the other two out. A tuning parameter:
 * revisit when a real PR's summary routinely reports omissions.
 */
export const MAX_PER_CHECK = 100;
const MAX_SUMMARY_ROWS = 50;
const MAX_REASON_CHARS = 300;
const GIT_MAX_BUFFER = 16 * 1024 * 1024;

export interface Revisions {
    base_ref: string;
    base_sha: string | null;
    merge_base_sha: string | null;
    head_sha: string | null;
}

export interface CheckStatus {
    id: ReviewCheck['id'];
    status: ReviewCheck['status'];
    reason?: string;
    items: number;
}

export interface GraphChecksReport {
    schema: 'graph-checks-report/1';
    advisory: true;
    status: 'analysed' | 'no-analysis';
    reason?: string;
    revisions: Revisions;
    graph_provenance: 'built-from-head' | 'supplied' | null;
    graph_checksum: string | null;
    checks: CheckStatus[];
    omitted: number;
    graph_findings: GraphCheckFinding[];
}

export interface Analysis {
    checks: readonly ReviewCheck[];
    checksum: string;
    provenance: 'built-from-head' | 'supplied';
}

export interface Args {
    base: string;
    out: string;
    graph: string | null;
}

/** Every flag takes a value; a flag at the end of argv, or followed by another flag, is a usage error. */
export function parseArgs(argv: readonly string[]): Args {
    const value = (name: string): string | null => {
        const i = argv.indexOf(name);
        if (i < 0) return null;
        const v = argv[i + 1];
        if (v === undefined || v.startsWith('--')) throw new Error(`${name} needs a value`);
        return v;
    };
    const base = value('--base');
    const out = value('--out');
    if (base === null) throw new Error('--base <rev> is required');
    if (out === null) throw new Error('--out <dir> is required');
    return { base, out, graph: value('--graph') };
}

/** Cut at a code point, never inside a surrogate pair. */
function clip(s: string, n: number): string {
    const cps = Array.from(s);
    return cps.length <= n ? s : cps.slice(0, n).join('');
}

function git(root: string, args: string[]): string | null {
    try {
        return execFileSync('git', args, { cwd: root, encoding: 'utf-8', maxBuffer: GIT_MAX_BUFFER, stdio: ['ignore', 'pipe', 'ignore'] });
    } catch {
        return null;
    }
}

const sha = (root: string, rev: string): string | null => (rev.startsWith('-') ? null : git(root, ['rev-parse', '--verify', '--quiet', `${rev}^{commit}`])?.trim() || null);

export function resolveRevisions(root: string, baseRef: string): Revisions {
    const head = sha(root, 'HEAD');
    const base = sha(root, baseRef);
    const mergeBase = head && base ? git(root, ['merge-base', base, head])?.trim() || null : null;
    return { base_ref: baseRef, base_sha: base, merge_base_sha: mergeBase, head_sha: head };
}

/** Lines of `commit:file`, read once per file; a path absent from the commit reads as undefined. */
function blobReader(root: string, commit: string): LineReader {
    const cache = new Map<string, string[] | null>();
    return (file, line) => {
        if (!cache.has(file)) {
            const text = git(root, ['show', `${commit}:${file}`]);
            cache.set(file, text === null ? null : text.split('\n'));
        }
        return cache.get(file)?.[line - 1];
    };
}

/**
 * HTML entities for every character that opens markup, a comment, a link,
 * code, a table cell or emphasis. What survives is plain text — except a bare
 * URL, which the renderer may still turn into a link.
 */
export function escapeMarkdown(s: string): string {
    return s
        .replace(/[\u0000-\u001f\u007f\u2028\u2029]/g, ' ')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/`/g, '&#96;')
        .replace(/\|/g, '&#124;')
        .replace(/\[/g, '&#91;')
        .replace(/\]/g, '&#93;')
        .replace(/\*/g, '&#42;')
        .replace(/_/g, '&#95;')
        .replace(/~/g, '&#126;');
}

/** The items a check flags: for `untested-change` only those still untested. */
export function flaggedItems(c: ReviewCheck): ReviewCheck['items'] {
    return c.id === 'untested-change' ? c.items.filter((i) => i.verdict === 'untested') : c.items;
}

/** The flagged items of each check, first `n` kept; what was dropped is counted. */
export function capChecks(checks: readonly ReviewCheck[], n: number): { checks: ReviewCheck[]; omitted: number } {
    let omitted = 0;
    const out = checks.map((c) => {
        if (c.status !== 'finding') return c;
        const flagged = flaggedItems(c);
        omitted += Math.max(0, flagged.length - n);
        return { ...c, items: flagged.slice(0, n) };
    });
    return { checks: out, omitted };
}

export function buildReport(root: string, rev: Revisions, analysis: Analysis | null, reason?: string): GraphChecksReport {
    const common = { schema: 'graph-checks-report/1', advisory: true, revisions: rev } as const;
    if (analysis === null || rev.head_sha === null) {
        return {
            ...common,
            status: 'no-analysis',
            reason: clip(reason ?? 'the head does not resolve', MAX_REASON_CHARS),
            graph_provenance: analysis?.provenance ?? null,
            graph_checksum: analysis?.checksum ?? null,
            checks: [],
            omitted: 0,
            graph_findings: [],
        };
    }
    const { checks, omitted } = capChecks(analysis.checks, MAX_PER_CHECK);
    return {
        ...common,
        status: 'analysed',
        graph_provenance: analysis.provenance,
        graph_checksum: analysis.checksum,
        checks: analysis.checks.map((c) => ({ id: c.id, status: c.status, ...(c.reason ? { reason: clip(c.reason, MAX_REASON_CHARS) } : {}), items: c.status === 'finding' ? flaggedItems(c).length : c.items.length })),
        omitted,
        graph_findings: graphCheckFindings(checks, root, rev.head_sha, blobReader(root, rev.head_sha)),
    };
}

export function renderSummary(r: GraphChecksReport): string {
    const short = (s: string | null): string => escapeMarkdown(s ? s.slice(0, 12) : 'unresolved');
    const lines = [
        '## Code-graph review checks (advisory, separate job)',
        '',
        'Reported beside the self-review gate, never by it: the dispositions ledger refuses these rows. Produced by code from this PR, so advisory, not independent evidence.',
        '',
        `- base: ${escapeMarkdown(r.revisions.base_ref)} = ${short(r.revisions.base_sha)} · merge-base: ${short(r.revisions.merge_base_sha)} · head: ${short(r.revisions.head_sha)}`,
        `- graph: ${short(r.graph_checksum)} (${escapeMarkdown(r.graph_provenance ?? 'none')})`,
    ];
    if (r.status === 'no-analysis') {
        lines.push(`- status: **no analysis** — ${escapeMarkdown(r.reason ?? '')}`, '', 'No analysis is not a pass.');
        return `${lines.join('\n')}\n`;
    }
    for (const c of r.checks) {
        const state = c.status === 'unknown' ? `did not run — ${escapeMarkdown(c.reason ?? 'no reason recorded')} (no analysis is not a pass)` : c.status === 'finding' ? `${c.items} flagged` : 'pass';
        lines.push(`- ${escapeMarkdown(c.id)}: ${state}`);
    }
    lines.push(`- rows: ${r.graph_findings.length}${r.omitted ? ` (+${r.omitted} omitted, at most ${MAX_PER_CHECK} per check)` : ''}`, '');
    if (r.graph_findings.length === 0) {
        lines.push('No finding rows were produced; see the check statuses above.');
        return `${lines.join('\n')}\n`;
    }
    lines.push('| check | finding | at |', '|---|---|---|');
    for (const f of r.graph_findings.slice(0, MAX_SUMMARY_ROWS)) {
        const at = f.file ? `${f.file}:${f.line ?? ''}` : '';
        lines.push(`| ${escapeMarkdown(f.check)} | ${escapeMarkdown(f.title)} | ${escapeMarkdown(at)} |`);
    }
    if (r.graph_findings.length > MAX_SUMMARY_ROWS) lines.push('', `${r.graph_findings.length - MAX_SUMMARY_ROWS} more in the artifact.`);
    return `${lines.join('\n')}\n`;
}

async function analyse(root: string, rev: Revisions, supplied: string | null): Promise<{ analysis: Analysis | null; reason?: string }> {
    if (rev.head_sha === null) return { analysis: null, reason: 'the head does not resolve' };
    if (rev.base_sha === null) return { analysis: null, reason: `the base does not resolve: ${rev.base_ref}` };
    if (rev.merge_base_sha === null) return { analysis: null, reason: 'no merge-base between base and head (unrelated or shallow history)' };
    if ((git(root, ['status', '--porcelain']) ?? 'unreadable').trim() !== '') {
        return { analysis: null, reason: 'the checkout differs from its head commit, so a graph built from it would not describe that commit' };
    }
    let graph: string;
    let provenance: Analysis['provenance'];
    if (supplied !== null) {
        if (!fs.existsSync(supplied)) return { analysis: null, reason: `no graph at the supplied path: ${supplied}` };
        graph = supplied;
        provenance = 'supplied';
    } else {
        graph = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'graph-checks-')), 'graph.json');
        provenance = 'built-from-head';
        try {
            await withGitVisibleScopeAsync(() => buildFromRepo(root, graph, { lanes: true }));
        } catch (e) {
            return { analysis: null, reason: `the graph build failed: ${(e as Error).message}` };
        }
    }
    const hunks = diffHunks(root, rev.merge_base_sha);
    if (hunks === null) return { analysis: null, reason: 'the diff from the merge-base could not be read' };
    try {
        const r = reviewRiskAt(graph, root, rev.merge_base_sha, hunks);
        return { analysis: { checks: r.checks, checksum: r.basis.graph_checksum, provenance } };
    } catch (e) {
        return { analysis: null, reason: `the checks failed: ${(e as Error).message}` };
    }
}

export async function main(argv: readonly string[], root = process.cwd()): Promise<number> {
    let args: Args;
    try {
        args = parseArgs(argv);
    } catch (e) {
        process.stderr.write(`graph_checks_report: ${(e as Error).message}\nusage: graph_checks_report.ts --base <rev> --out <dir> [--graph <graph.json>]\n`);
        return 2;
    }
    const rev = resolveRevisions(root, args.base);
    const { analysis, reason } = await analyse(root, rev, args.graph);
    const report = buildReport(root, rev, analysis, reason);
    try {
        fs.mkdirSync(args.out, { recursive: true });
        fs.writeFileSync(path.join(args.out, 'graph-checks.json'), `${JSON.stringify(report, null, 2)}\n`);
        fs.writeFileSync(path.join(args.out, 'summary.md'), renderSummary(report));
    } catch (e) {
        process.stderr.write(`graph_checks_report: could not write the report: ${(e as Error).message}\n`);
        return 1;
    }
    process.stdout.write(`graph checks: ${report.status}${report.reason ? ` (${report.reason})` : ''}, ${report.graph_findings.length} row(s)\n`);
    return 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
    main(process.argv.slice(2)).then(
        (code) => process.exit(code),
        (e: unknown) => {
            process.stderr.write(`graph_checks_report: ${String(e)}\n`);
            process.exit(1);
        },
    );
}
```

## The test change since `main`

```diff
diff --git a/tests/scripts/graph_checks_report.test.ts b/tests/scripts/graph_checks_report.test.ts
index d25eae303c..53e8d1bd49 100644
--- a/tests/scripts/graph_checks_report.test.ts
+++ b/tests/scripts/graph_checks_report.test.ts
@@ -76,6 +76,10 @@ describe('graph checks report — evidence and shape', () => {
         const { root, base } = repo();
         const r = buildReport(root, resolveRevisions(root, base), { checks, checksum: 'c0ffee', provenance: 'supplied' });
         expect(r.graph_findings.filter((f) => f.check === 'untested-change')).toHaveLength(100);
+        // The count states the qualifying items: 150 untested, not the 180 the check carried.
+        expect(r.checks.find((c) => c.id === 'untested-change')?.items).toBe(150);
+        expect(r.omitted).toBe(50);
+        expect(renderSummary(r)).toContain('untested-change: 150 flagged');
         expect(r.graph_findings.some((f) => f.check === 'missing-co-change')).toBe(true);
         expect(renderSummary(r)).toContain('missing-co-change: did not run');
     });
@@ -176,3 +180,25 @@ describe('graph checks report — main', () => {
         expect(await main(['--out'], os.tmpdir())).toBe(2);
     });
 });
+
+describe('graph checks report — the workflow fallback', () => {
+    // The job summary step writes this when the report step never finished; it
+    // must be a complete no-analysis report, not a different shape under the
+    // same schema identifier.
+    it('writes the same shape as a no-analysis report, with the base ref escaped', () => {
+        const wf = fs.readFileSync(path.join(process.cwd(), '.github', 'workflows', 'self-review-gate.yml'), 'utf-8');
+        const m = /node -e '([^']+)'/.exec(wf.slice(wf.indexOf('graph-checks:')));
+        expect(m).not.toBeNull();
+        const out = outDir();
+        const r = spawnSync(process.execPath, ['-e', (m as RegExpExecArray)[1] as string], { env: { ...process.env, BASE_REF: 'feat/"odd"', OUT: path.join(out, 'graph-checks.json') }, encoding: 'utf-8' });
+        expect(r.status).toBe(0);
+        const fallback = readReport(out);
+        const { root, base } = repo();
+        const reference = buildReport(root, resolveRevisions(root, base), null, 'x');
+        expect(Object.keys(fallback).sort()).toEqual(Object.keys(reference).sort());
+        expect(Object.keys(fallback.revisions).sort()).toEqual(Object.keys(reference.revisions).sort());
+        expect(fallback.status).toBe('no-analysis');
+        expect(fallback.revisions.base_ref).toBe('feat/"odd"');
+        expect(fallback.reason).toContain('no report was written');
+    });
+});
```

## Answer each question, by number

1. What behaviour changes, including what follows from it that the change does not state?
2. Which authority or safety boundary becomes wider or narrower, and in which direction?
3. Does the change weaken anything that judges it — a test, a gate, a threshold, this review?
4. Is another host or projection left as a way around the control this change touches?
5. Can it be undone, and how — by whom, with what authority, and against which revision?
6. What observation would show the claimed benefit to be false, and what rollback / kill-switch criteria does the change omit?
7. Would a smaller change do, and what does the larger one buy that the smaller one does not?
8. What does it add to standing instruction weight that every later session pays?
9. Could untrusted content steer the path this change opens, and what bounds it if so?

End with exactly one line in this form:
`STANCE: <ratified|confirmed-non-expanding|refused> | CONFIDENCE: <high|med|low> | DEALBREAKER: <yes|no>`
