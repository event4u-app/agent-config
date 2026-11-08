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
        // Written last and renamed into place: the job reads its existence as
        // "the report finished", so it must never exist half-written.
        const summary = path.join(args.out, 'summary.md');
        fs.writeFileSync(`${summary}.tmp`, renderSummary(report));
        fs.renameSync(`${summary}.tmp`, summary);
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
