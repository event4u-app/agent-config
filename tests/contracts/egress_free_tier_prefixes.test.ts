// road-to-free-hands-a-paid-head-checks 1.2 (D4): bare credentials of the
// free-tier providers the package itself touches were not masked — reproduced
// 0/50 for each of hf_, nvapi-, r8_ — while the assignment form was caught.
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';

import { describe, expect, it } from 'vitest';

import { resetCouncilEgress } from '../../src/scripts/ai_council/council_egress.js';
import { CREDENTIAL_ENV_ROWS, credentialEnvNames, unmappedCredentialEnv } from '../../src/scripts/_lib/egress_credential_env.js';
import { EGRESS_RULES } from '../../src/scripts/_lib/egress_rules.js';

const ALNUM = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
function randomBody(n: number, alphabet = ALNUM): string {
    const bytes = crypto.randomBytes(n);
    return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
}

const SHAPES: Record<string, () => string> = {
    hf_: () => `hf_${randomBody(34, 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz')}`,
    'nvapi-': () => `nvapi-${randomBody(64, `${ALNUM}-_`)}`,
    r8_: () => `r8_${randomBody(37)}`,
};

describe('egress_prefixes — the three free-tier prefixes', () => {
    for (const [prefix, make] of Object.entries(SHAPES)) {
        it(`masks every synthetic bare ${prefix} key (50/50)`, () => {
            const egress = resetCouncilEgress({ identifiers: true });
            for (let i = 0; i < 50; i++) {
                const key = make();
                const out = egress.replace(`token in a log line: ${key} and more`);
                expect(out, `${prefix} key ${i} leaked`).not.toContain(key);
            }
        });
    }
});

describe('egress_prefixes — the three rows at their stated minimum', () => {
    // Council round 5 asked for the quantifier minimums to be exercised, not only longer keys.
    const MIN: Record<string, { prefix: string; min: number; alphabet: string }> = {
        'huggingface-token': { prefix: 'h' + 'f_', min: 30, alphabet: ALNUM },
        'nvidia-api-key': { prefix: 'nv' + 'api-', min: 40, alphabet: `${ALNUM}-_` },
        'replicate-api-token': { prefix: 'r' + '8_', min: 30, alphabet: ALNUM },
    };
    for (const [rule, { prefix, min, alphabet }] of Object.entries(MIN)) {
        it(`${rule}: a body of exactly ${min} is masked, one shorter is not`, () => {
            const egress = resetCouncilEgress({ identifiers: true });
            const at = `${prefix}${randomBody(min, alphabet)}`;
            const short = `${prefix}${randomBody(min - 1, alphabet)}`;
            expect(egress.replace(`k ${at} x`)).not.toContain(at);
            expect(egress.replace(`k ${short} x`)).toContain(short);
        });
    }

    it('nvidia-api-key covers every permitted character, - and _ included', () => {
        const egress = resetCouncilEgress({ identifiers: true });
        const key = `${'nv' + 'api-'}${'-_'.repeat(10)}${randomBody(30)}`;
        expect(egress.replace(`k ${key} x`)).not.toContain(key);
    });
});

describe('egress coverage join — every credential env var a shipped adapter reads', () => {
    const REPO = path.resolve(__dirname, '..', '..');
    const SOURCES = [
        'src/scripts/_lib/environment_detector.ts',
        ...fs.readdirSync(path.join(REPO, 'src/scripts/ai_council')).filter((f) => f.endsWith('.ts')).map((f) => `src/scripts/ai_council/${f}`),
        ...['ai-image', 'ai-video'].flatMap((d) =>
            fs.readdirSync(path.join(REPO, 'src/scripts', d, 'adapters')).map((f) => `src/scripts/${d}/adapters/${f}`),
        ),
    ];

    it('maps to a prefix row or to an explicit no-stable-prefix row', () => {
        const names = new Set(SOURCES.flatMap((rel) => credentialEnvNames(fs.readFileSync(path.join(REPO, rel), 'utf8'))));
        expect(names.size).toBeGreaterThan(0);
        expect(unmappedCredentialEnv([...names])).toEqual([]);
    });

    it('a fixture adapter reading an unmapped *_TOKEN fails the join', () => {
        const fixture = 'curl -H "Authorization: Bearer $NEWVENDOR_API_TOKEN" https://api.example.test/v1';
        expect(unmappedCredentialEnv(credentialEnvNames(fixture))).toEqual(['NEWVENDOR_API_TOKEN']);
    });

    it('every row that names a rule names one the table has', () => {
        const rules = new Set(EGRESS_RULES.map((r) => r.rule));
        for (const row of CREDENTIAL_ENV_ROWS) {
            if (row.rule !== 'no-stable-prefix') expect(rules.has(row.rule), row.env).toBe(true);
        }
    });
});
