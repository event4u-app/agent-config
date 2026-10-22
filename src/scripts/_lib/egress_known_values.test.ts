/**
 * Known values — a credential with no shape, found by knowing it.
 *
 * The planted password is assembled at runtime and compared by boolean, so a
 * failure never prints it.
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { detect } from './egress_rules.js';
import { findKnownValues, knownValueSet, MIN_KNOWN_VALUE_LENGTH, readEnvFileBodies } from './egress_known_values.js';

const made: string[] = [];
afterEach(() => {
    while (made.length > 0) fs.rmSync(made.pop() as string, { recursive: true, force: true });
});

// A quote and a backslash so JSON escaping changes it; a space so URL encoding does.
const PASSWORD = ['p"ss', 'w0rd', 'horse', '42'].join('\\').replace('\\horse', ' horse');
const b64 = (s: string): string => Buffer.from(s, 'utf8').toString('base64');

function fixtureProject(): string {
    const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'known-values-')));
    made.push(dir);
    fs.writeFileSync(path.join(dir, '.env'), `# local\nDB_PASSWORD='${PASSWORD}'\nDEBUG=true\n`);
    fs.writeFileSync(path.join(dir, '.env.example'), 'DB_PASSWORD=changeme-template-value\n');
    return dir;
}

describe('knownValueSet', () => {
    it('takes credential-named env vars and every .env value long enough, and skips templates', () => {
        const dir = fixtureProject();
        const set = knownValueSet({ GITHUB_TOKEN: 'abcdefgh12345', HOME: '/home/someone-long', PW_AUTH: 'short' }, readEnvFileBodies(dir));
        expect(set.has(PASSWORD)).toBe(true);
        expect(set.has('abcdefgh12345')).toBe(true);
        expect(set.has('/home/someone-long')).toBe(false);
        expect(set.has('short')).toBe(false);
        expect(set.has('changeme-template-value')).toBe(false);
        expect([...set].every((v) => v.length >= MIN_KNOWN_VALUE_LENGTH)).toBe(true);
    });

    it('reads AUTH as a trailing word, not a substring of AUTHOR or AUTH_SOCK', () => {
        const set = knownValueSet(
            { GIT_AUTHOR_NAME: 'Someone Longname', SSH_AUTH_SOCK: '/tmp/ssh-agent.sock', BASIC_AUTH: 'user:pass-1234' },
            [],
        );
        expect(set.has('Someone Longname')).toBe(false);
        expect(set.has('/tmp/ssh-agent.sock')).toBe(false);
        expect(set.has('user:pass-1234')).toBe(true);
    });
});

describe('findKnownValues — a password with no recognisable shape', () => {
    it('matches no rule in the table, which is why the set exists', () => {
        expect(detect(`password: ${PASSWORD}`).some((s) => s.rule !== 'generic-assignment')).toBe(false);
    });

    it('is found printed by a command in all four encodings', () => {
        const dir = fixtureProject();
        const set = knownValueSet({}, readEnvFileBodies(dir));
        const printed = spawnSync('cat', ['.env'], { cwd: dir, encoding: 'utf8' }).stdout;
        const forms: Array<[string, string]> = [
            ['plain', printed],
            ['base64', `Authorization: Basic ${b64(`admin:${PASSWORD}`)}`],
            ['url', `GET /login?pw=${encodeURIComponent(PASSWORD)}&x=1`],
            ['json', JSON.stringify({ config: { password: PASSWORD } })],
        ];
        for (const [encoding, text] of forms) {
            const { hits } = findKnownValues(text, set);
            expect(hits.length > 0, encoding).toBe(true);
            expect(hits[0]?.encodings.includes(encoding as never), encoding).toBe(true);
            const h = hits[0] as { start: number; end: number };
            expect(text.slice(h.start, h.end).length > 0).toBe(true);
        }
    });

    it('is found through two layers: base64 of a URL-encoded copy', () => {
        const set = new Set([PASSWORD]);
        const text = `blob=${b64(`v=${encodeURIComponent(PASSWORD)}`)}`;
        const { hits } = findKnownValues(text, set);
        expect(hits.map((h) => h.encodings.join('>'))).toEqual(['base64>url']);
    });

    it('a nesting past the bound is a counted miss, not a hit and not a hang', () => {
        const set = new Set([PASSWORD]);
        const text = `x=${b64(b64(b64(PASSWORD)))}`;
        const started = Date.now();
        const scan = findKnownValues(text, set);
        expect(Date.now() - started).toBeLessThan(1_000);
        expect(scan.hits).toEqual([]);
        expect(scan.misses.pastLayerBound).toBeGreaterThan(0);
    });

    it('counts a text past the size bound and a search past the time bound', () => {
        const set = new Set([PASSWORD]);
        const big = findKnownValues(`${'a'.repeat(64)} ${b64(PASSWORD)}`, set, { maxBytes: 16, maxMs: 50 });
        expect(big.hits).toEqual([]);
        expect(big.misses.pastSizeBound).toBe(1);
        let t = 0;
        const slow = findKnownValues(`x=${b64(PASSWORD)}`, set, { maxBytes: 1_000_000, maxMs: 5 }, () => (t += 10));
        expect(slow.misses.pastTimeBound).toBe(1);
    });

    it('an empty set finds nothing and decodes nothing', () => {
        expect(findKnownValues(`x=${b64(PASSWORD)}`, new Set()).hits).toEqual([]);
    });
});
