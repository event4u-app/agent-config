/**
 * Phase 1.8 acceptance: dry-run mode — every write route returns a
 * `preview` payload and the disk is untouched. Contract:
 * `agents/roadmaps/onboarding-wizard-takeover.md` § Dry-run state contract.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { bootTestApp, authHeaders, fixtureSettings, fixtureUserIdentity, settingsTemplate, type TestApp } from './helpers.js';

const PORT = 41610;

const SETTINGS_REL = join('settings', '.agent-settings.yml');
const USER_YML_REL = join('settings', '.agent-user.yml');

interface PingBody { ok: true; version: string; projectRoot: string; dryRun: boolean }
interface SettingsPutBody { dryRun: true; lastModified: number; preview: { path: string; body: string } }
interface UserMdPutBody { dryRun: true; lastModified: number | null; preview: { path: string; identity: Record<string, unknown>; body: string } }
interface WizardStateBody { step: number; totalSteps: number; partial: Record<string, unknown>; startedAt: string | null }
interface WizardFinishBody { ok: true; dryRun: true; preview: { settingsYaml: string; identity: Record<string, unknown> | null; userIdentityYaml: string | null } }

describe('dry-run mode', () => {
    let ctx: TestApp;

    beforeEach(async () => { ctx = await bootTestApp({ port: PORT, dryRun: true }); });
    afterEach(async () => { await ctx.cleanup(); });

    it('GET /api/v1/ping advertises dryRun=true', async () => {
        const res = await ctx.app.inject({
            method: 'GET', url: '/api/v1/ping', headers: authHeaders(ctx.token, ctx.host),
        });
        expect(res.statusCode).toBe(200);
        const body = res.json() as PingBody;
        expect(body.dryRun).toBe(true);
    });

    it('PUT /api/v1/settings returns preview and leaves the file byte-identical', async () => {
        const settingsFile = join(ctx.projectRoot, SETTINGS_REL);
        const before = readFileSync(settingsFile, 'utf8');
        const beforeMtime = statSync(settingsFile).mtimeMs;

        const get = await ctx.app.inject({
            method: 'GET', url: '/api/v1/settings', headers: authHeaders(ctx.token, ctx.host),
        });
        const lastModified = (get.json() as { lastModified: number }).lastModified;

        const res = await ctx.app.inject({
            method: 'PUT', url: '/api/v1/settings',
            headers: {
                ...authHeaders(ctx.token, ctx.host),
                'content-type': 'application/json',
                'if-unmodified-since': String(lastModified),
            },
            payload: { values: fixtureSettings({ cost_profile: 'minimal' }) },
        });
        expect(res.statusCode).toBe(200);
        const body = res.json() as SettingsPutBody;
        expect(body.dryRun).toBe(true);
        expect(body.preview.path).toBe(SETTINGS_REL);
        expect(body.preview.body).toMatch(/^cost_profile:\s*minimal\b/m);

        // Disk untouched — byte content + mtime preserved.
        expect(readFileSync(settingsFile, 'utf8')).toBe(before);
        expect(statSync(settingsFile).mtimeMs).toBe(beforeMtime);
    });

    it('PUT /api/v1/user-md returns preview and does not create the file', async () => {
        const userYmlFile = join(ctx.projectRoot, USER_YML_REL);
        expect(existsSync(userYmlFile)).toBe(false);

        const identity = fixtureUserIdentity();
        const res = await ctx.app.inject({
            method: 'PUT', url: '/api/v1/user-md',
            headers: { ...authHeaders(ctx.token, ctx.host), 'content-type': 'application/json' },
            payload: { identity },
        });
        expect(res.statusCode).toBe(200);
        const body = res.json() as UserMdPutBody;
        expect(body.dryRun).toBe(true);
        expect(body.preview.path).toBe(USER_YML_REL);
        expect(body.preview.identity).toEqual(identity);
        expect(body.preview.body).toMatch(/name:\s*Matze/);

        expect(existsSync(userYmlFile)).toBe(false);
    });

    it('POST /api/v1/wizard/state stores in memory only and GET resumes from it', async () => {
        const stateFile = join(ctx.projectRoot, 'state', 'wizard-state.json');
        expect(existsSync(stateFile)).toBe(false);

        const post = await ctx.app.inject({
            method: 'POST', url: '/api/v1/wizard/state',
            headers: { ...authHeaders(ctx.token, ctx.host), 'content-type': 'application/json' },
            payload: { step: 4, partial: { 'personal.user_name': 'Matze' } },
        });
        expect(post.statusCode).toBe(200);
        expect((post.json() as { dryRun: true }).dryRun).toBe(true);
        // No file on disk — in-memory only.
        expect(existsSync(stateFile)).toBe(false);

        const get = await ctx.app.inject({
            method: 'GET', url: '/api/v1/wizard/state', headers: authHeaders(ctx.token, ctx.host),
        });
        const body = get.json() as WizardStateBody;
        expect(body.step).toBe(4);
        expect(body.partial).toEqual({ 'personal.user_name': 'Matze' });
    });

    it('POST /api/v1/wizard/finish returns preview of both files and writes nothing', async () => {
        const settingsFile = join(ctx.projectRoot, SETTINGS_REL);
        const userYmlFile = join(ctx.projectRoot, USER_YML_REL);
        const settingsBefore = readFileSync(settingsFile, 'utf8');
        expect(existsSync(userYmlFile)).toBe(false);

        const identity = fixtureUserIdentity({ notes: 'body.' });
        const res = await ctx.app.inject({
            method: 'POST', url: '/api/v1/wizard/finish',
            headers: { ...authHeaders(ctx.token, ctx.host), 'content-type': 'application/json' },
            payload: {
                settings: fixtureSettings({ cost_profile: 'minimal' }),
                identity,
            },
        });
        expect(res.statusCode).toBe(200);
        const body = res.json() as WizardFinishBody;
        expect(body.dryRun).toBe(true);
        expect(body.preview.settingsYaml).toMatch(/^cost_profile:\s*minimal\b/m);
        expect(body.preview.identity).toEqual(identity);
        expect(body.preview.userIdentityYaml).toMatch(/name:\s*Matze/);

        // Disk untouched on both files.
        expect(readFileSync(settingsFile, 'utf8')).toBe(settingsBefore);
        expect(existsSync(userYmlFile)).toBe(false);
        // 2PC marker dir should not contain any wizard-intent files.
        const intentDir = join(ctx.projectRoot, 'state');
        const fs = await import('node:fs');
        const entries = fs.existsSync(intentDir) ? fs.readdirSync(intentDir) : [];
        expect(entries.filter((e) => e.startsWith('wizard-intent-'))).toHaveLength(0);
    });

    it('settings template fixture is reachable (sanity)', () => {
        expect(settingsTemplate().length).toBeGreaterThan(0);
    });
});
