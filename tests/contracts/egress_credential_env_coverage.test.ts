// The credential coverage join (road-to-free-hands-a-paid-head-checks 1.2): every
// credential environment variable a shipped adapter or council client reads maps
// to an egress row that masks its bare value, or is named no-stable-prefix.
import * as fs from 'node:fs';
import * as path from 'node:path';

import { describe, expect, it } from 'vitest';

import { CREDENTIAL_ENV_ROWS, credentialEnvNames, unmappedCredentialEnv } from '../../src/scripts/_lib/egress_credential_env.js';
import { EGRESS_RULES } from '../../src/scripts/_lib/egress_rules.js';

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
