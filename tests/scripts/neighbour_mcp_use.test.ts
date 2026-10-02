/**
 * Foreign MCP servers counted by use
 * (road-to-neighbours-that-pull-their-weight step 3.3).
 *
 * The census publishes what the post-tool recorder observed. Three properties
 * are load-bearing and each has its own case: the window actually excludes an
 * old sighting, the server segment is matched after the same sanitisation a
 * host applies (an exact-key match would report `0` for every server whose
 * name carries a dot, which reads as "never used" rather than as "never
 * matched"), and `advertised` stays the literal `unknown` because nothing in a
 * read-only census launches a neighbour's process to ask.
 *
 * A planted store on disk rather than an injected map, for the reason every
 * other fixture in this directory plants a tree: the thing under test is
 * whether the census reads the file the hook actually writes, and a literal
 * would let a path mismatch pass.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';
import { parse } from 'yaml';

import { renderText } from '../../src/scripts/_cli/cmd_doctor_neighbours.js';
import { _concern_matches_tool } from '../../src/scripts/hooks/dispatch_hook.js';
import { census } from '../../src/scripts/_lib/neighbour_census.js';
import { serverOf, serverSegment } from '../../src/scripts/_lib/neighbour_tool_use.js';

const REPO_ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..');

const dirs: string[] = [];

afterEach(() => {
    while (dirs.length > 0) {
        fs.rmSync(dirs.pop() as string, { recursive: true, force: true });
    }
});

function write(root: string, rel: string, body: string): void {
    const full = path.join(root, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, body, 'utf-8');
}

function plant(store: Record<string, string> | null, servers: Record<string, unknown>): string {
    const root = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'mcp-use-'));
    dirs.push(root);
    write(root, '.mcp.json', JSON.stringify({ mcpServers: servers }));
    if (store !== null) {
        write(root, path.join('agents', 'runtime', 'neighbour-tool-use.json'), JSON.stringify(store));
    }
    return root;
}

const NOW = new Date('2026-10-02T12:00:00.000Z');

describe('mcp servers carry observed use', () => {
    it('counts distinct tools inside the window and drops one outside it', () => {
        const root = plant(
            {
                mcp__acme__alpha: '2026-10-01',
                mcp__acme__beta: '2026-09-20',
                mcp__acme__gamma: '2026-07-01',
                mcp__other__delta: '2026-10-02',
            },
            { acme: { command: 'acme-mcp' }, other: { command: 'other-mcp' } },
        );

        const byId = new Map(census(root, { now: NOW }).mcp_servers.map((m) => [m.id, m]));

        // `gamma` is 93 days old and must not be counted; `beta` is 12 and must.
        expect(byId.get('project:acme')?.tools_used_30d).toBe(2);
        expect(byId.get('project:other')?.tools_used_30d).toBe(1);
        expect(byId.get('project:acme')?.tools_window_days).toBe(30);
    });

    it('matches a server whose key is sanitised inside the tool name', () => {
        const root = plant(
            { mcp__claude_ai_Claude_Docs__read: '2026-10-02' },
            { 'claude.ai Claude Docs': { command: 'docs-mcp' } },
        );

        expect(census(root, { now: NOW }).mcp_servers[0]?.tools_used_30d).toBe(1);
    });

    it('reports 0 observed and advertised unknown when no store was ever written', () => {
        const entry = census(plant(null, { acme: { command: 'acme-mcp' } }), { now: NOW }).mcp_servers[0];

        expect(entry?.tools_used_30d).toBe(0);
        // Never a ratio. The denominator is not missing by accident — it is
        // not obtainable without launching the neighbour, which this does not do.
        expect(entry?.tools_advertised).toBe('unknown');
    });

    it('ignores a malformed store rather than failing the census', () => {
        const root = plant(null, { acme: { command: 'acme-mcp' } });
        write(root, path.join('agents', 'runtime', 'neighbour-tool-use.json'), '{ not json');

        expect(census(root, { now: NOW }).mcp_servers[0]?.tools_used_30d).toBe(0);
    });

    it('prints the pair on the text surface and the number in --json', () => {
        const c = census(plant({ mcp__acme__alpha: '2026-10-02' }, { acme: { command: 'acme-mcp' } }), {
            now: NOW,
        });

        expect(renderText(c).join('\n')).toContain('project:acme  tools used (30d): 1  advertised: unknown');
        // The step's own verify line, asserted against the JSON the CLI prints.
        expect(JSON.stringify(c)).toMatch(/"tools_used_30d":\s*[0-9]+/);
    });
});

/**
 * The recorder has to be REACHED before it can record, and nothing above this
 * block can tell whether it is: every case here calls the hook directly, which
 * is exactly how a concern the dispatcher skips keeps a green test suite.
 *
 * `_concern_matches_tool` matches a `tools:` entry EXACTLY — `names.includes`,
 * no globbing — so `tools: [Skill]`, which was provable from this hook's source
 * while `Skill` was its only branch surface, now silences it for every MCP call.
 * There is no value of the key that admits `mcp__<server>__<tool>`, because the
 * names are not enumerable. The entry therefore carries no `tools:` key, and
 * this asserts that against the SHIPPED manifest rather than against a literal.
 */
describe('the recorder is reachable through the dispatcher', () => {
    it('the shipped telemetry-usage entry admits an mcp__ tool name', () => {
        const manifest = parse(
            fs.readFileSync(path.join(REPO_ROOT, 'src', 'scripts', 'hook_manifest.yaml'), 'utf-8'),
        ) as { concerns: Record<string, Record<string, unknown>> };
        const entry = manifest.concerns['telemetry-usage'];

        expect(entry).toBeDefined();
        expect(_concern_matches_tool(entry as never, 'mcp__acme__alpha')).toBe(true);
        expect(_concern_matches_tool(entry as never, 'Skill')).toBe(true);
    });

    it('NEGATIVE CONTROL — the filter this entry must not carry would silence it', () => {
        // Without this the assertion above passes for a filter that admits
        // everything, which is indistinguishable from a filter that was never
        // consulted. `tools: [Skill]` is the exact shape that was there.
        expect(_concern_matches_tool({ tools: ['Skill'] } as never, 'mcp__acme__alpha')).toBe(false);
        // And a glob is not an escape: matching is exact, so this is also false.
        expect(_concern_matches_tool({ tools: ['Skill', 'mcp__*'] } as never, 'mcp__acme__alpha')).toBe(
            false,
        );
    });
});

describe('the tool-name parser', () => {
    it('splits a server segment off, and refuses a name that is not an MCP tool', () => {
        expect(serverOf('mcp__linear-server__create_issue')).toBe('linear-server');
        expect(serverOf('mcp__acme')).toBe('acme');
        expect(serverOf('Bash')).toBeNull();
        expect(serverOf('mcp__')).toBeNull();
    });

    it('sanitises a key the way a host embeds it', () => {
        expect(serverSegment('claude.ai Claude Docs')).toBe('claude_ai_Claude_Docs');
        expect(serverSegment('linear-server')).toBe('linear-server');
    });
});
