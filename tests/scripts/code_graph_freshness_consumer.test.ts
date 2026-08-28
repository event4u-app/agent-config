// Step 3.3 of road-to-code-graph-evidence-that-exists: a stale or absent graph
// must never produce a confident answer at any consumer this roadmap touched.
//
// The three-state verdict already ships (`detect.ts:150` — ABSENT | STALE |
// FRESH). What did not ship is a test pinning that a CONSUMER sees the degraded
// state rather than an empty-but-confident answer, which is the failure mode
// that matters: an absent graph and a graph that genuinely contains no match
// both return no relations, and only the verdict distinguishes them.
//
// Naming note, recorded rather than smoothed: the roadmap step says an absent
// graph returns `unavailable`. The shipped token is `ABSENT`. These tests assert
// the shipped token — a test written against a word the code does not use would
// pass only by being wrong.

import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { afterAll, describe, expect, it } from 'vitest';

const REPO_ROOT = resolve(import.meta.dirname, '..', '..');
const TSX = join(REPO_ROOT, 'node_modules', '.bin', process.platform === 'win32' ? 'tsx.cmd' : 'tsx');
const CLI = join(REPO_ROOT, 'src', 'scripts', 'code_graph', 'cli.ts');

const scratch = mkdtempSync(join(tmpdir(), 'cg-freshness-'));
afterAll(() => rmSync(scratch, { recursive: true, force: true }));

function cli(args: string[]): { stdout: string; stderr: string; status: number } {
    const r = spawnSync(TSX, [CLI, ...args], { cwd: REPO_ROOT, encoding: 'utf-8', maxBuffer: 32 * 1024 * 1024 });
    return { stdout: r.stdout ?? '', stderr: r.stderr ?? '', status: r.status ?? 1 };
}

describe('code-graph freshness — an absent graph is never a confident empty answer', () => {
    it('`detect` on a root with no graph reports ABSENT, not an empty FRESH', () => {
        const emptyRoot = join(scratch, 'no-graph-here');
        writeFileSync(join(scratch, 'placeholder'), '');
        const r = cli(['detect', '--root', emptyRoot, '--format', 'json']);
        const v = JSON.parse(r.stdout) as { verdict: string; source: string | null };
        expect(v.verdict).toBe('ABSENT');
        expect(v.source).toBeNull();
    });

    it('a query against a graph file that does not exist SAYS the graph is missing', () => {
        const r = cli(['query', 'buildGraph', '--graph', join(scratch, 'nope.json'), '--budget', '5']);
        const all = `${r.stdout}${r.stderr}`;
        // The distinguishing property: the output names the missing graph. It
        // must NOT be indistinguishable from a real "no matching relations".
        expect(all).toMatch(/not found/i);
        expect(all).not.toMatch(/^\s*\(no matching relations\)/m);
    });

    it('the three verdict states are exactly ABSENT, STALE, FRESH — a fourth would silently widen the contract', () => {
        const src = spawnSync('git', ['show', 'HEAD:src/scripts/code_graph/detect.ts'], { cwd: REPO_ROOT, encoding: 'utf-8' }).stdout ?? '';
        expect(src).toMatch(/verdict:\s*'ABSENT'\s*\|\s*'STALE'\s*\|\s*'FRESH'/);
    });
});

describe('code-graph freshness — a real graph answers, so the ABSENT case is not vacuous', () => {
    // Without this, every assertion above would also pass against an engine that
    // can never answer anything. Sensitivity, not decoration.
    it('a freshly built graph answers a question the absent one could not', () => {
        const out = join(scratch, 'real.json');
        const b = cli(['build', '--root', 'src/scripts/code_graph', '--out', out]);
        expect(b.status, b.stderr).toBe(0);
        const q = cli(['affected', 'buildGraph', '--graph', out, '--budget', '20']);
        expect(q.stdout).toMatch(/--\w+-->/);
        expect(q.stdout).not.toMatch(/not found/i);
    }, 120_000);
});
