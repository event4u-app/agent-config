/**
 * egress_token — the placeholder grammar and its one recogniser.
 *
 * Planted values are assembled at runtime; assertions compare by boolean so a
 * failure never prints a planted value.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { detect } from './egress_rules.js';
import { formatToken, parseTokens, replaceValues, TOKEN_FP_LENGTH, TOKEN_PATTERN, TokenScope } from './egress_token.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(HERE, '..', '..');

const ALNUM = 'Ab3Cd5Ef7Gh9Jk2Lm4Np6Qr8St1Uv3Wx5Yz7';
function mixed(n: number): string {
    let s = '';
    while (s.length < n) s += ALNUM;
    return s.slice(0, n);
}
const KEY = `sk-ant-${mixed(40)}`;

describe('grammar', () => {
    it('format and parse round-trip the parts', () => {
        const tok = formatToken({ type: 'IBAN', number: 3, fingerprint: 'a1b2c3' });
        const parsed = parseTokens(`x ${tok} y`);
        expect(parsed).toHaveLength(1);
        expect(parsed[0]).toMatchObject({
            type: 'IBAN',
            number: 3,
            fingerprint: 'a1b2c3',
        });
    });

    it('the recogniser carries the global flag and bounded quantifiers only', () => {
        expect(TOKEN_PATTERN.flags).toContain('g');
        expect(/(?<!\\)[+*]|\{\d+,\}/.test(TOKEN_PATTERN.source.replace(/\[[^\]]*\]/g, ''))).toBe(false);
    });

    it('rejects malformed shapes', () => {
        const good = formatToken({
            type: 'EMAIL',
            number: 1,
            fingerprint: 'abcdef',
        });
        expect(parseTokens(good.replace('abcdef', 'abcde'))).toHaveLength(0);
        expect(parseTokens(good.replace('abcdef', 'ABCDEF'))).toHaveLength(0);
        expect(parseTokens(good.replace('EMAIL', 'email'))).toHaveLength(0);
    });

    it('no detector rule matches a token, alone or after a keyword', () => {
        for (const type of ['APIKEY', 'SECRET', 'TOKEN', 'EMAIL', 'IBAN', 'DBURI']) {
            const tok = formatToken({ type, number: 12, fingerprint: 'f00d42' });
            expect(detect(tok)).toEqual([]);
            const line = `api_key = "${tok}"`;
            expect(replaceValues(line, new TokenScope())).toBe(line);
        }
    });
});

describe('TokenScope', () => {
    it('one canonical value gets one token; two values get two numbers', () => {
        const scope = new TokenScope();
        const a = scope.mint('EMAIL', 'identifier', 'one@corp.test');
        const b = scope.mint('EMAIL', 'identifier', 'two@corp.test');
        expect(scope.mint('EMAIL', 'identifier', 'one@corp.test')).toBe(a);
        expect(a).not.toBe(b);
        expect(parseTokens(a)[0]?.number).toBe(1);
        expect(parseTokens(b)[0]?.number).toBe(2);
        expect(parseTokens(a)[0]?.fingerprint).toHaveLength(TOKEN_FP_LENGTH);
    });

    it('resolves its own identifier tokens', () => {
        const scope = new TokenScope();
        const tok = scope.mint('EMAIL', 'identifier', 'one@corp.test');
        expect(scope.resolve(tok) === 'one@corp.test').toBe(true);
    });

    it('never resolves a credential token and never holds the credential value', () => {
        const scope = new TokenScope();
        const tok = scope.mint('APIKEY', 'credential', KEY);
        expect(scope.resolve(tok)).toBeNull();
        expect(JSON.stringify(scope.snapshot()).includes(KEY)).toBe(false);
    });

    it('a forged token with the right number and a wrong fingerprint does not resolve', () => {
        const scope = new TokenScope();
        const tok = scope.mint('EMAIL', 'identifier', 'one@corp.test');
        const p = parseTokens(tok)[0];
        const forged = formatToken({
            type: 'EMAIL',
            number: p?.number ?? 0,
            fingerprint: '000000' === p?.fingerprint ? '000001' : '000000',
        });
        expect(scope.resolve(forged)).toBeNull();
    });

    it('a token minted under another scope key does not resolve', () => {
        const other = new TokenScope();
        const scope = new TokenScope();
        scope.mint('EMAIL', 'identifier', 'one@corp.test');
        const foreign = other.mint('EMAIL', 'identifier', 'one@corp.test');
        expect(scope.resolve(foreign)).toBeNull();
    });

    it('fingerprints differ across scopes for the same value', () => {
        const a = new TokenScope().mint('EMAIL', 'identifier', 'one@corp.test');
        const b = new TokenScope().mint('EMAIL', 'identifier', 'one@corp.test');
        expect(a).not.toBe(b);
    });

    it('refuses a key shorter than 32 bytes', () => {
        expect(() => new TokenScope(new Uint8Array(8))).toThrow(/key/);
    });
});

describe('replaceValues', () => {
    it('replaces every detected value with a token of its type', () => {
        const scope = new TokenScope();
        const text = `deploy with ${KEY} today`;
        const out = replaceValues(text, scope);
        expect(out.includes(KEY)).toBe(false);
        expect(parseTokens(out).map((t) => t.type)).toEqual(['APIKEY']);
    });

    it('replacing twice yields the same bytes as replacing once', () => {
        const scope = new TokenScope();
        const text = `a ${KEY} b api_key = "${mixed(24)}" c`;
        const once = replaceValues(text, scope);
        expect(replaceValues(once, scope)).toBe(once);
    });

    it('two occurrences of one value share one token', () => {
        const scope = new TokenScope();
        const out = replaceValues(`${KEY} and ${KEY}`, scope);
        const toks = parseTokens(out);
        expect(toks).toHaveLength(2);
        expect(toks[0]?.fingerprint).toBe(toks[1]?.fingerprint);
    });
});

describe('one spelling under src/', () => {
    it('no file outside egress_token.ts writes a token-shaped literal', () => {
        const SHAPES = [/⟦[A-Z]{2,16}_\d{1,6}\.[0-9a-f]{6}⟧/, /__(?:AC_)?[A-Z]{2,16}_\d{1,6}_[0-9a-f]{6}__/];
        const offenders: string[] = [];
        const walk = (dir: string): void => {
            for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
                const p = path.join(dir, e.name);
                if (e.isDirectory()) {
                    if (e.name !== 'node_modules' && e.name !== 'fixtures') walk(p);
                } else if (/\.(?:ts|js|mjs)$/.test(e.name) && !/egress_token(?:\.test)?\.ts$/.test(e.name)) {
                    const body = fs.readFileSync(p, 'utf-8');
                    if (SHAPES.some((s) => s.test(body))) offenders.push(path.relative(SRC, p));
                }
            }
        };
        walk(SRC);
        expect(offenders).toEqual([]);
    });
});
