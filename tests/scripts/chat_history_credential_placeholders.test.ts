/**
 * OQ-34, option 1 of blocker b-history-credential-store-vs-egress-contract
 * (owner, 2026-11-04): chat history stores egress placeholders for credentials
 * and no original anywhere. Every write path is checked against the bytes on
 * disk, because the file is the surface the decision is about.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import * as ch from '../../src/scripts/chat_history.js';
import { parseTokens } from '../../src/scripts/_lib/egress_token.js';

const ALNUM = 'Ab3Cd5Ef7Gh9Jk2Lm4Np6Qr8St1Uv3Wx5Yz7';
const run = (n: number): string => ALNUM.repeat(Math.ceil(n / ALNUM.length)).slice(0, n);
// Assembled at runtime so no literal credential sits in the tree.
const GITHUB_PAT = 'gh' + 'p_' + run(36);
const STRIPE_KEY = 'sk' + '_live_' + run(24);
const EMAIL = 'someone@example.com';
const RSA = ['RSA', 'PRIVATE', 'KEY'].join(' ');

const dirs: string[] = [];
function historyFile(): string {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'chat-hist-cred-'));
    dirs.push(d);
    const file = path.join(d, 'chat-history.jsonl');
    ch.init('per_phase', { path: file });
    return file;
}

afterEach(() => {
    while (dirs.length > 0) fs.rmSync(dirs.pop() as string, { recursive: true, force: true });
});

const onDisk = (file: string): string => fs.readFileSync(file, 'utf-8');

describe('chat history stores credential placeholders, never the value', () => {
    it('append replaces a credential with a placeholder token', () => {
        const file = historyFile();
        ch.append({ t: 'user', text: `use ${GITHUB_PAT} for the push` }, { path: file, session: 's1' });
        const raw = onDisk(file);
        expect(raw).not.toContain(GITHUB_PAT);
        const text = ch.read_entries({ path: file })[0]?.['text'] as string;
        expect(text.startsWith('use ')).toBe(true);
        expect(text.endsWith(' for the push')).toBe(true);
        expect(parseTokens(text)).toHaveLength(1);
    });

    it('reaches nested string leaves of an entry', () => {
        const file = historyFile();
        ch.append(
            { t: 'tool', input: { args: ['--token', STRIPE_KEY], env: { KEY: `Bearer ${GITHUB_PAT}` } } },
            { path: file, session: 's1' },
        );
        const raw = onDisk(file);
        expect(raw).not.toContain(STRIPE_KEY);
        expect(raw).not.toContain(GITHUB_PAT);
    });

    it('leaves identifiers and plain text untouched', () => {
        const file = historyFile();
        ch.append({ t: 'user', text: `mail ${EMAIL} about the release` }, { path: file, session: 's1' });
        expect(ch.read_entries({ path: file })[0]?.['text']).toBe(`mail ${EMAIL} about the release`);
    });

    it('withholds a leaf whose credential extent cannot be proven', () => {
        const file = historyFile();
        const truncated = `-----BEGIN ${RSA}-----\n${run(64)}\n(truncated)`;
        ch.append({ t: 'user', text: truncated, keep: 'unrelated' }, { path: file, session: 's1' });
        const entry = ch.read_entries({ path: file })[0] as Record<string, unknown>;
        expect(onDisk(file)).not.toContain(run(64));
        expect(entry['text']).toMatch(/^\[chat-history: text withheld \(pem-private-key\)\]$/);
        expect(entry['keep']).toBe('unrelated');
    });

    it('reset_with_entries and prepend_entries redact what they write', () => {
        const file = historyFile();
        ch.reset_with_entries([{ t: 'user', text: GITHUB_PAT }], 'per_phase', { path: file });
        ch.prepend_entries([{ t: 'user', text: STRIPE_KEY }], { path: file });
        const raw = onDisk(file);
        expect(raw).not.toContain(GITHUB_PAT);
        expect(raw).not.toContain(STRIPE_KEY);
        expect(ch.read_entries({ path: file })).toHaveLength(2);
    });

    it('keeps no resolvable copy: the placeholder appears nowhere beside its value', () => {
        const file = historyFile();
        ch.append({ t: 'user', text: GITHUB_PAT }, { path: file, session: 's1' });
        const siblings = fs.readdirSync(path.dirname(file));
        expect(siblings).toEqual(['chat-history.jsonl']);
    });
});
