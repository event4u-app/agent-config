/**
 * /api/v1/settings/changes — pending settings-surface delta routes
 * (road-to-settings-change-review).
 *
 * The delta file is written by the installer (`state/settings-delta.json`
 * under the global root = the server writeRoot in tests); the server only
 * serves and clears it. Classification lives client-side in the shared
 * module (covered by tests/shared/settingsSurface.test.ts).
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { bootTestApp, authHeaders, type TestApp } from './helpers.js';
import type { SurfaceDelta } from '../../src/shared/settingsSurface.js';

const PORT = 41955;

function fixtureDelta(): SurfaceDelta {
    return {
        oldVersion: '8.3.0',
        newVersion: '8.4.0',
        changes: [
            {
                key: 'personal.autonomy',
                kind: 'default_changed',
                old: { type: 'string', default: 'auto', enum: ['auto', 'on', 'off'] },
                new: { type: 'string', default: 'on', enum: ['auto', 'on', 'off'] },
            },
            {
                key: 'discipline_profile',
                kind: 'added',
                new: { type: 'string', default: 'auto', enum: ['auto', 'off', 'essential', 'full'] },
            },
        ],
    };
}

function writeDelta(root: string, delta: SurfaceDelta = fixtureDelta()): string {
    const dir = join(root, 'state');
    mkdirSync(dir, { recursive: true });
    const pth = join(dir, 'settings-delta.json');
    writeFileSync(pth, JSON.stringify(delta, null, 2));
    return pth;
}

describe('GET /api/v1/settings/changes', () => {
    let t: TestApp;
    beforeEach(async () => { t = await bootTestApp({ port: PORT }); });
    afterEach(async () => { await t.cleanup(); });

    it('404s with NO_PENDING_CHANGES when no delta file exists', async () => {
        const res = await t.app.inject({
            method: 'GET',
            url: '/api/v1/settings/changes',
            headers: authHeaders(t.token, t.host),
        });
        expect(res.statusCode).toBe(404);
        expect(res.json().error.code).toBe('NO_PENDING_CHANGES');
    });

    it('serves the pending delta from the writeRoot', async () => {
        writeDelta(t.projectRoot);
        const res = await t.app.inject({
            method: 'GET',
            url: '/api/v1/settings/changes',
            headers: authHeaders(t.token, t.host),
        });
        expect(res.statusCode).toBe(200);
        const body = res.json() as { delta: SurfaceDelta; source: string };
        expect(body.source).toBe('writeRoot');
        expect(body.delta.oldVersion).toBe('8.3.0');
        expect(body.delta.changes).toHaveLength(2);
        expect(body.delta.changes.map((c) => `${c.key}:${c.kind}`)).toEqual([
            'personal.autonomy:default_changed',
            'discipline_profile:added',
        ]);
    });

    it('treats a malformed delta file as no pending changes', async () => {
        const dir = join(t.projectRoot, 'state');
        mkdirSync(dir, { recursive: true });
        writeFileSync(join(dir, 'settings-delta.json'), '{not json');
        const res = await t.app.inject({
            method: 'GET',
            url: '/api/v1/settings/changes',
            headers: authHeaders(t.token, t.host),
        });
        expect(res.statusCode).toBe(404);
    });
});

describe('POST /api/v1/settings/changes/ack', () => {
    let t: TestApp;
    beforeEach(async () => { t = await bootTestApp({ port: PORT }); });
    afterEach(async () => { await t.cleanup(); });

    it('deletes the pending delta and subsequent GET 404s', async () => {
        const pth = writeDelta(t.projectRoot);
        const ack = await t.app.inject({
            method: 'POST',
            url: '/api/v1/settings/changes/ack',
            headers: authHeaders(t.token, t.host),
        });
        expect(ack.statusCode).toBe(200);
        expect(ack.json()).toMatchObject({ ok: true, cleared: true });
        expect(existsSync(pth)).toBe(false);

        const after = await t.app.inject({
            method: 'GET',
            url: '/api/v1/settings/changes',
            headers: authHeaders(t.token, t.host),
        });
        expect(after.statusCode).toBe(404);
    });

    it('is idempotent — ack with nothing pending still succeeds', async () => {
        const res = await t.app.inject({
            method: 'POST',
            url: '/api/v1/settings/changes/ack',
            headers: authHeaders(t.token, t.host),
        });
        expect(res.statusCode).toBe(200);
        expect(res.json()).toMatchObject({ ok: true, cleared: false });
    });
});

describe('dry-run mode', () => {
    let t: TestApp;
    beforeEach(async () => { t = await bootTestApp({ port: PORT, dryRun: true }); });
    afterEach(async () => { await t.cleanup(); });

    it('ack never deletes the delta file in dry-run', async () => {
        const pth = writeDelta(t.projectRoot);
        const ack = await t.app.inject({
            method: 'POST',
            url: '/api/v1/settings/changes/ack',
            headers: authHeaders(t.token, t.host),
        });
        expect(ack.statusCode).toBe(200);
        expect(ack.json()).toMatchObject({ ok: true, dryRun: true, cleared: false });
        expect(existsSync(pth)).toBe(true);
    });
});
