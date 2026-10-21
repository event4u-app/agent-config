/**
 * road-to-one-detector-and-the-senders-we-own 3.3: the council bundle goes
 * through the engine, and the member call checks what it is about to send.
 *
 * Every value is assembled at runtime and never printed.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { beforeEach, describe, expect, it } from 'vitest';

import { EGRESS_RULES } from '../../../src/scripts/_lib/egress_rules.js';
import { parseTokens } from '../../../src/scripts/_lib/egress_token.js';
import { bundle_prompt, redact } from '../../../src/scripts/ai_council/bundler.js';
import { curlJsonPost, stringLeaves } from '../../../src/scripts/ai_council/api_transport.js';
import { AnthropicCliClient, CouncilResponse, ExternalAIClient } from '../../../src/scripts/ai_council/clients.js';
import { CouncilEgress, resetCouncilEgress } from '../../../src/scripts/ai_council/council_egress.js';
import { callMember } from '../../../src/scripts/ai_council/response_render.js';

const ALNUM = 'Qw3Er5Ty7Ui9Op2As4Df6Gh8Jk1Lz3Xc5Vb7Nm9';
const run = (n: number, shift = 0): string => {
    let s = '';
    for (let i = 0; i < n; i += 1) s += ALNUM[(i + shift) % ALNUM.length];
    return s;
};

const PAT = `${'gh'}p_${run(36, 2)}`;
const DB_PASSWORD = `pw${run(10, 4)}`;
const DB_URI = `postgres://app:${DB_PASSWORD}@db.example.com:5432/app`;
const EMAIL = ['jane.doe', 'example.org'].join('@');
const IBAN = 'DE89 3704 0044 0532 0130 00';
const PHONE = '+49 30 1234567';
const AWS = `AKIA${'ABCDEFGHIJ234567'}`;
const CODE_LINE = 'const token = getToken();';

/** The F1 sample: five values that left unchanged before, and a code line that was lost whole. */
const F1 = [
    `Contact: ${EMAIL}`,
    `IBAN: ${IBAN}`,
    `Phone: ${PHONE}`,
    `DATABASE_URL=${DB_URI}`,
    `export GITHUB=${PAT}`,
    CODE_LINE,
].join('\n');

class FakeClient extends ExternalAIClient {
    readonly sent: string[] = [];
    constructor() {
        super();
        this.name = 'fake';
        this.model = 'fake-1';
    }
    ask(system_prompt: string, user_prompt: string): CouncilResponse {
        this.sent.push(`${system_prompt}\n${user_prompt}`);
        return new CouncilResponse({ provider: this.name, model: this.model, text: 'ok' });
    }
}

const call = (client: FakeClient, user_prompt: string, system = 'You review.'): CouncilResponse =>
    callMember(client, { user_prompt, max_tokens: 64 }, {}, () => system, (e) => String(e));

const IDENTIFIER_TYPES = new Set(EGRESS_RULES.filter((r) => r.class === 'identifier').map((r) => r.type));
const hasIdentifierRows = ['EMAIL', 'IBAN', 'PHONE'].every((t) => IDENTIFIER_TYPES.has(t));

describe('council bundle: span replacement through the engine (3.3)', () => {
    beforeEach(() => {
        resetCouncilEgress({ identifiers: false });
    });

    it('replaces the credentials of the F1 sample and keeps the code line', () => {
        const out = redact(F1);
        expect(out).not.toContain(PAT);
        expect(out).not.toContain(DB_PASSWORD);
        expect(out.split('\n')).toContain(CODE_LINE);
        const types = parseTokens(out).map((t) => t.type);
        expect(types).toContain('DBURI');
        expect(types).toContain('TOKEN');
        // A finding costs the value, not the line: the key names stay readable.
        expect(out).toMatch(/^DATABASE_URL=/m);
        expect(out).toMatch(/^export GITHUB=__TOKEN_1_/m);
    });

    // skip-reason: the rule table carries no EMAIL, IBAN or PHONE identifier rows yet, so protect has nothing to replace them with
    it.skipIf(!hasIdentifierRows)('the F1 sample leaves with five placeholders in protect', () => {
        const out = redact(F1, new CouncilEgress({ identifiers: true }));
        expect(parseTokens(out)).toHaveLength(5);
        for (const v of [EMAIL, IBAN, PHONE, DB_PASSWORD, PAT]) expect(out).not.toContain(v);
        expect(out.split('\n')).toContain(CODE_LINE);
    });

    it('identifiers are left, and not refused, under the shipped default (D8)', () => {
        const egress = new CouncilEgress({ identifiers: false });
        const out = redact(F1, egress);
        expect(out).toContain(EMAIL);
        expect(egress.check(out)).toBeNull();
    });

    it('a low-entropy password and a bearer value lose the value, not the line', () => {
        const out = redact(['password = hunter2', 'Authorization: Bearer abc.def', 'token: string;'].join('\n')).split('\n');
        expect(out[0]).toMatch(/^password = __SECRET_1_[0-9a-f]{6}__$/);
        expect(out[1]).toMatch(/^Authorization: __TOKEN_1_[0-9a-f]{6}__$/);
        expect(out[2]).toBe('token: string;');
    });

    it('code after a credential keyword is not a secret (found by bundling this branch)', () => {
        const code = [
            "    password: 'password',",
            "    readonly token: typeof import('./x.js');",
            '    apiKey: new RegExp(source),',
            '    secret: await load(),',
        ].join('\n');
        expect(redact(code)).toBe(code);
    });

    it('replacing twice yields the same bytes as replacing once', () => {
        const egress = new CouncilEgress();
        const once = redact(F1, egress);
        expect(redact(once, egress)).toBe(once);
    });

    it('a credential token never restores for display', () => {
        const egress = new CouncilEgress();
        const out = redact(F1, egress);
        expect(egress.restoreForDisplay(out)).toBe(out);
    });
});

describe('council member call: the final check (3.3)', () => {
    beforeEach(() => {
        resetCouncilEgress({ identifiers: false });
    });

    it('sends a bundled body', () => {
        const client = new FakeClient();
        const r = call(client, bundle_prompt(F1).text);
        expect(r.error).toBeNull();
        expect(client.sent).toHaveLength(1);
        expect(client.sent[0]).not.toContain(PAT);
    });

    it('canary: a raw value planted past the replacement is refused before the request is written', () => {
        const bundled = bundle_prompt(F1).text;
        const planted = `${bundled}\n\nappendix: ${PAT}`;
        const client = new FakeClient();
        const r = call(client, planted);
        expect(r.error).toMatch(/^egress refused: replaced-value-present/);
        expect(r.error).not.toContain(PAT);
        expect(client.sent).toHaveLength(0);
        // The canary is live: without the check this body would reach the member.
        expect(new FakeClient().ask('You review.', planted).text).toBe('ok');
        expect(planted).toContain(PAT);
    });

    it('a high-confidence finding that never went through the bundler is refused, in the system prompt too', () => {
        const client = new FakeClient();
        expect(call(client, `plain question ${AWS}`).error).toMatch(/high-confidence-finding \(aws-access-key\)/);
        expect(call(client, 'plain question', `system ${AWS}`).error).toMatch(/high-confidence-finding/);
        expect(client.sent).toHaveLength(0);
    });

    it('the split path is checked as one body', () => {
        const client = new FakeClient();
        const r = callMember(
            client,
            { user_prompt: 'unused', max_tokens: 64 },
            { split: { stable: 'artefact', suffix: `\nround 2: ${AWS}` } },
            () => 'You review.',
            (e) => String(e),
        );
        expect(r.error).toMatch(/egress refused/);
        expect(client.sent).toHaveLength(0);
    });
});

describe('the transports check what they are about to write (3.3)', () => {
    beforeEach(() => {
        resetCouncilEgress({ identifiers: false });
    });

    it('the API post refuses a body carrying a high-confidence finding before curl is spawned', () => {
        expect(() =>
            curlJsonPost('https://unreachable.invalid/v1/messages', [], { messages: [{ role: 'user', content: `q ${AWS}` }] }),
        ).toThrow(/^egress refused: high-confidence-finding \(aws-access-key\); nothing was sent$/);
    });

    it('the API post refuses a value the bundler replaced in this run', () => {
        bundle_prompt(F1);
        expect(() => curlJsonPost('https://unreachable.invalid/v1', [], { prompt: `x ${PAT}` })).toThrow(
            /replaced-value-present/,
        );
    });

    it('the body check reads every string the provider would read, keys included', () => {
        expect(stringLeaves({ a: ['x', { [AWS]: 1 }], b: 'y' })).toEqual(['a', 'x', AWS, 'b', 'y']);
    });

    it('a CLI seat refuses before spawning and books no call', () => {
        const callsPath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'egress-cli-')), 'cli-calls.json');
        const client = new AnthropicCliClient({ cli_calls_path: callsPath, binary: '/bin/echo' });
        const spawned: string[] = [];
        (client as unknown as { _runSubprocess: (c: string[], s: string | null) => unknown })._runSubprocess = (c) => {
            spawned.push(c.join(' '));
            return { returncode: 0, stdout: '{}', stderr: '' };
        };
        const r = client.ask('You review.', `question ${AWS}`);
        expect(r.error).toBe('egress_refused');
        expect(spawned).toHaveLength(0);
        expect(fs.existsSync(callsPath)).toBe(false);
    });
});

/**
 * Council review of this branch, 2026-10-21, round A1: both seats REQUEST_CHANGES
 * on one confidentiality defect. The review-assignment value shape opened and
 * closed with an OPTIONAL quote around a capture that forbade whitespace, so a
 * quoted credential containing a space was replaced only up to that space and
 * its remainder stayed in the outbound body. Both seats asked for the assertion
 * to be made over the whole body rather than over the detector's span, which is
 * what these cases do.
 */
describe('a quoted credential leaves whole, never by its prefix (council A1)', () => {
    beforeEach(() => {
        resetCouncilEgress({ identifiers: false });
    });

    const WORDS = ['correct', 'horse', 'battery', 'staple'].join(' ');

    it('a double-quoted value containing spaces leaves no byte of itself behind', () => {
        const out = redact(`password = "${WORDS}"`);
        expect(out).not.toContain(WORDS);
        for (const word of WORDS.split(' ')) expect(out).not.toContain(word);
        expect(parseTokens(out).map((t) => t.type)).toContain('SECRET');
    });

    it('a single-quoted value containing spaces leaves no byte of itself behind', () => {
        const out = redact(`apiKey: '${WORDS}'`);
        for (const word of WORDS.split(' ')) expect(out).not.toContain(word);
    });

    it('an unterminated quote is over-redacted to the line end, never matched by its prefix', () => {
        const out = redact(`password = "${WORDS}`);
        for (const word of WORDS.split(' ')) expect(out).not.toContain(word);
    });

    it('an unquoted value is still replaced, and the key name stays readable', () => {
        const value = `pw${run(14, 7)}`;
        const out = redact(`password=${value}`);
        expect(out).not.toContain(value);
        expect(out).toMatch(/^password=__SECRET_1_/);
    });

    it('the whole quoted value is absent from the body a member would receive', () => {
        const client = new FakeClient();
        const r = call(client, bundle_prompt(`password = "${WORDS}"`).text);
        expect(r.error).toBeNull();
        expect(client.sent).toHaveLength(1);
        expect(client.sent[0]).not.toContain(WORDS);
        for (const word of WORDS.split(' ')) expect(client.sent[0]).not.toContain(word);
    });
});

/**
 * Council review of this branch, 2026-10-21, round A1, both seats: the
 * review-assignment shape declared no boundary before its keyword group, so a
 * key that merely ENDS in a credential word was replaced. Over-redaction here
 * is not free — shadow dispatch drops a query that needed a placeholder.
 */
describe('a credential keyword is a key, not a suffix (council A1)', () => {
    beforeEach(() => {
        resetCouncilEgress({ identifiers: false });
    });

    it('a key that merely ends in a credential word is left alone', () => {
        for (const line of ['mytoken = ordinary', 'notsecret = ordinary', 'xapiKey = ordinary']) {
            expect(redact(line)).toBe(line);
        }
    });

    it('a compound key separated from the keyword is still a credential', () => {
        const value = `pw${run(12, 3)}`;
        for (const key of ['client_secret', 'MY_TOKEN', 'api-key']) {
            const out = redact(`${key}=${value}`);
            expect(out).not.toContain(value);
        }
    });
});
