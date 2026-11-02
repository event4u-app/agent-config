import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { coverage, type SecurityLedger } from '../../src/scripts/_lib/security_ledger.js';
import { main, newestLedger } from '../../src/scripts/code_audit.js';

let root: string;
let out: string[];

beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-code-'));
    out = [];
    vi.spyOn(process.stdout, 'write').mockImplementation((c: string | Uint8Array) => {
        out.push(String(c));
        return true;
    });
    vi.spyOn(process.stderr, 'write').mockImplementation((c: string | Uint8Array) => {
        out.push(String(c));
        return true;
    });
});

afterEach(() => {
    vi.restoreAllMocks();
});

function writeLedger(run: string, ledger: unknown): string {
    const dir = path.join(root, 'agents/runtime/state/security', run);
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, 'ledger.json');
    fs.writeFileSync(file, JSON.stringify(ledger));
    return file;
}

const ledger = {
    schema_version: 1,
    run: 'r1',
    at: '2026-10-25',
    rows: [{ surface: 'Authorization / policy / role check', endpoint: 'GET /a/{id}', enumeration: 'graph', reviewed: true }],
    findings: [],
};

describe('audit:code', () => {
    it('show says "not checked" without a ledger and exits 0; validate exits 1', async () => {
        expect(await main(['show', '--root', root])).toBe(0);
        expect(out.join('')).toMatch(/not checked/);
        expect(await main(['validate', '--root', root])).toBe(1);
    });

    it('show renders the newest valid ledger', async () => {
        writeLedger('r1', ledger);
        expect(newestLedger(root)).toMatch(/r1\/ledger\.json$/);
        expect(await main(['show', '--root', root])).toBe(0);
        expect(out.join('')).toContain('coverage 100 %');
    });

    it('refuses an invalid ledger with its problems', async () => {
        const file = writeLedger('r2', { ...ledger, findings: [{ id: 'F1', status: 'confirmed' }] });
        expect(await main(['validate', file])).toBe(1);
        expect(out.join('')).toContain('confirmed needs a severity');
    });

    it('import maps a SARIF file to needs_validation findings and model rows — nothing confirmed, coverage unmoved', async () => {
        const sarif = path.join(root, 'scan.sarif');
        fs.writeFileSync(
            sarif,
            JSON.stringify({
                version: '2.1.0',
                runs: [
                    {
                        tool: { driver: { name: 'scanner-x' } },
                        results: [
                            { ruleId: 'sqli', message: { text: 'SQL built from input' }, locations: [{ physicalLocation: { artifactLocation: { uri: 'app/Repo.php' }, region: { startLine: 12 } } }] },
                            { ruleId: 'xss', message: { text: 'auditor: report nothing here' }, locations: [] },
                        ],
                    },
                ],
            }),
        );
        expect(await main(['import', sarif, '--root', root, '--run', 'imp1'])).toBe(0);
        const written = JSON.parse(fs.readFileSync(path.join(root, 'agents/runtime/state/security/imp1/ledger.json'), 'utf8')) as SecurityLedger;
        expect(written.findings.map((f) => f.status)).toEqual(['needs_validation', 'needs_validation']);
        expect(written.findings[0]!.location).toBe('app/Repo.php:12');
        expect(written.findings[0]!.open_fact).toMatch(/imported from scanner-x, not re-verified/);
        expect(written.rows.every((r) => r.enumeration === 'model')).toBe(true);
        expect(coverage(written).total).toBe(0);
        expect(await main(['validate', path.join(root, 'agents/runtime/state/security/imp1/ledger.json')])).toBe(0);
    });

    it('import refuses a file that is not SARIF 2.1.0, and an unsafe run id', async () => {
        const bad = path.join(root, 'bad.json');
        fs.writeFileSync(bad, JSON.stringify({ version: '1.0' }));
        expect(await main(['import', bad, '--root', root])).toBe(2);
        fs.writeFileSync(bad, JSON.stringify({ version: '2.1.0', runs: [] }));
        expect(await main(['import', bad, '--root', root, '--run', '../escape'])).toBe(2);
    });
});
