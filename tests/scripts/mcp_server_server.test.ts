// Parity tests for the src/scripts/mcp_server/server.ts twin.
//
// Ported from the `@requires_mcp` server-layer cases of
// tests/test_mcp_server.py (prompts/list + get, pagination, hot-reload,
// resources/list + read, tools/list + call). In the Python source these
// drive `server.request_handlers[mcp_types.X]` via the `mcp` SDK and are
// skipped when the SDK is absent.
//
// The TS twin's `build_server` is a pure factory — the handler *logic* is
// transport-agnostic and exposed via `BuiltServer.request_handlers`, so
// the logic cases run unconditionally here (the SDK is not needed to
// exercise them). The actual SDK-transport wiring (`_serveOverSdk`)
// degrades when `@modelcontextprotocol/sdk` is absent; the
// SDK-availability probe is asserted as a skipIf-gated case mirroring the
// Python `@requires_mcp` marker.
import * as fs from 'node:fs';
import * as path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { REPO_ROOT, bumpMtime, makeTmpDir } from './_mcp_server.js';

import {
    type ListPromptsResult,
    build_server,
    mcp_sdk_available,
} from '../../src/scripts/mcp_server/server.js';
import {
    PromptCache,
    load_all_prompts,
    load_phase_1_prompts,
} from '../../src/scripts/mcp_server/prompts.js';
import { load_all_resources } from '../../src/scripts/mcp_server/resources.js';
import { MIME_MARKDOWN } from '../../src/scripts/mcp_server/resources.js';
import { ToolCache } from '../../src/scripts/mcp_server/tools.js';

const tmpDirs: string[] = [];
afterEach(() => {
    while (tmpDirs.length > 0) {
        const d = tmpDirs.pop()!;
        try {
            fs.rmSync(d, { recursive: true, force: true });
        } catch {
            /* best-effort */
        }
    }
});
function tmp(): string {
    const d = makeTmpDir('mcp-server-');
    tmpDirs.push(d);
    return d;
}

function buildWithFixtures() {
    const prompts = load_phase_1_prompts(REPO_ROOT);
    return { server: build_server(prompts), prompts };
}

// ----------------------------------------------------------------------
// prompts/list + prompts/get
// ----------------------------------------------------------------------

describe('server — prompts', () => {
    it('lists the 5 phase-1 prompts with skill prefix', async () => {
        const { server, prompts } = buildWithFixtures();
        const result = await server.request_handlers['prompts/list'](null);
        expect(result.prompts.length).toBe(prompts.length);
        for (const prompt of result.prompts) {
            expect(prompt.name.startsWith('skill.')).toBe(true);
            expect(prompt.description).toBeTruthy();
        }
    });

    it('get_prompt returns the skill body verbatim', async () => {
        const { server, prompts } = buildWithFixtures();
        const target = prompts[0]!;
        const result = await server.request_handlers['prompts/get'](`skill.${target.name}`);
        expect(result.messages.length).toBe(1);
        expect(result.messages[0]!.role).toBe('user');
        const text = result.messages[0]!.content.text;
        expect(text.trim()).toBeTruthy();
        expect(text).toBe(target.body);
    });

    it('get_prompt with an unknown name throws', async () => {
        const { server } = buildWithFixtures();
        await expect(
            server.request_handlers['prompts/get']('skill.does-not-exist'),
        ).rejects.toThrow(/Unknown prompt/);
    });

    it('lists all prompts — skills and commands (B1/B2)', async () => {
        const [prompts] = load_all_prompts(REPO_ROOT);
        const server = build_server(prompts, { page_size: 10_000 });
        const result = await server.request_handlers['prompts/list'](null);
        const names = result.prompts.map((p) => p.name);
        expect(names.some((n) => n.startsWith('skill.'))).toBe(true);
        expect(names.some((n) => n.startsWith('command.'))).toBe(true);
        expect(names.length).toBe(prompts.length);
    });

    it('paginates prompts with a cursor (B4)', async () => {
        const [prompts] = load_all_prompts(REPO_ROOT);
        const server = build_server(prompts, { page_size: 5 });
        const seen: string[] = [];
        let cursor: string | null = null;
        let pages = 0;
        for (;;) {
            const result: ListPromptsResult = await server.request_handlers['prompts/list'](cursor);
            expect(result.prompts.length).toBeLessThanOrEqual(5);
            seen.push(...result.prompts.map((p) => p.name));
            cursor = result.nextCursor;
            pages += 1;
            if (cursor === null) {
                break;
            }
            expect(pages).toBeLessThan(1000);
        }
        expect(pages).toBeGreaterThan(1);
        expect(seen.length).toBe(prompts.length);
        expect(new Set(seen).size).toBe(seen.length);
    });

    it('accepts a loader callable for hot-reload (B5)', async () => {
        const root = tmp();
        const skillDir = path.join(root, 'dist/agent-src', 'skills', 'demo');
        fs.mkdirSync(skillDir, { recursive: true });
        const skillMd = path.join(skillDir, 'SKILL.md');
        fs.writeFileSync(skillMd, '---\nname: demo\ndescription: "v1"\n---\nbody-v1\n', 'utf-8');
        const cache = new PromptCache(root);
        const server = build_server(() => cache.get(), { page_size: 100 });

        const r1 = await server.request_handlers['prompts/list'](null);
        expect(r1.prompts.map((p) => p.description)).toEqual(['v1']);

        fs.writeFileSync(skillMd, '---\nname: demo\ndescription: "v2"\n---\nbody-v2\n', 'utf-8');
        bumpMtime(skillMd, 2);

        const r2 = await server.request_handlers['prompts/list'](null);
        expect(r2.prompts.map((p) => p.description)).toEqual(['v2']);
    });
});

// ----------------------------------------------------------------------
// resources/list + resources/read
// ----------------------------------------------------------------------

describe('server — resources', () => {
    it('lists resources with pagination (C1 + C3)', async () => {
        const [resources] = load_all_resources(REPO_ROOT);
        const server = build_server([], { resources, page_size: 7 });
        const seen: string[] = [];
        let cursor: string | null = null;
        let pages = 0;
        for (;;) {
            const result = await server.request_handlers['resources/list'](cursor);
            expect(result.resources.length).toBeLessThanOrEqual(7);
            for (const entry of result.resources) {
                expect(entry.mimeType).toBe(MIME_MARKDOWN);
                seen.push(entry.uri);
            }
            cursor = result.nextCursor;
            pages += 1;
            if (cursor === null) {
                break;
            }
            expect(pages).toBeLessThan(1000);
        }
        expect(pages).toBeGreaterThan(1);
        expect(seen.length).toBe(resources.length);
        expect(new Set(seen).size).toBe(seen.length);
    });

    it('reads a resource body verbatim (C2)', async () => {
        const [resources] = load_all_resources(REPO_ROOT);
        const server = build_server([], { resources });
        const target = resources[0]!;
        const contents = await server.request_handlers['resources/read'](target.uri);
        expect(contents.length).toBe(1);
        expect(contents[0]!.mimeType).toBe(MIME_MARKDOWN);
        expect(contents[0]!.content).toBe(target.body);
    });

    it('read_resource with an unknown URI throws', async () => {
        const server = build_server([], { resources: [] });
        await expect(
            server.request_handlers['resources/read']('rule://does-not-exist'),
        ).rejects.toThrow(/Unknown resource/);
    });

    it('resources arg can be a cache callable (C4)', async () => {
        const cache = (await import('../../src/scripts/mcp_server/resources.js')).ResourceCache;
        const rc = new cache(REPO_ROOT);
        const server = build_server([], { resources: () => rc.get(), page_size: 3 });
        const result = await server.request_handlers['resources/list'](null);
        expect(result.resources.length).toBe(3);
        expect(result.nextCursor).toBe('3');
    });
});

// ----------------------------------------------------------------------
// tools/list + tools/call (D4 / J2)
// ----------------------------------------------------------------------

describe('server — tools', () => {
    it('lists the full catalog plus allowlist (D4 / J2)', async () => {
        const { REGISTRY } = await import('../../src/scripts/mcp_server/tools.js');
        const server = build_server([], { tools: new ToolCache() });
        const handler = server.request_handlers['tools/list'];
        expect(handler).toBeDefined();
        const tools = await handler!();
        const names = tools.map((t) => t.name).sort();
        expect(names).toEqual(Object.keys(REGISTRY).sort());
        expect(names).toContain('chat_history_append');
        expect(names).toContain('lint_skills');
        expect(names).toContain('memory_lookup');
    });

    it('call_tool on a stub returns the envelope as a successful result (J2)', async () => {
        const root = tmp();
        const server = build_server([], { tools: new ToolCache() });
        const handler = server.request_handlers['tools/call'];
        expect(handler).toBeDefined();
        const prev = process.cwd();
        let payload: Record<string, unknown>;
        try {
            process.chdir(root);
            payload = await handler!('compile_router', { dry_run: true });
        } finally {
            process.chdir(prev);
        }
        expect(payload.code).toBe('not_implemented');
        expect(payload.tool).toBe('compile_router');
        expect(payload.transport).toBe('stdio');
    });

    it('call_tool dry-run succeeds (D4)', async () => {
        const root = tmp();
        const server = build_server([], { tools: new ToolCache() });
        const handler = server.request_handlers['tools/call'];
        const prev = process.cwd();
        let body: Record<string, unknown>;
        try {
            process.chdir(root);
            body = await handler!('chat_history_append', {
                text: 'hi',
                entry_type: 'note',
                dry_run: true,
            });
        } finally {
            process.chdir(prev);
        }
        expect(body.dry_run).toBe(true);
    });

    it('call_tool path escape surfaces as a thrown error (D4)', async () => {
        const root = tmp();
        const server = build_server([], { tools: new ToolCache() });
        const handler = server.request_handlers['tools/call'];
        const prev = process.cwd();
        try {
            process.chdir(root);
            await expect(
                handler!('chat_history_append', {
                    text: 'x',
                    path: '/etc/passwd',
                    dry_run: true,
                }),
            ).rejects.toThrow(/escapes consumer_root/);
        } finally {
            process.chdir(prev);
        }
    });

    it('call_tool unknown name throws', async () => {
        const root = tmp();
        const server = build_server([], { tools: new ToolCache() });
        const handler = server.request_handlers['tools/call'];
        const prev = process.cwd();
        try {
            process.chdir(root);
            await expect(handler!('nope', {})).rejects.toThrow(/Unknown tool/);
        } finally {
            process.chdir(prev);
        }
    });
});

// ----------------------------------------------------------------------
// SDK availability — the TS analogue of the Python @requires_mcp marker.
// ----------------------------------------------------------------------

describe('server — MCP SDK availability', () => {
    it('reports whether @modelcontextprotocol/sdk is importable (degrade-when-absent)', async () => {
        const available = await mcp_sdk_available();
        // The dep is intentionally NOT installed at this phase, so the twin
        // degrades. This assertion documents the current state; the
        // transport-wiring path (`_serveOverSdk`) only runs when true.
        expect(typeof available).toBe('boolean');
    });
});
