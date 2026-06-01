/**
 * Phase 2.2 — three-layer settings merge (defaults < global < project).
 *
 * Mirrors the Python suite in `tests/test_install_scope_global_only.py`
 * so the Fastify `GET /api/v1/settings` reader and the Python
 * `read_layered_settings` helper produce the same effective tree.
 *
 * The default `helpers.ts::bootTestApp` collapses both layers onto a
 * single `projectRoot`; here we boot `createApp` directly with separate
 * `writeRoot` (global stand-in) and `legacyReadRoot` (project stand-in)
 * so the merge order is exercised end-to-end.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { FastifyInstance } from 'fastify';
import { createApp } from '../../src/server/app.js';
import { authHeaders } from './helpers.js';

const PORT = 41610;
const TOKEN = 'x'.repeat(64);
const HOST = `127.0.0.1:${PORT}`;

interface Ctx {
    app: FastifyInstance;
    globalRoot: string;
    projectRoot: string;
    uiDir: string;
    cleanup: () => Promise<void>;
}

async function bootLayered(opts: {
    seedGlobal?: string;
    seedProject?: string;
} = {}): Promise<Ctx> {
    const globalRoot = mkdtempSync(join(tmpdir(), 'agent-cfg-global-'));
    const projectRoot = mkdtempSync(join(tmpdir(), 'agent-cfg-project-'));
    const uiDir = mkdtempSync(join(tmpdir(), 'agent-cfg-ui-'));
    mkdirSync(join(globalRoot, 'state'), { recursive: true });
    mkdirSync(join(globalRoot, 'settings'), { recursive: true, mode: 0o700 });
    mkdirSync(join(projectRoot, 'settings'), { recursive: true, mode: 0o700 });
    writeFileSync(join(uiDir, 'index.html'), '<!doctype html><html><body>ok</body></html>');

    if (opts.seedGlobal !== undefined) {
        writeFileSync(
            join(globalRoot, 'settings', '.agent-settings.yml'),
            opts.seedGlobal,
            { mode: 0o600 },
        );
    }
    if (opts.seedProject !== undefined) {
        writeFileSync(
            join(projectRoot, 'settings', '.agent-settings.yml'),
            opts.seedProject,
            { mode: 0o600 },
        );
    }

    const app = await createApp({
        writeRoot: globalRoot,
        legacyReadRoot: projectRoot,
        uiDistDir: uiDir,
        token: TOKEN,
        expectedPort: PORT,
        logLevel: 'fatal',
        skipReplay: true,
    });
    await app.ready();

    const cleanup = async (): Promise<void> => {
        await app.close();
        rmSync(globalRoot, { recursive: true, force: true });
        rmSync(projectRoot, { recursive: true, force: true });
        rmSync(uiDir, { recursive: true, force: true });
    };
    return { app, globalRoot, projectRoot, uiDir, cleanup };
}

describe('GET /api/v1/settings — three-layer merge', () => {
    let ctx: Ctx;
    afterEach(async () => { await ctx.cleanup(); });

    it('returns 404 when neither global nor project file exists (defaults are not "installed")', async () => {
        ctx = await bootLayered({});
        const res = await ctx.app.inject({
            method: 'GET',
            url: '/api/v1/settings',
            headers: authHeaders(TOKEN, HOST),
        });
        expect(res.statusCode).toBe(404);
        expect((res.json() as { error: { code: string } }).error.code).toBe('NOT_FOUND');
    });

    it('global-only — defaults < global; defaults still leak through unset keys', async () => {
        ctx = await bootLayered({
            seedGlobal: 'rule_loading_tier: full\npersonal:\n  ide: cursor\n',
        });
        const res = await ctx.app.inject({
            method: 'GET',
            url: '/api/v1/settings',
            headers: authHeaders(TOKEN, HOST),
        });
        expect(res.statusCode).toBe(200);
        const body = res.json() as { values: Record<string, unknown> };
        expect(body.values.rule_loading_tier).toBe('full');
        const personal = body.values.personal as Record<string, unknown>;
        expect(personal.ide).toBe('cursor');
        // Defaults from the template survive — pull a stable scalar.
        expect(body.values).toHaveProperty('project');
    });

    it('project-only — defaults < project (legacy fallback when global is absent)', async () => {
        ctx = await bootLayered({
            seedProject: 'rule_loading_tier: minimal\npersonal:\n  ide: vscode\n',
        });
        const res = await ctx.app.inject({
            method: 'GET',
            url: '/api/v1/settings',
            headers: authHeaders(TOKEN, HOST),
        });
        expect(res.statusCode).toBe(200);
        const body = res.json() as { values: Record<string, unknown> };
        expect(body.values.rule_loading_tier).toBe('minimal');
        const personal = body.values.personal as Record<string, unknown>;
        expect(personal.ide).toBe('vscode');
    });

    it('both layers — project wins over global wins over defaults', async () => {
        ctx = await bootLayered({
            seedGlobal: 'rule_loading_tier: full\npersonal:\n  ide: cursor\n  pace: thorough\n',
            seedProject: 'rule_loading_tier: minimal\npersonal:\n  ide: phpstorm\n',
        });
        const res = await ctx.app.inject({
            method: 'GET',
            url: '/api/v1/settings',
            headers: authHeaders(TOKEN, HOST),
        });
        expect(res.statusCode).toBe(200);
        const body = res.json() as { values: Record<string, unknown> };
        // Project wins.
        expect(body.values.rule_loading_tier).toBe('minimal');
        const personal = body.values.personal as Record<string, unknown>;
        expect(personal.ide).toBe('phpstorm');
        // Global key untouched by project still leaks through.
        expect(personal.pace).toBe('thorough');
    });
});
