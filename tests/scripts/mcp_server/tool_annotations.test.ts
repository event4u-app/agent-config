/**
 * Defect D7: every implemented MCP tool carries all four tool-behavior hints.
 * An absent `destructiveHint` / `openWorldHint` reads as `true` under the MCP
 * spec, so a hint left out is a wrong hint, not a missing one.
 */
import * as fs from 'node:fs';
import { describe, expect, it } from 'vitest';

import { _buildEntries, CATALOG_PATH } from '../../../src/scripts/build_mcp_catalog.js';
import { build_server } from '../../../src/scripts/mcp_server/server.js';
import { tool_annotations } from '../../../src/scripts/mcp_server/annotations.js';
import { ALLOWLIST, type BuiltinTool, ToolCache } from '../../../src/scripts/mcp_server/tools.js';

const HINTS = ['destructiveHint', 'idempotentHint', 'openWorldHint', 'readOnlyHint'];
const ADDITIVE = ['chat_history_append', 'memory_signal'];

async function listedAnnotations(): Promise<Map<string, Record<string, unknown>>> {
    const server = build_server([], { tools: new ToolCache() });
    const tools = (await server.request_handlers['tools/list']!()) as unknown as Array<{
        name: string;
        annotations?: Record<string, unknown>;
    }>;
    return new Map(tools.map((t) => [t.name, t.annotations ?? {}]));
}

describe('tools/list — the four MCP hints', () => {
    it('returns all four boolean hints for every implemented tool', async () => {
        const listed = await listedAnnotations();
        expect([...listed.keys()].sort()).toEqual(Object.keys(ALLOWLIST).sort());
        for (const [name, a] of listed) {
            expect(Object.keys(a).sort(), name).toEqual(HINTS);
            for (const h of HINTS) expect(typeof a[h], `${name}.${h}`).toBe('boolean');
        }
    });

    it('an ro tool is read-only, non-destructive and idempotent; only a declared one is open-world', async () => {
        for (const [name, a] of await listedAnnotations()) {
            const tool = ALLOWLIST[name]!;
            expect(a['readOnlyHint'], name).toBe(tool.side_effect === 'ro');
            expect(a['openWorldHint'], name).toBe(tool.open_world === true);
            if (tool.side_effect === 'ro') {
                expect(a['destructiveHint'], name).toBe(false);
                expect(a['idempotentHint'], name).toBe(true);
            }
        }
    });

    it('additive tools write but are not destructive', async () => {
        const listed = await listedAnnotations();
        for (const name of ADDITIVE) {
            expect(listed.get(name), name).toMatchObject({
                readOnlyHint: false,
                destructiveHint: false,
                openWorldHint: false,
            });
        }
    });

    it('pins the owner-decided cases: roadmap_archive destructive, run_tests open-world but not destructive', async () => {
        const listed = await listedAnnotations();
        expect(listed.get('roadmap_archive')).toMatchObject({ readOnlyHint: false, destructiveHint: true });
        expect(listed.get('run_tests')).toMatchObject({
            readOnlyHint: false,
            destructiveHint: false,
            openWorldHint: true,
        });
    });

    it('every tool that declares an effect shape or open world carries a reason', () => {
        for (const tool of Object.values(ALLOWLIST)) {
            if (tool.effect_shape !== undefined || tool.open_world === true) {
                expect(tool.effect_reason?.trim(), tool.name).toBeTruthy();
            }
        }
    });
});

describe('tool_annotations — refuses a tool whose hints would fall back to the defaults', () => {
    const base: BuiltinTool = {
        name: 'x',
        description: 'x',
        input_schema: {},
        side_effect: 'fs-write',
        handler: async () => ({}),
    };

    it('throws on a writing tool with no effect_shape', () => {
        expect(() => tool_annotations(base)).toThrow(/declares no effect_shape/);
    });

    it('throws on an ro tool that declares an effect_shape', () => {
        expect(() =>
            tool_annotations({ ...base, side_effect: 'ro', effect_shape: 'additive', effect_reason: 'r' }),
        ).toThrow(/side_effect 'ro'/);
    });

    it('throws on a declared shape without a reason', () => {
        expect(() => tool_annotations({ ...base, effect_shape: 'additive' })).toThrow(/effect_reason/);
    });

    it('derives destructive and idempotent from the shape', () => {
        const r = 'r';
        expect(tool_annotations({ ...base, effect_shape: 'destructive', effect_reason: r })).toEqual({
            readOnlyHint: false,
            destructiveHint: true,
            idempotentHint: false,
            openWorldHint: false,
        });
        expect(tool_annotations({ ...base, effect_shape: 'idempotent', effect_reason: r })).toMatchObject({
            destructiveHint: false,
            idempotentHint: true,
        });
    });
});

describe('consumer_tool_catalog.json — pins all four hints', () => {
    it('the committed catalog carries the same four hints tools/list serves', async () => {
        const listed = await listedAnnotations();
        const doc = JSON.parse(fs.readFileSync(CATALOG_PATH(), 'utf-8')) as {
            tools: Array<{ name: string; implemented_on: string[]; annotations?: Record<string, unknown> }>;
        };
        const implemented = doc.tools.filter((t) => t.implemented_on.length > 0);
        expect(implemented.map((t) => t.name).sort()).toEqual([...listed.keys()].sort());
        for (const t of implemented) expect(t.annotations, t.name).toEqual(listed.get(t.name));
    });

    it('the generator refuses a registry tool whose hints cannot be derived', () => {
        const saved = ALLOWLIST['chat_history_append']!;
        const { effect_shape: _drop, ...broken } = saved;
        (ALLOWLIST as Record<string, BuiltinTool>)['chat_history_append'] = broken;
        try {
            expect(() => _buildEntries()).toThrow(/chat_history_append/);
        } finally {
            (ALLOWLIST as Record<string, BuiltinTool>)['chat_history_append'] = saved;
        }
    });
});
