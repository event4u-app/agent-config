import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { main, newestLedger } from '../../src/scripts/audit_code.js';

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
});
