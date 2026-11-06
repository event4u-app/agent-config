import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { buildBundle, proveMain, ScorecardError } from '../../../src/scripts/code_graph/prove.js';

const NOW = new Date('2026-11-05T12:00:00Z');
const DAY = 86_400_000;

let root: string;

function write(rel: string, body: string): string {
    const p = path.join(root, rel);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, body);
    return p;
}

function age(rel: string, days: number): void {
    const t = new Date(NOW.getTime() - days * DAY);
    fs.utimesSync(path.join(root, rel), t, t);
}

const sha = (s: string) => createHash('sha256').update(s).digest('hex');

const CORPUS = 'questions: []\n';

function fixture(): void {
    write('bench/corpus.yaml', CORPUS);
    write(
        'bench/PREREG.md',
        ['# reg', '', '## Hashes', '', '```', `${sha(CORPUS)}  bench/corpus.yaml`, `${'0'.repeat(64)}  bench/other.yaml`, '```', ''].join('\n'),
    );
    write('reports/present-2026-11-01.md', '# Present\n\n**Result: the native arm WINS.**\n');
    age('reports/present-2026-11-01.md', 3);
    write('reports/old-2026-01-01.md', '# Old\n\n| x | y | TIE |\n');
    age('reports/old-2026-01-01.md', 300);
    write(
        'bench/scorecard.yaml',
        [
            'version: 1',
            'registration: bench/PREREG.md',
            'corpus: bench/corpus.yaml',
            'rows:',
            '  - id: present-row',
            '    metric: recall delta',
            '    artefact: reports/present-*.md',
            '    bar: "+10 pp recall"',
            '    expiry_days: 30',
            '  - id: missing-row',
            '    metric: edge precision',
            '    artefact: reports/edge-oracle-*.md',
            '    bar: "precision per resolved_via"',
            '    expiry_days: 30',
            '    role: edge-oracle',
            '  - id: counterfactual-review',
            '    role: counterfactual-review',
            '    metric: oracle-confirmed miss rate',
            '    artefact: reports/counterfactual-*.md',
            '    bar: ">= 40 % of PRs"',
            '    expiry_days: 30',
            '  - id: expired-row',
            '    metric: crossover',
            '    artefact: reports/old-*.md',
            '    bar: "measured crossover"',
            '    expiry_days: 90',
            "    verdict_pattern: '^\\| x \\| y \\| (\\w+) \\|'",
            '',
        ].join('\n'),
    );
    write(
        'graph.json',
        JSON.stringify({
            nodes: [],
            edges: [
                { source: 'a', target: 'b', relation: 'calls', resolved_via: 'import-specifier' },
                { source: 'a', target: 'c', relation: 'calls', resolved_via: 'import-specifier' },
                { source: 'b', target: 'c', relation: 'calls', resolved_via: 'name-lookup' },
            ],
        }),
    );
}

beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'cg-prove-'));
    fixture();
});
afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

describe('code-graph prove', () => {
    it('lists a present, a missing and an expired artefact with their status', () => {
        const b = buildBundle({ root, scorecardPath: path.join(root, 'bench/scorecard.yaml'), graphPath: path.join(root, 'graph.json'), now: NOW });
        const byId = Object.fromEntries(b.rows.map((r) => [r.id, r]));
        expect(Object.keys(byId).sort()).toEqual(['counterfactual-review', 'expired-row', 'missing-row', 'present-row']);

        expect(byId['present-row']!.status).toBe('present');
        expect(byId['present-row']!.artefacts[0]!.path).toBe('reports/present-2026-11-01.md');
        expect(byId['present-row']!.artefacts[0]!.sha256).toBe(sha('# Present\n\n**Result: the native arm WINS.**\n'));
        expect(byId['present-row']!.verdict).toBe('the native arm WINS.');
        expect(byId['present-row']!.bar).toBe('+10 pp recall');

        expect(byId['missing-row']!.status).toBe('missing');
        expect(byId['missing-row']!.artefacts[0]!.path).toBeNull();
        expect(byId['missing-row']!.artefacts[0]!.pattern).toBe('reports/edge-oracle-*.md');

        expect(byId['expired-row']!.status).toBe('expired');
        expect(byId['expired-row']!.verdict).toBe('TIE');
    });

    it('reads the corpus sha from the registration and checks it against the file', () => {
        const b = buildBundle({ root, scorecardPath: path.join(root, 'bench/scorecard.yaml'), graphPath: path.join(root, 'graph.json'), now: NOW });
        expect(b.corpus.registered_sha256).toBe(sha(CORPUS));
        expect(b.corpus.actual_sha256).toBe(sha(CORPUS));
        expect(b.corpus.matches).toBe(true);
    });

    it("counts the graph's resolved_via histogram", () => {
        const b = buildBundle({ root, scorecardPath: path.join(root, 'bench/scorecard.yaml'), graphPath: path.join(root, 'graph.json'), now: NOW });
        expect(b.resolved_via_histogram).toEqual({ 'import-specifier': 2, 'name-lookup': 1 });
    });

    it('names an absent oracle and an un-run 3.5 instead of omitting them', () => {
        const b = buildBundle({ root, scorecardPath: path.join(root, 'bench/scorecard.yaml'), graphPath: path.join(root, 'graph.json'), now: NOW });
        expect(b.oracle_version).toBeNull();
        expect(b.oracle_version_reason).toMatch(/no edge-oracle report/);
        expect(b.counterfactual_review).toBeNull();
        expect(b.counterfactual_review_reason).toMatch(/not run/);
    });

    it('reads the oracle version from the edge-oracle report header when one exists', () => {
        write('reports/edge-oracle-2026-11-04.md', '# Edge precision and recall against a SCIP oracle\n\nRoot `src` · graph `g.json` · index `i.scip` (scip-typescript 0.3.14) · prefix `src/scripts/`.\n');
        age('reports/edge-oracle-2026-11-04.md', 1);
        const b = buildBundle({ root, scorecardPath: path.join(root, 'bench/scorecard.yaml'), graphPath: path.join(root, 'graph.json'), now: NOW });
        expect(b.oracle_version).toBe('scip-typescript 0.3.14');
        expect(b.rows.find((r) => r.id === 'missing-row')!.status).toBe('present');
    });

    it('refuses an unreadable scorecard and exits non-zero from the CLI', () => {
        expect(() => buildBundle({ root, scorecardPath: path.join(root, 'nope.yaml'), now: NOW })).toThrow(ScorecardError);
        write('bad.yaml', 'rows: 3\n');
        expect(() => buildBundle({ root, scorecardPath: path.join(root, 'bad.yaml'), now: NOW })).toThrow(ScorecardError);
        expect(proveMain(['--root', root, '--scorecard', path.join(root, 'nope.yaml')])).not.toBe(0);
    });

    it('writes the bundle to --out and exits 0 even with missing artefacts', () => {
        const out = path.join(root, 'out/bundle.json');
        const rc = proveMain(['--root', root, '--scorecard', path.join(root, 'bench/scorecard.yaml'), '--graph', path.join(root, 'graph.json'), '--out', out]);
        expect(rc).toBe(0);
        const parsed = JSON.parse(fs.readFileSync(out, 'utf-8'));
        expect(parsed.rows).toHaveLength(4);
    });
});
