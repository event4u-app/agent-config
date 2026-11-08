<!-- evidence-type: analysis -->

# Review, round 7: the shipped `graph-checks` job beside the self-review gate

Round 6 (`agents/evidence/council/graph-checks-job-r6-20261106.question.md`) accepted placing the code graph's three review checks in a separate, non-required CI job beside the self-review gate, and refused that round's implementation. The version now on `main` (commit `17d530c409`) is the one this round reviews. No council round has reviewed it yet. Roadmap: `road-to-a-graph-that-wins` AC-8, as the owner narrowed it on 2026-11-06 ("a separate, non-required job beside the gate").

Review the shipped job, script and tests for:

- anything that could affect the self-review gate's jobs, their exit codes or their artifacts;
- anything that weakens an existing control;
- whether the job is genuinely non-required and read-only;
- correctness of the report (diff base, blob-quoted exhibits, escaping, "no analysis" handling);
- whether its artifact can be mistaken for review input;
- what is missing.

## The job (`.github/workflows/self-review-gate.yml`, from the comment above it to the end of the file)

```yaml
  # The code graph's three review checks (untested change, missing co-change
  # partner, touched entry point), reported BESIDE the gate, never by it —
  # roadmap `road-to-a-graph-that-wins` AC-8 as the owner narrowed it on
  # 2026-11-06, after five AI-council rounds refused every placement on the
  # gate's required path (`agents/evidence/council/graph-checks-*`).
  #
  # Optional because the branch ruleset does not list it (read 2026-11-06:
  # three required checks, none from this workflow). `continue-on-error` only
  # keeps a red here from failing the workflow run; it does not make a check
  # optional, the ruleset does. No step here is a dependency of the gate's jobs.
  #
  # Read-only token (`contents: read`, no PR comment) — which limits the token,
  # not what `npm ci` may do to the workspace; that is why the report refuses
  # a checkout that differs from its commit. It checks out the PR's REAL head,
  # never the synthetic merge commit, so every SHA it records exists.
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
      # minutes (measured: about 25 s to build this repository) so the summary
      # and the upload below always keep time to run.
      - name: Build the graph and report its checks (advisory)
        timeout-minutes: 7
        env:
          BASE_REF: ${{ github.base_ref }}
        run: ./node_modules/.bin/tsx src/scripts/graph_checks_report.ts --base "origin/$BASE_REF" --out "$RUNNER_TEMP/graph-checks"
      - name: Job summary
        if: always()
        run: |
          mkdir -p "$RUNNER_TEMP/graph-checks"
          if [ -f "$RUNNER_TEMP/graph-checks/summary.md" ]; then
            cat "$RUNNER_TEMP/graph-checks/summary.md" >> "$GITHUB_STEP_SUMMARY"
          else
            echo "Code-graph review checks: no report was written (the job failed before the report step finished). No analysis is not a pass." >> "$GITHUB_STEP_SUMMARY"
            echo '{"schema":"graph-checks-report/1","advisory":true,"status":"no-report","reason":"the job failed before the report step finished"}' > "$RUNNER_TEMP/graph-checks/graph-checks.json"
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
 * - it runs in its own CI job with `continue-on-error`, and that job is not in
 *   the branch ruleset's required checks (read 2026-11-06) — `continue-on-error`
 *   alone would not make it optional, the ruleset does;
 * - its artifact carries `schema: graph-checks-report/1` and `graph_findings`,
 *   never `findings`, and the dispositions ledger refuses to ingest it
 *   (`check_finding_dispositions.refusesIngest`);
 * - it posts no PR comment — the job summary is its only rendered surface.
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

/** The flagged items of each check, first `n` kept; what was dropped is counted. */
export function capChecks(checks: readonly ReviewCheck[], n: number): { checks: ReviewCheck[]; omitted: number } {
    let omitted = 0;
    const out = checks.map((c) => {
        if (c.status !== 'finding') return c;
        const flagged = c.id === 'untested-change' ? c.items.filter((i) => i.verdict === 'untested') : c.items;
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
        checks: analysis.checks.map((c) => ({ id: c.id, status: c.status, ...(c.reason ? { reason: clip(c.reason, MAX_REASON_CHARS) } : {}), items: c.items.length })),
        omitted,
        graph_findings: graphCheckFindings(checks, root, rev.head_sha, blobReader(root, rev.head_sha)),
    };
}

export function renderSummary(r: GraphChecksReport): string {
    const short = (s: string | null): string => escapeMarkdown(s ? s.slice(0, 12) : 'unresolved');
    const lines = [
        '## Code-graph review checks (advisory, separate job)',
        '',
        'Reported beside the self-review gate, never by it: these rows cannot block, and the dispositions ledger refuses them.',
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
        lines.push('No check flagged anything.');
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

## The tests (`tests/scripts/graph_checks_report.test.ts`)

```ts
/**
 * The graph-checks reporting job (AC-8, narrowed): a separate, non-required job
 * beside the self-review gate. Its artifact must be refused by the dispositions
 * ledger, its revisions recorded resolved, its graph and exhibits must describe
 * one commit, its summary must be inert, and "no analysis" must never read as a
 * pass or fall back silently.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';

import { merge_ingest, refusesIngest } from '../../src/scripts/check_finding_dispositions.js';
import type { ReviewCheck } from '../../src/scripts/code_graph/review_risk.js';
import { buildReport, capChecks, escapeMarkdown, type GraphChecksReport, main, parseArgs, renderSummary, resolveRevisions } from '../../src/scripts/graph_checks_report.js';

const REPO_ROOT = path.resolve(__dirname, '../..');
const ENV = { ...process.env, GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@example.com', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@example.com' };

function git(root: string, ...args: string[]): string {
    return execFileSync('git', args, { cwd: root, encoding: 'utf-8', env: ENV }).trim();
}

/** A repository with a base commit and a head commit that changes `lonely`'s body. */
function repo(): { root: string; base: string; head: string } {
    const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'graph-checks-report-')));
    git(root, 'init', '-q', '-b', 'main');
    fs.mkdirSync(path.join(root, 'app'));
    fs.writeFileSync(path.join(root, 'app/a.ts'), 'export function lonely() {\n  return 1;\n}\n');
    git(root, 'add', '.');
    git(root, 'commit', '-qm', 'base');
    const base = git(root, 'rev-parse', 'HEAD');
    fs.writeFileSync(path.join(root, 'app/a.ts'), 'export function lonely() {\n  return 2;\n}\n');
    git(root, 'commit', '-qam', 'head');
    return { root, base, head: git(root, 'rev-parse', 'HEAD') };
}

const outDir = (): string => fs.mkdtempSync(path.join(os.tmpdir(), 'graph-checks-out-'));
const readReport = (out: string): GraphChecksReport => JSON.parse(fs.readFileSync(path.join(out, 'graph-checks.json'), 'utf-8')) as GraphChecksReport;

const flagged = (label: string, witness: string): ReviewCheck[] => [
    { id: 'untested-change', status: 'finding', items: [{ id: `x#${label}`, label, verdict: 'untested', witness, edges: [] }] },
    { id: 'missing-co-change', status: 'pass', items: [] },
    { id: 'touched-entry-point', status: 'pass', items: [] },
];

describe('graph checks report — evidence and shape', () => {
    it('quotes the head commit, not the working tree', () => {
        const { root, base, head } = repo();
        fs.writeFileSync(path.join(root, 'app/a.ts'), 'tampered after commit\n');
        const r = buildReport(root, resolveRevisions(root, base), { checks: flagged('lonely', 'app/a.ts:1'), checksum: 'c0ffee', provenance: 'supplied' });
        expect(r.revisions).toEqual({ base_ref: base, base_sha: base, merge_base_sha: base, head_sha: head });
        expect(r.graph_findings[0]?.exhibits?.[0]).toMatchObject({ type: 'presence', path: 'app/a.ts', line: 1, quote: 'export function lonely() {', commit: head });
    });

    it('drops the exhibit when the witness is not in the head commit', () => {
        const { root, base } = repo();
        const r = buildReport(root, resolveRevisions(root, base), { checks: flagged('ghost', 'app/missing.ts:3'), checksum: 'c0ffee', provenance: 'supplied' });
        expect(r.graph_findings).toHaveLength(1);
        expect(r.graph_findings[0]?.exhibits).toBeUndefined();
    });

    it('caps each check before any exhibit is read, so a noisy check cannot crowd out the others', () => {
        const many = Array.from({ length: 150 }, (_, k) => ({ id: `x#s${k}`, label: `s${k}`, verdict: 'untested' as const, witness: 'app/a.ts:1', edges: [] }));
        const tested = Array.from({ length: 30 }, (_, k) => ({ id: `x#t${k}`, label: `t${k}`, verdict: 'tested' as const, witness: 'app/a.ts:1', edges: [] }));
        const checks: ReviewCheck[] = [
            { id: 'untested-change', status: 'finding', items: [...tested, ...many] },
            { id: 'missing-co-change', status: 'unknown', reason: 'shallow clone', items: [] },
            { id: 'touched-entry-point', status: 'pass', items: [] },
        ];
        const capped = capChecks(checks, 100);
        expect(capped.checks[0]?.items).toHaveLength(100);
        expect(capped.checks[0]?.items.every((i) => i.verdict === 'untested')).toBe(true);
        expect(capped.omitted).toBe(50);
        const { root, base } = repo();
        const r = buildReport(root, resolveRevisions(root, base), { checks, checksum: 'c0ffee', provenance: 'supplied' });
        expect(r.graph_findings.filter((f) => f.check === 'untested-change')).toHaveLength(100);
        expect(r.graph_findings.some((f) => f.check === 'missing-co-change')).toBe(true);
        expect(renderSummary(r)).toContain('missing-co-change: did not run');
    });

    it('renders hostile strings inert, including composed comment markers', () => {
        for (const s of ['<!' + '<!--' + '--', '--<!-->', '<script>x</script>', '[a](http://e.example)', '`x`|y', '**b** _i_ ~~s~~', 'a\u0007b\u2028c']) {
            expect(escapeMarkdown(s)).not.toMatch(/[<>`|[\]*_~\u0000-\u001f\u2028\u2029]/);
        }
        const { root, base } = repo();
        const r = buildReport(root, resolveRevisions(root, base), { checks: flagged('<!' + '<!--' + '--', 'app/a.ts:1'), checksum: 'c0ffee', provenance: 'supplied' });
        expect(renderSummary(r)).not.toContain('<!--');
    });

    it('refuses a flag with no value instead of reading a neighbour', () => {
        expect(() => parseArgs(['--base'])).toThrow(/--base/);
        expect(() => parseArgs(['--base', '--out', 'x'])).toThrow(/--base needs a value/);
        expect(() => parseArgs(['--out', 'x'])).toThrow(/--base/);
        expect(parseArgs(['--base', 'origin/main', '--out', 'o'])).toEqual({ base: 'origin/main', out: 'o', graph: null });
    });
});

describe('graph checks report — the dispositions ledger refuses it', () => {
    const report = (): GraphChecksReport => {
        const { root, base } = repo();
        return buildReport(root, resolveRevisions(root, base), { checks: flagged('lonely', 'app/a.ts:1'), checksum: 'c0ffee', provenance: 'supplied' });
    };

    it('names the report as refused, and an accidental merge adds nothing and asserts no clean review', () => {
        const r = report() as unknown as Record<string, unknown>;
        expect(r).not.toHaveProperty('findings');
        expect(refusesIngest(r)).toMatch(/advisory/);
        expect(refusesIngest({ findings: [] })).toBeNull();
        const merged = merge_ingest({ findings: [] } as never, r);
        expect(merged).toMatchObject({ added: 0, reasoned: false, carried: [] });
    });

    it('the ingest CLI exits 2 on it and writes no ledger', () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cfd-graph-'));
        const file = path.join(dir, 'graph-checks.json');
        fs.writeFileSync(file, JSON.stringify(report()));
        const tsx = path.join(REPO_ROOT, 'node_modules', '.bin', process.platform === 'win32' ? 'tsx.cmd' : 'tsx');
        const res = spawnSync(tsx, [path.join(REPO_ROOT, 'src/scripts/check_finding_dispositions.ts'), '--ingest', file, '--release', '0.0.0', '--dir', dir], { cwd: REPO_ROOT, encoding: 'utf-8' });
        expect(res.status).toBe(2);
        expect(res.stderr).toMatch(/not a self-review findings artifact/);
        expect(fs.existsSync(path.join(dir, '0.0.0.json'))).toBe(false);
    });
});

describe('graph checks report — main', () => {
    it('builds the graph from a clean head and reports the changed symbol with resolved revisions', async () => {
        const { root, base, head } = repo();
        const out = outDir();
        expect(await main(['--base', base, '--out', out], root)).toBe(0);
        const r = readReport(out);
        expect(r.status).toBe('analysed');
        expect(r.graph_provenance).toBe('built-from-head');
        expect(r.revisions).toEqual({ base_ref: base, base_sha: base, merge_base_sha: base, head_sha: head });
        const row = r.graph_findings.find((f) => f.check === 'untested-change' && f.title.endsWith(': lonely'));
        expect(row?.exhibits?.[0]).toMatchObject({ path: 'app/a.ts', commit: head });
        expect(fs.readFileSync(path.join(out, 'summary.md'), 'utf-8')).toContain('untested-change: ');
    }, 60_000);

    it('reports no analysis, never a fallback, when there is no merge-base', async () => {
        const { root } = repo();
        git(root, 'checkout', '-q', '--orphan', 'other');
        git(root, 'rm', '-rq', '--cached', '.');
        fs.rmSync(path.join(root, 'app'), { recursive: true, force: true });
        fs.writeFileSync(path.join(root, 'x.txt'), 'x\n');
        git(root, 'add', 'x.txt');
        git(root, 'commit', '-qm', 'unrelated');
        const out = outDir();
        expect(await main(['--base', 'main', '--out', out], root)).toBe(0);
        const r = readReport(out);
        expect(r.status).toBe('no-analysis');
        expect(r.reason).toMatch(/no merge-base/);
        expect(r.revisions.merge_base_sha).toBeNull();
        expect(fs.readFileSync(path.join(out, 'summary.md'), 'utf-8')).toContain('No analysis is not a pass');
    });

    it('reports no analysis for an unresolvable base, a dirty checkout and a missing supplied graph', async () => {
        const { root, base } = repo();
        let out = outDir();
        await main(['--base', 'no-such-ref', '--out', out], root);
        expect(readReport(out).reason).toMatch(/base does not resolve/);

        fs.writeFileSync(path.join(root, 'app/a.ts'), 'dirty\n');
        out = outDir();
        await main(['--base', base, '--out', out], root);
        expect(readReport(out).reason).toMatch(/differs from its head commit/);
        git(root, 'checkout', '-q', '--', '.');

        out = outDir();
        await main(['--base', base, '--out', out, '--graph', path.join(root, 'nope.json')], root);
        expect(readReport(out)).toMatchObject({ status: 'no-analysis', graph_provenance: null });
    });

    it('exits 2 on a usage error and writes nothing', async () => {
        expect(await main(['--out'], os.tmpdir())).toBe(2);
    });
});
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
