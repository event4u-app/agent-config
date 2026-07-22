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
