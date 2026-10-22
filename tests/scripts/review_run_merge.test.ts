// Merging scoped self-review runs over one range into one whole-span record —
// accepted only when the runs, together, read every in-scope file the merge
// recomputes for that range itself.
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { coverageScope } from '../../src/scripts/_lib/review_coverage.js';
import { mergeRunsMain } from '../../src/scripts/self_review_gate.js';

let repo: string;
let out: string;
let base: string;
let head: string;

function git(...args: string[]): string {
    const r = spawnSync('git', ['-C', repo, ...args], { encoding: 'utf8' });
    if (r.status !== 0) throw new Error(r.stderr);
    return r.stdout.trim();
}

function put(rel: string, text: string): void {
    fs.mkdirSync(path.dirname(path.join(repo, rel)), { recursive: true });
    fs.writeFileSync(path.join(repo, rel), text);
}

/** A run file as `--findings-out` writes it. */
function run(name: string, cov: Record<string, unknown>, findings: unknown[] = [], range: { head: string; base: string } | null = { head, base }): string {
    const file = path.join(out, name);
    fs.writeFileSync(
        file,
        JSON.stringify({ schema_version: 1, ...(range === null ? {} : { review: range }), coverage: { chunks: 1, unreviewed: [], ...cov }, findings }),
    );
    return file;
}

const finding = (id: string) => ({ finding_id: id, severity: 'low', kind: 'style', title: id, detail: 'd', file: 'src/a.ts' });

beforeEach(() => {
    repo = fs.mkdtempSync(path.join(os.tmpdir(), 'merge-runs-repo-'));
    out = fs.mkdtempSync(path.join(os.tmpdir(), 'merge-runs-out-'));
    git('init', '-q', '-b', 'main');
    git('config', 'user.email', 't@t');
    git('config', 'user.name', 't');
    git('config', 'commit.gpgsign', 'false');
    put('README.md', '# base\n');
    git('add', '-A');
    git('commit', '-q', '-m', 'base');
    base = git('rev-parse', 'HEAD');
    for (const f of ['src/a.ts', 'src/b.ts', 'src/c.ts', 'docs/x.md']) put(f, `// ${f}\n`);
    git('add', '-A');
    git('commit', '-q', '-m', 'change');
    head = git('rev-parse', 'HEAD');
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
});

afterEach(() => {
    vi.restoreAllMocks();
    fs.rmSync(repo, { recursive: true, force: true });
    fs.rmSync(out, { recursive: true, force: true });
});

const merge = (files: string[], extra: string[] = []): number =>
    mergeRunsMain(['--merge-runs', files.join(','), '--out', path.join(out, 'merged.json'), ...extra], repo);
const merged = (): Record<string, unknown> => JSON.parse(fs.readFileSync(path.join(out, 'merged.json'), 'utf8')) as Record<string, unknown>;

describe('--merge-runs', () => {
    it('a complete union is accepted, with no scope, and findings de-duplicated by fingerprint', () => {
        const full = run('full.json', {
            scope: ['src'],
            filesTotal: 3,
            filesReviewed: 2,
            unreviewed: [{ path: 'src/c.ts', reason: 'chunk did not complete' }],
        }, [finding('aaa'), finding('bbb')]);
        const resume = run('resume.json', { scope: ['src/c.ts'], filesTotal: 1, filesReviewed: 1 }, [finding('bbb'), finding('ccc')]);
        expect(merge([full, resume])).toBe(0);
        const m = merged();
        const cov = m['coverage'] as Record<string, unknown>;
        expect(coverageScope(cov)).toBeNull();
        expect([cov['filesReviewed'], cov['filesTotal']]).toEqual([3, 3]);
        expect((m['findings'] as Array<{ finding_id: string }>).map((f) => f.finding_id)).toEqual(['aaa', 'bbb', 'ccc']);
        expect(m['review']).toMatchObject({ head, base, range_source: 'recorded' });
    });

    it('one file missing from the union is refused, and the file is named', () => {
        const full = run('full.json', {
            scope: ['src'],
            filesTotal: 3,
            filesReviewed: 2,
            unreviewed: [{ path: 'src/c.ts', reason: 'chunk did not complete' }],
        });
        expect(merge([full])).toBe(1);
        expect(fs.existsSync(path.join(out, 'merged.json'))).toBe(false);
        const err = (process.stderr.write as unknown as { mock: { calls: unknown[][] } }).mock.calls.map((c) => String(c[0])).join('');
        expect(err).toContain('src/c.ts');
    });

    it('runs over different review SHAs are refused', () => {
        put('src/d.ts', '// later\n');
        git('add', '-A');
        git('commit', '-q', '-m', 'later');
        const later = git('rev-parse', 'HEAD');
        const full = run('full.json', { scope: ['src'], filesTotal: 3, filesReviewed: 2, unreviewed: [{ path: 'src/c.ts', reason: 'x' }] });
        const resume = run('resume.json', { scope: ['src/c.ts'], filesTotal: 1, filesReviewed: 1 }, [], { head: later, base });
        expect(merge([full, resume])).toBe(1);
    });

    it('a run whose own totals the recomputed range does not reproduce is refused', () => {
        // Claims 2 of 2 under `src` — the range has 3 there, so it was not a run over it.
        const lying = run('lying.json', { scope: ['src'], filesTotal: 2, filesReviewed: 2 });
        expect(merge([lying])).toBe(1);
    });

    it('files that record no range merge only on an asserted range they reproduce', () => {
        const full = run('full.json', { scope: ['src'], filesTotal: 3, filesReviewed: 2, unreviewed: [{ path: 'src/c.ts', reason: 'x' }] }, [], null);
        const resume = run('resume.json', { scope: ['src/c.ts'], filesTotal: 1, filesReviewed: 1 }, [], null);
        expect(merge([full, resume])).toBe(1);
        expect(merge([full, resume], ['--head', head, '--base', base])).toBe(0);
        expect(merged()['review']).toMatchObject({ range_source: 'asserted-reproduced' });
        // An asserted range the runs do not reproduce is refused.
        expect(merge([full, resume], ['--head', head, '--base', head])).toBe(1);
    });
});
