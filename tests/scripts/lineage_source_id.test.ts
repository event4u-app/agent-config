// Step 7.1 of road-to-a-graph-that-follows-you — a keyed, stable source id.
//
// The id must be stable (same source → same id, across URL spellings), keyed
// (not a plain digest anyone can recompute from a guessed URL), and must fail
// closed without the key rather than inventing a fresh identity.
import { spawnSync } from 'node:child_process';
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

import { canonicalSourceIdentity, SOURCE_ID_RE, sourceId } from '../../src/scripts/_lib/source_id.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', '_lib', 'link_crypto.ts');
const TSX_BIN = path.join(REPO_ROOT, 'node_modules', '.bin', process.platform === 'win32' ? 'tsx.cmd' : 'tsx');
const KEY = 'test-link-key-0123456789abcdef';

const temps: string[] = [];
afterEach(() => {
    while (temps.length > 0) fs.rmSync(temps.pop() as string, { recursive: true, force: true });
});

/** Run the CLI with a throwaway HOME and cwd so neither real settings file is ever read. */
function runCli(args: string[], key: string | null): { status: number | null; stdout: string; stderr: string } {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'source-id-home-'));
    temps.push(home);
    const env: NodeJS.ProcessEnv = { ...process.env, HOME: home, USERPROFILE: home };
    delete env.EVENT4U_LINK_KEY;
    if (key !== null) env.EVENT4U_LINK_KEY = key;
    const res = spawnSync(TSX_BIN, [SCRIPT, ...args], { cwd: home, env, encoding: 'utf-8' });
    return { status: res.status, stdout: res.stdout, stderr: res.stderr };
}

describe('sourceId', () => {
    it('gives one id for the same URL twice', () => {
        const a = sourceId('https://github.com/acme/widget', KEY);
        expect(a).toMatch(SOURCE_ID_RE);
        expect(sourceId('https://github.com/acme/widget', KEY)).toBe(a);
    });

    it('collapses https, .git, ssh and deep-link spellings onto one id', () => {
        const id = sourceId('https://github.com/acme/widget', KEY);
        for (const v of [
            'https://github.com/Acme/Widget.git',
            'git@github.com:acme/widget.git',
            'https://www.github.com/acme/widget/tree/main/src',
        ]) {
            expect(sourceId(v, KEY), v).toBe(id);
        }
    });

    it('is keyed — another key gives another id, and the id is not sha256(url)', () => {
        const url = 'https://github.com/acme/widget';
        const id = sourceId(url, KEY);
        expect(sourceId(url, 'another-key-entirely-9876543210')).not.toBe(id);
        const hex = id.slice('src_'.length);
        for (const plain of [url, canonicalSourceIdentity(url)]) {
            expect(crypto.createHash('sha256').update(plain).digest('hex').startsWith(hex)).toBe(false);
        }
    });

    it('canonicalizes a non-repository URL without inventing a repository', () => {
        expect(canonicalSourceIdentity('https://User:tok@Example.org/Talk/?b=1#t')).toBe('example.org/Talk?b=1');
        expect(sourceId('https://example.org/Talk/', KEY)).toBe(sourceId('https://EXAMPLE.org/Talk', KEY));
    });

    it('refuses an empty key instead of hashing with nothing', () => {
        expect(() => sourceId('https://github.com/acme/widget', '')).toThrow(/key/);
    });
});

describe('link_crypto source-id', () => {
    it('prints the keyed id when a key is available', () => {
        const res = runCli(['source-id', '--value', 'https://github.com/acme/widget.git'], KEY);
        expect(res.status).toBe(0);
        expect(res.stdout.trim()).toBe(sourceId('https://github.com/acme/widget', KEY));
    });

    it('exits non-zero without a key rather than inventing an identity', () => {
        const res = runCli(['source-id', '--value', 'https://github.com/acme/widget'], null);
        expect(res.status).not.toBe(0);
        expect(res.stdout).not.toMatch(/src_/);
        expect(res.stderr).toMatch(/link_encryption_key/);
    });
});
