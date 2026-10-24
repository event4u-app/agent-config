import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { statePath } from '../../../src/scripts/_lib/advisory_notice.js';
import { readRegistry } from '../../../src/scripts/_lib/project_registry.js';
import { main } from '../../../src/scripts/code_graph/cli.js';
import { graphHome } from '../../../src/scripts/code_graph/graph_home.js';
import { sqliteTwinPath } from '../../../src/scripts/code_graph/sqlite_store.js';
import { GRAPH_TOOLS } from '../../../src/scripts/mcp_server/graph_tools.js';
import { ToolCache } from '../../../src/scripts/mcp_server/tools.js';
import { type Estate, makeEstate } from './estate_fixture.js';

let tmp: string;
let saved: string | undefined;
let out: string[];

async function cg(...argv: string[]): Promise<{ rc: number; stdout: string }> {
    out = [];
    const rc = await main(argv);
    return { rc, stdout: out.join('') };
}

function idOf(root: string): string {
    return Object.entries(readRegistry().projects).find(([, e]) => e.root === root)![0];
}

/** Index the estate, then take every project graph away: an answer after this read the index alone. */
async function indexedWithoutGraphs(): Promise<Estate> {
    const e = makeEstate(tmp, 2);
    expect((await cg('projects', 'index', 'on')).rc).toBe(0);
    for (const r of [e.core, e.app, e.billing]) expect((await cg('build', '--root', r)).rc).toBe(0);
    for (const r of [e.core, e.app, e.billing]) {
        const cache = graphHome(r).cachePath;
        fs.rmSync(cache);
        fs.rmSync(sqliteTwinPath(cache), { force: true });
    }
    return e;
}

beforeEach(() => {
    tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'cg-estate-cli-')));
    saved = process.env.EVENT4U_CONFIG_HOME;
    process.env.EVENT4U_CONFIG_HOME = path.join(tmp, 'home');
    out = [];
    const sink = (s: string | Uint8Array): boolean => {
        out.push(String(s));
        return true;
    };
    vi.spyOn(process.stdout, 'write').mockImplementation(sink);
    vi.spyOn(process.stderr, 'write').mockImplementation(sink);
});
afterEach(() => {
    vi.restoreAllMocks();
    process.env.EVENT4U_CONFIG_HOME = saved;
    fs.rmSync(tmp, { recursive: true, force: true });
});

describe('estate queries read the index only (5.3)', () => {
    it('who uses vitest: the two npm projects, never billing', async () => {
        const e = await indexedWithoutGraphs();
        const r = await cg('estate', 'projects-using', 'vitest', '--json');
        expect(r.rc).toBe(0);
        const rows = JSON.parse(r.stdout) as Array<{ id: string; root: string }>;
        expect(rows.map((x) => x.root).sort()).toEqual([e.app, e.core].sort());
        expect(rows.map((x) => x.id).sort()).toEqual([idOf(e.app), idOf(e.core)].sort());
    }, 120_000);

    it('where-used names the declarers of a package and the referrers of a symbol', async () => {
        const e = await indexedWithoutGraphs();
        const pkg = JSON.parse((await cg('estate', 'where-used', '@estate/core', '--json')).stdout) as {
            package_users: Array<{ root: string }>;
            publishers: Array<{ root: string }>;
        };
        expect(pkg.package_users.map((x) => x.root)).toEqual([e.app]);
        expect(pkg.publishers.map((x) => x.root)).toEqual([e.core]);
        const sym = JSON.parse((await cg('estate', 'where-used', 'uniqueThing', '--json')).stdout) as {
            declared_by: Array<{ root: string }>;
            referenced_by: Array<{ root: string }>;
        };
        expect(sym.declared_by.map((x) => x.root)).toEqual([e.core]);
        expect(sym.referenced_by.map((x) => x.root)).toEqual([e.billing]);
        const text = await cg('estate', 'where-used', 'vitest');
        expect(text.stdout).toContain(e.app);
        expect(text.stdout).toContain(e.core);
    }, 120_000);

    it('advisory-impact joins advisory packages with the projects that import them', async () => {
        const e = await indexedWithoutGraphs();
        const state = statePath(e.core)!;
        fs.mkdirSync(path.dirname(state), { recursive: true });
        fs.writeFileSync(
            state,
            JSON.stringify({
                schema: 1,
                at: '2026-10-24T00:00:00.000Z',
                findings: [{ key: 'GHSA-x|vitest|3.0.0', id: 'GHSA-x', tier: 'T1', ecosystem: 'npm', package: 'vitest' }],
                notice: null,
            }),
        );
        const r = JSON.parse((await cg('estate', 'advisory-impact', '--json')).stdout) as Array<{
            package: string;
            advisories: string[];
            projects: Array<{ root: string; imports: number }>;
        }>;
        expect(r).toHaveLength(1);
        expect(r[0]?.package).toBe('vitest');
        expect(r[0]?.advisories).toEqual(['GHSA-x']);
        expect(r[0]?.projects.map((p) => p.root).sort()).toEqual([e.app, e.core].sort());
        const direct = JSON.parse((await cg('estate', 'advisory-impact', '--package', 'monolog/monolog', '--json')).stdout) as Array<{
            projects: Array<{ root: string }>;
        }>;
        expect(direct[0]?.projects.map((p) => p.root)).toEqual([e.billing]);
    }, 120_000);

    it('without an index it says how to switch one on', async () => {
        const r = await cg('estate', 'projects-using', 'vitest');
        expect(r.rc).toBe(1);
        expect(r.stdout).toMatch(/projects index on/);
    });

    it('the MCP tool answers the same question from the index', async () => {
        const e = await indexedWithoutGraphs();
        expect(GRAPH_TOOLS['graph_estate']?.side_effect).toBe('ro');
        const r = await new ToolCache().dispatch('graph_estate', { query: 'projects-using', name: 'vitest' }, tmp);
        expect(r['status']).toBe('ok');
        expect((r['projects'] as Array<{ root: string }>).map((p) => p.root).sort()).toEqual([e.app, e.core].sort());
        const off = await new ToolCache().dispatch('graph_estate', { query: 'where-used' }, tmp);
        expect(off['status']).toBe('error');
    }, 120_000);
});

