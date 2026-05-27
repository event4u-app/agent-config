/**
 * detect-tools `configured` field — road-to-wizard-ux-improvements follow-up.
 *
 * `configured` surfaces the user's prior wizard selection (wizard-tools.json),
 * so Step 1 pre-selects those on a repeat run instead of every installed (or
 * every deployed) tool. We point AGENT_CONFIG_WIZARD_TOOLS at a temp file so
 * the test never reads the real ~/.event4u/agent-config/wizard-tools.json.
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
    const prev = process.env['AGENT_CONFIG_WIZARD_TOOLS'];
    afterEach(async () => {
        if (ctx) await ctx.cleanup();
        if (prev === undefined) delete process.env['AGENT_CONFIG_WIZARD_TOOLS'];
        else process.env['AGENT_CONFIG_WIZARD_TOOLS'] = prev;
    });

    it('returns the prior selection (known ids only) as configured', async () => {
        const dir = mkdtempSync(join(tmpdir(), 'agent-config-seltools-'));
        const file = join(dir, 'wizard-tools.json');
        writeFileSync(file, JSON.stringify({ tools: ['cursor', 'claude-code', 'bogus-not-a-tool'] }), 'utf8');
        process.env['AGENT_CONFIG_WIZARD_TOOLS'] = file;

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

    it('returns an empty configured list when no prior selection exists', async () => {
        process.env['AGENT_CONFIG_WIZARD_TOOLS'] = join(tmpdir(), 'agent-config-absent', 'nope.json');
        ctx = await bootTestApp({ port: PORT + 1, extendedSteps: true });
        const res = await ctx.app.inject({
            method: 'GET', url: '/api/v1/wizard/detect-tools', headers: authHeaders(ctx.token, ctx.host),
        });
        expect(res.statusCode).toBe(200);
        expect((res.json() as DetectToolsBody).configured).toEqual([]);
    });
});
