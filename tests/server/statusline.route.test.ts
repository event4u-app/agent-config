import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import Fastify from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { uninstallTap } from '../../src/scripts/_cli/cmd_statusline.js';
import { applyOffer, readOffer, statuslineRoute } from '../../src/server/routes/statusline.js';

let home: string;
let env: Record<string, string>;
const settingsFile = (): string => path.join(home, '.claude', 'settings.json');

beforeEach(() => {
    home = fs.mkdtempSync(path.join(os.tmpdir(), 'statusline-route-'));
    env = { EVENT4U_CONFIG_HOME: path.join(home, 'ac'), CLAUDE_CONFIG_DIR: path.join(home, '.claude') };
});
afterEach(() => fs.rmSync(home, { recursive: true, force: true }));

describe('the statusline offer', () => {
    it('is offered on a machine that has neither the tap nor a recorded answer', () => {
        expect(readOffer(env)).toEqual({ state: 'offer', settings_path: settingsFile(), has_existing: false });
    });

    it('names an existing status line that will stay chained', () => {
        fs.mkdirSync(path.dirname(settingsFile()), { recursive: true });
        fs.writeFileSync(settingsFile(), JSON.stringify({ statusLine: { type: 'command', command: 'mine' } }));
        expect(readOffer(env).has_existing).toBe(true);
    });

    it('a yes installs the tap and the offer is not made again', () => {
        expect(applyOffer(true, env).ok).toBe(true);
        expect(JSON.parse(fs.readFileSync(settingsFile(), 'utf-8')).statusLine.command).toBe('agent-config statusline:tap');
        expect(readOffer(env).state).toBe('installed');
    });

    it('an accepted offer is not made again after the tap is uninstalled', () => {
        expect(applyOffer(true, env).ok).toBe(true);
        expect(uninstallTap(env).code).toBe(0);
        expect(readOffer(env).state).toBe('accepted');
    });

    it('an answer that cannot be recorded installs nothing and reports failure', async () => {
        const quotaDir = path.join(home, 'ac', 'state', 'quota');
        fs.mkdirSync(quotaDir, { recursive: true });
        fs.chmodSync(quotaDir, 0o500);
        try {
            expect(() => applyOffer(true, env)).toThrow();
            expect(fs.existsSync(settingsFile())).toBe(false);
            const a = Fastify();
            await a.register(statuslineRoute({ env }));
            const r = await a.inject({ method: 'POST', url: '/api/v1/wizard/statusline', payload: { install: true } });
            expect(r.statusCode).toBe(500);
            expect(r.json()).toMatchObject({ ok: false });
            expect(fs.existsSync(settingsFile())).toBe(false);
        } finally {
            fs.chmodSync(quotaDir, 0o700);
        }
    });

    it('a failed install takes the recorded yes back, so the offer stays open', () => {
        fs.mkdirSync(path.dirname(settingsFile()), { recursive: true });
        fs.writeFileSync(settingsFile(), '{ broken');
        expect(applyOffer(true, env).ok).toBe(false);
        expect(readOffer(env).state).toBe('offer');
    });

    it('an install that throws takes the recorded yes back too', () => {
        // installTap records the user's original status line first; a directory
        // in that place makes it throw rather than return a failure code.
        fs.mkdirSync(path.join(home, 'ac', 'state', 'quota', 'statusline-original.json'), { recursive: true });
        expect(() => applyOffer(true, env)).toThrow();
        expect(readOffer(env).state).toBe('offer');
    });

    it('a record that fails half-way leaves no answer: the offer stays open and a later answer succeeds', () => {
        const failing = (file: string, data: string): void => {
            fs.writeFileSync(file, data.slice(0, 5));
            throw new Error('disk full');
        };
        expect(() => applyOffer(true, env, { write: failing })).toThrow(/disk full/);
        expect(() => applyOffer(false, env, { write: failing })).toThrow(/disk full/);
        expect(fs.existsSync(settingsFile())).toBe(false);
        expect(readOffer(env).state).toBe('offer');
        expect(fs.readdirSync(path.join(home, 'ac', 'state', 'quota'))).toEqual([]);
        expect(applyOffer(false, env).ok).toBe(true);
        expect(readOffer(env).state).toBe('declined');
    });

    it('a failed install whose yes cannot be taken back says so and names the command', () => {
        fs.mkdirSync(path.dirname(settingsFile()), { recursive: true });
        fs.writeFileSync(settingsFile(), '{ broken');
        const r = applyOffer(true, env, { remove: () => { throw new Error('EACCES'); } });
        expect(r.ok).toBe(false);
        expect(r.message).toMatch(/yes is recorded but the tap was not added.*statusline:install/);
        expect(readOffer(env).state).toBe('accepted');
    });

    it('a recorded yes already gone before the take-back is not reported as stuck', () => {
        fs.mkdirSync(path.dirname(settingsFile()), { recursive: true });
        fs.writeFileSync(settingsFile(), '{ broken');
        const offer = path.join(home, 'ac', 'state', 'quota', 'statusline-offer.json');
        const r = applyOffer(true, env, { remove: (f) => { if (f.endsWith('.tmp')) { fs.rmSync(f); fs.rmSync(offer); } } });
        expect(r.ok).toBe(false);
        expect(r.message).not.toMatch(/yes is recorded|answered elsewhere/);
        expect(readOffer(env).state).toBe('offer');
    });

    // The foreign answer is in place before takeBack reads it; a swap between its read and its remove is not covered.
    it('an answer with another token is left alone and named, never reported as our stuck yes', () => {
        fs.mkdirSync(path.dirname(settingsFile()), { recursive: true });
        fs.writeFileSync(settingsFile(), '{ broken');
        const offer = path.join(home, 'ac', 'state', 'quota', 'statusline-offer.json');
        const swap = (f: string): void => {
            fs.rmSync(f);
            if (f.endsWith('.tmp')) fs.writeFileSync(offer, JSON.stringify({ decision: 'declined', token: 'someone-else' }));
        };
        fs.rmSync(offer, { force: true });
        const r = applyOffer(true, env, { remove: swap, write: (f, d) => fs.writeFileSync(f, d) });
        expect(r.ok).toBe(false);
        expect(r.message).toMatch(/answered elsewhere/);
        expect(r.message).not.toMatch(/yes is recorded/);
        expect(readOffer(env).state).toBe('declined');
    });

    it('a temporary file that cannot be cleaned up does not undo a recorded answer', () => {
        const stuck = { remove: (file: string): void => { if (file.endsWith('.tmp')) throw new Error('EBUSY'); fs.rmSync(file, { force: true }); } };
        expect(applyOffer(true, env, stuck).ok).toBe(true);
        expect(readOffer(env).state).toBe('installed');
    });

    it('an unreadable answer is never read as no answer: the offer is not made', () => {
        fs.mkdirSync(path.join(home, 'ac', 'state', 'quota'), { recursive: true });
        fs.writeFileSync(path.join(home, 'ac', 'state', 'quota', 'statusline-offer.json'), 'not json');
        expect(readOffer(env).state).toBe('declined');
    });

    it('a no writes nothing to the host settings and is remembered', () => {
        expect(applyOffer(false, env).ok).toBe(true);
        expect(fs.existsSync(settingsFile())).toBe(false);
        expect(readOffer(env).state).toBe('declined');
    });
});

describe('the route', () => {
    const app = async (dryRun = false) => {
        const a = Fastify();
        await a.register(statuslineRoute({ dryRun, env }));
        return a;
    };

    it('GET reports the offer', async () => {
        const r = await (await app()).inject({ method: 'GET', url: '/api/v1/wizard/statusline' });
        expect(r.statusCode).toBe(200);
        expect(r.json().state).toBe('offer');
    });

    it('POST applies the answer; a dry run writes nothing', async () => {
        const dry = await (await app(true)).inject({ method: 'POST', url: '/api/v1/wizard/statusline', payload: { install: true } });
        expect(dry.json().message).toMatch(/Dry-run/);
        expect(fs.existsSync(settingsFile())).toBe(false);
        const real = await (await app()).inject({ method: 'POST', url: '/api/v1/wizard/statusline', payload: { install: true } });
        expect(real.statusCode).toBe(200);
        expect(fs.existsSync(settingsFile())).toBe(true);
    });

    it('a dry run records no answer either way, and says so', async () => {
        for (const install of [true, false]) {
            const r = await (await app(true)).inject({ method: 'POST', url: '/api/v1/wizard/statusline', payload: { install } });
            expect(r.json()).toMatchObject({ ok: true, dryRun: true });
        }
        expect(fs.existsSync(settingsFile())).toBe(false);
        expect(readOffer(env).state).toBe('offer');
    });

    it('POST answers once: a second answer is refused and changes nothing', async () => {
        const a = await app();
        expect((await a.inject({ method: 'POST', url: '/api/v1/wizard/statusline', payload: { install: false } })).statusCode).toBe(200);
        const again = await a.inject({ method: 'POST', url: '/api/v1/wizard/statusline', payload: { install: true } });
        expect(again.statusCode).toBe(409);
        expect(fs.existsSync(settingsFile())).toBe(false);
        expect(readOffer(env).state).toBe('declined');
    });

    it('two answers at once: exactly one is taken, the other is refused', async () => {
        const a = await app();
        const [x, y] = await Promise.all([
            a.inject({ method: 'POST', url: '/api/v1/wizard/statusline', payload: { install: false } }),
            a.inject({ method: 'POST', url: '/api/v1/wizard/statusline', payload: { install: true } }),
        ]);
        expect([x.statusCode, y.statusCode].sort()).toEqual([200, 409]);
        const state = readOffer(env).state;
        expect(state === 'declined' ? !fs.existsSync(settingsFile()) : state === 'installed').toBe(true);
    });

    it('an answer already on disk is not overwritten by applyOffer', () => {
        expect(applyOffer(false, env).ok).toBe(true);
        expect(() => applyOffer(true, env)).toThrow(/already answered/);
        expect(fs.existsSync(settingsFile())).toBe(false);
        expect(readOffer(env).state).toBe('declined');
    });

    it('an answer file with an unknown decision counts as answered', () => {
        fs.mkdirSync(path.join(home, 'ac', 'state', 'quota'), { recursive: true });
        fs.writeFileSync(path.join(home, 'ac', 'state', 'quota', 'statusline-offer.json'), JSON.stringify({ decision: 'maybe' }));
        expect(readOffer(env).state).toBe('declined');
    });

    it('POST refuses a body without a boolean', async () => {
        const r = await (await app()).inject({ method: 'POST', url: '/api/v1/wizard/statusline', payload: { install: 'yes' } });
        expect(r.statusCode).toBe(400);
    });
});
