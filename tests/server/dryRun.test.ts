/**
 * Phase 1.8 acceptance: dry-run mode — every write route returns a
 * `preview` payload and the disk is untouched. Contract:
 * `agents/roadmaps/onboarding-wizard-takeover.md` § Dry-run state contract.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { bootTestApp, authHeaders, fixtureSettings, settingsTemplate, type TestApp } from './helpers.js';

const PORT = 41610;

interface PingBody { ok: true; version: string; projectRoot: string; dryRun: boolean }
interface SettingsPutBody { dryRun: true; lastModified: number; preview: { path: string; body: string } }
interface UserMdPutBody { dryRun: true; lastModified: number | null; preview: { path: string; body: string } }
interface WizardStateBody { step: number; totalSteps: number; partial: Record<string, unknown>; startedAt: string | null }
interface WizardFinishBody { ok: true; dryRun: true; preview: { settingsYaml: string; userMd: string | null } }

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
        const settingsFile = join(ctx.projectRoot, '.agent-settings.yml');
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
        expect(body.preview.path).toBe('.agent-settings.yml');
        expect(body.preview.body).toMatch(/^cost_profile:\s*minimal\b/m);

        // Disk untouched — byte content + mtime preserved.
        expect(readFileSync(settingsFile, 'utf8')).toBe(before);
        expect(statSync(settingsFile).mtimeMs).toBe(beforeMtime);
    });

    it('PUT /api/v1/user-md returns preview and does not create the file', async () => {
        const userMdFile = join(ctx.projectRoot, '.agent-user.md');
        expect(existsSync(userMdFile)).toBe(false);

        const userMdBody = `---\nversion: 1\nidentity:\n  name: "Matze"\n---\n\n# Notes\nhi.\n`;
        const res = await ctx.app.inject({
            method: 'PUT', url: '/api/v1/user-md',
            headers: { ...authHeaders(ctx.token, ctx.host), 'content-type': 'application/json' },
            payload: { body: userMdBody },
        });
        expect(res.statusCode).toBe(200);
        const body = res.json() as UserMdPutBody;
        expect(body.dryRun).toBe(true);
        expect(body.preview.path).toBe('.agent-user.md');
        expect(body.preview.body).toBe(userMdBody);

        expect(existsSync(userMdFile)).toBe(false);
    });

    it('POST /api/v1/wizard/state stores in memory only and GET resumes from it', async () => {
        const stateFile = join(ctx.projectRoot, '.agent-config', 'wizard-state.json');
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
        const settingsFile = join(ctx.projectRoot, '.agent-settings.yml');
        const userMdFile = join(ctx.projectRoot, '.agent-user.md');
        const settingsBefore = readFileSync(settingsFile, 'utf8');
        expect(existsSync(userMdFile)).toBe(false);

        const userMdBody = `---\nversion: 1\nidentity:\n  name: "Matze"\n---\n\n# Notes\nbody.\n`;
        const res = await ctx.app.inject({
            method: 'POST', url: '/api/v1/wizard/finish',
            headers: { ...authHeaders(ctx.token, ctx.host), 'content-type': 'application/json' },
            payload: {
                settings: fixtureSettings({ cost_profile: 'minimal' }),
                userMd: userMdBody,
            },
        });
        expect(res.statusCode).toBe(200);
        const body = res.json() as WizardFinishBody;
        expect(body.dryRun).toBe(true);
        expect(body.preview.settingsYaml).toMatch(/^cost_profile:\s*minimal\b/m);
        expect(body.preview.userMd).toBe(userMdBody);

        // Disk untouched on both files.
        expect(readFileSync(settingsFile, 'utf8')).toBe(settingsBefore);
        expect(existsSync(userMdFile)).toBe(false);
        // 2PC marker dir should not contain any wizard-intent files.
        const intentDir = join(ctx.projectRoot, 'agents', 'state');
        const fs = await import('node:fs');
        const entries = fs.existsSync(intentDir) ? fs.readdirSync(intentDir) : [];
        expect(entries.filter((e) => e.startsWith('wizard-intent-'))).toHaveLength(0);
    });

    it('settings template fixture is reachable (sanity)', () => {
        expect(settingsTemplate().length).toBeGreaterThan(0);
    });
});
