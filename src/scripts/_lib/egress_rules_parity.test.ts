/**
 * Old-versus-new parity for the credential rows that moved out of
 * secret_detector.ts into the rule table.
 *
 * OLD_PATTERNS is the rule pack exactly as secret_detector.ts carried it before
 * the move, frozen here as the reference. Every case is run through both; a
 * detection the old pack made and the new one does not is allowed only when the
 * rule and case are listed in DETECTION_CEILINGS, which the contract publishes.
 * A listed ceiling that no longer loses anything fails too, so the list cannot
 * go stale. Values are built at runtime and compared by offsets, never printed.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { DETECTION_CEILINGS, EGRESS_RULES, findSpans } from './egress_rules.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CONTRACT = path.resolve(HERE, '..', '..', '..', 'docs', 'contracts', 'egress-placeholders-v1.md');

const OLD_PATTERNS: Readonly<Record<string, { regex: RegExp; valueGroup?: number }>> = {
    'anthropic-api-key': { regex: /sk-ant-[A-Za-z0-9_-]{20,}/g },
    'anthropic-project-key': { regex: /sk-proj-[A-Za-z0-9_-]{20,}/g },
    'aws-access-key': { regex: /AKIA[0-9A-Z]{16}/g },
    'google-api-key': { regex: /AIza[0-9A-Za-z_-]{35}/g },
    'github-pat': { regex: /ghp_[0-9A-Za-z]{36}/g },
    'github-fine-grained-pat': { regex: /github_pat_[0-9A-Za-z_]{22,}/g },
    jwt: { regex: /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g },
    'stripe-secret-key': { regex: /sk_(?:live|test)_[0-9A-Za-z]{16,}/g },
    'slack-token': { regex: /xox[baprs]-[0-9A-Za-z-]{10,}/g },
    'pem-private-key': { regex: /-----BEGIN [A-Z ]*PRIVATE KEY-----/g },
    'db-connection-uri': { regex: /\b[a-z][a-z0-9+.-]*:\/\/[^\s:/@]+:[^\s:/@]+@/g },
    'generic-assignment': {
        regex: /(?:password|passwd|pwd|secret|api[_-]?key|access[_-]?token|auth[_-]?token)\s*[:=]\s*['"]?([^'"\s]{8,})['"]?/gi,
        valueGroup: 1,
    },
};

const ALNUM = 'Ab3Cd5Ef7Gh9Jk2Lm4Np6Qr8St1Uv3Wx5Yz7';
function run(n: number): string {
    let s = '';
    while (s.length < n) s += ALNUM;
    return s.slice(0, n);
}
const seg = (n: number): string => run(n);
const jwt = (n: number): string => `eyJ${seg(n)}.${seg(20)}.${seg(20)}`;

/** Case id → text. Each targets a boundary the move could have changed. */
const CASES: Readonly<Record<string, string>> = {
    'anthropic-1024': `x sk-ant-${run(1024)} y`,
    'anthropic-1025': `x sk-ant-${run(1025)} y`,
    'anthropic-5000': `x sk-ant-${run(5000)} y`,
    'project-5000': `x sk-proj-${run(5000)} y`,
    'aws-std': `x AKIA${'ABCDEFGHIJ234567'} y`,
    'google-std': `x AIza${run(35)} y`,
    'ghp-std': `x ghp_${run(36)} y`,
    'fine-grained-5000': `x github_pat_${run(5000)} y`,
    'jwt-std': `x ${jwt(40)} y`,
    'jwt-8192': `x ${jwt(8192)} y`,
    'jwt-8193': `x ${jwt(8193)} y`,
    'jwt-glued': `x Bearer:${jwt(40)} y`,
    'jwt-glued-word': `x abc${jwt(40)} y`,
    'stripe-5000': `x sk_live_${run(5000)} y`,
    'slack-5000': `x xoxb-${run(5000)} y`,
    'pem-std': '-----BEGIN RSA PRIVATE KEY-----',
    'pem-long-label': `-----BEGIN ${'A '.repeat(40)}PRIVATE KEY-----`,
    'uri-std': 'x postgres://user:pa55word@db.example:5432/app y',
    'uri-userinfo-256': `x postgres://${run(256)}:${run(256)}@db y`,
    'uri-userinfo-257': `x postgres://${run(257)}:${run(257)}@db y`,
    'uri-userinfo-5000': `x postgres://u:${run(5000)}@db y`,
    'uri-scheme-32': `x ${'a'.repeat(32)}://user:pass@db y`,
    'uri-scheme-33': `x ${'a'.repeat(33)}://user:pass@db y`,
    'uri-scheme-dotted-40': `x ${'a.'.repeat(20)}x://user:pass@db y`,
    'generic-std': `api_key = "${run(24)}"`,
    'generic-ws-16': `password${' '.repeat(16)}=${' '.repeat(16)}${run(24)}`,
    'generic-ws-17': `password${' '.repeat(17)}=${' '.repeat(17)}${run(24)}`,
    'generic-ws-200': `password${' '.repeat(200)}:${' '.repeat(200)}${run(24)}`,
    'generic-value-1025': `secret: ${run(1025)}`,
    'generic-value-5000': `secret: ${run(5000)}`,
};

type Span = readonly [number, number];

function matches(regex: RegExp, valueGroup: number | undefined, text: string): Span[] {
    const re = new RegExp(regex.source, regex.flags.includes('d') ? regex.flags : `${regex.flags}d`);
    const out: Span[] = [];
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
        if (m[0].length === 0) {
            re.lastIndex += 1;
            continue;
        }
        const v = valueGroup !== undefined ? m[valueGroup] : m[0];
        if (v === undefined) continue;
        const start = valueGroup !== undefined ? (m.indices?.[valueGroup]?.[0] ?? m.index) : m.index;
        out.push([start, start + v.length]);
    }
    return out;
}

const key = (s: Span): string => `${s[0]}-${s[1]}`;

// The pre-move generic-assignment value gate, frozen alongside the patterns.
function oldShannon(value: string): number {
    const freq = new Map<string, number>();
    for (const ch of value) freq.set(ch, (freq.get(ch) ?? 0) + 1);
    let e = 0;
    for (const c of freq.values()) e -= (c / value.length) * Math.log2(c / value.length);
    return e;
}
function oldLooksLikeSecretValue(value: string): boolean {
    if (value.length < 16 || /[()$`{}<>[\];,]|->|=>|\.\w/.test(value)) return false;
    if (!/[0-9]/.test(value) && !(/[a-z]/.test(value) && /[A-Z]/.test(value))) return false;
    return oldShannon(value) >= 3.3;
}
// What each documented ceiling is allowed to lose, stated exactly per case.
const CEILING_EXPECT: Readonly<Record<string, (before: string[], after: string[]) => boolean>> = {
    'jwt|jwt-glued-word': (before, after) => before.length === 1 && after.length === 0,
    'db-connection-uri|uri-scheme-33': (before, after) => before.length === 1 && after.length === 0,
    // Matched from a later boundary: same end (the userinfo and its @ are covered), later start.
    'db-connection-uri|uri-scheme-dotted-40': (before, after) => {
        if (before.length !== 1 || after.length !== 1) return false;
        const [b0, b1] = (before[0] as string).split('-').map(Number);
        const [a0, a1] = (after[0] as string).split('-').map(Number);
        return a1 === b1 && (a0 as number) > (b0 as number);
    },
};

const OLD_VALIDATORS: Readonly<Record<string, (v: string) => boolean>> = {
    'generic-assignment': oldLooksLikeSecretValue,
};

describe('old-versus-new parity of the credential rows', () => {
    it('the frozen reference covers exactly the credential rows of the table', () => {
        const credential = EGRESS_RULES.filter((r) => r.class === 'credential').map((r) => r.rule);
        expect(credential.sort()).toEqual(Object.keys(OLD_PATTERNS).sort());
    });

    const ceilings = new Set(DETECTION_CEILINGS.flatMap((c) => c.cases.map((id) => `${c.rule}|${id}`)));

    for (const rule of EGRESS_RULES.filter((r) => r.class === 'credential')) {
        const old = OLD_PATTERNS[rule.rule];
        if (old === undefined) continue;
        for (const [id, text] of Object.entries(CASES)) {
            it(`${rule.rule} on ${id}`, () => {
                const before = matches(old.regex, old.valueGroup, text).map(key);
                const after = matches(rule.pattern, rule.valueGroup, text).map(key);
                if (ceilings.has(`${rule.rule}|${id}`)) {
                    // A documented ceiling must actually lose this case, or it is stale.
                    expect(before.length > 0 && before.some((s) => !after.includes(s))).toBe(true);
                } else {
                    expect(after).toEqual(before);
                }
            });

            it(`${rule.rule} on ${id} through the policy path`, () => {
                const gate = OLD_VALIDATORS[rule.rule];
                const before = matches(old.regex, old.valueGroup, text)
                    .filter((s) => gate === undefined || gate(text.slice(s[0], s[1])))
                    .map(key);
                const after = findSpans(text, [rule]).map((s) => key([s.start, s.end]));
                const expected = CEILING_EXPECT[`${rule.rule}|${id}`];
                if (ceilings.has(`${rule.rule}|${id}`)) {
                    expect(expected).toBeDefined();
                    expect(expected?.(before, after)).toBe(true);
                } else {
                    expect(after).toEqual(before);
                }
            });
        }
    }
});

describe('documented ceilings', () => {
    it('every ceiling names a credential rule, at least one case and a reason', () => {
        const rules = new Set(EGRESS_RULES.map((r) => r.rule));
        for (const c of DETECTION_CEILINGS) {
            expect(rules.has(c.rule)).toBe(true);
            expect(c.cases.length).toBeGreaterThan(0);
            expect(c.cases.every((id) => id in CASES)).toBe(true);
            expect(c.ceiling.length).toBeGreaterThan(20);
        }
    });

    it('the contract publishes every ceiling by rule id', () => {
        const contract = fs.readFileSync(CONTRACT, 'utf-8');
        const section = contract.split('## Detection ceilings')[1] ?? '';
        for (const c of DETECTION_CEILINGS) {
            expect(section.includes(`\`${c.rule}\``)).toBe(true);
        }
    });
});
