/**
 * The `project` parameter on the graph tools (road-to-a-graph-that-follows-you
 * 5.1) and the no-graph answer that points at what exists (5.2).
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { readRegistry, updateRegistry } from '../../../src/scripts/_lib/project_registry.js';
import { main } from '../../../src/scripts/code_graph/cli.js';
import { GRAPH_TOOLS } from '../../../src/scripts/mcp_server/graph_tools.js';
import { ToolCache } from '../../../src/scripts/mcp_server/tools.js';

let tmp: string;
let saved: string | undefined;

function repo(name: string, body: string, withAgents: boolean): string {
    const r = path.join(tmp, name);
    fs.mkdirSync(path.join(r, 'src'), { recursive: true });
    if (withAgents) fs.mkdirSync(path.join(r, 'agents'));
    fs.writeFileSync(path.join(r, 'src', 'mod.ts'), body);
    execFileSync('git', ['-C', r, 'init', '-q']);
    execFileSync('git', ['-C', r, 'add', '-A']);
    execFileSync('git', ['-C', r, '-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-q', '-m', 'x']);
    return r;
}

async function build(root: string): Promise<void> {
    const w = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    try {
        expect(await main(['build', '--root', root])).toBe(0);
    } finally {
        w.mockRestore();
    }
}

function idOf(root: string): string {
    return Object.entries(readRegistry().projects).find(([, e]) => e.root === root)![0];
}

beforeEach(() => {
    tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-project-')));
    saved = process.env.EVENT4U_CONFIG_HOME;
    process.env.EVENT4U_CONFIG_HOME = path.join(tmp, 'home');
});
afterEach(() => {
    process.env.EVENT4U_CONFIG_HOME = saved;
    fs.rmSync(tmp, { recursive: true, force: true });
});

describe('a project parameter on the graph tools (5.1)', () => {
    it('every graph tool declares an optional `project`', () => {
        for (const t of Object.values(GRAPH_TOOLS)) {
            // The estate tool answers across every project; it has no single one to select.
            if (t.name === 'graph_estate') continue;
            const s = t.input_schema as { properties: Record<string, unknown>; required?: string[] };
            expect(s.properties['project'], t.name).toBeDefined();
            expect(s.required ?? [], t.name).not.toContain('project');
        }
    });

    it('queries a second project by id, name and path from another server root', async () => {
        const server = repo('server', 'export function serverOnly(): number {\n    return 1;\n}\n', true);
        const other = repo('other-lib', 'export function libThing(): number {\n    return 2;\n}\nexport function useIt(): number {\n    return libThing();\n}\n', false);
        await build(server);
        await build(other);
        const cache = new ToolCache();
        const here = await cache.dispatch('graph_node', { id: 'src/mod.ts#libThing' }, server);
        expect(here['status']).toBe('refused');
        for (const ref of [idOf(other), 'other-lib', other]) {
            const r = await cache.dispatch('graph_node', { id: 'src/mod.ts#libThing', project: ref }, server);
            expect(r['status'], ref).toBe('ok');
            expect((r['in'] as unknown[]).length, ref).toBeGreaterThan(0);
        }
        const q = await cache.dispatch('graph_query', { symbol: 'src/mod.ts#useIt', project: 'other-lib' }, server);
        expect(q['status']).toBe('ok');
        expect(String(q['source'])).toContain(path.join(tmp, 'home'));
        const def = await cache.dispatch('graph_node', { id: 'src/mod.ts#serverOnly' }, server);
        expect(def['status']).toBe('ok');
    }, 60_000);

    it('refuses an unknown or ambiguous project instead of guessing', async () => {
        const server = repo('server', 'export const s = 1;\n', true);
        await build(server);
        const cache = new ToolCache();
        const r = await cache.dispatch('graph_query', { symbol: 's', project: 'no-such-project' }, server);
        expect(r['status']).toBe('error');
        expect(String(r['error'])).toMatch(/no registered project/);
    });

    it('the CLI takes --project the same way', async () => {
        const other = repo('cli-other', 'export function cliThing(): number {\n    return 3;\n}\n', false);
        await build(other);
        const out: string[] = [];
        const w = vi.spyOn(process.stdout, 'write').mockImplementation((s: string | Uint8Array) => {
            out.push(String(s));
            return true;
        });
        try {
            expect(await main(['query', 'cliThing', '--project', 'cli-other'])).toBe(0);
        } finally {
            w.mockRestore();
        }
        expect(out.join('')).toContain('cliThing');
        const e = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
        try {
            expect(await main(['query', 'cliThing', '--project', 'missing-one'])).toBe(1);
        } finally {
            e.mockRestore();
        }
    }, 60_000);
});

describe('noGraph points at what exists (5.2)', () => {
    it('a root without a graph lists another checkout of the same repository', async () => {
        const main = repo('alpha', 'export const a = 1;\n', false);
        await build(main);
        const wt = path.join(tmp, 'alpha-wt');
        execFileSync('git', ['-C', main, 'worktree', 'add', '-q', wt]);
        const r = await new ToolCache().dispatch('graph_query', { symbol: 'a' }, wt);
        expect(r['status']).toBe('unavailable');
        const listed = r['registered_projects'] as Array<{ id: string; name: string; root?: string }>;
        expect(listed).toEqual([{ id: idOf(main), name: 'alpha', root: main }]);
        expect(String(r['error'])).toMatch(/project/);
    }, 60_000);

    it('an unrelated root never learns another project exists while the estate index is off (O1)', async () => {
        const a = repo('alpha', 'export const a = 1;\n', false);
        const b = repo('beta', 'export const b = 2;\n', true);
        await build(a);
        await build(b);
        const empty = path.join(tmp, 'empty');
        fs.mkdirSync(empty);
        const r = await new ToolCache().dispatch('graph_query', { symbol: 'a' }, empty);
        expect(r['status']).toBe('unavailable');
        expect(r['registered_projects']).toBeUndefined();
        const wire = JSON.stringify(r);
        expect(wire).not.toContain(a);
        expect(wire).not.toContain(b);
    }, 60_000);

    it('with the estate index on, other projects are named by id only, never by path', async () => {
        const a = repo('alpha', 'export const a = 1;\n', false);
        const b = repo('beta', 'export const b = 2;\n', true);
        await build(a);
        await build(b);
        updateRegistry((reg) => {
            reg.index = true;
        });
        const empty = path.join(tmp, 'empty');
        fs.mkdirSync(empty);
        const r = await new ToolCache().dispatch('graph_query', { symbol: 'a' }, empty);
        const listed = r['registered_projects'] as Array<{ id: string; name: string; root?: string }>;
        expect(listed.map((p) => p.id).sort()).toEqual([idOf(a), idOf(b)].sort());
        expect(listed.every((p) => p.root === undefined)).toBe(true);
        const wire = JSON.stringify(r);
        expect(wire).not.toContain(a);
        expect(wire).not.toContain(b);
    }, 60_000);

    it('with an empty registry the answer is unchanged', async () => {
        const empty = path.join(tmp, 'empty');
        fs.mkdirSync(empty);
        const r = await new ToolCache().dispatch('graph_query', { symbol: 'a' }, empty);
        expect(r['status']).toBe('unavailable');
        expect(r['registered_projects']).toBeUndefined();
        expect(String(r['error'])).toMatch(/run `agent-config code-graph build`/);
    });
});
