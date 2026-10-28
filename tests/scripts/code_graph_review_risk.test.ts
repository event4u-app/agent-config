/**
 * `review-risk`: a planted diff against a planted repository lists every term
 * with the facts it counted and their witnesses; the total is their sum.
 */
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildFromRepo } from '../../src/scripts/code_graph/build.js';
import { graphHome } from '../../src/scripts/code_graph/graph_home.js';
import {
    diffHunks,
    parseUnifiedZero,
    renderReviewRisk,
    renderReviewRiskMarkdown,
    REVIEW_RISK_COMMENT_MARKER,
    RISK_TERMS,
    RISK_WEIGHTS,
    type ReviewRisk,
    reviewRisk,
    riskBand,
} from '../../src/scripts/code_graph/review_risk.js';
import { validateGraph } from '../../src/scripts/code_graph/validate.js';
import type { CodeGraph } from '../../src/scripts/code_graph/types.js';
import { GRAPH_TOOLS } from '../../src/scripts/mcp_server/graph_tools.js';

const FX = path.resolve(__dirname, '../fixtures/code-graph');
let root: string;
let graph: CodeGraph;

const git = (...args: string[]): string =>
    execFileSync('git', ['-C', root, '-c', 'user.email=t@example.com', '-c', 'user.name=t', '-c', 'commit.gpgsign=false', ...args], { encoding: 'utf-8' });
const edit = (rel: string, from: string | RegExp, to: string): void => {
    const p = path.join(root, rel);
    const before = fs.readFileSync(p, 'utf-8');
    const after = before.replace(from, to);
    if (after === before) throw new Error(`planted edit did not apply to ${rel}`);
    fs.writeFileSync(p, after);
};

/** A blog (P1), the partner client (P5) behind a route, and a CI workflow; two files that change together. */
function plant(): void {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'review-risk-'));
    fs.cpSync(path.join(FX, 'correctness/p1-blog'), root, { recursive: true });
    for (const rel of ['app/Services/PartnerClient.php', 'config/services.php', 'contracts/partner.openapi.yaml', 'resources/wsdl/stock.wsdl']) {
        fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
        fs.copyFileSync(path.join(FX, 'interfaces/p5', rel), path.join(root, rel));
    }
    fs.cpSync(path.join(FX, 'delivery/clean/.github'), path.join(root, '.github'), { recursive: true });
    fs.mkdirSync(path.join(root, 'agents'), { recursive: true });
    fs.writeFileSync(
        path.join(root, 'app/Http/Controllers/StockController.php'),
        '<?php\n\nnamespace App\\Http\\Controllers;\n\nuse App\\Services\\PartnerClient;\n\nclass StockController\n{\n    public function show(string $sku)\n    {\n        $client = new PartnerClient();\n        return $client->warehouseStock($sku);\n    }\n}\n',
    );
    fs.appendFileSync(path.join(root, 'routes/web.php'), "Route::get('/stock/{sku}', [App\\Http\\Controllers\\StockController::class, 'show']);\n");
    git('init', '-q');
    git('add', '-A');
    git('commit', '-qm', 'base');
    for (const i of [1, 2, 3]) {
        fs.appendFileSync(path.join(root, 'app/Services/PartnerClient.php'), `// rev ${i}\n`);
        fs.appendFileSync(path.join(root, 'config/services.php'), `// rev ${i}\n`);
        git('commit', '-qam', `co ${i}`);
    }
}

beforeAll(async () => {
    plant();
    ({ graph } = await buildFromRepo(root, graphHome(root).cachePath, { lanes: true }));
});
afterAll(() => fs.rmSync(root, { recursive: true, force: true }));

describe('review-risk on a planted diff', () => {
    let r: ReviewRisk;
    beforeAll(() => {
        edit('app/Services/PartnerClient.php', "GetStock(['ItemCode' => $sku])", "GetStock(['ItemCode' => strtoupper($sku)])");
        edit('database/migrations/2024_01_01_000003_create_comments_table.php', "->text('body');", "->text('body')->nullable();");
        edit('.github/workflows/ci.yml', /runs-on: ubuntu-latest/g, 'runs-on: ubuntu-24.04');
        r = reviewRisk(root, graph, 'HEAD', diffHunks(root, 'HEAD')!);
    });

    it('starts from the symbols the hunks overlap', () => {
        expect(r.changed).toEqual(['.github/workflows/ci.yml', 'app/Services/PartnerClient.php', 'database/migrations/2024_01_01_000003_create_comments_table.php']);
        expect(r.seeds.map((s) => s.label)).toContain('warehouseStock');
    });

    it('lists every term with the facts it counted, each with a witness', () => {
        for (const t of r.terms) {
            expect(t.items.length, t.term).toBeGreaterThan(0);
            for (const i of t.items) expect(i.witness, `${t.term} ${i.id}`).toMatchObject({ file: expect.any(String), line: expect.any(Number), hash: expect.stringMatching(/^[0-9a-f]{8}$/) });
        }
        const labels = (term: string): string[] => r.terms.find((t) => t.term === term)!.items.map((i) => i.label);
        expect(labels('entry points')).toEqual(['GET /stock/{sku}']);
        expect(labels('missing partners')).toEqual(['config/services.php']);
        expect(labels('columns')).toEqual(['comments.body']);
        expect(labels('operations')).toEqual(['GetStock']);
        expect(labels('pipelines').sort()).toEqual(['deploy', 'stage-deploy', 'test']);
    });

    it('is a sum of count times weight, and nothing else', () => {
        expect(r.terms.map((t) => t.term)).toEqual([...RISK_TERMS]);
        for (const t of r.terms) expect(t.contribution).toBe(t.items.length * RISK_WEIGHTS[t.term]);
        expect(r.total).toBe(r.terms.reduce((n, t) => n + t.contribution, 0));
        expect(reviewRisk(root, graph, 'HEAD', diffHunks(root, 'HEAD')!, { ...RISK_WEIGHTS, pipelines: 0 }).total).toBe(r.total - r.terms.find((t) => t.term === 'pipelines')!.contribution);
    });

    it('answers through graph_impact in review_risk mode', async () => {
        const out = (await GRAPH_TOOLS['graph_impact']!.handler({ diff: 'HEAD', review_risk: true }, root)) as { status: string; total: number };
        expect(out.status).toBe('ok');
        expect(out.total).toBe(r.total);
    });
});

describe('review-risk boundaries', () => {
    it('no hunks score zero', () => {
        const clean = reviewRisk(root, graph, 'HEAD', []);
        expect(clean.total).toBe(0);
        expect(clean.terms.every((t) => t.items.length === 0)).toBe(true);
    });

    it('refuses a rev that does not resolve or reads as an option', () => {
        expect(diffHunks(root, 'no-such-rev')).toBeNull();
        expect(diffHunks(root, '--output=/tmp/x')).toBeNull();
    });

    it('reads zero-context hunks, a deleted file on its old side', () => {
        const text = ['--- a/x.ts', '+++ b/x.ts', '@@ -3,0 +4,2 @@', '+a', '+b', '--- a/gone.ts', '+++ /dev/null', '@@ -1,5 +0,0 @@'].join('\n');
        expect(parseUnifiedZero(text)).toEqual([
            { file: 'x.ts', from: 4, to: 5 },
            { file: 'gone.ts', from: 1, to: 5 },
        ]);
    });
});

describe('4.2 — a skipped lane reads unknown, never 0', () => {
    it('shallow clone renders unknown', async () => {
        const shallow = fs.mkdtempSync(path.join(os.tmpdir(), 'review-risk-shallow-'));
        try {
            execFileSync('git', ['clone', '-q', '--depth', '1', `file://${root}`, shallow]);
            const built = await buildFromRepo(shallow, graphHome(shallow).cachePath, { lanes: true });
            const history = built.graph.lanes_run?.find((l) => l.lane === 'history');
            expect(history?.skipped_reason).toBe('shallow clone');
            // Persisted through the serialized cache and accepted by the schema gate.
            const reread = JSON.parse(fs.readFileSync(graphHome(shallow).cachePath, 'utf-8')) as CodeGraph;
            expect(reread.lanes_run?.find((l) => l.lane === 'history')?.skipped_reason).toBe('shallow clone');
            expect(validateGraph(reread).ok).toBe(true);

            fs.appendFileSync(path.join(shallow, 'app/Services/PartnerClient.php'), '// edit\n');
            const r = reviewRisk(shallow, reread, 'HEAD', diffHunks(shallow, 'HEAD')!);
            const partners = r.terms.find((t) => t.term === 'missing partners')!;
            expect(partners.unknown).toBe('shallow clone');
            expect(partners.contribution).toBe(0);
            expect(r.total).toBe(r.terms.filter((t) => !t.unknown).reduce((n, t) => n + t.contribution, 0));
            const text = renderReviewRisk(r).join('\n');
            expect(text).toContain('missing partners unknown (shallow clone)');
            expect(text).not.toMatch(/missing partners 0×/);
        } finally {
            fs.rmSync(shallow, { recursive: true, force: true });
        }
    });
});

describe('5.1 — three deterministic checks', () => {
    it('three checks cite witnesses', () => {
        const r = reviewRisk(root, graph, 'HEAD', diffHunks(root, 'HEAD')!);
        expect(r.checks.map((c) => c.id)).toEqual(['untested-change', 'missing-co-change', 'touched-entry-point']);
        const byId = Object.fromEntries(r.checks.map((c) => [c.id, c]));
        const untested = byId['untested-change']!;
        expect(untested.items.find((i) => i.label === 'warehouseStock')?.verdict).toBe('untested');
        expect(untested.status).toBe('finding');
        expect(byId['missing-co-change']!.items.map((i) => i.label)).toEqual(['config/services.php']);
        expect(byId['touched-entry-point']!.items.map((i) => i.label)).toContain('GET /stock/{sku}');
        for (const c of r.checks) for (const i of c.items) expect(i.witness, `${c.id} ${i.id}`).toMatch(/^[^:]+:\d+$/);
        for (const c of r.checks.slice(1)) for (const i of c.items) expect(i.edges.length).toBeGreaterThan(0);
    });

    it('labels a change reached by a tested caller, and cites the tests edge of a tested one', () => {
        const g: CodeGraph = {
            schema_version: 3, source_checksum: 'hand', languages: ['typescript'], grammar_abi: 14,
            edge_confidence_counts: { EXTRACTED: 0, INFERRED: 0, AMBIGUOUS: 0 },
            suppressed_edge_counts: { dynamic_no_candidate: 0 },
            nodes: [
                { id: 'a.ts#direct', label: 'direct', kind: 'function', source_file: 'a.ts', source_location: [1, 1, 2, 1] },
                { id: 'a.ts#inner', label: 'inner', kind: 'function', source_file: 'a.ts', source_location: [4, 1, 5, 1] },
                { id: 'b.ts#outer', label: 'outer', kind: 'function', source_file: 'b.ts', source_location: [1, 1, 3, 1] },
                { id: 't.test.ts', label: 't.test.ts', kind: 'file', source_file: 't.test.ts', source_location: [] },
            ],
            edges: [
                { source: 't.test.ts', target: 'a.ts#direct', relation: 'tests', confidence: 'INFERRED', resolved_via: 'test-import', provider: 'native' },
                { source: 't.test.ts', target: 'b.ts#outer', relation: 'tests', confidence: 'INFERRED', resolved_via: 'test-import', provider: 'native' },
                { source: 'b.ts#outer', target: 'a.ts#inner', relation: 'calls', confidence: 'INFERRED', resolved_via: 'import-specifier', provider: 'native' },
            ],
        } as CodeGraph;
        const r = reviewRisk(root, g, 'HEAD', [{ file: 'a.ts', from: 1, to: 5 }]);
        const items = r.checks[0]!.items;
        expect(items.find((i) => i.id === 'a.ts#direct')).toMatchObject({ verdict: 'tested', edges: ['t.test.ts --tests/test-import--> a.ts#direct'] });
        expect(items.find((i) => i.id === 'a.ts#inner')).toMatchObject({ verdict: 'reached-by-tested-caller', edges: ['b.ts#outer --calls/import-specifier--> a.ts#inner'] });
        expect(r.checks[0]!.status).toBe('pass');
    });
});

describe('5.4 — the regression selector has a caller', () => {
    it('impact --regressions selects the registry entries the diff reaches', () => {
        const reg = path.join(root, 'agents', 'regressions.json');
        fs.writeFileSync(reg, JSON.stringify([{ id: 'guards-partner', guards: ['app/Services/PartnerClient.php'] }, { id: 'guards-nothing', guards: ['nowhere.ts'] }]));
        let out = '';
        try {
            out = execFileSync(path.resolve(__dirname, '../../node_modules/.bin/tsx'), [path.resolve(__dirname, '../../src/scripts/code_graph/cli.ts'), 'impact', '--diff', 'HEAD~1', '--root', root, '--graph', graphHome(root).cachePath, '--regressions', reg], { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] });
        } catch (e) {
            out = (e as { stdout?: string }).stdout ?? '';
        }
        const r = JSON.parse(out) as { graph: string; selected: Array<{ id: string; reason: string }>; skipped: string[]; refusal: string[] | null };
        expect(r.graph).toBe('code');
        expect(r.selected.map((x) => x.id)).toEqual(['guards-partner']);
        expect(r.selected[0]!.reason).toBe('touched');
        expect(r.skipped).toEqual(['guards-nothing']);
    }, 60_000);
});

describe('5.5 — the PR comment, opt-in', () => {
    it('markdown no analysis is not low risk', () => {
        const none = renderReviewRiskMarkdown(null, 'no code graph has been built');
        expect(none.startsWith(REVIEW_RISK_COMMENT_MARKER)).toBe(true);
        expect(none).toContain('**Status: no analysis**');
        expect(none).not.toMatch(/Band: low/);

        const r = reviewRisk(root, graph, 'HEAD', diffHunks(root, 'HEAD')!);
        const md = renderReviewRiskMarkdown(r, undefined, { callers: 3 });
        expect(md).toContain(`**Band: ${riskBand(r).band}**`);
        expect(md).not.toMatch(/\d\.\d/); // no decimal
        for (const c of r.checks) expect(md).toContain(`| ${c.id} | ${c.status}`);
        expect(md).toContain('Omitted by the cap: callers 3');

        // A skipped lane makes the band unknown, never low.
        const skipped = reviewRisk(root, { ...graph, lanes_run: [...(graph.lanes_run ?? []).filter((l) => l.lane !== 'history'), { lane: 'history', facts: 0, relations: 0, skipped_reason: 'shallow clone' }] }, 'HEAD', diffHunks(root, 'HEAD')!);
        expect(riskBand(skipped)).toMatchObject({ band: 'unknown', reasons: ['missing partners: shallow clone'] });
        expect(renderReviewRiskMarkdown(skipped)).toContain('**Band: unknown**');
    });
});
