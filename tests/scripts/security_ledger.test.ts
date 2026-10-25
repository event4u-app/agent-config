import { describe, expect, it } from 'vitest';

import { coverage, renderLedger, runStatus, type SecurityLedger, validateLedger } from '../../src/scripts/_lib/security_ledger.js';

const base = (): SecurityLedger => ({
    schema_version: 1,
    run: 'r1',
    at: '2026-10-25T10:00:00Z',
    rows: [
        { surface: 'Authorization / policy / role check', endpoint: 'GET /invoices/{id}', enumeration: 'graph', reviewed: true },
        { surface: 'File upload / user-supplied URL', endpoint: 'POST /avatar', enumeration: 'convention', reviewed: false, reason: 'budget' },
        { surface: 'Public unauthenticated endpoint', endpoint: 'GET /debug', enumeration: 'model', reviewed: true },
    ],
    findings: [
        { id: 'F1', status: 'confirmed', title: 'IDOR on invoices', location: 'app/Http/InvoiceController.php:42', finder: 'hunter-authz', verifier: 'verifier-2', severity: 'high', proof: 'test', proof_test: 'tests/Feature/InvoiceIdorTest.php' },
        { id: 'F2', status: 'needs_validation', title: 'Upload type', location: 'app/Http/AvatarController.php:12', finder: 'hunter-upload', verifier: 'verifier-3', open_fact: 'does the storage disk serve uploads as text/html?' },
        { id: 'F3', status: 'rejected', title: 'Raw SQL', location: 'database/migrations/x.php:9', finder: 'hunter-input', verifier: 'verifier-4', reason: 'static migration constant' },
    ],
});

describe('validateLedger', () => {
    it('accepts a well-formed ledger', () => {
        expect(validateLedger(base())).toEqual([]);
    });

    it('refuses a severity on needs_validation', () => {
        const l = base();
        l.findings[1] = { ...l.findings[1]!, severity: 'high' };
        expect(validateLedger(l)).toContain('findings[1] F2: needs_validation carries no severity');
    });

    it('refuses a finder verifying its own candidate unless recorded single-member', () => {
        const l = base();
        l.findings[0] = { ...l.findings[0]!, verifier: 'hunter-authz' };
        expect(validateLedger(l)[0]).toMatch(/finder and verifier are the same/);
        l.findings[0] = { ...l.findings[0]!, review_independence: 'single-member' };
        expect(validateLedger(l)).toEqual([]);
    });

    it('refuses a confirmed finding without proof, and an unreviewed row without its reason', () => {
        const l = base();
        delete l.findings[0]!.proof;
        delete l.rows[1]!.reason;
        expect(validateLedger(l)).toEqual([
            'rows[1]: an unreviewed row names its reason',
            'findings[0] F1: confirmed needs proof static-trace|test',
        ]);
    });
});

describe('coverage and the derived report', () => {
    it('counts graph and convention rows only', () => {
        expect(coverage(base())).toEqual({ reviewed: 1, total: 2, percent: 50 });
    });

    it('orders open, then unreviewed, then rejected, and never prints a bare zero', () => {
        const text = renderLedger(base());
        const order = ['## Open findings', '## Unreviewed', '## Rejected candidates'].map((h) => text.indexOf(h));
        expect(order).toEqual([...order].sort((a, b) => a - b));
        expect(text).toContain('model-found, not counted');
        const empty = { ...base(), findings: [] };
        expect(renderLedger(empty)).toContain('none open — at 50 % coverage');
    });

    it('says "not enumerated" when no row came from the graph or a convention', () => {
        const l = { ...base(), rows: [base().rows[2]!], findings: [] };
        const text = renderLedger(l);
        expect(text).toContain('coverage: not enumerated');
        expect(text).not.toContain('0 %');
    });

    it('compares finder and verifier after trimming and case-folding', () => {
        const l = base();
        l.findings[0] = { ...l.findings[0]!, finder: 'Hunter-Authz ', verifier: 'hunter-authz' };
        expect(validateLedger(l)[0]).toMatch(/finder and verifier are the same/);
    });

    it('says "not checked" when there is no ledger', () => {
        expect(renderLedger(null)).toMatch(/^Security: not checked/);
    });
});

describe('runStatus', () => {
    it('is partial while a counted row is unreviewed or a finding still needs validation', () => {
        expect(runStatus(base())).toBe('partial');
        const l = base();
        l.rows[1] = { ...l.rows[1]!, reviewed: true };
        expect(runStatus(l)).toBe('partial');
        l.findings[1] = { ...l.findings[1]!, status: 'rejected', reason: 'served as attachment' };
        expect(runStatus(l)).toBe('complete');
    });

    it('is not_enumerated when no row came from the graph or a convention, whatever the findings say', () => {
        const l = base();
        l.rows = l.rows.filter((r) => r.enumeration === 'model');
        l.findings = [];
        expect(runStatus(l)).toBe('not_enumerated');
    });

    it('is printed before anything else in the report', () => {
        expect(renderLedger(base()).split('\n')[1]).toBe('status: partial');
    });
});

