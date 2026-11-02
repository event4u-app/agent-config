import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { readCodexAuth } from '../../../src/scripts/_lib/codex_auth.js';

let dir: string;
const jwt = (payload: object): string =>
    `h.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.s`;
const write = (body: string): string => {
    const p = path.join(dir, 'auth.json');
    fs.writeFileSync(p, body);
    return p;
};

beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-auth-'));
});
afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
    vi.restoreAllMocks();
});

describe('readCodexAuth', () => {
    it('absent file → not present', () => {
        expect(readCodexAuth(path.join(dir, 'auth.json'))).toEqual({ present: false, class: null, expiresAt: null });
    });

    it('oauth tokens → subscription, latest exp wins', () => {
        const p = write(JSON.stringify({ tokens: { id_token: jwt({ exp: 100 }), access_token: jwt({ exp: 300 }), refresh_token: 'r' } }));
        expect(readCodexAuth(p)).toEqual({ present: true, class: 'cli-subscription', expiresAt: 300 });
    });

    it('api key only → metered; millisecond expiry is normalised', () => {
        const p = write(JSON.stringify({ OPENAI_API_KEY: 'sk-x', expires_at: 2_000_000_000_000 }));
        expect(readCodexAuth(p)).toEqual({ present: true, class: 'cli-api-key', expiresAt: 2_000_000_000 });
    });

    it('malformed file → over-gated (metered), never a subscription', () => {
        expect(readCodexAuth(write('{not json'))).toEqual({ present: true, class: 'cli-api-key', expiresAt: null });
        expect(readCodexAuth(write('[]'))).toEqual({ present: true, class: 'cli-api-key', expiresAt: null });
    });

    it('no field value leaves the module, nothing is logged', () => {
        const spies = (['log', 'info', 'warn', 'error', 'debug'] as const).map((m) => vi.spyOn(console, m));
        const secret = 'SECRET-TOKEN-VALUE';
        const p = write(JSON.stringify({ tokens: { access_token: secret, account_id: 'acct-123' }, OPENAI_API_KEY: secret }));
        const verdict = readCodexAuth(p);
        expect(Object.keys(verdict).sort()).toEqual(['class', 'expiresAt', 'present']);
        expect(JSON.stringify(verdict)).not.toContain(secret);
        expect(JSON.stringify(verdict)).not.toContain('acct-123');
        for (const s of spies) expect(s).not.toHaveBeenCalled();
    });
});
