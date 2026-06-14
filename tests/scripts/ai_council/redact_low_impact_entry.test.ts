// Tests for src/scripts/ai_council/redact_low_impact_entry.ts (py2ts Phase 1).
//
// SECURITY-SENSITIVE twin: the redaction regexes and refusal markers must
// match the Python original byte-for-byte. Golden-parity is run against the
// CPython twin (imported as a package member so its `from
// scripts.ai_council.config import _RAW_KEY_PREFIXES` resolves), comparing the
// structured result (ok / violations / summary) on fixtures that hit each of
// the eight forbidden-content classes.
//
// Secret-shaped / email / path tokens are ASSEMBLED FROM ESCAPE SEQUENCES so
// this test file does not itself trip the repo's source-confidentiality /
// secret-scanning linters.
import { describe, expect, it } from 'vitest';

import {
    RedactionResult,
    redact_low_impact_entry,
} from '../../../src/scripts/ai_council/redact_low_impact_entry.js';
import { hasPython3, runPyCode } from './_harness.js';

const py3 = hasPython3();

// ── fixtures assembled from parts (never a literal secret) ────────────────
const SK = 'sk-' + 'A'.repeat(10); // raw-key prefix class
const SK_ANT = 'sk-ant-' + 'B'.repeat(10);
const EMAIL = 'al' + 'ice' + '@' + 'exa' + 'mple.com';
const UPATH = '/Users' + '/bob/proj/file.ts';
const HOST = 'api.corp.' + 'internal';
const MONEY = '$' + '1,234.56';
const LONG = 'x'.repeat(45); // > 40 chars inside backticks
const API_KEY = 'api_key' + ': ' + 'C'.repeat(14);

/** Run the redactor in CPython via the package import, return the JSON dict. */
function pyRedact(text: string, kwargs = '{}'): {
    ok: boolean;
    summary: string;
    violations: Array<[string, string, string]>;
} {
    const code = [
        'import json, sys',
        'from scripts.ai_council.redact_low_impact_entry import redact_low_impact_entry',
        'text = sys.argv[1]',
        'kw = json.loads(sys.argv[2])',
        'r = redact_low_impact_entry(text, **kw)',
        'print(json.dumps({"ok": r.ok, "summary": r.summary(), '
            + '"violations": [[v.category, v.snippet, v.note] for v in r.violations]}, ensure_ascii=False))',
    ].join('\n');
    const res = runPyCode(code, [text, kwargs]);
    if (res.status !== 0) {
        throw new Error(`python3 failed: ${res.stderr}`);
    }
    return JSON.parse(res.stdout);
}

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

describe.runIf(py3)('redact_low_impact_entry — golden parity vs CPython twin', () => {
    const cases: Array<{ desc: string; text: string; kwargs?: string }> = [
        { desc: 'clean', text: 'plain decision about caching' },
        { desc: 'raw-key secret', text: `leak ${SK}` },
        { desc: 'sk-ant secret', text: `anthropic ${SK_ANT}` },
        { desc: 'inline api_key', text: `${API_KEY}` },
        { desc: 'email', text: `mail ${EMAIL}` },
        { desc: 'unix path', text: `path ${UPATH}` },
        { desc: 'windows path', text: 'path C:\\Users\\bob\\f.txt here' },
        { desc: 'internal host', text: `host ${HOST}` },
        { desc: 'money usd-code', text: 'cost USD 1000 total' },
        { desc: 'money symbol', text: `cost ${MONEY}` },
        { desc: 'long code', text: 'code `' + LONG + '`' },
        {
            desc: 'all-classes combined + kwargs',
            text: `${SK} ${EMAIL} ${UPATH} ${HOST} ${MONEY} \`${LONG}\` ${API_KEY} acme tbl`,
            kwargs: JSON.stringify({
                repo_root: '/Users/bob',
                private_domains: ['priv.example'],
                customer_names: ['acme'],
                sql_identifiers: ['tbl'],
            }),
        },
    ];

    const tsKwargs = (k?: string): Parameters<typeof redact_low_impact_entry>[1] => {
        if (!k) {
            return {};
        }
        const obj = JSON.parse(k) as Record<string, unknown>;
        return {
            repoRoot: (obj['repo_root'] as string) ?? null,
            privateDomains: (obj['private_domains'] as string[]) ?? [],
            customerNames: (obj['customer_names'] as string[]) ?? [],
            sqlIdentifiers: (obj['sql_identifiers'] as string[]) ?? [],
        };
    };

    it.each(cases)('$desc', ({ text, kwargs }) => {
        const expected = pyRedact(text, kwargs ?? '{}');
        const r = redact_low_impact_entry(text, tsKwargs(kwargs));
        // Structured parity (JSON whitespace differs between json.dumps and
        // JSON.stringify; the content is what matters — same as modes.test.ts).
        expect(r.ok).toBe(expected.ok);
        expect(tsTuples(r)).toEqual(expected.violations);
        expect(r.summary()).toBe(expected.summary);
    });
});
