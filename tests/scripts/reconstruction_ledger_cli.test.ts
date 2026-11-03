// road-to-an-observation-provider-slot 0.2 — the ledger CLI's exit codes.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { main } from '../../src/scripts/reconstruction_ledger.js';

let dir: string;
let output: string;

beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ledger-cli-'));
    output = '';
    const capture = (chunk: string | Uint8Array): boolean => {
        output += String(chunk);
        return true;
    };
    vi.spyOn(process.stdout, 'write').mockImplementation(capture);
    vi.spyOn(process.stderr, 'write').mockImplementation(capture);
});

afterEach(() => {
    vi.restoreAllMocks();
    fs.rmSync(dir, { recursive: true, force: true });
});

function row(over: Record<string, unknown> = {}): Record<string, unknown> {
    return {
        id: 'o1',
        behavior: 'saving an empty title shows a validation error',
        tier: 'behavior',
        required_cases: ['happy', 'empty'],
        evidence: { happy: ['E1'], empty: ['E2'] },
        verifier: 'tests/feature/title.test.ts',
        verifier_authority: 'controlled-replay',
        status: 'verified',
        ...over,
    };
}

function ledgerFile(body: unknown): string {
    const p = path.join(dir, 'obligations.json');
    fs.writeFileSync(p, typeof body === 'string' ? body : JSON.stringify(body));
    return p;
}

describe('reconstruction_ledger --check', () => {
    it('exits 0 on a closed ledger', () => {
        const p = ledgerFile({ evidence_ids: ['E1', 'E2'], obligations: [row()] });
        expect(main(['--check', p])).toBe(0);
        expect(output).toContain('closed');
    });

    it('exits 1 on an open ledger', () => {
        const p = ledgerFile({ evidence_ids: ['E1', 'E2'], obligations: [row(), row({ id: 'o2', status: 'open' })] });
        expect(main(['--check', p])).toBe(1);
        expect(output).toContain('open');
    });

    it('exits 1 on an empty ledger, which reads unknown', () => {
        const p = ledgerFile({ evidence_ids: [], obligations: [] });
        expect(main(['--check', p])).toBe(1);
        expect(output).toContain('unknown');
    });

    it('exits 2 on an invalid ledger and names each error', () => {
        const p = ledgerFile({ evidence_ids: ['E1'], obligations: [row()] });
        expect(main(['--check', p])).toBe(2);
        expect(output).toContain('invalid');
        expect(output).toContain('unknown evidence id E2');
    });

    it('fails closed when the file records no evidence ids', () => {
        const p = ledgerFile({ obligations: [row()] });
        expect(main(['--check', p])).toBe(2);
    });

    it('exits 2 on usage errors: no flag, a missing file, unparseable JSON, a wrong shape', () => {
        expect(main([])).toBe(2);
        expect(main(['--check'])).toBe(2);
        expect(main(['--check', path.join(dir, 'nope.json')])).toBe(2);
        expect(main(['--check', ledgerFile('{ not json')])).toBe(2);
        expect(main(['--check', ledgerFile({ evidence_ids: [], obligations: {} })])).toBe(2);
    });

    it('exits 2 with a message, never a stack trace, on a malformed row', () => {
        const noEvidence = { id: 'a', status: 'open', tier: 'ux', verifier_authority: 'maintainer' };
        expect(main(['--check', ledgerFile({ evidence_ids: ['e1'], obligations: [noEvidence] })])).toBe(2);
        expect(output).toContain('a: `evidence` must be an object');

        output = '';
        const noCases = row({ required_cases: undefined });
        expect(main(['--check', ledgerFile({ evidence_ids: ['E1', 'E2'], obligations: [noCases] })])).toBe(2);
        expect(output).toContain('o1: `required_cases` must be a list of strings');

        output = '';
        expect(main(['--check', ledgerFile({ evidence_ids: ['E1'], obligations: [null] })])).toBe(2);
        expect(output).toContain('row 0: not an object');
    });
});
