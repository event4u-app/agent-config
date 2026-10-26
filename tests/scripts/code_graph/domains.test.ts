import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { assignDomains, proposeDomains, readDomainRules, structuralDomains } from '../../../src/scripts/code_graph/domains.js';
import { buildMap } from '../../../src/scripts/code_graph/map.js';
import type { MapModel } from '../../../src/scripts/code_graph/map_model.js';

const roots: string[] = [];
function project(files: Record<string, string>): string {
    const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'cg-domains-')));
    roots.push(root);
    for (const [rel, body] of Object.entries(files)) {
        fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
        fs.writeFileSync(path.join(root, rel), body);
    }
    fs.mkdirSync(path.join(root, 'agents', 'map'), { recursive: true });
    return root;
}
const php = (ns: string, cls: string, body: string, uses: string[] = []): string =>
    `<?php\nnamespace ${ns};\n\n${uses.map((u) => `use ${u};\n`).join('')}\nclass ${cls}${body}\n`;
async function model(root: string): Promise<MapModel> {
    const res = await buildMap(root, {});
    return (JSON.parse(fs.readFileSync(path.join(res.outDir, 'code', 'map.json'), 'utf-8')) as { model: MapModel }).model;
}
afterAll(() => {
    for (const r of roots) fs.rmSync(r, { recursive: true, force: true });
});

const LAYERS = `domains:
  - name: Orders
    paths: ["app/Orders/**"]
    public: ["app/Orders/Api/**", "app/Orders/Order.php"]
  - name: Billing
    paths: ["app/Billing/**"]
  - name: Money
    paths: ["app/Orders/Shared/**"]
domain_allow:
  Billing: [Orders]
`;

describe('declared domains', () => {
    let m: MapModel;
    let root: string;
    beforeAll(async () => {
        root = project({
            'composer.json': JSON.stringify({ require: { 'laravel/framework': '^11.0' }, autoload: { 'psr-4': { 'App\\': 'app/' } } }),
            'agents/map/layers.yaml': LAYERS,
            'app/Orders/Order.php': php('App\\Orders', 'Order', " extends \\Illuminate\\Database\\Eloquent\\Model\n{\n    protected $table = 'orders';\n    public function invoice() { return new Invoice(); }\n}", ['App\\Billing\\Invoice']),
            'app/Orders/Internal/Calc.php': php('App\\Orders\\Internal', 'Calc', '\n{\n}'),
            'app/Orders/Shared/Amount.php': php('App\\Orders\\Shared', 'Amount', '\n{\n}'),
            'app/Billing/Invoice.php': php('App\\Billing', 'Invoice', '\n{\n    public function total() { return new Calc(); }\n}', ['App\\Orders\\Internal\\Calc']),
            'app/Billing/OrderLedger.php': php('App\\Billing', 'OrderLedger', " extends \\Illuminate\\Database\\Eloquent\\Model\n{\n    protected $table = 'orders';\n    public function order() { return new \\App\\Orders\\Order(); }\n}"),
            'app/Misc/Thing.php': php('App\\Misc', 'Thing', '\n{\n}'),
            'database/migrations/2026_01_01_000000_create_orders_table.php':
                "<?php\nuse Illuminate\\Database\\Migrations\\Migration;\nuse Illuminate\\Database\\Schema\\Blueprint;\nuse Illuminate\\Support\\Facades\\Schema;\n\nreturn new class extends Migration {\n    public function up(): void\n    {\n        Schema::create('orders', function (Blueprint $table) {\n            $table->id();\n        });\n    }\n};\n",
        });
        m = await model(root);
    }, 120_000);

    it('gives each file its declared domain, and files outside every glob none', () => {
        const d = (p: string) => m.files.find((f) => f.path === p)?.domain;
        expect(d('app/Orders/Order.php')).toBe('Orders');
        expect(d('app/Billing/Invoice.php')).toBe('Billing');
        expect(d('app/Misc/Thing.php')).toBeUndefined();
        expect(m.domains?.source).toBe('declared');
    });

    it('reports each breach class with both witnesses', () => {
        const kinds = (m.domains?.violations ?? []).map((v) => `${v.kind}:${v.domains.join('>')}`).sort();
        expect(kinds).toContain('domain:Orders>Billing');
        expect(kinds).toContain('domain-public:Billing>Orders');
        expect(kinds).toContain('domain-cycle:Billing>Orders');
        expect(kinds).toContain('domain-overlap:Orders>Money');
        const breach = m.domains!.violations.find((v) => v.kind === 'domain')!;
        expect(breach.files.map((i) => m.files[i]!.path)).toEqual(['app/Orders/Order.php', 'app/Billing/Invoice.php']);
    });

    it('a table written from two domains is one finding', () => {
        const t = (m.domains?.violations ?? []).filter((v) => v.kind === 'domain-table');
        expect(t.map((v) => [v.table, v.domains])).toEqual([['orders', ['Billing', 'Orders']]]);
    });

    it('the context pack names each item\'s domain and the boundary the change crosses', async () => {
        const { buildFromRepo } = await import('../../../src/scripts/code_graph/build.js');
        const { loadGraph } = await import('../../../src/scripts/code_graph/query.js');
        const { contextPack } = await import('../../../src/scripts/code_graph/verify/pack.js');
        const cache = path.join(root, 'agents', 'map', '.build', 'pack-test.json');
        await buildFromRepo(root, cache, { lanes: true });
        const p = contextPack(loadGraph(cache), root, cache, '', { diffFiles: ['app/Orders/Order.php'] });
        expect(p.lines.join('\n')).toMatch(/domain Orders/);
        expect(p.domains).toEqual(['Billing', 'Orders']);
        expect(p.lines[p.lines.length - 1]).toBe('the change crosses domains: Billing, Orders');
    }, 120_000);

    it('the Domain lens is available and no proposal is made', () => {
        expect(m.legend?.find((l) => l.key === 'domain')?.available).toBe(true);
        expect(m.domainProposals).toBeUndefined();
    });
});

describe('without a declaration', () => {
    it('proposes domains as inferred only: no breach, no lens, a snippet to adopt', async () => {
        const files: Record<string, string> = { 'package.json': '{"name":"x"}' };
        for (let i = 0; i < 6; i++) files[`src/shipping/s${i}.ts`] = `import { s${(i + 1) % 6} } from './s${(i + 1) % 6}';\nexport const s${i} = 1;\n`;
        for (let i = 0; i < 6; i++) files[`src/catalog/c${i}.ts`] = `import { c${(i + 1) % 6} } from './c${(i + 1) % 6}';\nexport const c${i} = 1;\n`;
        const m = await model(project(files));
        expect(m.domains).toBeUndefined();
        expect(m.domainProposals?.source).toBe('inferred');
        expect(m.domainProposals?.list.map((x) => x.name).sort()).toEqual(['catalog', 'shipping']);
        expect(m.domainProposals?.snippet).toMatch(/^domains:\n {2}- name: /);
        expect(m.files.every((f) => f.domain === undefined)).toBe(true);
        expect(m.legend?.find((l) => l.key === 'domain')?.available).toBe(false);
    }, 120_000);

    it('adopting the snippet yields the declared domains and no proposals', async () => {
        const files: Record<string, string> = { 'package.json': '{"name":"x"}' };
        for (let i = 0; i < 6; i++) files[`src/shipping/s${i}.ts`] = `import { s${(i + 1) % 6} } from './s${(i + 1) % 6}';\nexport const s${i} = 1;\n`;
        const root = project(files);
        const first = await model(root);
        fs.writeFileSync(path.join(root, 'agents', 'map', 'layers.yaml'), `${first.domainProposals!.snippet}\n`);
        const second = await model(root);
        expect(second.domains?.list.map((d) => d.name)).toEqual(['shipping']);
        expect(second.domainProposals).toBeUndefined();
    }, 120_000);
});

describe('domain helpers', () => {
    it('reads the code structure as domains when two or more folders declare them', () => {
        const r = structuralDomains(['app/Domain/Orders/A.php', 'app/Domain/Billing/B.php', 'app/Http/C.php'])!;
        expect(r.source).toBe('structure');
        expect(assignDomains(['app/Domain/Orders/A.php', 'app/Http/C.php'], r).of).toEqual(['Orders', undefined]);
        expect(structuralDomains(['app/Domain/Orders/A.php'])).toBeNull();
    });

    it('never proposes a shared-sounding folder as a business domain', () => {
        const paths = ['src/shared/a.ts', 'src/shared/b.ts', 'src/shared/c.ts', 'src/shared/d.ts', 'src/shared/e.ts'];
        expect(proposeDomains([{ files: [0, 1, 2, 3, 4] }], paths)).toEqual([]);
    });

    it('returns null for a layers file without a domains section', () => {
        const root = project({ 'agents/map/layers.yaml': 'layers:\n  - name: ui\n    paths: ["src/**"]\n' });
        expect(readDomainRules(path.join(root, 'agents', 'map', 'layers.yaml'))).toBeNull();
    });
});
