/**
 * The five code-graph MCP tools (road-to-a-graph-that-is-shipped 4.1) and the
 * pinned stdio install hint (4.2).
 *
 * 4.1's verify is *"catalogue count 36; `telemetry:report` shows `tools/call`
 * rows for them in a fixture session"*. Both halves are asserted here, and the
 * second is asserted over the log the server actually writes rather than over a
 * mock: `ToolCache.dispatch` is the real dispatch path, so a tool that reached
 * the registry without reaching telemetry would fail here.
 *
 * The step names `telemetry:report`, which is the ARTEFACT-ENGAGEMENT report and
 * a different log — `agents/runtime/mcp-telemetry/calls.jsonl` is where a
 * `tools/call` lands. Recorded rather than silently substituted: the rows the
 * step asks for are the ones asserted, in the file that holds them.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { buildFromRepo } from '../../src/scripts/code_graph/build.js';
import { GRAPH_TOOLS } from '../../src/scripts/mcp_server/graph_tools.js';
import { ALLOWLIST, ToolCache } from '../../src/scripts/mcp_server/tools.js';
import { TELEMETRY_FILENAME, TELEMETRY_REL_DIR } from '../../src/scripts/mcp_server/telemetry.js';
import catalog from '../../src/scripts/mcp_server/consumer_tool_catalog.json' with { type: 'json' };

const NAMES = ['graph_impact', 'graph_tests_for', 'graph_dead', 'graph_query', 'graph_path'] as const;

const dirs: string[] = [];
afterEach(() => {
    for (const d of dirs.splice(0)) fs.rmSync(d, { recursive: true, force: true });
});

/** A consumer root with a real graph at the path the server looks for. */
async function consumerRig(): Promise<string> {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-graph-'));
    dirs.push(dir);
    const files: Record<string, string> = {
        'src/service.ts': 'export function handle(x: string): string {\n    return x.trim();\n}\n',
        'src/main.ts': "import { handle } from './service.js';\n\nexport function run(): string {\n    return handle('a');\n}\n",
        'tests/service.test.ts':
            "import { handle } from '../src/service.js';\n\nexport function check(): boolean {\n    return handle('a') === 'a';\n}\n",
    };
    for (const [rel, body] of Object.entries(files)) {
        const full = path.join(dir, rel);
        fs.mkdirSync(path.dirname(full), { recursive: true });
        fs.writeFileSync(full, body);
    }
    await buildFromRepo(dir, path.join(dir, 'agents/runtime/state/code-graph-v1.json'));
    return dir;
}

function telemetryRows(root: string): Record<string, unknown>[] {
    const p = path.join(root, TELEMETRY_REL_DIR, TELEMETRY_FILENAME);
    if (!fs.existsSync(p)) return [];
    return fs
        .readFileSync(p, 'utf-8')
        .split('\n')
        .filter((l) => l.trim() !== '')
        .map((l) => JSON.parse(l) as Record<string, unknown>);
}

describe('4.1 — the five graph tools are registered', () => {
    it('all five are in ALLOWLIST, so they are implemented rather than stubs', () => {
        for (const n of NAMES) {
            expect(ALLOWLIST[n], `${n} missing from ALLOWLIST`).toBeDefined();
            expect(ALLOWLIST[n]?.name).toBe(n);
        }
        expect(Object.keys(GRAPH_TOOLS).sort()).toStrictEqual([...NAMES].sort());
    });

    it('the catalogue carries 36 tools, and all five are among them', () => {
        const tools = (catalog as { tools: { name: string; implemented_on: string[] }[] }).tools;
        expect(tools).toHaveLength(36);
        const byName = new Map(tools.map((t) => [t.name, t]));
        for (const n of NAMES) {
            expect(byName.get(n), `${n} missing from the catalogue`).toBeDefined();
            // `implemented_on: ['stdio']` is what separates a real tool from a
            // documentation stub — a graph tool listed as a stub would be in
            // the count and unreachable on the wire.
            expect(byName.get(n)?.implemented_on).toStrictEqual(['stdio']);
        }
    });

    it('graph_impact declares shell, the other four declare read-only', () => {
        // It resolves its `diff` argument with `git diff --name-only`. The enum
        // has no "read-only subprocess" value, and understating the mechanism is
        // the failure a capability enum exists to prevent.
        expect(ALLOWLIST['graph_impact']?.side_effect).toBe('shell');
        for (const n of ['graph_tests_for', 'graph_dead', 'graph_query', 'graph_path']) {
            expect(ALLOWLIST[n]?.side_effect, `${n} should be read-only`).toBe('ro');
        }
    });
});

describe('4.1 — a fixture session, dispatched through the real ToolCache', () => {
    it('answers from the graph and writes a telemetry row for every one of the five', async () => {
        const root = await consumerRig();
        const cache = new ToolCache();

        const q = await cache.dispatch('graph_query', { symbol: 'src/service.ts#handle' }, root);
        expect(q['status']).toBe('ok');
        expect(q['staleness']).toBe('fresh');

        const t = await cache.dispatch('graph_tests_for', { symbol: 'src/service.ts#handle' }, root);
        expect(t['status']).toBe('ok');
        expect(t['tests']).toStrictEqual(['tests/service.test.ts']);

        const p = await cache.dispatch(
            'graph_path',
            { from: 'src/main.ts#run', to: 'src/service.ts#handle' },
            root,
        );
        expect(p['status']).toBe('ok');
        expect((p['lines'] as string[]).join(' ')).toContain('src/service.ts#handle');

        // Refuses by default — the same fail-closed contract the CLI has, and
        // over the wire it has to be a STATUS a caller can branch on rather
        // than an exit code nobody sees.
        const d = await cache.dispatch('graph_dead', {}, root);
        expect(d['refusal']).toMatch(/entry-point source\(s\) unavailable: exports/);
        expect(d['dead']).toStrictEqual([]);

        const d2 = await cache.dispatch('graph_dead', { accept_missing_exports: true }, root);
        expect(d2['refusal']).toBeNull();
        expect(d2['dead']).toContain('tests/service.test.ts#check');

        // No git repository in the rig, so the rev cannot resolve — and the
        // tool must SAY so rather than report an empty impact set.
        const i = await cache.dispatch('graph_impact', { diff: 'HEAD~1' }, root);
        expect(i['status']).toBe('error');
        expect(i['error']).toMatch(/cannot resolve rev/);

        const rows = telemetryRows(root);
        const dispatched = rows.filter((r) => NAMES.includes(r['tool_name'] as (typeof NAMES)[number]));
        expect(new Set(dispatched.map((r) => r['tool_name']))).toStrictEqual(new Set(NAMES));
        // Every row is `implemented`, never `stub` — that field is the one the
        // telemetry report groups on, so a stub row would silently under-count
        // real usage.
        for (const r of dispatched) expect(r['outcome']).toBe('implemented');
    }, 60_000);

    it('says the graph is unavailable rather than answering from nothing', async () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-graph-empty-'));
        dirs.push(dir);
        const cache = new ToolCache();
        const r = await cache.dispatch('graph_tests_for', { symbol: 'anything' }, dir);
        expect(r['status']).toBe('unavailable');
        expect(r['staleness']).toBe('absent');
        expect(r['error']).toMatch(/no code-graph source found/);
    }, 60_000);

    it('refuses an entry-point path that escapes the consumer root', async () => {
        const root = await consumerRig();
        const cache = new ToolCache();
        const r = await cache.dispatch('graph_dead', { entry_points: '../outside.txt' }, root);
        expect(r['status']).toBe('error');
        expect(r['error']).toMatch(/path escapes consumer_root/);
    }, 60_000);
});

describe('4.2 — the stdio install hint', () => {
    it('carries no `npx -y`, which is the step verify', () => {
        const raw = fs.readFileSync('src/scripts/mcp_server/consumer_tool_catalog.json', 'utf-8');
        expect(raw.includes('npx -y')).toBe(false);
    });

    it('is the installed-binary form, and the description states the PATH assumption', () => {
        const c = catalog as { install_hint_stdio: string; description: string };
        expect(c.install_hint_stdio).toBe('agent-config mcp-server');
        expect(c.description).toContain('assumes `agent-config` is on PATH');
    });
});
