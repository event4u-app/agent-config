/**
 * The settings route and the three `git.*` keys.
 *
 * In global mode the route writes the user-global file, and the settings
 * loader discards `git.*` keys from that file, so a form that offered them
 * would save a value that has no effect anywhere. The route withholds them
 * there and refuses a non-default value; in every mode it runs the same value
 * and pattern check `git:convention show` and `settings:check` run.
 */
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { load_agent_settings } from '../../src/scripts/_lib/agent_settings.js';
import { TEMPLATE_PLACEHOLDER_DEFAULTS, parseYaml } from '../../src/server/io/yamlIO.js';
import { carveOutKeys } from '../../src/shared/settingsCarveOut.js';

import { authHeaders, bootTestApp, fixtureSettings, type TestApp } from './helpers.js';

const PORT = 41711;

interface SettingsGet {
    values: Record<string, unknown>;
    lastModified: number;
    schema: { properties?: Record<string, unknown> };
    withheld?: { keys: string[]; reason: string };
}
interface ErrorBody {
    error: { code: string; fields?: Array<{ path: string; message: string }> };
}

let home: string;
let savedHome: string | undefined;
beforeEach(() => {
    savedHome = process.env['EVENT4U_CONFIG_HOME'];
    home = mkdtempSync(join(tmpdir(), 'git-keys-home-'));
    process.env['EVENT4U_CONFIG_HOME'] = home;
});
afterEach(() => {
    if (savedHome === undefined) delete process.env['EVENT4U_CONFIG_HOME'];
    else process.env['EVENT4U_CONFIG_HOME'] = savedHome;
    rmSync(home, { recursive: true, force: true });
});

async function get(ctx: TestApp): Promise<SettingsGet> {
    const res = await ctx.app.inject({ method: 'GET', url: '/api/v1/settings', headers: authHeaders(ctx.token, ctx.host) });
    expect(res.statusCode).toBe(200);
    return res.json() as SettingsGet;
}

async function put(ctx: TestApp, git: Record<string, string>): Promise<{ status: number; body: unknown }> {
    const { lastModified } = await get(ctx);
    const base = fixtureSettings();
    const res = await ctx.app.inject({
        method: 'PUT',
        url: '/api/v1/settings',
        headers: { ...authHeaders(ctx.token, ctx.host), 'content-type': 'application/json', 'if-unmodified-since': String(lastModified + 5) },
        payload: { values: { ...base, git: { ...(base['git'] as Record<string, string>), ...git } }, confirmGuarded: true },
    });
    return { status: res.statusCode, body: res.json() };
}

/** The user-global file as the settings loader resolves it, with no other layer and no template defaults. */
function readBack(file: string): Record<string, unknown> {
    const none = join(home, 'absent.yml');
    return load_agent_settings({ user_global_path: file, project_path: none, template_path: none });
}

/** The template seeded by `bootTestApp`, without its `git:` section: a file written before the keys existed. */
function withoutGitSection(body: string): string {
    const out = body.replace(/^git:\n[\s\S]*?\n(?=# --- GitHub)/m, '');
    expect(out).not.toMatch(/^git:/m);
    return out;
}

/**
 * Save exactly what the form was shown, with no guarded-key confirmation. The
 * seeded file gets its installer placeholders filled first, as an installed file
 * has them, so the round trip validates.
 */
async function saveShown(ctx: TestApp): Promise<{ diff: unknown; status: number; body: string }> {
    const file = join(ctx.projectRoot, 'settings', '.agent-settings.yml');
    let body = readFileSync(file, 'utf8');
    for (const [placeholder, value] of Object.entries(TEMPLATE_PLACEHOLDER_DEFAULTS)) body = body.replaceAll(placeholder, value);
    writeFileSync(file, body);
    const shown = await get(ctx);
    const diff = await ctx.app.inject({
        method: 'POST',
        url: '/api/v1/settings/diff',
        headers: { ...authHeaders(ctx.token, ctx.host), 'content-type': 'application/json' },
        payload: { values: shown.values },
    });
    expect(diff.statusCode, diff.body).toBe(200);
    const res = await ctx.app.inject({
        method: 'PUT',
        url: '/api/v1/settings',
        headers: { ...authHeaders(ctx.token, ctx.host), 'content-type': 'application/json', 'if-unmodified-since': String(shown.lastModified + 5) },
        payload: { values: shown.values },
    });
    return { diff: diff.json(), status: res.statusCode, body: res.body };
}

describe('global mode — the write root is the user-global layer', () => {
    let ctx: TestApp;
    beforeEach(async () => {
        ctx = await bootTestApp({ port: PORT });
    });
    afterEach(async () => {
        await ctx.cleanup();
    });

    it('does not offer the three keys, and says why', async () => {
        const body = await get(ctx);
        expect(body.values).not.toHaveProperty('git');
        expect(body.schema.properties).not.toHaveProperty('git');
        expect(body.withheld?.keys).toEqual(['git.commit_format', 'git.branch_pattern', 'git.update_strategy']);
        expect(body.withheld?.reason).toContain('.git-convention.yml');
    });

    it('refuses a value the user-global file would drop', async () => {
        const r = await put(ctx, { update_strategy: 'rebase' });
        expect(r.status).toBe(422);
        const fields = (r.body as ErrorBody).error.fields ?? [];
        expect(fields.map((f) => f.path)).toEqual(['git.update_strategy']);
        expect(fields[0]?.message).toContain('.git-convention.yml');
    });

    it('accepts the template defaults a form round-trips', async () => {
        expect((await put(ctx, {})).status).toBe(200);
    });

    it('leaves a git value already in the user-global file alone: neither guarded nor reset', async () => {
        const file = join(ctx.projectRoot, 'settings', '.agent-settings.yml');
        writeFileSync(file, readFileSync(file, 'utf8').replace(/^(\s+update_strategy:) merge$/m, '$1 rebase'));
        expect(readFileSync(file, 'utf8')).toMatch(/^\s+update_strategy: rebase$/m);

        const shown = await get(ctx);
        expect(shown.values).not.toHaveProperty('git');
        // What the form submits: every offered section, no git.
        const { git: _withheld, ...form } = fixtureSettings();
        const save = (values: Record<string, unknown>, confirmGuarded: boolean) =>
            ctx.app.inject({
                method: 'PUT',
                url: '/api/v1/settings',
                headers: { ...authHeaders(ctx.token, ctx.host), 'content-type': 'application/json', 'if-unmodified-since': String(shown.lastModified + 5) },
                payload: { values, confirmGuarded },
            });
        const diff = await ctx.app.inject({
            method: 'POST',
            url: '/api/v1/settings/diff',
            headers: { ...authHeaders(ctx.token, ctx.host), 'content-type': 'application/json' },
            payload: { values: form },
        });
        expect(diff.statusCode, diff.body).toBe(200);
        expect(JSON.stringify(diff.json())).not.toContain('git.');

        // The fixture differs from the seeded template in unrelated guarded keys;
        // none of the confirmation it asks for may name a git key.
        const gated = await save(form, false);
        expect(JSON.stringify(gated.json())).not.toContain('git.');
        const res = await save(form, true);
        expect(res.statusCode, res.body).toBe(200);
        expect(readFileSync(file, 'utf8')).toMatch(/^\s+update_strategy: rebase$/m);
    });
    it('a user-global file without a git section: no git diff, no confirmation, none written', async () => {
        const file = join(ctx.projectRoot, 'settings', '.agent-settings.yml');
        writeFileSync(file, withoutGitSection(readFileSync(file, 'utf8')));
        const r = await saveShown(ctx);
        expect(JSON.stringify(r.diff)).not.toContain('git.');
        expect(r.status, r.body).toBe(200);
        expect(readFileSync(file, 'utf8')).not.toMatch(/^git:/m);
    });
});

describe('global mode with a project layer above the user-global file', () => {
    let ctx: TestApp;
    let project: string;
    beforeEach(async () => {
        project = mkdtempSync(join(tmpdir(), 'git-keys-project-'));
        mkdirSync(join(project, 'settings'), { recursive: true });
        writeFileSync(join(project, 'settings', '.agent-settings.yml'), 'git:\n  update_strategy: rebase\n');
        ctx = await bootTestApp({ port: PORT + 2, legacyReadRoot: project });
    });
    afterEach(async () => {
        await ctx.cleanup();
        rmSync(project, { recursive: true, force: true });
    });

    it('writes only the git section the user-global file holds, never a project value', async () => {
        const file = join(ctx.projectRoot, 'settings', '.agent-settings.yml');
        expect(readFileSync(file, 'utf8')).toMatch(/^\s+update_strategy: merge$/m);
        const shown = await get(ctx);
        const { git: _withheld, ...form } = fixtureSettings();
        const res = await ctx.app.inject({
            method: 'PUT',
            url: '/api/v1/settings',
            headers: { ...authHeaders(ctx.token, ctx.host), 'content-type': 'application/json', 'if-unmodified-since': String(shown.lastModified + 5) },
            payload: { values: form, confirmGuarded: true },
        });
        expect(res.statusCode, res.body).toBe(200);
        expect(readFileSync(file, 'utf8')).toMatch(/^\s+update_strategy: merge$/m);
        expect(readFileSync(file, 'utf8')).not.toMatch(/update_strategy: rebase/);
    });
    it('a project git value is not a change to the user-global file: no git diff, no confirmation', async () => {
        const r = await saveShown(ctx);
        expect(JSON.stringify(r.diff)).not.toContain('git.');
        expect(r.status, r.body).toBe(200);
    });

    it('an absent user-global file is written as a fresh file, never from the project file', async () => {
        const file = join(ctx.projectRoot, 'settings', '.agent-settings.yml');
        rmSync(file);
        const shown = await get(ctx);
        const { git: _withheld, ...form } = fixtureSettings();
        const res = await ctx.app.inject({
            method: 'PUT',
            url: '/api/v1/settings',
            headers: { ...authHeaders(ctx.token, ctx.host), 'content-type': 'application/json', 'if-unmodified-since': String(shown.lastModified + 5) },
            payload: { values: form, confirmGuarded: true },
        });
        expect(res.statusCode, res.body).toBe(200);
        const written = readFileSync(file, 'utf8');
        expect(written).not.toMatch(/update_strategy/);
        expect(written).not.toMatch(/^git:/m);
        // A value equal to its default is not written; it resolves through the template.
        const template = join(process.cwd(), 'src', 'config', 'agent-settings.template.yml');
        const resolved = load_agent_settings({ user_global_path: file, project_path: join(home, 'absent.yml'), template_path: template });
        expect(resolved['personal']).toMatchObject({ autonomy: (form['personal'] as Record<string, unknown>)['autonomy'] });
    });

    it('the first save into an absent user-global file is read back by the settings loader', async () => {
        const file = join(ctx.projectRoot, 'settings', '.agent-settings.yml');
        rmSync(file);
        const shown = await get(ctx);
        const { git: _withheld, ...rest } = fixtureSettings();
        const form = { ...rest, personal: { ...(rest['personal'] as Record<string, unknown>), autonomy: 'on' } };
        const res = await ctx.app.inject({
            method: 'PUT',
            url: '/api/v1/settings',
            headers: { ...authHeaders(ctx.token, ctx.host), 'content-type': 'application/json', 'if-unmodified-since': String(shown.lastModified + 5) },
            payload: { values: form, confirmGuarded: true },
        });
        expect(res.statusCode, res.body).toBe(200);
        const written = readFileSync(file, 'utf8');
        expect(written).not.toMatch(/^[a-z_]+\.[a-z_.]+:/m);
        expect(written).not.toMatch(/^git:/m);
        expect((readBack(file)['personal'] as Record<string, unknown>)['autonomy']).toBe('on');
        expect(readBack(file)['git']).toBeUndefined();
    });

    it('the first save into an absent user-global file records decisions, never a copy of the defaults', async () => {
        const file = join(ctx.projectRoot, 'settings', '.agent-settings.yml');
        rmSync(file);
        const shown = await get(ctx);
        const { git: _withheld, ...rest } = shown.values;
        const form = { ...rest, personal: { ...(rest['personal'] as Record<string, unknown>), autonomy: 'on' } };
        const res = await ctx.app.inject({
            method: 'PUT',
            url: '/api/v1/settings',
            headers: { ...authHeaders(ctx.token, ctx.host), 'content-type': 'application/json', 'if-unmodified-since': String(shown.lastModified + 5) },
            payload: { values: form, confirmGuarded: true },
        });
        expect(res.statusCode, res.body).toBe(200);
        const leaves = (o: unknown, at = ''): string[] =>
            o !== null && typeof o === 'object' && !Array.isArray(o)
                ? Object.entries(o as Record<string, unknown>).flatMap(([k, v]) => leaves(v, at === '' ? k : `${at}.${k}`))
                : [at];
        const allowed = new Set([...carveOutKeys(), 'personal.autonomy']);
        const written = leaves(parseYaml(readFileSync(file, 'utf8')));
        expect(written).toContain('personal.autonomy');
        expect(written.filter((k) => !allowed.has(k))).toEqual([]);
    });

    it('a user-global file without a git section stays without one under a project git value', async () => {
        const file = join(ctx.projectRoot, 'settings', '.agent-settings.yml');
        writeFileSync(file, withoutGitSection(readFileSync(file, 'utf8')));
        const r = await saveShown(ctx);
        expect(JSON.stringify(r.diff)).not.toContain('git.');
        expect(r.status, r.body).toBe(200);
        expect(readFileSync(file, 'utf8')).not.toMatch(/^git:/m);
    });
});

describe('package-sandbox mode — the write root is the project layer', () => {
    let ctx: TestApp;
    beforeEach(async () => {
        ctx = await bootTestApp({ port: PORT + 1, mode: 'package-sandbox' });
    });
    afterEach(async () => {
        await ctx.cleanup();
    });

    it('offers the keys and saves a valid value', async () => {
        const body = await get(ctx);
        expect(body.values).toHaveProperty('git');
        expect(body.withheld).toBeUndefined();
        expect((await put(ctx, { update_strategy: 'rebase' })).status).toBe(200);
    });

    it('runs the branch-pattern check the reader runs', async () => {
        const r = await put(ctx, { branch_pattern: '{type}/$(id)-{slug}' });
        expect(r.status).toBe(422);
        const fields = (r.body as ErrorBody).error.fields ?? [];
        expect(fields.map((f) => f.path)).toEqual(['git.branch_pattern']);
        expect(fields[0]?.message).toContain('outside [A-Za-z0-9._/-]');
    });

    it('refuses a value with surrounding whitespace instead of trimming it into validity', async () => {
        const r = await put(ctx, { branch_pattern: ' {type}/{slug} ' });
        expect(r.status).toBe(422);
        expect((r.body as ErrorBody).error.fields?.[0]?.message).toContain('whitespace');
    });

    it('refuses a pattern without {slug}', async () => {
        const r = await put(ctx, { branch_pattern: '{type}/{ticket}' });
        expect(r.status).toBe(422);
        expect((r.body as ErrorBody).error.fields?.[0]?.message).toContain('{slug}');
    });
});
