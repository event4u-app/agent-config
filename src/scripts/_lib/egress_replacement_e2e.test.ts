/**
 * End to end: every credential row of the rule table, planted in text, goes
 * through the full replacement path, and no planted sensitive byte sequence may
 * survive in the output. Detection parity says what the scanner reports; this
 * suite says what actually leaves.
 *
 * Fixtures are assembled at runtime, so no credential-shaped literal sits in
 * this file, and every assertion is a boolean so a failure never prints one.
 */
import { describe, expect, it } from 'vitest';

import { EGRESS_RULES } from './egress_rules.js';
import { EgressRefusedError, parseTokens, replaceValues, TokenScope } from './egress_token.js';

const ALNUM = 'Ab3Cd5Ef7Gh9Jk2Lm4Np6Qr8St1Uv3Wx5Yz7';
function run(n: number, salt = 0): string {
    const src = ALNUM.slice(salt % ALNUM.length) + ALNUM.slice(0, salt % ALNUM.length);
    let s = '';
    while (s.length < n) s += src;
    return s.slice(0, n);
}
const B64 = (n: number, salt: number): string => run(n, salt).replace(/[_-]/g, 'x');

const PEM_LABEL = ['RSA', 'PRIVATE', 'KEY'].join(' ');
function pem(lines: string[]): string {
    return [`-----BEGIN ${PEM_LABEL}-----`, ...lines, `-----END ${PEM_LABEL}-----`].join('\n');
}
const uri = (scheme: string, user: string, password: string): string =>
    `${scheme}${'://'}${user}:${password}@db.internal:5432/app`;
const jwt = (a: number, b: number, c: number): string => `eyJ${run(a, 1)}.${run(b, 2)}.${run(c, 3)}`;

interface Fixture {
    readonly rule: string;
    readonly text: string;
    /** Byte sequences of which no copy may remain after replacement. */
    readonly secrets: readonly string[];
}

const PEM_BODY = [B64(64, 4), B64(64, 5), B64(40, 6)];
const PASSWORD = run(20, 7);
const LONG_SCHEME = 'a'.repeat(33);

const FIXTURES: readonly Fixture[] = [
    { rule: 'anthropic-api-key', text: `key sk-ant-${run(90, 8)} end`, secrets: [`sk-ant-${run(90, 8)}`] },
    { rule: 'anthropic-api-key', text: `key sk-ant-${run(5000, 9)}`, secrets: [run(5000, 9).slice(-40)] },
    { rule: 'anthropic-project-key', text: `key sk-proj-${run(60, 10)}`, secrets: [run(60, 10)] },
    { rule: 'aws-access-key', text: 'id AKIA' + 'ABCDEFGHIJ234567 x', secrets: ['ABCDEFGHIJ234567'] },
    { rule: 'google-api-key', text: `g AIza${run(35, 11)} x`, secrets: [run(35, 11)] },
    {
        rule: 'github-pat',
        text: `t ghp_${run(36, 12).replace(/[_-]/g, 'q')} x`,
        secrets: [run(36, 12).replace(/[_-]/g, 'q')],
    },
    { rule: 'github-fine-grained-pat', text: `t github_pat_${run(80, 13)} x`, secrets: [run(80, 13)] },
    { rule: 'jwt', text: `Bearer ${jwt(30, 40, 30)}`, secrets: [jwt(30, 40, 30).slice(3)] },
    { rule: 'jwt', text: `glued x${jwt(30, 40, 30)} y`, secrets: [jwt(30, 40, 30).slice(3)] },
    { rule: 'jwt', text: `long ${jwt(9000, 20, 20)}`, secrets: [run(9000, 1).slice(-30)] },
    {
        rule: 'stripe-secret-key',
        text: `s sk_live_${run(40, 14).replace(/[_-]/g, 'q')}`,
        secrets: [run(40, 14).replace(/[_-]/g, 'q')],
    },
    { rule: 'slack-token', text: `s xoxb-${run(40, 15)}`, secrets: [run(40, 15)] },
    { rule: 'pem-private-key', text: `before\n${pem(PEM_BODY)}\nafter`, secrets: PEM_BODY },
    { rule: 'pem-private-key', text: `in a string: "${pem(PEM_BODY).split('\n').join('\\n')}"`, secrets: PEM_BODY },
    { rule: 'db-connection-uri', text: `url ${uri('postgres', 'svc', PASSWORD)}`, secrets: [PASSWORD] },
    { rule: 'db-connection-uri', text: `url ${uri(LONG_SCHEME, 'svc', PASSWORD)}`, secrets: [PASSWORD] },
    { rule: 'db-connection-uri', text: `url ${uri('a.'.repeat(20) + 'x', 'svc', PASSWORD)}`, secrets: [PASSWORD] },
    { rule: 'generic-assignment', text: `password = "${run(30, 16)}"`, secrets: [run(30, 16)] },
    { rule: 'generic-assignment', text: `secret: ${run(3000, 17)}`, secrets: [run(3000, 17).slice(-40)] },
    { rule: 'generic-assignment', text: `AuthToken=AuthToken=AuthToken=`, secrets: ['AuthToken=AuthToken='] },
];

describe('end-to-end replacement leaves no planted byte', () => {
    it('every credential row has at least one fixture', () => {
        const covered = new Set(FIXTURES.map((f) => f.rule));
        const missing = EGRESS_RULES.filter((r) => r.class === 'credential' && !covered.has(r.rule)).map((r) => r.rule);
        expect(missing).toEqual([]);
    });

    FIXTURES.forEach((f, i) => {
        it(`${f.rule} #${i}`, () => {
            const out = replaceValues(f.text, new TokenScope());
            expect(f.secrets.every((s) => !out.includes(s))).toBe(true);
            expect(parseTokens(out).length).toBeGreaterThan(0);
        });
    });
});

describe('a rule without a provable replacement span fails closed', () => {
    it('a private-key header with no matching end marker refuses the whole text', () => {
        const text = `-----BEGIN ${PEM_LABEL}-----\n${PEM_BODY.join('\n')}\n(truncated)`;
        expect(() => replaceValues(text, new TokenScope())).toThrow(EgressRefusedError);
    });

    it('the refusal names the rule and carries no byte of the text', () => {
        const text = `-----BEGIN ${PEM_LABEL}-----\n${PEM_BODY.join('\n')}`;
        try {
            replaceValues(text, new TokenScope());
            expect.unreachable();
        } catch (e) {
            const msg = (e as Error).message;
            expect(msg.includes('pem-private-key')).toBe(true);
            expect(PEM_BODY.some((b) => msg.includes(b))).toBe(false);
        }
    });
});
