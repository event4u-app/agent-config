// Phase 1.3 of `road-to-skill-delivery-over-mcp` — `.mcp.json`, the project-scope
// config Claude Code reads, and the reason the installer owns it.
//
// D3 of the roadmap: `grep -ic mcp src/scripts/install.ts` was 0, so a fresh
// consumer install produced no MCP config at all, so the `suggest_skill_for_task`
// Iron Law in `rules/missing-skill-recovery.md` was unfulfillable by default.
//
// WHY NOT `mcp_render`, which the roadmap's step text named. That CLI projects the
// consumer's own root `mcp.json` onto per-tool configs by OVERWRITING them, which
// would delete both our entry and any server the consumer added by hand. The
// installer's `merge_json_file` writes only our key and records it as an RFC-6901
// pointer so uninstall subtracts exactly that key. `mcp:check` keeps the
// target-awareness the step asked for, as containment rather than equality.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { ensure_mcp_bridge } from '../../src/scripts/install.js';
import { MCP_SERVER_KEY } from '../../src/scripts/_lib/mcp_bridge.js';
import { check_mcp_json } from '../../src/scripts/mcp_render.js';
import { _scan } from '../../src/scripts/lint_mcp_config_security.js';
import { ScannedFile } from '../../src/scripts/_lib/security_lint.js';

let project: string;

beforeEach(() => {
    project = fs.mkdtempSync(path.join(os.tmpdir(), 'mcpjson-'));
});
afterEach(() => {
    fs.rmSync(project, { recursive: true, force: true });
});

function readMcpJson(): Record<string, any> {
    return JSON.parse(fs.readFileSync(path.join(project, '.mcp.json'), 'utf8'));
}

describe('ensure_mcp_bridge — a fresh install produces the entry', () => {
    it('creates .mcp.json with the documented npx entry', () => {
        ensure_mcp_bridge(project, false);
        const data = readMcpJson();
        expect(data.mcpServers[MCP_SERVER_KEY]).toEqual({
            command: 'npx',
            args: ['-y', '@event4u/agent-config', 'mcp-server'],
        });
    });

    it('reports the merged key as an RFC-6901 pointer so uninstall can subtract it', () => {
        const merged = ensure_mcp_bridge(project, false);
        expect(merged.length).toBeGreaterThan(0);
        const pointers = merged.map((m) => String(m.json_pointer ?? ''));
        expect(pointers.some((p) => p.includes('mcpServers'))).toBe(true);
        expect(merged.every((m) => String(m.file ?? '').includes('.mcp.json'))).toBe(true);
    });

    it('is idempotent — a second run changes nothing', () => {
        ensure_mcp_bridge(project, false);
        const first = fs.readFileSync(path.join(project, '.mcp.json'), 'utf8');
        ensure_mcp_bridge(project, false);
        expect(fs.readFileSync(path.join(project, '.mcp.json'), 'utf8')).toBe(first);
    });

    it('MERGES — it never deletes a server the consumer added by hand', () => {
        fs.writeFileSync(
            path.join(project, '.mcp.json'),
            JSON.stringify({ mcpServers: { 'their-server': { command: 'their-cmd' } } }, null, 2),
        );
        ensure_mcp_bridge(project, false);
        const data = readMcpJson();
        expect(data.mcpServers['their-server']).toEqual({ command: 'their-cmd' });
        expect(data.mcpServers[MCP_SERVER_KEY].command).toBe('npx');
    });

    it('preserves unrelated top-level keys', () => {
        fs.writeFileSync(
            path.join(project, '.mcp.json'),
            JSON.stringify({ mcpServers: {}, somethingElse: { keep: true } }, null, 2),
        );
        ensure_mcp_bridge(project, false);
        expect(readMcpJson().somethingElse).toEqual({ keep: true });
    });
});

describe('lint_mcp_config_security on the produced file', () => {
    it('produces no FAIL finding — npx -y is a documented warn, not a leak', () => {
        ensure_mcp_bridge(project, false);
        const target = path.join(project, '.mcp.json');
        const lines = fs.readFileSync(target, 'utf8').split('\n');
        const sf = new ScannedFile(
            target,
            '.mcp.json',
            lines,
            new Array(lines.length + 1).fill(false),
            new Array(lines.length + 1).fill(false),
            {},
            1,
        );
        const findings = _scan(sf);
        // The gate's exit code is driven by `is_fail` only; MED smells warn.
        expect(findings.filter((f) => f.is_fail)).toEqual([]);
        // And the file must carry no inline secret at all, warn or fail.
        expect(fs.readFileSync(target, 'utf8')).not.toMatch(/sk-ant-|AKIA|ghp_/);
    });
});

describe('mcp:check treats .mcp.json as a target (containment, not equality)', () => {
    it('reports absent on a tree where the installer has not run', () => {
        expect(check_mcp_json(project)).toBe('absent');
    });

    it('reports ok once the installer has run', () => {
        ensure_mcp_bridge(project, false);
        expect(check_mcp_json(project)).toBe('ok');
    });

    it('reports missing-entry when the file exists without our server', () => {
        fs.writeFileSync(
            path.join(project, '.mcp.json'),
            JSON.stringify({ mcpServers: { other: {} } }),
        );
        expect(check_mcp_json(project)).toBe('missing-entry');
    });

    it('reports missing-entry when mcpServers is absent or the wrong shape', () => {
        fs.writeFileSync(path.join(project, '.mcp.json'), JSON.stringify({}));
        expect(check_mcp_json(project)).toBe('missing-entry');
        fs.writeFileSync(path.join(project, '.mcp.json'), JSON.stringify({ mcpServers: [] }));
        expect(check_mcp_json(project)).toBe('missing-entry');
    });

    it('reports unreadable rather than throwing on malformed JSON', () => {
        fs.writeFileSync(path.join(project, '.mcp.json'), '{ not json');
        expect(check_mcp_json(project)).toBe('unreadable');
    });

    it('does not confuse a consumer server that merely LOOKS like ours', () => {
        fs.writeFileSync(
            path.join(project, '.mcp.json'),
            JSON.stringify({ mcpServers: { 'agent-config-fork': {} } }),
        );
        expect(check_mcp_json(project)).toBe('missing-entry');
    });
});
