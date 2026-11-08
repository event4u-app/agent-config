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
        // The count states the qualifying items: 150 untested, not the 180 the check carried.
        expect(r.checks.find((c) => c.id === 'untested-change')?.items).toBe(150);
        expect(renderSummary(r)).toContain('untested-change: 150 flagged');
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
