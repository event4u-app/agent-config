// Tests for src/scripts/bench_ab_v2_complexity.ts — the offline re-scorer that
// retro-fits the T1/T2 endpoints onto a finished report from its preserved
// workspaces (S0.3 delta #11 + delta #7).
//
// The properties that matter here are the NULL paths. A re-scorer that silently
// writes 0 for a pruned workspace would hand `compare()` a value where there is
// no observation, and `size_claim_verdict` would then treat an unmeasured arm as
// a measured one — which is precisely the failure the `measured` flag exists to
// prevent. So every "cannot measure this" branch is asserted, not just the happy
// path.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { rescoreReport } from '../../src/scripts/bench_ab_v2_complexity.js';

const tmpDirs: string[] = [];
afterEach(() => {
    for (const d of tmpDirs.splice(0)) fs.rmSync(d, { recursive: true, force: true });
});

function tmp(prefix: string): string {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
    tmpDirs.push(d);
    return d;
}

/** A fixture root plus a workspace that "ran" against it. */
function stage(fixtureSrc: string, workspaceSrc: string): { fixtures: string; workspace: string } {
    const root = tmp('cxr-');
    const fixtures = path.join(root, 'fixtures');
    const fixtureDir = path.join(fixtures, 'demo-01');
    fs.mkdirSync(path.join(fixtureDir, 'src'), { recursive: true });
    fs.writeFileSync(path.join(fixtureDir, 'src', 'a.js'), fixtureSrc, 'utf8');

    const workspace = path.join(root, 'work');
    fs.mkdirSync(path.join(workspace, 'src'), { recursive: true });
    fs.writeFileSync(path.join(workspace, 'src', 'a.js'), workspaceSrc, 'utf8');
    return { fixtures, workspace };
}

const FLAT = `function classify(n) {
  if (n < 0) {
    return 'neg';
  }
  return 'pos';
}
`;
const GOLFED = `function classify(n) { return n < 0 ? 'neg' : n === 0 ? 'zero' : 'pos'; }
`;

function reportWith(workspace: string, opts: { fixture?: string } = {}): Record<string, unknown> {
    const rec: Record<string, unknown> = {
        id: 'demo-01',
        arms: {
            'package-ladder': [{ seed: 0, errored: false, workspace, metrics: { tokens: 1 } }],
        },
    };
    if (opts.fixture !== undefined) rec['fixture'] = opts.fixture;
    return { records: [rec] };
}

describe('bench_ab_v2_complexity — offline re-score', () => {
    it('computes added lines and a median from a preserved workspace', async () => {
        const { fixtures, workspace } = stage(FLAT, GOLFED);
        const rows = await rescoreReport(reportWith(workspace, { fixture: 'demo-01' }), {
            fixturesRoot: fixtures,
            corpusPath: null,
        });
        expect(rows.length).toBe(1);
        const r = rows[0]!;
        expect(r.skipped_reason).toBeNull();
        // The golfed one-liner: one added line, and a NESTED ternary — outer +1,
        // inner +1 plus its nesting penalty = 3. The flat original scores 1.
        expect(r.added_lines).toBe(1);
        expect(r.median_cognitive_complexity).toBe(3);
        expect(r.n_functions).toBe(1);
    });

    it('--write puts both endpoints on the trial, and only then', async () => {
        const { fixtures, workspace } = stage(FLAT, GOLFED);
        const payload = reportWith(workspace, { fixture: 'demo-01' });
        const trial = () =>
            ((payload['records'] as Record<string, unknown>[])[0]!['arms'] as Record<string, unknown[]>)[
                'package-ladder'
            ]![0] as Record<string, unknown>;

        await rescoreReport(payload, { fixturesRoot: fixtures, corpusPath: null });
        expect((trial()['metrics'] as Record<string, unknown>)['added_lines']).toBeUndefined();

        await rescoreReport(payload, { fixturesRoot: fixtures, corpusPath: null, write: true });
        const m = trial()['metrics'] as Record<string, unknown>;
        expect(m['added_lines']).toBe(1);
        expect(m['median_cognitive_complexity']).toBe(3);
        expect(m['complexity_n_functions']).toBe(1);
    });

    it('a pruned workspace yields nulls and a reason — never a zero', async () => {
        const { fixtures } = stage(FLAT, GOLFED);
        const rows = await rescoreReport(
            reportWith(path.join(fixtures, 'does-not-exist'), { fixture: 'demo-01' }),
            { fixturesRoot: fixtures, corpusPath: null },
        );
        const r = rows[0]!;
        expect(r.added_lines).toBeNull();
        expect(r.median_cognitive_complexity).toBeNull();
        expect(r.skipped_reason).toBe('workspace missing on disk');
    });

    it('a trial with no recorded workspace is reported, not skipped silently', async () => {
        const { fixtures } = stage(FLAT, GOLFED);
        const payload = { records: [{ id: 'demo-01', fixture: 'demo-01', arms: { a: [{ seed: 0 }] } }] };
        const rows = await rescoreReport(payload, { fixturesRoot: fixtures, corpusPath: null });
        expect(rows[0]!.skipped_reason).toBe('no workspace recorded');
        expect(rows[0]!.median_cognitive_complexity).toBeNull();
    });

    it('falls back to the corpus for reports written before the fixture key existed', async () => {
        const { fixtures, workspace } = stage(FLAT, GOLFED);
        const corpus = path.join(tmp('cxc-'), 'corpus.yaml');
        fs.writeFileSync(corpus, 'tasks:\n  - id: demo-01\n    fixture: demo-01\n', 'utf8');
        // No `fixture` on the record — exactly the shape of every existing report.
        const rows = await rescoreReport(reportWith(workspace), {
            fixturesRoot: fixtures,
            corpusPath: corpus,
        });
        expect(rows[0]!.skipped_reason).toBeNull();
        expect(rows[0]!.median_cognitive_complexity).toBe(3);
    });

    it('an unresolvable fixture is a reason, not a crash', async () => {
        const { fixtures, workspace } = stage(FLAT, GOLFED);
        const rows = await rescoreReport(reportWith(workspace), {
            fixturesRoot: fixtures,
            corpusPath: null,
        });
        expect(rows[0]!.skipped_reason).toBe('record carries no fixture path');
    });
});
