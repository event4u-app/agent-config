/**
 * Drift matrix for the one rule table (road-to-one-detector-and-the-senders-we-own
 * step 2.2): every positive credential fixture against every consumer that
 * detects credentials. Each consumer keeps its own policy — refuse, mask, report,
 * redact a line — and only detection is shared, so the assertion is the same for
 * all of them: the value does not survive, or the consumer reports a hit.
 *
 * Consumers are graded by what their policy can see. A pattern-grade consumer
 * runs the table's rows and must catch every fixture. A prefix-grade consumer
 * acts on a raw-key prefix alone (a config ref, a short masked log value) and
 * must catch every fixture whose row declares a prefix. Values are built at
 * runtime and never printed.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { describe, expect, it } from 'vitest';

import { scan as workspaceScan, scrub as workspaceScrub } from './workspace_secrets.js';
import { scrub_string as explainScrub } from '../_cli/explain_last/scrubber.js';
import { redact as bundlerRedact } from '../ai_council/bundler.js';
import { load_council_config } from '../ai_council/config.js';
import { redact_low_impact_entry } from '../ai_council/redact_low_impact_entry.js';
import { redact as crossRepoRedact } from '../cross_repo_retrieve.js';
import { hasInlineSecret } from '../lint_mcp_config_security.js';
import { detect, EGRESS_RULES } from './egress_rules.js';
import { scanText } from './secret_detector.js';

const ALNUM = 'Ab3Cd5Ef7Gh9Jk2Lm4Np6Qr8St1Uv3Wx5Yz7';
const run = (n: number): string => ALNUM.repeat(Math.ceil(n / ALNUM.length)).slice(0, n);

/** One positive value per credential row, assembled from parts. */
const FIXTURES: Readonly<Record<string, string>> = {
    'anthropic-api-key': 'sk-' + 'ant-' + 'api03-' + run(40),
    'anthropic-project-key': 'sk-' + 'proj-' + run(24),
    'openai-api-key': 'sk-' + run(40),
    'aws-access-key': 'AK' + 'IA' + 'ABCDEFGHIJ234567',
    'google-api-key': 'AI' + 'za' + run(35),
    'google-oauth-token': 'ya' + '29.' + run(40),
    'github-pat': 'gh' + 'p_' + run(36),
    'github-app-token': 'gh' + 'o_' + run(36),
    'github-fine-grained-pat': 'github' + '_pat_' + run(30),
    'xai-api-key': 'xa' + 'i-' + run(40),
    'perplexity-api-key': 'pp' + 'lx-' + run(40),
    'groq-api-key': 'gs' + 'k_' + run(40),
    'huggingface-token': 'h' + 'f_' + run(34),
    'nvidia-api-key': 'nv' + 'api-' + run(64),
    'replicate-api-token': 'r' + '8_' + run(37),
    jwt: 'ey' + 'J' + run(20) + '.' + run(20) + '.' + run(20),
    'stripe-secret-key': 'sk' + '_live_' + run(24),
    'slack-token': 'xo' + 'xb-' + run(24),
    'pem-private-key': '-----BEGIN RSA ' + 'PRIVATE KEY-----\nMIIabc\n-----END RSA ' + 'PRIVATE KEY-----',
    'db-connection-uri': 'postgres://user:' + run(16) + '@db.example:5432/app',
    'generic-assignment': 'api_key = "' + run(24) + '"',
};

const credentialRows = EGRESS_RULES.filter((r) => r.class === 'credential');

/** The part of a fixture that is the secret; for a URI, the password. */
function secretOf(rule: string, fixture: string): string {
    if (rule === 'db-connection-uri') return run(16);
    if (rule === 'generic-assignment') return run(24);
    if (rule === 'pem-private-key') return 'MIIabc';
    return fixture;
}

const inSentence = (v: string): string => `prefix text ${v} suffix text`;

/** True when the consumer acted on the fixture. */
type Consumer = (fixture: string, secret: string) => boolean;

const PATTERN_GRADE: Readonly<Record<string, Consumer>> = {
    secret_detector: (f) => scanText(inSentence(f)).some((x) => x.confidence === 'high'),
    lint_mcp_config_security: (f) => hasInlineSecret(inSentence(f)),
    workspace_secrets_scan: (f) => workspaceScan(inSentence(f)).length > 0,
    workspace_secrets_scrub: (f, s) => !workspaceScrub(inSentence(f))[0].includes(s),
    cross_repo_retrieve: (f, s) => !crossRepoRedact(inSentence(f), {})[0].includes(s),
    council_bundler: (f, s) => !bundlerRedact(inSentence(f)).includes(s),
};

// A row a consumer's policy deliberately leaves out, with the reason. The MCP
// lint's HIGH tier is structural credentials; a keyword assignment was never in
// it, and promoting one would change that consumer's policy, not its detection.
const POLICY_EXCLUDED: Readonly<Record<string, readonly string[]>> = {
    lint_mcp_config_security: ['generic-assignment'],
};

function councilRefRefused(ref: string): boolean {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'egress-drift-'));
    const file = path.join(dir, 'council.yml');
    fs.writeFileSync(file, `enabled: false\nmembers:\n  anthropic:\n    enabled: false\n    api_key_ref: ${JSON.stringify(ref)}\n`);
    try {
        load_council_config(file);
        return false;
    } catch (e) {
        return /raw API key/.test(String(e));
    } finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
}

const PREFIX_GRADE: Readonly<Record<string, Consumer>> = {
    explain_last_scrubber: (f, s) => !String(explainScrub(inSentence(f))).includes(s),
    low_impact_redactor: (f) => redact_low_impact_entry(inSentence(f)).violations.some((v) => v.category === 'secret'),
    council_api_key_ref: (f) => councilRefRefused(f),
};

describe('drift matrix: one table, every consumer', () => {
    it('every credential row has a fixture and every fixture names a row', () => {
        expect(Object.keys(FIXTURES).sort()).toEqual(credentialRows.map((r) => r.rule).sort());
    });

    it('the anthropic api03 key of F2 is a named row', () => {
        expect(FIXTURES['anthropic-api-key']?.startsWith('sk-' + 'ant-' + 'api03-')).toBe(true);
    });

    for (const row of credentialRows) {
        const fixture = FIXTURES[row.rule] ?? '';
        const secret = secretOf(row.rule, fixture);
        for (const [name, consumer] of Object.entries(PATTERN_GRADE)) {
            const excluded = POLICY_EXCLUDED[name]?.includes(row.rule) === true;
            it(`${name} ${excluded ? 'leaves to its own policy' : 'acts on'} ${row.rule}`, () => {
                expect(consumer(fixture, secret)).toBe(!excluded);
            });
        }
        if ((row.prefixes ?? []).length === 0) continue;
        for (const [name, consumer] of Object.entries(PREFIX_GRADE)) {
            it(`${name} acts on ${row.rule} by prefix`, () => {
                expect(consumer(fixture, secret)).toBe(true);
            });
        }
    }

    it('a row declares tokenStart exactly when it does not match glued to a word', () => {
        for (const row of credentialRows) {
            if ((row.prefixes ?? []).length === 0) continue;
            const glued = detect(`x${FIXTURES[row.rule] ?? ''}`, [row]).length > 0;
            expect({ rule: row.rule, glued }).toEqual({ rule: row.rule, glued: row.tokenStart !== true });
        }
    });

    it('a masking consumer leaves no body of an unproven key block', () => {
        const body = 'MIIq7w3e5r7t9y';
        const block = '-----BEGIN RSA ' + 'PRIVATE KEY-----\n' + body + '\n-----END EC ' + 'PRIVATE KEY-----';
        expect(workspaceScrub(inSentence(block))[0]).not.toContain(body);
        expect(crossRepoRedact(inSentence(block), {})[0]).not.toContain(body);
        expect(bundlerRedact(`a\n${block}\nb`)).not.toContain(body);
    });
});
