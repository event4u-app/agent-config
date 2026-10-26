import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import Fastify from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

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

    it('POST refuses a body without a boolean', async () => {
        const r = await (await app()).inject({ method: 'POST', url: '/api/v1/wizard/statusline', payload: { install: 'yes' } });
        expect(r.statusCode).toBe(400);
    });
});
