/**
 * End to end: every credential row of the rule table, planted in text, goes
 * through the full replacement path. Each fixture is split into the bytes
 * before the secret, the secret's full replacement span, and the bytes after
 * it, and the output must equal exactly `before + one token + after`: every
 * byte inside the span is gone and every byte outside it is untouched. Checking
 * that a substring is absent would pass a partial replacement of a long value.
 *
 * Fixtures are assembled at runtime, so no credential-shaped literal sits in
 * this file, and every assertion is a boolean so a failure never prints one.
 */
import { describe, expect, it } from 'vitest';

import { detect, EGRESS_RULES } from './egress_rules.js';
import { EgressRefusedError, formatToken, parseTokens, replaceValues, TokenScope } from './egress_token.js';

const ALNUM = 'Ab3Cd5Ef7Gh9Jk2Lm4Np6Qr8St1Uv3Wx5Yz7';
function run(n: number, salt = 0): string {
    const src = ALNUM.slice(salt % ALNUM.length) + ALNUM.slice(0, salt % ALNUM.length);
    let s = '';
    while (s.length < n) s += src;
    return s.slice(0, n);
}
const B64 = (n: number, salt: number): string => run(n, salt).replace(/[_-]/g, 'x');

const RSA = ['RSA', 'PRIVATE', 'KEY'].join(' ');
const EC = ['EC', 'PRIVATE', 'KEY'].join(' ');
const begin = (label: string): string => `-----BEGIN ${label}-----`;
const end = (label: string): string => `-----END ${label}-----`;
const pem = (lines: string[], sep = '\n'): string => [begin(RSA), ...lines, end(RSA)].join(sep);
const uri = (scheme: string, user: string, password: string): string => `${scheme}${'://'}${user}:${password}@`;
const jwt = (a: number, b: number, c: number): string => `eyJ${run(a, 1)}.${run(b, 2)}.${run(c, 3)}`;
const q = (s: string): string => s.replace(/[_-]/g, 'q');

interface Fixture {
    readonly rule: string;
    readonly before: string;
    /** The full replacement span: every byte here must go. */
    readonly secret: string;
    readonly after: string;
}

const PEM_BODY = [B64(64, 4), B64(64, 5), B64(40, 6)];
const PASSWORD = run(20, 7);

const FIXTURES: readonly Fixture[] = [
    { rule: 'anthropic-api-key', before: 'key ', secret: `sk-ant-${run(90, 8)}`, after: ' end' },
    { rule: 'anthropic-api-key', before: 'key ', secret: `sk-ant-${run(5000, 9)}`, after: '' },
    { rule: 'anthropic-project-key', before: 'key ', secret: `sk-proj-${run(60, 10)}`, after: '\n' },
    { rule: 'aws-access-key', before: 'id ', secret: 'AKIA' + 'ABCDEFGHIJ234567', after: ' x' },
    { rule: 'google-api-key', before: 'g ', secret: `AIza${run(35, 11)}`, after: ' x' },
    { rule: 'github-pat', before: 't ', secret: `ghp_${q(run(36, 12))}`, after: ' x' },
    { rule: 'github-fine-grained-pat', before: 't ', secret: `github_pat_${run(80, 13)}`, after: ' x' },
    { rule: 'jwt', before: 'Bearer ', secret: jwt(30, 40, 30), after: '' },
    { rule: 'jwt', before: 'glued x', secret: jwt(30, 40, 30), after: ' y' },
    { rule: 'jwt', before: 'long ', secret: jwt(9000, 20, 20), after: '' },
    { rule: 'stripe-secret-key', before: 's ', secret: `sk_live_${q(run(40, 14))}`, after: '' },
    { rule: 'slack-token', before: 's ', secret: `xoxb-${run(40, 15)}`, after: '' },
    { rule: 'pem-private-key', before: 'before\n', secret: pem(PEM_BODY), after: '\nafter' },
    { rule: 'pem-private-key', before: 'in a string: "', secret: pem(PEM_BODY, '\\n'), after: '"' },
    {
        rule: 'db-connection-uri',
        before: 'url ',
        secret: uri('postgres', 'svc', PASSWORD),
        after: 'db.internal:5432/app',
    },
    { rule: 'db-connection-uri', before: 'url ', secret: uri('a'.repeat(33), 'svc', PASSWORD), after: 'db/app' },
    { rule: 'db-connection-uri', before: 'url ', secret: uri(`${'a.'.repeat(20)}x`, 'svc', PASSWORD), after: 'db' },
    { rule: 'generic-assignment', before: 'password = "', secret: run(30, 16), after: '"' },
    { rule: 'generic-assignment', before: 'secret: ', secret: run(3000, 17), after: '' },
    { rule: 'generic-assignment', before: 'AuthToken=', secret: 'AuthToken=AuthToken=', after: '' },
];

/** True when `out` is exactly `before`, one well-formed token, then `after`. */
function exactlyReplaced(out: string, f: Fixture): boolean {
    if (!out.startsWith(f.before) || !out.endsWith(f.after)) return false;
    const middle = out.slice(f.before.length, out.length - f.after.length);
    const toks = parseTokens(middle);
    return toks.length === 1 && toks[0]?.start === 0 && toks[0]?.end === middle.length;
}

describe('end-to-end replacement removes exactly the replacement span', () => {
    it('every credential row has at least one fixture', () => {
        const covered = new Set(FIXTURES.map((f) => f.rule));
        const missing = EGRESS_RULES.filter((r) => r.class === 'credential' && !covered.has(r.rule)).map((r) => r.rule);
        expect(missing).toEqual([]);
    });

    FIXTURES.forEach((f, i) => {
        it(`${f.rule} #${i}`, () => {
            const text = f.before + f.secret + f.after;
            // The fixture's named rule is what detects it, at the secret's start.
            expect(detect(text).some((s) => s.rule === f.rule && s.start === f.before.length)).toBe(true);
            expect(exactlyReplaced(replaceValues(text, new TokenScope()), f)).toBe(true);
        });
    });

    it('the exact-boundary check rejects a partial replacement', () => {
        const f = FIXTURES[1] as Fixture;
        const tok = formatToken({ type: 'APIKEY', number: 1, fingerprint: 'abcdef' });
        const partial = `${f.before}${tok}${f.secret.slice(-10)}${f.after}`;
        expect(exactlyReplaced(partial, f)).toBe(false);
    });
});

describe('a rule without a provable replacement span fails closed', () => {
    const refuses = (text: string): boolean => {
        try {
            replaceValues(text, new TokenScope());
            return false;
        } catch (e) {
            return e instanceof EgressRefusedError;
        }
    };

    it('a private-key header with no end marker refuses the whole text', () => {
        expect(refuses(`${begin(RSA)}\n${PEM_BODY.join('\n')}\n(truncated)`)).toBe(true);
    });

    it('an end marker with a different label refuses, even when the right one follows', () => {
        expect(refuses([begin(RSA), PEM_BODY[0], end(EC), PEM_BODY[1], end(RSA)].join('\n'))).toBe(true);
    });

    it('a second header before any end marker refuses', () => {
        expect(refuses([begin(RSA), PEM_BODY[0], begin(RSA), PEM_BODY[1], end(RSA)].join('\n'))).toBe(true);
    });

    it('the refusal names the rule and carries no byte of the text', () => {
        try {
            replaceValues(`${begin(RSA)}\n${PEM_BODY.join('\n')}`, new TokenScope());
            expect.unreachable();
        } catch (e) {
            const msg = (e as Error).message;
            expect(msg.includes('pem-private-key')).toBe(true);
            expect(PEM_BODY.some((b) => msg.includes(b))).toBe(false);
        }
    });
});
