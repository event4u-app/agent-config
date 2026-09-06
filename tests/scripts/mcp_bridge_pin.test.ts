// The `.mcp.json` version pin and its update path.
//
// Unpinned, `npx -y @event4u/agent-config` resolves the `latest` dist-tag on
// every server start, so the server a consumer runs is whatever the registry
// served most recently rather than the artefact their installer approved. The
// pin closes that; the migrate path stops the pin itself from freezing at the
// version of the install that wrote it.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
    MCP_PACKAGE_NAME,
    MCP_SERVER_KEY,
    mcpBridgeEntry,
    migrateMcpBridge,
    readPackageVersion,
} from '../../src/scripts/_lib/mcp_bridge.js';

function serverOf(entry: Record<string, unknown>): { command: string; args: string[] } {
    const servers = entry['mcpServers'] as Record<string, unknown>;
    return servers[MCP_SERVER_KEY] as { command: string; args: string[] };
}

describe('mcpBridgeEntry — the emitted spec equals the manifest version', () => {
    let root: string;
    beforeEach(() => {
        root = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-pin-'));
    });
    afterEach(() => {
        fs.rmSync(root, { recursive: true, force: true });
    });

    it('pins to the version in package.json', () => {
        fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ version: '14.18.0' }));
        expect(serverOf(mcpBridgeEntry(root)).args).toEqual([
            '-y',
            `${MCP_PACKAGE_NAME}@14.18.0`,
            'mcp-server',
        ]);
    });

    it('reads the same version readPackageVersion reports', () => {
        fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ version: '9.9.9' }));
        const version = readPackageVersion(root);
        expect(version).toBe('9.9.9');
        expect(serverOf(mcpBridgeEntry(root)).args[1]).toBe(`${MCP_PACKAGE_NAME}@${version!}`);
    });

    it('leaves the spec UNPINNED when the version cannot be read', () => {
        // Deliberate: an invented specifier would fail to resolve at server
        // start, which is a worse failure than the drift the pin closes.
        expect(serverOf(mcpBridgeEntry(root)).args[1]).toBe(MCP_PACKAGE_NAME);
        fs.writeFileSync(path.join(root, 'package.json'), '{ not json');
        expect(serverOf(mcpBridgeEntry(root)).args[1]).toBe(MCP_PACKAGE_NAME);
    });

    it('never emits a bare `latest` dist-tag once a version is readable', () => {
        fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ version: '1.2.3' }));
        expect(JSON.stringify(mcpBridgeEntry(root))).not.toContain('latest');
    });
});

describe('migrateMcpBridge — rewrites our key and nothing beside it', () => {
    let root: string;
    const NEIGHBOUR = { command: 'node', args: ['./their-server.js'], env: { THEIRS: '1' } };

    function writeMcpJson(entry: unknown): void {
        fs.writeFileSync(
            path.join(root, '.mcp.json'),
            JSON.stringify({ mcpServers: { neighbour: NEIGHBOUR, [MCP_SERVER_KEY]: entry } }, null, 2),
        );
    }
    function readBack(): Record<string, unknown> {
        const doc = JSON.parse(fs.readFileSync(path.join(root, '.mcp.json'), 'utf-8')) as Record<
            string,
            unknown
        >;
        return doc['mcpServers'] as Record<string, unknown>;
    }

    beforeEach(() => {
        root = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-migrate-'));
        fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ version: '14.18.0' }));
    });
    afterEach(() => {
        fs.rmSync(root, { recursive: true, force: true });
    });

    it('rewrites an old-shape entry and leaves a hand-added neighbour byte-identical', () => {
        writeMcpJson({ command: 'npx', args: ['-y', MCP_PACKAGE_NAME, 'mcp-server'] });
        expect(migrateMcpBridge(root, root)).toBe('rewritten');

        const servers = readBack();
        expect((servers[MCP_SERVER_KEY] as { args: string[] }).args[1]).toBe(
            `${MCP_PACKAGE_NAME}@14.18.0`,
        );
        // The whole point: the neighbour is not read, reordered or rewritten.
        expect(JSON.stringify(servers['neighbour'])).toBe(JSON.stringify(NEIGHBOUR));
    });

    it('reports `current` and writes nothing when the entry already matches', () => {
        writeMcpJson(serverOf(mcpBridgeEntry(root)));
        const before = fs.readFileSync(path.join(root, '.mcp.json'), 'utf-8');
        expect(migrateMcpBridge(root, root)).toBe('current');
        expect(fs.readFileSync(path.join(root, '.mcp.json'), 'utf-8')).toBe(before);
    });

    it('is idempotent — a second run is a no-op', () => {
        writeMcpJson({ command: 'npx', args: ['-y', MCP_PACKAGE_NAME, 'mcp-server'] });
        expect(migrateMcpBridge(root, root)).toBe('rewritten');
        expect(migrateMcpBridge(root, root)).toBe('current');
    });

    it('reports `absent` rather than creating a file install owns', () => {
        expect(migrateMcpBridge(root, root)).toBe('absent');
        expect(fs.existsSync(path.join(root, '.mcp.json'))).toBe(false);
    });

    it('reports `absent` when the file carries no entry of ours', () => {
        fs.writeFileSync(
            path.join(root, '.mcp.json'),
            JSON.stringify({ mcpServers: { neighbour: NEIGHBOUR } }, null, 2),
        );
        expect(migrateMcpBridge(root, root)).toBe('absent');
        expect(readBack()[MCP_SERVER_KEY]).toBeUndefined();
    });
});
