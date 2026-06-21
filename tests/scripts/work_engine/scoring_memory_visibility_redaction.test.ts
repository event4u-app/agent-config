// Privacy-floor regression for work_engine/scoring/memory_visibility.ts.
//
// PURE-TS port of tests/contracts/test_memory_visibility_redaction.py — the
// privacy-floor SPEC for `docs/contracts/memory-visibility-v1.md`. The sibling
// scoring_memory_visibility.test.ts covers the FUNCTIONAL surface (parity of
// summarise/format/diff/should_emit); this file covers the REDACTION floor only:
// the visibility line and its summary must never carry entry bodies, summaries,
// quoted snippets, secrets, tokens, env values, or paths outside the allowlist.
//
// Three layers, faithfully ported:
//   1. Allowlisted summary keys — summarise_visibility returns exactly
//      {asks, hits, ids}.
//   2. Rendered-line whitelist — grammar regex; no path separators outside the
//      allowlist; the 8 synthetic secrets never appear in the line OR in any
//      summary value's serialized form.
//   3. Synthetic-secret + unknown-id-typed payload drops.
//
// No python, no oracle: imports the TS twin and asserts directly.
import { describe, expect, it } from 'vitest';

import {
    format_line,
    summarise_visibility,
} from '../../../src/agent-src/templates/scripts/work_engine/scoring/memory_visibility.js';

const ALLOWED_SUMMARY_KEYS = ['asks', 'hits', 'ids'];

// Ported verbatim from SYNTHETIC_SECRETS in the python spec.
const SYNTHETIC_SECRETS: readonly string[] = [
    'AKIAFAKEFAKEFAKEFAKE',
    'ghp_FAKE_PERSONAL_ACCESS_TOKEN_1234567890',
    'Bearer eyJhbGciFAKEHEADER.FAKEPAYLOAD.FAKESIGNATURE',
    '/etc/passwd',
    '/var/log/prod.log',
    '/Users/operator/.ssh/id_rsa',
    'DROP TABLE customers',
    'user@example.com password=hunter2',
];

/** Build a memory hit dict that crams every dangerous field in (mirror `_payload`). */
function payload(extras: Record<string, unknown>): Record<string, unknown> {
    return {
        id: 'mem_safe_42',
        type: 'domain-invariants',
        score: 0.91,
        ...extras,
    };
}

/**
 * Python `repr(value)` surface used by the secret-absence assertion. The python
 * test does `assert secret not in repr(value)` for every summary value. The
 * summary values are: two ints and a list of id strings — so a deterministic
 * JSON serialization is a faithful, equivalent "serialized form" surface for
 * the substring check (no secret may hide in any of them).
 */
function serializeValue(value: unknown): string {
    return JSON.stringify(value ?? null);
}

/**
 * Stable, non-negative synthetic id derived from the secret string, mirroring
 * the python `abs(hash(secret)) % 9999` shape — the exact int is irrelevant
 * (it is a *safe* id), only that it is a stable mem_safe_<n> id.
 */
function safeIdFor(secret: string): string {
    let h = 0;
    for (let i = 0; i < secret.length; i += 1) {
        h = (h * 31 + secret.charCodeAt(i)) | 0;
    }
    return `mem_safe_${Math.abs(h) % 9999}`;
}

describe('memory_visibility redaction floor — summary key allowlist', () => {
    it('summary only exposes the allowlisted keys', () => {
        const summary = summarise_visibility([
            payload({
                entry: {
                    body: 'secret onboarding text',
                    summary: 'do not leak',
                    path: '/etc/secrets/credentials',
                },
                source: 'operational',
                path: 'agents/memory/intake/2026-05-04.jsonl',
                snippet: 'do not leak',
                raw: SYNTHETIC_SECRETS[0],
            }),
        ]);
        expect(new Set(Object.keys(summary))).toEqual(new Set(ALLOWED_SUMMARY_KEYS));
        expect(summary['ids']).toEqual(['mem_safe_42']);
    });
});

describe('memory_visibility redaction floor — secret value never surfaces', () => {
    for (const secret of SYNTHETIC_SECRETS) {
        it(`secret ${JSON.stringify(secret)} never appears in line or summary values`, () => {
            const memory = [
                payload({
                    id: safeIdFor(secret),
                    entry: { body: secret, summary: secret },
                    raw_text: secret,
                    path: secret,
                    source: secret,
                }),
            ];
            const summary = summarise_visibility(memory);
            const line = format_line(summary);
            expect(line).not.toBeNull();
            expect(line as string).not.toContain(secret);
            for (const value of Object.values(summary)) {
                expect(serializeValue(value)).not.toContain(secret);
            }
        });
    }
});

describe('memory_visibility redaction floor — contract grammar', () => {
    it('line matches the contract grammar whitelist', () => {
        const memory = [
            { id: 'mem_a', type: 'domain-invariants' },
            { id: 'mem_b', type: 'architecture-decisions' },
            { id: 'mem_c', type: 'incident-learnings' },
        ];
        const line = format_line(summarise_visibility(memory));
        expect(line).not.toBeNull();
        // ^🧠 Memory: \d+/\d+ · ids=[<id-list>]$  (ids: alnum, _, comma, space, …, +)
        const pattern = /^\u{1F9E0} Memory: \d+\/\d+ · ids=\[[a-zA-Z0-9_,\s…+]*\]$/u;
        expect(pattern.test(line as string)).toBe(true);
    });
});

describe('memory_visibility redaction floor — path separators outside allowlist', () => {
    it('line never leaks path fragments outside the allowlist', () => {
        const memory = [
            payload({
                id: 'mem_safe_path_1',
                path: '/var/log/billing/prod.log',
                entry: { file: '/etc/passwd' },
            }),
        ];
        const line = format_line(summarise_visibility(memory));
        expect(line).not.toBeNull();
        const l = line as string;
        expect(l).not.toContain('/var/');
        expect(l).not.toContain('/etc/');
        expect(l.toLowerCase()).not.toContain('log');
    });
});

describe('memory_visibility redaction floor — id typing', () => {
    it('drops payloads with missing / non-string-or-int ids; stringifies int ids', () => {
        const summary = summarise_visibility([
            { type: 'domain-invariants', body: 'no id here' }, // no id → dropped
            { id: ['not', 'a', 'string'], type: 'x' }, // list id → dropped
            { id: 42, type: 'x' }, // int id → "42"
        ]);
        expect(summary['ids']).toEqual(['42']);
    });
});
