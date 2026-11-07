/**
 * road-to-a-link-with-agent-switch 2.2 — the installer's `.mcp.json` entry for
 * the link: enabled → written and recorded; disabled → removed; absent →
 * untouched. Driven through `registerMcpHosts`, the call site install uses.
 */
import { afterEach, describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { AGENT_SWITCH_MCP_KEY, type LinkProbe } from '../../src/scripts/_lib/agent_switch_link.js';
import { MCP_SERVER_KEY, type MergeJsonFile, registerMcpHosts } from '../../src/scripts/_lib/mcp_bridge.js';

const dirs: string[] = [];
afterEach(() => {
    for (const d of dirs.splice(0)) fs.rmSync(d, { recursive: true, force: true });
});
function root(): string {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'as-install-'));
    dirs.push(d);
    return d;
}

/** Deep-merges `mcpServers` and records one entry per merged server key, like the installer. */
const mergeJsonFile: MergeJsonFile = (filePath, entry) => {
    let doc: Record<string, unknown> = {};
    try {
        doc = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as Record<string, unknown>;
    } catch {
        doc = {};
    }
    const wanted = (entry['mcpServers'] ?? {}) as Record<string, unknown>;
    doc['mcpServers'] = { ...((doc['mcpServers'] ?? {}) as Record<string, unknown>), ...wanted };
    fs.writeFileSync(filePath, `${JSON.stringify(doc, null, 2)}\n`, 'utf-8');
    return Object.keys(wanted).map((k) => ({ file: '.mcp.json', pointer: `/mcpServers/${k}` }));
};

const LINK = { command: 'agent-switch', args: ['mcp', 'serve'] };
const present = (): LinkProbe => ({
    state: 'present',
    status: { enabled: true, version: '2.13.0', contract: 1, mcp: LINK },
});
const state = (s: 'disabled' | 'incompatible' | 'absent' | 'failed') => (): LinkProbe => ({ state: s, detail: 'test' });

function servers(r: string): Record<string, unknown> {
    const p = path.join(r, '.mcp.json');
    if (!fs.existsSync(p)) return {};
    return (JSON.parse(fs.readFileSync(p, 'utf-8')) as { mcpServers?: Record<string, unknown> }).mcpServers ?? {};
}
function seed(r: string, extra: Record<string, unknown>): void {
    fs.writeFileSync(path.join(r, '.mcp.json'), `${JSON.stringify({ mcpServers: extra }, null, 2)}\n`, 'utf-8');
}
function install(r: string, link: () => LinkProbe, tools = new Set(['claude-code'])) {
    const into: Record<string, Record<string, unknown>[]> = {};
    registerMcpHosts(mergeJsonFile, r, false, r, tools, into, () => false, link);
    return (into['claude-code'] ?? []).map((e) => e['pointer']);
}

describe('2.2 the agent-switch entry in .mcp.json', () => {
    it('enabled: writes the advertised command next to our own server and records it', () => {
        const r = root();
        const recorded = install(r, present);
        expect(servers(r)[AGENT_SWITCH_MCP_KEY]).toEqual(LINK);
        expect(servers(r)[MCP_SERVER_KEY]).toBeDefined();
        expect(recorded).toContain(`/mcpServers/${AGENT_SWITCH_MCP_KEY}`);
    });

    it.each(['disabled', 'incompatible'] as const)('%s: removes our entry and records nothing for it', (s) => {
        const r = root();
        seed(r, { [AGENT_SWITCH_MCP_KEY]: LINK, mine: { command: 'x' } });
        const recorded = install(r, state(s));
        expect(servers(r)[AGENT_SWITCH_MCP_KEY]).toBeUndefined();
        expect(servers(r)['mine']).toEqual({ command: 'x' });
        expect(recorded).not.toContain(`/mcpServers/${AGENT_SWITCH_MCP_KEY}`);
    });

    it('disabled: a hand-written server under the same key is not ours and stays', () => {
        const r = root();
        const handWritten = { command: '/opt/as/bin/agent-switch', args: ['mcp', 'serve'], env: { X: '1' } };
        seed(r, { [AGENT_SWITCH_MCP_KEY]: handWritten });
        install(r, state('disabled'));
        expect(servers(r)[AGENT_SWITCH_MCP_KEY]).toEqual(handWritten);
    });

    it.each(['absent', 'failed'] as const)('%s: leaves an existing entry as it is and keeps it recorded', (s) => {
        const r = root();
        seed(r, { [AGENT_SWITCH_MCP_KEY]: LINK });
        const recorded = install(r, state(s));
        expect(servers(r)[AGENT_SWITCH_MCP_KEY]).toEqual(LINK);
        expect(recorded).toContain(`/mcpServers/${AGENT_SWITCH_MCP_KEY}`);
    });

    it('absent: writes nothing where there was nothing', () => {
        const r = root();
        install(r, state('absent'));
        expect(servers(r)[AGENT_SWITCH_MCP_KEY]).toBeUndefined();
    });

    it('does not probe or write when claude-code is not selected', () => {
        const r = root();
        let probed = false;
        install(r, () => {
            probed = true;
            return present();
        }, new Set(['cursor']));
        expect(probed).toBe(false);
        expect(servers(r)[AGENT_SWITCH_MCP_KEY]).toBeUndefined();
    });
});
