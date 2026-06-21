/**
 * Phase B Step 4 of road-to-clean-skill-distribution-channels.
 *
 *   GET /api/v1/wizard/scope-guard → spawns scripts/_lib/scope_guard.sh and
 *                                    returns a structured verdict (OK/WARN/
 *                                    DRIFT) the wizard renders before the
 *                                    user picks an install scope.
 *
 *   - Extended-mode disabled → 404 (canonical 7-step contract untouched).
 *   - Extended-mode enabled  → 200 with parsed findings array.
 *
 * No real cross-scope state is exercised here (the guard runs against the
 * current package); the test asserts the wire shape and that the script
 * actually exists + runs.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { FastifyInstance } from 'fastify';
import { createApp } from '../../src/server/app.js';
import { authHeaders, settingsTemplate } from './helpers.js';

const PORT = 41612;

interface ScopeGuardFinding {
    verdict: 'OK' | 'WARN' | 'DRIFT';
    tool: string;
    otherScopePath: string;
    otherVersion: string;
    thisVersion: string;
}

interface ScopeGuardResult {
    overall: 'OK' | 'WARN' | 'DRIFT';
    countOk: number;
    countWarn: number;
    countDrift: number;
    findings: ScopeGuardFinding[];
}

interface TestApp {
    app: FastifyInstance;
    token: string;
    host: string;
    cleanup: () => Promise<void>;
}

async function bootWithExtended(extended: boolean): Promise<TestApp> {
    const projectRoot = mkdtempSync(join(tmpdir(), 'agent-config-scope-test-'));
    mkdirSync(join(projectRoot, 'state'), { recursive: true });
    mkdirSync(join(projectRoot, 'settings'), { recursive: true, mode: 0o700 });
    writeFileSync(join(projectRoot, 'settings', '.agent-settings.yml'), settingsTemplate(), { mode: 0o600 });

    const uiDir = mkdtempSync(join(tmpdir(), 'agent-config-scope-ui-'));
    writeFileSync(join(uiDir, 'index.html'), '<!doctype html><html><body>ok</body></html>');

    const token = 'x'.repeat(64);
    const app = await createApp({
        projectRoot,
        uiDistDir: uiDir,
        token,
        expectedPort: PORT,
        logLevel: 'fatal',
        skipReplay: true,
        extendedSteps: extended,
    });
    await app.ready();

    const cleanup = async (): Promise<void> => {
        await app.close();
        rmSync(projectRoot, { recursive: true, force: true });
        rmSync(uiDir, { recursive: true, force: true });
    };
    return { app, token, host: `127.0.0.1:${PORT}`, cleanup };
}

describe('wizard scope-guard endpoint', () => {
    let ctx: TestApp;
    afterEach(async () => { await ctx.cleanup(); });

    it('GET /scope-guard returns 404 when extended-mode is off', async () => {
        ctx = await bootWithExtended(false);
        const res = await ctx.app.inject({
            method: 'GET',
            url: '/api/v1/wizard/scope-guard',
            headers: authHeaders(ctx.token, ctx.host),
        });
        expect(res.statusCode).toBe(404);
        const body = res.json() as { error: { code: string } };
        expect(body.error.code).toBe('NOT_FOUND');
    });

    it('GET /scope-guard returns parsed verdict when extended-mode is on', async () => {
        ctx = await bootWithExtended(true);
        const res = await ctx.app.inject({
            method: 'GET',
            url: '/api/v1/wizard/scope-guard',
            headers: authHeaders(ctx.token, ctx.host),
        });
        expect(res.statusCode).toBe(200);
        const body = res.json() as ScopeGuardResult;
        // The parser always emits a verdict + findings; in CI both should
        // be present even if every tool returns OK.
        expect(['OK', 'WARN', 'DRIFT']).toContain(body.overall);
        expect(Array.isArray(body.findings)).toBe(true);
        expect(body.findings.length).toBeGreaterThanOrEqual(6);
        // Every supported tool must appear.
        const tools = body.findings.map((f) => f.tool);
        for (const expectedTool of ['claude-code', 'augment', 'cursor', 'cline', 'windsurf', 'copilot']) {
            expect(tools).toContain(expectedTool);
        }
        // Counts must add up.
        const totals = body.countOk + body.countWarn + body.countDrift;
        expect(totals).toBe(body.findings.length);
    });
});
