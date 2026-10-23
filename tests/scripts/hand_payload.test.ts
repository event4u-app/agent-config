import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { askHand } from '../../src/scripts/ask_transport.js';
import { CouncilResponse, type ExternalAIClient } from '../../src/scripts/ai_council/clients.js';
import { resetCouncilEgress } from '../../src/scripts/ai_council/council_egress.js';
import {
    buildHandPayload,
    HandPayloadError,
    projectLinkingIdentifiers,
    signatureOf,
} from '../../src/scripts/ai_council/hand_payload.js';
import { handSystemPrompt } from '../../src/scripts/ai_council/hand_schemas.js';

let tmp: string;
beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hand-payload-'));
});
afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
});

const TOTAL_IMPL = 'export function total(rows: Row[]): number {\n    return rows.reduce((sum, r) => sum + r.amount, 0);\n}';
const PLACEHOLDER = /__[A-Z][A-Z0-9]{1,15}_[1-9][0-9]*_[0-9a-f]{6}(?:_v[0-9]+)?__/;

describe('signatureOf — the signature a hand may call, never the body', () => {
    it('cuts a block body, keeps a return-type literal, and handles an arrow and a Python def', () => {
        expect(signatureOf(TOTAL_IMPL)).toBe('export function total(rows: Row[]): number;');
        expect(signatureOf('function pick(): { a: number } {\n  return { a: 1 };\n}')).toBe('function pick(): { a: number };');
        expect(signatureOf('const twice = (n: number): number => n * 2;')).toBe('const twice = (n: number): number;');
        expect(signatureOf('const f = async (s: string) => {\n  await go(s);\n};')).toBe('const f = async (s: string);');
        expect(signatureOf('def load(path: str) -> dict:\n    return json.load(open(path))')).toBe('def load(path: str) -> dict:');
        expect(signatureOf('function ready(x: number): boolean;')).toBe('function ready(x: number): boolean;');
    });

    it('ignores braces inside strings and comments', () => {
        expect(signatureOf('function s(): string {\n  // }\n  return "}{";\n}')).toBe('function s(): string;');
    });
});

describe('signatureOf — whole-file callees (D5)', () => {
    const LEAKS = /\breturn\b|array_sum|reduce|json\.load/;

    it('refuses two top-level functions instead of leaking the first body', () => {
        const two = 'function a(x: number): number {\n    return x + 1;\n}\n\nfunction b(x: number): number {\n    return x * 2;\n}\n';
        expect(() => signatureOf(two)).toThrow(HandPayloadError);
    });

    it('refuses a declaration followed by an `export default` statement', () => {
        expect(() => signatureOf(`${TOTAL_IMPL}\n\nexport default total;\n`)).toThrow(HandPayloadError);
    });

    it('keeps an `export default function` to its signature', () => {
        const sig = signatureOf('export default function total(rows: Row[]): number {\n    return rows.reduce((s, r) => s + r.amount, 0);\n}\n');
        expect(sig).toBe('export default function total(rows: Row[]): number;');
    });

    it('drops a trailing comment instead of leaking the body before it', () => {
        const sig = signatureOf(`${TOTAL_IMPL}\n// keep in sync with average()\n`);
        expect(sig).toBe('export function total(rows: Row[]): number;');
    });

    it('drops Python imports and sends the def header only', () => {
        const py = 'import json\nfrom pathlib import Path\n\n\ndef load(path: str) -> dict:\n    return json.load(open(path))\n';
        const sig = signatureOf(py);
        expect(sig).toBe('def load(path: str) -> dict:');
        expect(sig).not.toMatch(LEAKS);
    });

    it('drops a PHP open tag, namespace and use lines and sends the signature only', () => {
        const php = '<?php\n\nnamespace App\\Billing;\n\nuse App\\Models\\Row;\n\nfunction total(array $rows): int {\n    return array_sum(array_map(fn ($r) => $r->amount, $rows));\n}\n';
        const sig = signatureOf(php);
        expect(sig).toBe('function total(array $rows): int;');
        expect(sig).not.toMatch(LEAKS);
    });

    it('refuses a Python file with two defs', () => {
        expect(() => signatureOf('def a():\n    return 1\n\ndef b():\n    return 2\n')).toThrow(HandPayloadError);
    });

    it('a whole-file callee never reaches the payload with a body', () => {
        expect(() =>
            buildHandPayload(
                { kind: 'draft-candidate', spec: 'Write average(rows).', callees: [`${TOTAL_IMPL}\n${TOTAL_IMPL.replace('total', 'sum2')}`] },
                resetCouncilEgress({ identifiers: true }),
            ),
        ).toThrow(HandPayloadError);
    });
});

describe('buildHandPayload — the slice the head cut, and nothing else', () => {
    it('carries no implementation body of a called function', () => {
        const p = buildHandPayload(
            { kind: 'draft-candidate', spec: 'Write average(rows) returning the mean amount.', callees: [TOTAL_IMPL] },
            resetCouncilEgress({ identifiers: true }),
        );
        expect(p.user).toContain('export function total(rows: Row[]): number;');
        expect(p.user).not.toContain('reduce');
        expect(p.user).not.toContain('sum + r.amount');
    });

    it('refuses a spec that already carries a callee’s implementation', () => {
        expect(() =>
            buildHandPayload(
                { kind: 'draft-candidate', spec: `Like this:\n${TOTAL_IMPL}`, callees: [TOTAL_IMPL] },
                resetCouncilEgress({ identifiers: true }),
            ),
        ).toThrow(HandPayloadError);
    });

    it('replaces linking identifiers with placeholders, in every spelling', () => {
        const p = buildHandPayload(
            {
                kind: 'draft-candidate',
                spec: 'In the Acme-Billing package (see /home/dev/acme-billing/src), write parse() for acme-billing rows.',
                linking: [
                    { type: 'PROJECT', value: 'acme-billing' },
                    { type: 'REPOPATH', value: '/home/dev/acme-billing' },
                ],
            },
            resetCouncilEgress({ identifiers: true }),
        );
        expect(p.user.toLowerCase()).not.toContain('acme-billing');
        expect(p.user).toMatch(PLACEHOLDER);
    });

    it('the system prompt is the kind schema only — no project rule, skill or instruction text', () => {
        const p = buildHandPayload(
            { kind: 'classify', spec: 'Label: ETIMEDOUT', linking: [{ type: 'PROJECT', value: 'acme-billing' }] },
            resetCouncilEgress({ identifiers: true }),
        );
        expect(p.system).toBe(handSystemPrompt('classify'));
    });
});

describe('projectLinkingIdentifiers', () => {
    it('reads package names, their parts, the homepage host, the directory name and the path', () => {
        const root = path.join(tmp, 'billing-core');
        fs.mkdirSync(root);
        fs.writeFileSync(
            path.join(root, 'package.json'),
            JSON.stringify({ name: '@acme/billing-core', homepage: 'https://billing.acme.example/docs' }),
        );
        const values = projectLinkingIdentifiers(root).map((l) => l.value);
        expect(values).toEqual(
            expect.arrayContaining(['@acme/billing-core', 'acme', 'billing-core', 'billing.acme.example', root]),
        );
    });
});

describe('askHand — the outbound payload', () => {
    it('a call whose slice names the project sends its placeholder instead', async () => {
        const sent: string[] = [];
        const member = {
            name: 'free1',
            billing_class: 'free-quota',
            ask: (system: string, user: string) => {
                sent.push(system, user);
                return new CouncilResponse({ provider: 'free1', model: 'm', text: '{"candidate":"x"}', input_tokens: 1, output_tokens: 1 });
            },
        } as unknown as ExternalAIClient;
        const r = await askHand(
            {
                kind: 'draft-candidate',
                spec: 'Write a helper for acme-billing that formats invoice ids.',
                linking: [{ type: 'PROJECT', value: 'acme-billing' }],
            },
            { members: [member], contentClass: 'public-artifact', auditDir: null, flips: () => true, egress: resetCouncilEgress({ identifiers: true }) },
        );
        expect(r).not.toBeNull();
        expect(sent.join('\n')).not.toContain('acme-billing');
        expect(sent[1]).toMatch(PLACEHOLDER);
    });
});
