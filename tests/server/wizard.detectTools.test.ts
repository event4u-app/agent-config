/**
 * detect-tools `configured` field — road-to-wizard-ux-improvements follow-up.
 *
 * `configured` surfaces the tools recorded in the global install lockfile
 * (the user's prior selection) so Step 1 pre-selects those on a repeat run.
 * We point AGENT_CONFIG_INSTALLED_LOCK at a temp file so the test never
 * reads the real ~/.event4u/agent-config/installed.lock.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { bootTestApp, authHeaders, type TestApp } from './helpers.js';

const PORT = 41770;

interface DetectToolsBody { tools: Record<string, boolean>; configured: string[] }

describe('wizard detect-tools configured', () => {
    let ctx: TestApp;
    const prevLock = process.env['AGENT_CONFIG_INSTALLED_LOCK'];
    afterEach(async () => {
        if (ctx) await ctx.cleanup();
        if (prevLock === undefined) delete process.env['AGENT_CONFIG_INSTALLED_LOCK'];
        else process.env['AGENT_CONFIG_INSTALLED_LOCK'] = prevLock;
    });

    it('returns the lockfile tools (known ids only) as configured', async () => {
        const dir = mkdtempSync(join(tmpdir(), 'agent-config-lock-'));
        const lock = join(dir, 'installed.lock');
        writeFileSync(lock, [
            'schema_version: 1',
            'agent_config_version: "4.3.0"',
            'installed_at: "2026-05-27T00:00:00Z"',
            'tools:',
            '  - cursor',
            '  - claude-code',
            '  - bogus-not-a-tool',
            '',
        ].join('\n'), 'utf8');
        process.env['AGENT_CONFIG_INSTALLED_LOCK'] = lock;

        ctx = await bootTestApp({ port: PORT, extendedSteps: true });
        const res = await ctx.app.inject({
            method: 'GET', url: '/api/v1/wizard/detect-tools', headers: authHeaders(ctx.token, ctx.host),
        });
        expect(res.statusCode).toBe(200);
        const body = res.json() as DetectToolsBody;
        expect(body.configured).toContain('cursor');
        expect(body.configured).toContain('claude-code');
        expect(body.configured).not.toContain('bogus-not-a-tool'); // unknown id filtered
        expect(typeof body.tools).toBe('object');
        rmSync(dir, { recursive: true, force: true });
    });

    it('returns an empty configured list when no lockfile exists', async () => {
        process.env['AGENT_CONFIG_INSTALLED_LOCK'] = join(tmpdir(), 'agent-config-absent', 'nope.lock');
        ctx = await bootTestApp({ port: PORT + 1, extendedSteps: true });
        const res = await ctx.app.inject({
            method: 'GET', url: '/api/v1/wizard/detect-tools', headers: authHeaders(ctx.token, ctx.host),
        });
        expect(res.statusCode).toBe(200);
        expect((res.json() as DetectToolsBody).configured).toEqual([]);
    });
});
