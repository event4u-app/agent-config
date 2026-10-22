/**
 * secret_detector — coverage (secret-hygiene-guardrail Phase 0).
 *
 * Positive fixtures: each labelled line carries one fake secret; expectations
 * come from an in-test label→kind map, NOT from detector output.
 * Negative fixtures: every line must be free of high/medium findings (low is
 * only for placeholder-shaped lines; the `secret-allow` line yields nothing).
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { detect, type EgressRule } from './egress_rules.js';
import { scanText, type SecretFinding } from './secret_detector.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES = path.join(HERE, 'fixtures', 'secret-detector');

function readFixture(name: string): string {
    return fs.readFileSync(path.join(FIXTURES, name), 'utf-8');
}

// Label → expected kind. Keyed by the leading `<label>|` token, so a reordered
// fixture cannot silently pass.
const EXPECTED_KIND: Readonly<Record<string, string>> = {
    aws: 'aws-access-key',
    github: 'github-pat',
    stripe: 'stripe-secret-key',
    google: 'google-api-key',
    slack: 'slack-token',
    pem: 'pem-private-key',
    jwt: 'jwt',
    dburl: 'db-connection-uri',
    assignment: 'generic-assignment',
    // adversarial-corpus additions (road-to-feedback-9.8.0-followups Phase 3)
    'github-fine-grained': 'github-pat',
    'env-db-password': 'generic-assignment',
    'env-api-key': 'generic-assignment',
    'dburl-mysql': 'db-connection-uri',
};

function isReal(f: SecretFinding): boolean {
    return f.confidence === 'high' || f.confidence === 'medium';
}

describe('scanText — positives', () => {
    const text = readFixture('positives.txt');
    const lines = text.split(/\r\n|\r|\n/);
    const findings = scanText(text);

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i] as string;
        if (!line.includes('|') || line.startsWith('#')) {
            continue;
        }
        const label = line.slice(0, line.indexOf('|'));
        const expectedKind = EXPECTED_KIND[label];
        const lineNo = i + 1;

        it(`flags ${label} as ${expectedKind}`, () => {
            expect(expectedKind, `no expected kind mapped for label "${label}"`).toBeDefined();
            const onLine = findings.filter((f) => f.line === lineNo && isReal(f));
            const kinds = onLine.map((f) => f.kind);
            expect(
                kinds,
                `line ${lineNo} (${label}) expected kind ${expectedKind}, got ${JSON.stringify(onLine)}`,
            ).toContain(expectedKind);
        });
    }
});

describe('scanText — negatives', () => {
    const text = readFixture('negatives.txt');
    const lines = text.split(/\r\n|\r|\n/);
    const findings = scanText(text);

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i] as string;
        if (line.trim() === '' || line.startsWith('#')) {
            continue;
        }
        const lineNo = i + 1;
        it(`no high/medium finding on line ${lineNo}`, () => {
            const real = findings.filter((f) => f.line === lineNo && isReal(f));
            expect(real, `unexpected real findings: ${JSON.stringify(real)}`).toHaveLength(0);
        });
    }

    it('the secret-allow line yields zero findings of any confidence', () => {
        const allowLineNo = lines.findIndex((l) => l.includes('secret-allow')) + 1;
        expect(allowLineNo, 'no secret-allow line in fixture').toBeGreaterThan(0);
        const onLine = findings.filter((f) => f.line === allowLineNo);
        expect(onLine).toHaveLength(0);
    });
});

describe('scanText — masking', () => {
    it('never reproduces the raw secret in `masked`', () => {
        const raw = 'AKIA1234567890ABCDEF';
        const findings = scanText(`aws_key = "${raw}"`);
        const hit = findings.find((f) => f.kind === 'aws-access-key');
        expect(hit, 'expected an aws-access-key finding').toBeDefined();
        const masked = (hit as SecretFinding).masked;
        expect(masked).not.toBe(raw);
        expect(masked.includes(raw)).toBe(false);
    });
});

describe('column of a captured value', () => {
    it('points at the capture, not an earlier copy of it inside the keyword', () => {
        // The captured value repeats the keyword, so it also occurs at offset 0 of the match.
        const findings = scanText('AuthToken=AuthToken=AuthToken=');
        expect(findings.map((f) => [f.rule, f.column])).toEqual([['generic-assignment', 11]]);
    });
});

describe('the scanner applies every field of a table row', () => {
    // A credential row that uses the fields no shipped credential row uses yet.
    const row: EgressRule = {
        rule: 'test-pin',
        type: 'SECRET',
        class: 'credential',
        pattern: /\b\d{6}\b/g,
        context: { words: /\bpin\b/i, window: 12 },
        exclusions: [/^000000$/],
        replacement: 'detection',
    };

    it('reports a value with its context word nearby', () => {
        expect(scanText('pin 482915', { rules: [row] }).map((f) => f.rule)).toEqual(['test-pin']);
    });

    it('drops a value without its context word', () => {
        expect(scanText('order 482915', { rules: [row] })).toEqual([]);
    });

    it('drops an excluded value', () => {
        expect(scanText('pin 000000', { rules: [row] })).toEqual([]);
    });

    it('refuses a value-group row without the d flag instead of guessing the column', () => {
        const { context: _context, ...rest } = row;
        const noD: EgressRule = { ...rest, pattern: /pin (\d{6})/g, valueGroup: 1 };
        expect(() => scanText('pin 482915', { rules: [noD] })).toThrow(/d flag/);
    });
});

describe('the scanner and the replacer on multi-line text', () => {
    const ALNUM = 'Ab3Cd5Ef7Gh9Jk2Lm4Np6Qr8St1Uv3Wx5Yz7';
    const run = (n: number): string => ALNUM.repeat(Math.ceil(n / ALNUM.length)).slice(0, n);
    const text = [
        `token: sk-ant-${run(40)}`,
        `password =`,
        `${run(24)}`,
        `url = postgres://u:${run(12)}@db`,
        `api_key = "${run(24)}"`,
    ].join('\n');

    it('every scanner finding is also a replacer span: the scanner never sees more', () => {
        const lineStarts = [0];
        for (let i = 0; i < text.length; i++) if (text[i] === '\n') lineStarts.push(i + 1);
        const spans = detect(text);
        for (const f of scanText(text)) {
            if (f.confidence !== 'high' || f.rule === 'entropy') continue;
            const at = (lineStarts[f.line - 1] as number) + f.column - 1;
            expect(spans.some((s) => s.start === at)).toBe(true);
        }
    });

    it('the replacer sees a value the line-scoped scanner cannot: an assignment split across lines', () => {
        const split = `password =\n${run(24)}`;
        expect(detect(split).some((s) => s.rule === 'generic-assignment')).toBe(true);
        expect(scanText(split).some((f) => f.rule === 'generic-assignment')).toBe(false);
    });
});

describe('scanText — caller-supplied rules', () => {
    it('a row without the global flag still terminates and finds each match once', () => {
        const probe = { rule: 'probe-non-global', type: 'SECRET', class: 'credential', replacement: 'detection', pattern: /zz9q[A-Za-z0-9]{12}/ } as unknown as EgressRule;
        const line = 'a zz9qAbCdEfGh1234 b zz9qXyZwVuTs5678';
        expect(scanText(line, { rules: [probe] }).filter((f) => f.rule === 'probe-non-global')).toHaveLength(2);
    });
});
