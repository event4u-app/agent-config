import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { spanHash, type LaneOutput } from '../../../src/scripts/code_graph/lanes/lane_fact.js';
import { readInterfaces } from '../../../src/scripts/code_graph/lanes/interfaces/index.js';

const ROOT = path.resolve(__dirname, '..', '..', '..');
const FIX = path.join(ROOT, 'tests', 'fixtures', 'code-graph', 'interfaces');
const P5 = path.join(FIX, 'p5');
const OTHERS = path.join(FIX, 'others');
const LANE_SRC = path.join(ROOT, 'src', 'scripts', 'code_graph', 'lanes', 'interfaces');

const fact = (out: LaneOutput, id: string) => out.facts.find((f) => f.id === id);
const rels = (out: LaneOutput, relation: string) => out.relations.filter((r) => r.relation === relation);

function copyTree(src: string): string {
    const dst = fs.mkdtempSync(path.join(os.tmpdir(), 'if-lane-'));
    fs.cpSync(src, dst, { recursive: true });
    return dst;
}

const temps: string[] = [];
afterEach(() => {
    vi.restoreAllMocks();
    for (const t of temps.splice(0)) fs.rmSync(t, { recursive: true, force: true });
});

describe('interfaces lane — P5 fixture', () => {
    const out = readInterfaces(P5);

    it('binds service partner to the PARTNER_URL name read from config/services.php', () => {
        const partner = fact(out, 'service:partner');
        expect(partner?.attrs['base_names']).toEqual(['PARTNER_URL']);
        expect(partner?.attrs['config_names']).toEqual(['PARTNER_KEY']);
        const bind = rels(out, 'configured-by').find((r) => r.from === 'service:partner' && r.to === 'env-var:code:config/services.php#PARTNER_URL');
        expect(bind?.witness.file).toBe('config/services.php');
        const line = fs.readFileSync(path.join(P5, 'config/services.php'), 'utf8').split('\n')[(bind?.witness.line ?? 0) - 1];
        expect(line).toContain("env('PARTNER_URL')");
        expect(bind?.witness.hash).toBe(spanHash(line ?? ''));
    });

    it('does not materialise a configured service no code calls', () => {
        expect(out.facts.some((f) => f.kind === 'service' && /mailgun/.test(f.id))).toBe(false);
    });

    it('reads the SOAP operation GetStock from the WSDL with contract parameters, called by the client', () => {
        const op = out.facts.find((f) => f.kind === 'operation' && f.attrs['protocol'] === 'soap' && f.attrs['method'] === 'GetStock');
        expect(op).toBeDefined();
        expect(op?.rung).toBe('T2');
        expect(op?.attrs['params']).toEqual(['ItemCode', 'Warehouse']);
        expect(op?.attrs['required']).toEqual(['ItemCode']);
        expect(op?.attrs['param_source']).toBe('contract');
        const call = rels(out, 'calls-out').find((r) => r.to === op?.id);
        expect(call?.from).toBe('app/Services/PartnerClient.php#PartnerClient::warehouseStock');
        expect(rels(out, 'described-by').some((r) => r.from === op?.id && r.to === 'resources/wsdl/stock.wsdl')).toBe(true);
    });

    it('keeps the contract authoritative for operations and parameters, call-site params marked as such', () => {
        const orders = fact(out, 'operation:partner:POST /orders');
        expect(orders?.attrs['params']).toEqual(['sku', 'quantity']);
        expect(orders?.attrs['param_source']).toBe('contract');
        const call = rels(out, 'calls-out').find((r) => r.to === 'operation:partner:POST /orders');
        expect(call?.attrs['params']).toEqual(['sku', 'qty']);
        expect(call?.attrs['param_source']).toBe('from-call-site');
    });

    it('names a literal-host service by its host and normalises path parameters', () => {
        const erp = fact(out, 'service:erp.acme-erp.example');
        expect(erp?.attrs['hosts']).toEqual(['erp.acme-erp.example']);
        expect(out.facts.some((f) => f.id === 'operation:erp.acme-erp.example:GET /api/prices/{sku}')).toBe(true);
    });

    it('never links an outbound call to the in-repo Comment::post method', () => {
        expect(out.relations.some((r) => /Comment/.test(r.to) || /Comment/.test(r.from))).toBe(false);
        expect(rels(out, 'calls-out').every((r) => r.to.startsWith('operation:'))).toBe(true);
    });

    it('refuses the entity-expansion WSDL and records why', () => {
        const s = out.skipped.find((x) => x.file === 'resources/wsdl/evil.wsdl');
        expect(s?.reason).toMatch(/entity/);
        expect(out.facts.some((f) => f.owner === 'resources/wsdl/evil.wsdl')).toBe(false);
    });

    it('gives every record a witness that points at a real line, and uses only lane kinds and relations', () => {
        for (const rec of [...out.facts, ...out.relations]) {
            const lines = fs.readFileSync(path.join(P5, rec.witness.file), 'utf8').split('\n');
            expect(rec.witness.line).toBeGreaterThanOrEqual(1);
            expect(rec.witness.line).toBeLessThanOrEqual(lines.length);
            expect(rec.witness.hash).toMatch(/^[0-9a-f]{8}$/);
        }
        expect(new Set(out.facts.map((f) => f.kind))).toEqual(new Set(['service', 'operation']));
        for (const r of out.relations) expect(['calls-out', 'configured-by', 'member', 'described-by']).toContain(r.relation);
    });

    it('is deterministic', () => {
        expect(JSON.stringify(readInterfaces(P5))).toBe(JSON.stringify(out));
    });
});

describe('interfaces lane — names only', () => {
    it('never opens .env and never keeps a value from .env.example', () => {
        const dir = copyTree(P5);
        temps.push(dir);
        fs.writeFileSync(path.join(dir, '.env'), 'PARTNER_URL=https://env-sentinel-host.invalid\nPARTNER_KEY=env-sentinel-key\n');
        fs.writeFileSync(path.join(dir, '.env.local'), 'PARTNER_KEY=local-sentinel-key\n');
        fs.writeFileSync(path.join(dir, '.env.testing.yml'), 'openapi: 3.0.0\ninfo:\n  title: yaml-sentinel\npaths: {}\n');
        fs.writeFileSync(path.join(dir, '.env.example'), 'PARTNER_URL=https://example-sentinel-host.invalid\nPARTNER_KEY=example-sentinel-key\n');
        const spy = vi.spyOn(fs, 'readFileSync');
        const out = readInterfaces(dir);
        const opened = spy.mock.calls.map((c) => String(c[0]));
        expect(opened.filter((p) => /\/\.env(?:\.[^/]*)?$/.test(p) && !p.endsWith('.env.example'))).toEqual([]);
        expect(opened.some((p) => p.endsWith('.env.example'))).toBe(true);
        const json = JSON.stringify(out);
        expect(json).not.toMatch(/sentinel/);
        expect(fact(out, 'service:partner')?.attrs['undeclared_in_example']).toEqual([]);
    });

    it('marks a base name the example file does not declare', () => {
        const dir = copyTree(P5);
        temps.push(dir);
        fs.writeFileSync(path.join(dir, '.env.example'), 'APP_NAME=\n');
        const out = readInterfaces(dir);
        expect(fact(out, 'service:partner')?.attrs['undeclared_in_example']).toEqual(['PARTNER_KEY', 'PARTNER_URL']);
    });

    it('records a dynamic base as a guessed service', () => {
        const dir = copyTree(P5);
        temps.push(dir);
        fs.writeFileSync(
            path.join(dir, 'app/Services/Dynamic.php'),
            "<?php\nclass Dynamic\n{\n    public function go(string $url)\n    {\n        return Http::get($url);\n    }\n}\n",
        );
        const out = readInterfaces(dir);
        const call = out.relations.find((r) => r.relation === 'calls-out' && r.from === 'app/Services/Dynamic.php#Dynamic::go');
        expect(call?.guess).toBe(true);
        expect(fact(out, 'service:unresolved')?.attrs['guess']).toBe(true);
    });

    it('imports no network module', () => {
        for (const f of fs.readdirSync(LANE_SRC)) {
            const text = fs.readFileSync(path.join(LANE_SRC, f), 'utf8');
            expect(text).not.toMatch(/from\s+['"](?:node:)?(?:https?|net|tls|dgram|dns|http2|child_process)['"]/);
        }
    });
});

describe('interfaces lane — other protocols and contracts', () => {
    const out = readInterfaces(OTHERS);

    it('reads gRPC services from .proto and matches a Go stub call case-insensitively', () => {
        const op = fact(out, 'operation:Inventory:rpc Inventory/GetStock');
        expect(op?.attrs['params']).toEqual(['sku', 'warehouse']);
        const call = rels(out, 'calls-out').find((r) => r.to === op?.id);
        expect(call?.attrs['in_contract']).toBe(true);
        expect(call?.attrs['param_mismatch']).toEqual([]);
    });

    it('reads GraphQL SDL root fields and binds documents to the single client', () => {
        expect(fact(out, 'operation:inventory_graphql:query stock')?.attrs['required']).toEqual(['sku']);
        const docs = rels(out, 'calls-out').filter((r) => r.attrs['protocol'] === 'graphql');
        expect(docs.map((d) => d.attrs['path']).sort()).toEqual(['release', 'reserve', 'stock']);
        expect(docs.find((d) => d.attrs['path'] === 'stock')?.from).toBe('graphql/client.ts#STOCK');
        expect(fact(out, 'service:inventory_graphql')?.attrs['base_names']).toEqual(['INVENTORY_GRAPHQL_URL']);
    });

    it('turns a manifest SDK into a service with its constructor call', () => {
        expect(fact(out, 'service:stripe')?.attrs['sdk_package']).toBe('stripe');
        expect(rels(out, 'calls-out').some((r) => r.to === 'operation:stripe:Stripe' && r.from === 'graphql/billing.ts')).toBe(true);
    });

    it('reads .http and Postman request files without keeping a header', () => {
        const shop = fact(out, 'service:shop');
        expect(shop?.attrs['contracts']).toEqual(['api.http', 'shop.postman_collection.json']);
        expect(fact(out, 'operation:shop:POST /orders')).toBeDefined();
        expect(JSON.stringify(out)).not.toMatch(/must-never-be-read/);
    });

    it('binds Spring @Value, .NET and Ruby bases to env names', () => {
        expect(fact(out, 'service:partner')?.attrs['base_names']).toEqual(['PARTNER_URL']);
        expect(fact(out, 'service:shipping')?.attrs['base_names']).toEqual(['SHIPPING_URL']);
        expect(fact(out, 'service:fx')?.attrs['base_names']).toEqual(['FX_URL']);
    });

    it('records a remote WSDL as a reference and never resolves it', () => {
        const svc = fact(out, 'service:soap.remote-stock.example');
        expect(svc?.attrs['remote_specs']).toEqual(['https://soap.remote-stock.example/service?wsdl']);
        const call = rels(out, 'calls-out').find((r) => r.attrs['protocol'] === 'soap');
        expect(call?.attrs['params']).toEqual(['ItemCode']);
    });
});
