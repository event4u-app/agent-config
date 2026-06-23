// Tests for src/scripts/ai_council/redact_low_impact_entry.ts (py2ts Phase 1).
//
// SECURITY-SENSITIVE: the redaction regexes and refusal markers cover each of
// the eight forbidden-content classes.
//
// Secret-shaped / email / path tokens are ASSEMBLED FROM ESCAPE SEQUENCES so
// this test file does not itself trip the repo's source-confidentiality /
// secret-scanning linters.
import { describe, expect, it } from 'vitest';

import type {
    RedactionResult} from '../../../src/scripts/ai_council/redact_low_impact_entry.js';
import {
    redact_low_impact_entry,
} from '../../../src/scripts/ai_council/redact_low_impact_entry.js';

// ── fixtures assembled from parts (never a literal secret) ────────────────
const SK = 'sk-' + 'A'.repeat(10); // raw-key prefix class
const EMAIL = 'al' + 'ice' + '@' + 'exa' + 'mple.com';
const UPATH = '/Users' + '/bob/proj/file.ts';
const HOST = 'api.corp.' + 'internal';
const MONEY = '$' + '1,234.56';
const LONG = 'x'.repeat(45); // > 40 chars inside backticks
const API_KEY = 'api_key' + ': ' + 'C'.repeat(14);

function tsTuples(r: RedactionResult): Array<[string, string, string]> {
    return r.violations.map((v) => [v.category, v.snippet, v.note]);
}

describe('redact_low_impact_entry — clean input', () => {
    it('returns ok=true and "redaction: clean" on benign text', () => {
        const r = redact_low_impact_entry('a generic decision about retry backoff strategy');
        expect(r.ok).toBe(true);
        expect(r.violations).toEqual([]);
        expect(r.summary()).toBe('redaction: clean');
    });

    it('generic placeholders survive (<customer> etc.)', () => {
        const r = redact_low_impact_entry('handled for <customer> and <tenant> accounts');
        expect(r.ok).toBe(true);
    });
});

describe('redact_low_impact_entry — eight forbidden classes', () => {
    it('1. secret — raw-key prefix', () => {
        const r = redact_low_impact_entry(`leaked ${SK} here`);
        expect(r.ok).toBe(false);
        expect(tsTuples(r)).toContainEqual(['secret', SK.slice(0, 8) + '…', "raw-key prefix 'sk-'"]);
    });

    it('1b. secret — inline api_key shape', () => {
        const r = redact_low_impact_entry(`config ${API_KEY} value`);
        expect(r.ok).toBe(false);
        expect(tsTuples(r).some(([c, , n]) => c === 'secret' && n === 'inline api_key')).toBe(true);
    });

    it('2. email', () => {
        const r = redact_low_impact_entry(`contact ${EMAIL} for details`);
        expect(tsTuples(r)).toContainEqual(['email', EMAIL, '']);
    });

    it('3. project path', () => {
        const r = redact_low_impact_entry(`see ${UPATH} for the change`);
        expect(tsTuples(r)).toContainEqual(['project_path', UPATH, '']);
    });

    it('3b. configured repo root', () => {
        const r = redact_low_impact_entry('lives under /opt/secretroot/x', { repoRoot: '/opt/secretroot' });
        expect(tsTuples(r)).toContainEqual(['project_path', '/opt/secretroot', 'configured repo root']);
    });

    it('4. customer name (caller-supplied, case-insensitive)', () => {
        const r = redact_low_impact_entry('the ACME deal closed', { customerNames: ['acme'] });
        expect(tsTuples(r)).toContainEqual(['customer_name', 'acme', '']);
    });

    it('5. internal hostname', () => {
        const r = redact_low_impact_entry(`ping ${HOST} now`);
        expect(tsTuples(r)).toContainEqual(['internal_hostname', HOST, '']);
    });

    it('5b. configured private domain', () => {
        const r = redact_low_impact_entry('host secret.example reached', {
            privateDomains: ['secret.example'],
        });
        expect(tsTuples(r)).toContainEqual([
            'internal_hostname',
            'secret.example',
            'configured private domain',
        ]);
    });

    it('6. monetary amount', () => {
        const r = redact_low_impact_entry(`budget ${MONEY} approved`);
        expect(tsTuples(r)).toContainEqual(['monetary_amount', MONEY, '']);
    });

    it('7. SQL identifier (caller-supplied)', () => {
        const r = redact_low_impact_entry('joined the orders_v2 table', {
            sqlIdentifiers: ['orders_v2'],
        });
        expect(tsTuples(r)).toContainEqual(['sql_identifier', 'orders_v2', '']);
    });

    it('8. long code excerpt (> 40 chars in backticks)', () => {
        const r = redact_low_impact_entry('snippet `' + LONG + '` end');
        expect(tsTuples(r)).toContainEqual([
            'long_code_excerpt',
            LONG.slice(0, 40) + '…',
            `${LONG.length} chars`,
        ]);
    });
});

describe('redact_low_impact_entry — RedactionResult.summary()', () => {
    it('joins violations with the REFUSED marker', () => {
        const r = redact_low_impact_entry(`${EMAIL} and ${MONEY}`);
        expect(r.summary().startsWith('redaction REFUSED — ')).toBe(true);
        expect(r.summary()).toContain(`email: '${EMAIL}'`);
    });
});
