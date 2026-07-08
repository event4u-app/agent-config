/**
 * Package-sandbox user-global read fallback
 * (road-to-setup-experience follow-up).
 *
 * When the GUI runs inside the package repo (worktree/local testing), the
 * REAL user-global config seeds reads — name, IDE, installed packs — so a
 * dry-run behaves like a consumer machine. Writes still land in the
 * sandbox. `EVENT4U_CONFIG_HOME` points the layer at a fixture here so
 * the test never touches the developer's actual `~/.event4u`.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import type { FastifyInstance } from 'fastify';
import { createApp } from '../../src/server/app.js';

const PORT = 41790;
const TOKEN = 'x'.repeat(64);

let userGlobal: string;
let sandbox: string;
let uiDir: string;
let lockDir: string;
let app: FastifyInstance;
const savedEnv: Record<string, string | undefined> = {};

function authHeaders(): Record<string, string> {
    return { host: `127.0.0.1:${PORT}`, authorization: `Bearer ${TOKEN}` };
}

beforeEach(async () => {
    // Fixture user-global config — the "real machine" state.
    userGlobal = mkdtempSync(join(tmpdir(), 'agent-config-userglobal-'));
    mkdirSync(join(userGlobal, 'settings'), { recursive: true });
    writeFileSync(
        join(userGlobal, 'settings', '.agent-settings.yml'),
        'rule_loading_tier: balanced\npersonal:\n  ide: phpstorm\npacks:\n  - php\n  - laravel\n',
        { mode: 0o600 },
    );
    writeFileSync(
        join(userGlobal, 'settings', '.agent-user.yml'),
        [
            'version: 1',
            'identity:',
            '  name: Matze',
            'language: de',
            'role:',
            '  - founder',
            'style:',
            '  pace: pragmatic',
            'voice_sample: |',
            '  Mach das einfach.',
            'last_updated: "2026-07-08"',
            '',
        ].join('\n'),
        { mode: 0o600 },
    );
    savedEnv['EVENT4U_CONFIG_HOME'] = process.env['EVENT4U_CONFIG_HOME'];
    process.env['EVENT4U_CONFIG_HOME'] = userGlobal;
    // Isolate the wizard lockfile too (manifest unions it).
    lockDir = mkdtempSync(join(tmpdir(), 'agent-config-lock-'));
    savedEnv['AGENT_CONFIG_WIZARD_TOOLS'] = process.env['AGENT_CONFIG_WIZARD_TOOLS'];
    process.env['AGENT_CONFIG_WIZARD_TOOLS'] = join(lockDir, 'wizard-tools.json');

    // Empty sandbox — the interesting case: nothing written yet.
    sandbox = mkdtempSync(join(tmpdir(), 'agent-config-sandbox-'));
    uiDir = mkdtempSync(join(tmpdir(), 'agent-config-ui-'));
    writeFileSync(join(uiDir, 'index.html'), '<!doctype html><html><body>ok</body></html>');

    app = await createApp({
        writeRoot: sandbox,
        projectRoot: sandbox,
        mode: 'package-sandbox',
        packageRoot: resolve(process.cwd()),
        uiDistDir: uiDir,
        token: TOKEN,
        expectedPort: PORT,
        logLevel: 'fatal',
        skipReplay: true,
        dryRun: true,
        extendedSteps: true,
    });
    await app.ready();
});

afterEach(async () => {
    await app.close();
    for (const key of ['EVENT4U_CONFIG_HOME', 'AGENT_CONFIG_WIZARD_TOOLS']) {
        if (savedEnv[key] === undefined) delete process.env[key];
        else process.env[key] = savedEnv[key];
    }
    for (const dir of [userGlobal, sandbox, uiDir, lockDir]) rmSync(dir, { recursive: true, force: true });
});

describe('package-sandbox user-global read fallback', () => {
    it('GET /settings merges the user-global layer (IDE prefill)', async () => {
        const res = await app.inject({ method: 'GET', url: '/api/v1/settings', headers: authHeaders() });
        expect(res.statusCode).toBe(200);
        const body = res.json() as { values: { personal?: { ide?: string } }; sources: { global: string[] } };
        expect(body.values.personal?.ide).toBe('phpstorm');
        expect(body.sources.global).toContain('personal.ide');
    });

    it('GET /user-md falls back to the user-global identity (name prefill)', async () => {
        const res = await app.inject({ method: 'GET', url: '/api/v1/user-md', headers: authHeaders() });
        expect(res.statusCode).toBe(200);
        const body = res.json() as { exists: boolean; identity: { identity?: { name?: string }; role?: string[] } | null };
        expect(body.exists).toBe(true);
        expect(body.identity?.identity?.name).toBe('Matze');
        expect(body.identity?.role).toEqual(['founder']);
    });

    it('manifest installedPacks includes the user-global packs', async () => {
        const res = await app.inject({ method: 'GET', url: '/api/v1/wizard/manifest', headers: authHeaders() });
        expect(res.statusCode).toBe(200);
        const body = res.json() as { installedPacks: string[] };
        expect(body.installedPacks).toEqual(['laravel', 'php']);
    });

    it('a sandbox file still overrides the user-global layer', async () => {
        mkdirSync(join(sandbox, 'settings'), { recursive: true });
        writeFileSync(
            join(sandbox, 'settings', '.agent-settings.yml'),
            'personal:\n  ide: vscode\n',
            { mode: 0o600 },
        );
        const res = await app.inject({ method: 'GET', url: '/api/v1/settings', headers: authHeaders() });
        expect(res.statusCode).toBe(200);
        expect((res.json() as { values: { personal?: { ide?: string } } }).values.personal?.ide).toBe('vscode');
    });
});
