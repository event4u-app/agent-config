/**
 * Roadmap step 3.3 — register the MCP server on the hosts the capability axis
 * records as reading a project MCP config, and on no others.
 *
 * The verify has two halves and they need opposite fixtures, so the axis reader
 * is injected: one test supplies an OBSERVED `true` and asserts the entry
 * lands, the other uses the real registry and asserts nothing does. The second
 * is the one that describes today's shipped behaviour.
 */
import { describe, expect, it, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
    MCP_PROJECT_CONFIG,
    makeEnsureMcpRegistrations,
    mcpRegistrationTargets,
    MCP_SERVER_KEY,
    type MergeJsonFile,
} from '../../src/scripts/_lib/mcp_bridge.js';
import { probeHostCapabilities } from '../../src/scripts/_lib/host_capability.js';

const tmpDirs: string[] = [];
function mkTmp(): string {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-reg-'));
    tmpDirs.push(d);
    return d;
}
afterEach(() => {
    for (const d of tmpDirs.splice(0)) fs.rmSync(d, { recursive: true, force: true });
});

/** A minimal stand-in for the installer's `merge_json_file`: deep-merge + write. */
const mergeJsonFile: MergeJsonFile = (filePath, entry, _force, _label) => {
    let doc: Record<string, unknown> = {};
    try {
        doc = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as Record<string, unknown>;
    } catch {
        doc = {};
    }
    const servers = (doc.mcpServers ?? {}) as Record<string, unknown>;
    const wanted = (entry.mcpServers ?? {}) as Record<string, unknown>;
    doc.mcpServers = { ...servers, ...wanted };
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, `${JSON.stringify(doc, null, 2)}\n`, 'utf-8');
    return [entry];
};

const ensure = makeEnsureMcpRegistrations(mergeJsonFile);
const ALL_TOOLS = new Set(['claude-code', 'cursor', 'gemini-cli', 'windsurf']);

function serversIn(root: string, rel: string): string[] {
    const p = path.join(root, ...rel.split('/'));
    if (!fs.existsSync(p)) return [];
    const doc = JSON.parse(fs.readFileSync(p, 'utf-8')) as Record<string, unknown>;
    return Object.keys((doc.mcpServers ?? {}) as Record<string, unknown>);
}

describe('step 3.3 — a host the axis marks as reading a project MCP config IS registered', () => {
    it('writes the entry into that host’s own config file', () => {
        const root = mkTmp();
        const targets = mcpRegistrationTargets(ALL_TOOLS, (h) => h === 'cursor');
        expect(targets.map((t) => t.toolId)).toEqual(['cursor']);
        ensure(root, false, root, targets);
        expect(serversIn(root, '.cursor/mcp.json')).toContain(MCP_SERVER_KEY);
    });

    it('registers several hosts when the axis marks several', () => {
        const root = mkTmp();
        const targets = mcpRegistrationTargets(ALL_TOOLS, (h) => h === 'cursor' || h === 'gemini');
        ensure(root, false, root, targets);
        expect(serversIn(root, '.cursor/mcp.json')).toContain(MCP_SERVER_KEY);
        expect(serversIn(root, '.gemini/settings.json')).toContain(MCP_SERVER_KEY);
    });

    it('leaves a neighbour server in that file byte-identical', () => {
        const root = mkTmp();
        const p = path.join(root, '.cursor', 'mcp.json');
        fs.mkdirSync(path.dirname(p), { recursive: true });
        fs.writeFileSync(p, JSON.stringify({ mcpServers: { neighbour: { command: 'x' } } }, null, 2));
        ensure(root, false, root, mcpRegistrationTargets(ALL_TOOLS, (h) => h === 'cursor'));
        const doc = JSON.parse(fs.readFileSync(p, 'utf-8')) as Record<string, unknown>;
        const servers = doc.mcpServers as Record<string, unknown>;
        expect(servers.neighbour).toEqual({ command: 'x' });
        expect(servers[MCP_SERVER_KEY]).toBeDefined();
    });
});

describe('step 3.3 — a host the axis does NOT mark gets nothing', () => {
    it('writes no entry when the axis says false for every host', () => {
        const root = mkTmp();
        const targets = mcpRegistrationTargets(ALL_TOOLS, () => false);
        expect(targets).toEqual([]);
        ensure(root, false, root, targets);
        for (const spec of Object.values(MCP_PROJECT_CONFIG)) {
            expect(serversIn(root, spec.relPath)).toEqual([]);
        }
    });

    it('a marked host that is NOT in the --tools set is still not registered', () => {
        const root = mkTmp();
        const targets = mcpRegistrationTargets(new Set(['claude-code']), () => true);
        expect(targets).toEqual([]);
        ensure(root, false, root, targets);
        expect(serversIn(root, '.cursor/mcp.json')).toEqual([]);
    });

    it('a host with no entry in the config table is never a target, marked or not', () => {
        const targets = mcpRegistrationTargets(new Set(['windsurf', 'cline', 'copilot']), () => true);
        expect(targets).toEqual([]);
    });
});

describe('step 3.3 — the measured state of the real axis', () => {
    it('no host in the committed registry records reads_project_mcp_config', () => {
        // The honest reading, pinned so a future observation has to change this
        // test deliberately rather than drift past it. `false` here is "nobody
        // answered", NOT "checked and absent".
        for (const spec of Object.values(MCP_PROJECT_CONFIG)) {
            expect(probeHostCapabilities(spec.hostId).reads_project_mcp_config).toBe(false);
        }
    });

    it('so the real installer registers zero additional hosts', () => {
        const targets = mcpRegistrationTargets(ALL_TOOLS, (h) => probeHostCapabilities(h).reads_project_mcp_config);
        expect(targets).toEqual([]);
    });

    it('claude-code is never routed through the axis — its registration is unconditional', () => {
        // Routing it here would DELETE a working `.mcp.json` write, because the
        // axis reports false for every host today.
        expect(mcpRegistrationTargets(new Set(['claude-code']), () => true).map((t) => t.toolId)).toEqual([]);
        expect(MCP_PROJECT_CONFIG['claude-code']).toBeDefined();
    });
});
