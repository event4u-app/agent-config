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

import { detect, findSpans } from './egress_rules.js';
import {
    canonicalValue,
    formatToken,
    MAX_FAILED_RESOLUTIONS,
    MAX_TOKEN_VARIANT,
    parseTokens,
    replaceValues,
    TOKEN_FP_LENGTH,
    TOKEN_PATTERN,
    TokenScope,
} from './egress_token.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(HERE, '..', '..');

const ALNUM = 'Ab3Cd5Ef7Gh9Jk2Lm4Np6Qr8St1Uv3Wx5Yz7';
function mixed(n: number): string {
    let s = '';
    while (s.length < n) s += ALNUM;
    return s.slice(0, n);
}
const KEY = `sk-ant-${mixed(40)}`;

/** Every string reachable from an object through own properties and Map/Set/array entries. */
function reachableStrings(root: unknown): string[] {
    const out: string[] = [];
    const seen = new Set<unknown>();
    const visit = (v: unknown): void => {
        if (typeof v === 'string') {
            out.push(v);
            return;
        }
        if (v === null || typeof v !== 'object' || seen.has(v)) return;
        seen.add(v);
        if (v instanceof Map) {
            for (const [k, x] of v) {
                visit(k);
                visit(x);
            }
        } else if (v instanceof Set || Array.isArray(v)) {
            for (const x of v) visit(x);
        }
        for (const k of Reflect.ownKeys(v)) visit((v as Record<PropertyKey, unknown>)[k]);
    };
    visit(root);
    return out;
}

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

    it('formatToken and the recogniser agree at the grammar boundaries', () => {
        for (const type of ['AB', 'A1', 'ABCDEFGHIJKLMNOP']) {
            expect(parseTokens(formatToken({ type, number: 999_999, fingerprint: 'abcdef' }))).toHaveLength(1);
        }
        expect(() => formatToken({ type: 'ABCDEFGHIJKLMNOPQ', number: 1, fingerprint: 'abcdef' })).toThrow(/grammar/);
        expect(() => formatToken({ type: '1A', number: 1, fingerprint: 'abcdef' })).toThrow(/grammar/);
    });

    it('formatToken refuses parts the recogniser would not parse', () => {
        expect(() => formatToken({ type: 'A', number: 1, fingerprint: 'abcdef' })).toThrow(/grammar/);
        expect(() => formatToken({ type: 'EMAIL', number: 0, fingerprint: 'abcdef' })).toThrow(/grammar/);
        expect(() => formatToken({ type: 'EMAIL', number: 1_000_000, fingerprint: 'abcdef' })).toThrow(/grammar/);
        expect(() => formatToken({ type: 'EMAIL', number: 1, fingerprint: 'xyz' })).toThrow(/grammar/);
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

    it('no detector rule matches a standalone token', () => {
        for (const type of ['APIKEY', 'SECRET', 'TOKEN', 'EMAIL', 'IBAN', 'DBURI']) {
            expect(detect(formatToken({ type, number: 12, fingerprint: 'f00d42' }))).toEqual([]);
        }
    });

    it('generic-assignment can match a token after a keyword (fingerprint-dependent entropy)', () => {
        const tok = formatToken({ type: 'SECRET', number: 1, fingerprint: 'a9c3e7' });
        const line = `api_key = "${tok}"`;
        const spans = findSpans(line).filter((s) => s.rule === 'generic-assignment');
        expect(spans).toHaveLength(1);
        expect(line.slice(spans[0]?.start, spans[0]?.end) === tok).toBe(true);
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

    it('never resolves a credential token', () => {
        const scope = new TokenScope();
        expect(scope.resolve(scope.mint('APIKEY', 'credential', KEY))).toBeNull();
    });

    it('holds no credential value anywhere in its state, which the walk can see', () => {
        const scope = new TokenScope();
        scope.mint('EMAIL', 'identifier', 'seen@corp.test');
        scope.mint('APIKEY', 'credential', KEY);
        const strings = reachableStrings(scope);
        // The walk reaches the private maps: the identifier value is there.
        expect(strings.some((v) => v === 'seen@corp.test')).toBe(true);
        expect(strings.some((v) => v.includes(KEY))).toBe(false);
    });

    it('refuses one value under a second class even when the type differs', () => {
        const a = new TokenScope();
        a.mint('APIKEY', 'credential', KEY);
        expect(() => a.mint('EMAIL', 'identifier', KEY)).toThrow(/class/);
        expect(a.resolve(a.mint('APIKEY', 'credential', KEY))).toBeNull();
        expect(reachableStrings(a).some((v) => v.includes(KEY))).toBe(false);
        const b = new TokenScope();
        b.mint('EMAIL', 'identifier', KEY);
        expect(() => b.mint('APIKEY', 'credential', KEY)).toThrow(/class/);
    });

    it('refuses to mint one (type, value) under a second class', () => {
        const a = new TokenScope();
        a.mint('APIKEY', 'identifier', KEY);
        expect(() => a.mint('APIKEY', 'credential', KEY)).toThrow(/class/);
        const b = new TokenScope();
        b.mint('APIKEY', 'credential', KEY);
        expect(() => b.mint('APIKEY', 'identifier', KEY)).toThrow(/class/);
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

    it('stops resolving once the failed-resolution budget is spent', () => {
        const scope = new TokenScope();
        const tok = scope.mint('EMAIL', 'identifier', 'one@corp.test');
        for (let i = 0; i < MAX_FAILED_RESOLUTIONS - 1; i++) {
            expect(scope.resolve(formatToken({ type: 'EMAIL', number: 1, fingerprint: 'ffffff' }))).toBeNull();
        }
        expect(scope.resolve(tok) === 'one@corp.test').toBe(true);
        expect(scope.resolve(formatToken({ type: 'EMAIL', number: 1, fingerprint: 'fffffe' }))).toBeNull();
        // Budget spent: even a genuine token no longer resolves.
        expect(scope.resolve(tok)).toBeNull();
    });

    it('a credential token is not a failed guess and spends no budget', () => {
        const scope = new TokenScope();
        const cred = scope.mint('APIKEY', 'credential', KEY);
        const tok = scope.mint('EMAIL', 'identifier', 'one@corp.test');
        for (let i = 0; i < MAX_FAILED_RESOLUTIONS * 2; i++) scope.resolve(cred);
        expect(scope.resolve(tok) === 'one@corp.test').toBe(true);
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

    it('accepts no caller key: every scope draws its own', () => {
        const Ctor = TokenScope as unknown as new (key?: Uint8Array) => TokenScope;
        const shared = new Uint8Array(32).fill(7);
        const a = new Ctor(shared);
        const b = new Ctor(shared);
        expect(a.mint('EMAIL', 'identifier', 'one@corp.test')).not.toBe(b.mint('EMAIL', 'identifier', 'one@corp.test'));
    });

    it('refuses a type the recogniser would not parse', () => {
        const scope = new TokenScope();
        for (const bad of ['x', 'X', 'email', 'A_B', 'TOOLONGTYPENAME17']) {
            expect(() => scope.mint(bad, 'identifier', 'v@corp.test')).toThrow(/type/);
        }
    });

    it('refuses a number past the six digits the recogniser parses', () => {
        const scope = new TokenScope();
        (scope as unknown as { counters: Map<string, number> }).counters.set('EMAIL', 999_999);
        expect(() => scope.mint('EMAIL', 'identifier', 'late@corp.test')).toThrow(/number/);
    });
});

describe('replaceValues', () => {
    it('numbers values of one type in the order they appear in the text', () => {
        const first = `sk-ant-${mixed(40)}`;
        const second = `sk-ant-${mixed(41)}`;
        const toks = parseTokens(replaceValues(`a ${first} b ${second} c`, new TokenScope()));
        expect(toks.map((t) => t.number)).toEqual([1, 2]);
    });

    it('replaces the captured value, not an earlier copy of it in the keyword', () => {
        // The captured value repeats the keyword, so it also occurs at offset 0 of the match.
        const text = 'AuthToken=AuthToken=AuthToken=';
        const out = replaceValues(text, new TokenScope());
        const toks = parseTokens(out);
        expect(toks).toHaveLength(1);
        expect(out.slice(0, toks[0]?.start)).toBe('AuthToken=');
        expect(out.slice(toks[0]?.end)).toBe('');
    });

    it('leaves a token this scope minted alone after a keyword', () => {
        const scope = new TokenScope();
        const once = replaceValues(`api_key = "${mixed(24)}"`, scope);
        expect(parseTokens(once)).toHaveLength(1);
        expect(replaceValues(once, scope)).toBe(once);
    });

    it('treats a token this scope did not mint as data and replaces it', () => {
        const line = `api_key = "${formatToken({ type: 'SECRET', number: 1, fingerprint: 'a9c3e7' })}"`;
        expect(replaceValues(line, new TokenScope())).not.toBe(line);
    });

    // A token-shaped substring is attacker-controllable: planted inside a real
    // credential it must not shield the credential from replacement.
    const FORGED = formatToken({ type: 'APIKEY', number: 1, fingerprint: '000000' });
    const EMBEDDED: Record<string, string> = {
        'anthropic-api-key': `sk-ant-${mixed(20)}${FORGED}${mixed(20)}`,
        'anthropic-project-key': `sk-proj-${mixed(20)}${FORGED}${mixed(20)}`,
        'github-fine-grained-pat': `github_pat_${mixed(22)}${FORGED}${mixed(10)}`,
        jwt: `eyJ${mixed(12)}${FORGED}.${mixed(12)}.${mixed(12)}`,
        'generic-assignment': `${mixed(12)}${FORGED}${mixed(12)}`,
        'db-connection-uri': `postgres://user:${mixed(8)}${FORGED}@db`,
    };
    for (const [rule, secret] of Object.entries(EMBEDDED)) {
        it(`a forged token inside a ${rule} value does not stop its replacement`, () => {
            const text = rule === 'generic-assignment' ? `password = ${secret}` : `x ${secret} y`;
            expect(findSpans(text).some((s) => s.rule === rule)).toBe(true);
            const out = replaceValues(text, new TokenScope());
            expect(out.includes(secret)).toBe(false);
            expect(out.includes(FORGED)).toBe(false);
        });
    }

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

describe('variants — two spellings of one entity', () => {
    // An IBAN-shaped value assembled at runtime; the token module is fed directly,
    // because no identifier rule exists in the table to detect it.
    const compact = ['DE', '89', '3704', '0044', '0532', '0130', '00'].join('');
    const spaced = compact.replace(/(.{4})/g, '$1 ').trim();

    it('a spaced and a compact IBAN share number and fingerprint, differ in suffix, and each restores to its bytes', () => {
        const scope = new TokenScope();
        const a = scope.mint('IBAN', 'identifier', compact);
        const b = scope.mint('IBAN', 'identifier', spaced);
        const [pa, pb] = [parseTokens(a)[0], parseTokens(b)[0]];
        expect(pa?.number === pb?.number && pa?.fingerprint === pb?.fingerprint).toBe(true);
        expect(a === b).toBe(false);
        expect([pa?.variant, pb?.variant]).toEqual([1, 2]);
        expect(scope.resolve(a) === compact).toBe(true);
        expect(scope.resolve(b) === spaced).toBe(true);
        expect(scope.mint('IBAN', 'identifier', spaced) === b).toBe(true);
    });

    it('replaceValues numbers the entity once whichever spelling comes first, and replacing twice is idempotent', () => {
        const scope = new TokenScope();
        const one = scope.mint('IBAN', 'identifier', spaced);
        const two = scope.mint('IBAN', 'identifier', compact.toLowerCase());
        expect(parseTokens(two)[0]?.number).toBe(parseTokens(one)[0]?.number);
        const text = `pay ${one} or ${two}`;
        expect(replaceValues(text, scope) === text).toBe(true);
    });

    it('a variant token from another scope does not resolve', () => {
        const mine = new TokenScope();
        const theirs = new TokenScope();
        theirs.mint('IBAN', 'identifier', compact);
        const foreign = theirs.mint('IBAN', 'identifier', spaced);
        mine.mint('IBAN', 'identifier', compact);
        mine.mint('IBAN', 'identifier', spaced);
        expect(mine.resolve(foreign)).toBeNull();
    });

    it('a credential variant shares the entity and restores to nothing', () => {
        const scope = new TokenScope();
        scope.mint('IBAN', 'credential', compact);
        const v = scope.mint('IBAN', 'credential', spaced);
        expect(parseTokens(v)[0]?.variant).toBe(2);
        expect(scope.resolve(v)).toBeNull();
    });

    it('a type with no canonical form keeps two spellings as two entities', () => {
        expect(canonicalValue('EMAIL', 'A@x.test') === 'A@x.test').toBe(true);
        const scope = new TokenScope();
        const a = scope.mint('EMAIL', 'identifier', 'A@x.test');
        const b = scope.mint('EMAIL', 'identifier', 'a@x.test');
        expect(parseTokens(a)[0]?.number === parseTokens(b)[0]?.number).toBe(false);
    });

    it('the grammar refuses a variant past what the recogniser parses, and no rule matches a variant token', () => {
        expect(() => formatToken({ type: 'IBAN', number: 1, fingerprint: 'abcdef', variant: MAX_TOKEN_VARIANT + 1 })).toThrow(/grammar/);
        expect(() => formatToken({ type: 'IBAN', number: 1, fingerprint: 'abcdef', variant: 0 })).toThrow(/grammar/);
        const top = formatToken({ type: 'IBAN', number: 1, fingerprint: 'abcdef', variant: MAX_TOKEN_VARIANT });
        expect(parseTokens(top)[0]?.variant).toBe(MAX_TOKEN_VARIANT);
        expect(formatToken({ type: 'IBAN', number: 1, fingerprint: 'abcdef', variant: 1 })).toBe('__IBAN_1_abcdef__');
        expect(detect(top)).toEqual([]);
    });

    it('the snapshot carries a variant count and no spelling', () => {
        const scope = new TokenScope();
        scope.mint('IBAN', 'identifier', compact);
        scope.mint('IBAN', 'identifier', spaced);
        const snap = scope.snapshot();
        expect(snap[0]?.variants).toBe(2);
        expect(JSON.stringify(snap).includes(compact)).toBe(false);
    });
});

describe('one spelling under src/', () => {
    it('no file outside egress_token.ts writes a token-shaped literal', () => {
        const SHAPES = [/⟦[A-Z]{2,16}_\d{1,6}\.[0-9a-f]{6}⟧/, /__(?:AC_)?[A-Z]{2,16}_\d{1,6}_[0-9a-f]{6}(?:_v\d{1,2})?__/];
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
