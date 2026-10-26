import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { evaluateDrift, type DriftRule } from '../../../src/scripts/code_graph/drift.js';
import { INTERFACE_DRIFT_RULES } from '../../../src/scripts/code_graph/lanes/interfaces/drift_rules.js';
import { readInterfaces } from '../../../src/scripts/code_graph/lanes/interfaces/index.js';

const FIX = path.resolve(__dirname, '..', '..', 'fixtures', 'code-graph', 'interfaces');
const p5 = readInterfaces(path.join(FIX, 'p5'));
const drift = readInterfaces(path.join(FIX, 'drift'));
const others = readInterfaces(path.join(FIX, 'others'));

function count(findings: { rule: string; title: string }[]): Record<string, number> {
    const out: Record<string, number> = {};
    for (const f of findings) out[`${f.rule} ${f.title}`] = (out[`${f.rule} ${f.title}`] ?? 0) + 1;
    return out;
}

describe('interface drift — P5 fixture', () => {
    const report = evaluateDrift(p5);

    it('finds exactly the contract and client classes the fixture plants', () => {
        expect(count(report.findings)).toEqual({
            'IF-1 call not in contract': 1,
            'IF-2 contract operation never called': 1,
            'IF-3 parameter mismatch': 1,
            'IF-4 literal base URL in code': 1,
            'IF-5 outbound call without timeout': 1,
        });
    });

    it('carries both witnesses for every finding', () => {
        for (const f of report.findings) {
            expect(f.witnesses[0]).toBeTruthy();
            expect(f.witnesses[1]).toBeTruthy();
            expect(f.tier).toBe('advice');
        }
        const if1 = report.findings.find((f) => f.rule === 'IF-1');
        expect(if1?.subject).toContain('DELETE /orders/{orderId}/cancel');
        expect(if1?.witnesses.map((w) => w?.file)).toEqual(['app/Services/PartnerClient.php', 'contracts/partner.openapi.yaml']);
        const if2 = report.findings.find((f) => f.rule === 'IF-2');
        expect(if2?.subject).toBe('operation:partner:GET /invoices');
        const if3 = report.findings.find((f) => f.rule === 'IF-3');
        expect(if3?.message).toContain('+qty');
        expect(if3?.message).toContain('-quantity');
    });

    it('does not flag the call that matches its contract, nor a client with a library default timeout', () => {
        const subjects = report.findings.map((f) => f.subject).join('\n');
        expect(subjects).not.toContain('GET /stock/{sku}');
        expect(report.findings.filter((f) => f.rule === 'IF-5').every((f) => f.subject.includes('erp.acme-erp.example'))).toBe(true);
    });

    it('prints its basis', () => {
        expect(report.basis.lane).toBe('interfaces');
        expect(report.basis.facts).toBe(p5.facts.length);
        expect(report.basis.rules).toEqual(['IF-1', 'IF-2', 'IF-3', 'IF-4', 'IF-5', 'IF-6', 'IF-7', 'IF-8']);
    });
});

describe('interface drift — drift fixture', () => {
    const report = evaluateDrift(drift);

    it('finds one of each planted class and nothing on the negatives', () => {
        expect(count(report.findings)).toEqual({
            'IF-4 credential literal in code': 1,
            'IF-5 outbound call without timeout': 1,
            'IF-6 user value into host or path': 1,
            'IF-7 webhook without signature check': 1,
            'IF-8 one service via two config names': 1,
        });
        const subjects = report.findings.map((f) => f.subject).join('\n');
        expect(subjects).not.toMatch(/invoices\/\{id\}|default\.png|webhooks\/payments|tomorrow/);
    });

    it('masks the credential everywhere', () => {
        const f = report.findings.find((x) => x.rule === 'IF-4');
        expect(f?.message).toContain('fixt****(23 chars)');
        expect(JSON.stringify(report)).not.toContain('fixturetokennotreal0000');
        expect(JSON.stringify(drift)).not.toContain('fixturetokennotreal0000');
        expect(f?.witnesses[1]?.line).toBe(9);
    });

    it('hands IF-6 and IF-7 to the threat-modeling skill instead of judging them', () => {
        for (const id of ['IF-6', 'IF-7']) {
            const f = report.findings.find((x) => x.rule === id);
            expect(f?.handoff).toBe('threat-modeling');
            expect(f?.message).toContain('threat-modeling');
        }
        for (const f of report.findings.filter((x) => !['IF-6', 'IF-7'].includes(x.rule))) expect(f.handoff).toBeNull();
    });

    it('witnesses IF-8 with both config-name sites', () => {
        const f = report.findings.find((x) => x.rule === 'IF-8');
        expect(f?.witnesses.map((w) => w?.file).sort()).toEqual(['app/weather.py', 'src/billing.ts']);
    });
});

describe('interface drift — other protocols', () => {
    it('applies the same rules to GraphQL and gRPC contracts', () => {
        const report = evaluateDrift(others);
        const ids = report.findings.map((f) => `${f.rule} ${f.subject}`);
        expect(ids).toContain('IF-1 graphql/client.ts#RESERVE -> operation:inventory_graphql:mutation release');
        expect(ids).toContain('IF-2 operation:inventory_graphql:query products');
        expect(ids).toContain('IF-2 operation:Inventory:rpc Inventory/Reserve');
        expect(report.findings.some((f) => f.rule === 'IF-3')).toBe(false);
    });
});

describe('interface drift — rules are data', () => {
    it('a new rule row yields findings with no engine change', () => {
        const extra: DriftRule = {
            id: 'IF-X',
            title: 'guessed service',
            tier: 'advice',
            handoff: null,
            match: 'fact',
            select: { edge: 'calls-out', where: { protocol: { eq: 'soap' } } },
            counter: 'client_witness',
            message: 'soap call {method}',
        };
        const report = evaluateDrift(p5, [...INTERFACE_DRIFT_RULES, extra]);
        const x = report.findings.filter((f) => f.rule === 'IF-X');
        expect(x).toHaveLength(1);
        expect(x[0]?.message).toBe('soap call GetStock');
        expect(evaluateDrift(p5, []).findings).toEqual([]);
    });
});
