/**
 * `mcp:available` — the probe from `road-to-capability-answerability` 2.3.
 *
 * The step's requirement is a separation, not a lookup: declared servers and
 * the static tool registry are different things and conflating them IS the
 * defect. So the tests assert the separation and the honesty of the label —
 * `launchable` must never silently become `reachable`, because that is the
 * settings-derived-answer-as-detection failure Phase 1.2 exists to fix.
 */
import { describe, expect, it } from 'vitest';
import { chmodSync, mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
    classifyServer,
    parseArgv,
    resolveOnPath,
    runMcpAvailable,
} from '../../src/scripts/_cli/cmd_mcp_available.js';

function scratch(): string {
    return mkdtempSync(join(tmpdir(), 'mcp-available-'));
}

/** A real executable on a real directory, so PATH resolution is not mocked. */
function fakeBin(dir: string, name: string): string {
    mkdirSync(dir, { recursive: true });
    const file = join(dir, name);
    writeFileSync(file, '#!/bin/sh\nexit 0\n', 'utf-8');
    chmodSync(file, 0o755);
    return file;
}

describe('mcp:available argv', () => {
    it('accepts nothing and --json only', () => {
        expect(parseArgv([]).ok).toBe(true);
        expect(parseArgv(['--json'])).toMatchObject({ ok: true, json: true });
        expect(parseArgv(['extra']).ok).toBe(false);
    });
});

describe('PATH resolution', () => {
    it('finds an executable and rejects a non-executable of the same name', () => {
        const root = scratch();
        const bin = join(root, 'bin');
        fakeBin(bin, 'real-server');
        mkdirSync(join(root, 'other'), { recursive: true });
        writeFileSync(join(root, 'other', 'plain-file'), 'not executable', 'utf-8');

        expect(resolveOnPath('real-server', bin, root)).toBe(join(bin, 'real-server'));
        // Present but not executable must NOT count as launchable — the whole
        // value of the label is that it is weaker than "reachable", not vaguer.
        expect(resolveOnPath('plain-file', join(root, 'other'), root)).toBeNull();
        expect(resolveOnPath('definitely-absent-xyz', bin, root)).toBeNull();
    });
});

describe('server classification', () => {
    it('separates command, url, and malformed entries', () => {
        const root = scratch();
        const bin = join(root, 'bin');
        fakeBin(bin, 'srv');

        expect(classifyServer('a', { command: 'srv' }, bin, root)).toMatchObject({
            transport: 'command',
            launch: 'launchable',
        });
        expect(classifyServer('b', { command: 'nope-xyz' }, bin, root)).toMatchObject({
            transport: 'command',
            launch: 'not-on-path',
        });
        // A remote server is declared-but-unprobed by design: probing it would
        // add an outbound leg to a read-only status verb.
        expect(classifyServer('c', { url: 'https://example.com/mcp' }, bin, root)).toMatchObject({
            transport: 'url',
            launch: 'not-probed',
        });
        expect(classifyServer('d', {}, bin, root)).toMatchObject({
            transport: 'unknown',
            launch: 'not-probed',
        });
    });
});

describe('mcp:available report', () => {
    it('keeps declared servers and the static tool registry apart', () => {
        const root = scratch();
        const bin = join(root, 'bin');
        fakeBin(bin, 'srv');
        writeFileSync(
            join(root, 'mcp.json'),
            JSON.stringify({ servers: { alpha: { command: 'srv' } } }),
            'utf-8',
        );

        const payload = JSON.parse(
            runMcpAvailable({ cwd: root, json: true, pathEnv: bin }).out.join('\n'),
        ) as { declared_servers: unknown[]; tool_registry: string[]; handshake_performed: boolean };

        expect(payload.declared_servers).toHaveLength(1);
        // Two distinct fields, never merged into one "available tools" list.
        expect(payload.tool_registry).not.toContain('alpha');
        expect(payload.handshake_performed).toBe(false);
    });

    it('never claims reachability it did not measure', () => {
        const root = scratch();
        const bin = join(root, 'bin');
        fakeBin(bin, 'srv');
        writeFileSync(join(root, 'mcp.json'), JSON.stringify({ servers: { alpha: { command: 'srv' } } }), 'utf-8');

        const text = runMcpAvailable({ cwd: root, json: false, pathEnv: bin }).out.join('\n');
        expect(text).toContain('launchable');
        expect(text).toContain('No MCP handshake was performed');
        expect(text).not.toMatch(/\breachable\b(?!")/);
    });

    it('refuses to report "none" when mcp.json is unparseable', () => {
        const root = scratch();
        writeFileSync(join(root, 'mcp.json'), '{ this is not json', 'utf-8');

        const result = runMcpAvailable({ cwd: root, json: false, pathEnv: '' });
        // A declaration file that does not parse is a failure to answer. Exiting
        // 0 with an empty list would be the silent-wrong-guess this roadmap is about.
        expect(result.code).toBe(1);
        expect(result.err.join('\n')).toContain('not valid JSON');
    });

    it('answers cleanly when no mcp.json exists at all', () => {
        const root = scratch();
        const result = runMcpAvailable({ cwd: root, json: false, pathEnv: '' });
        expect(result.code).toBe(0);
        expect(result.out.join('\n')).toContain('no mcp.json in this project');
    });
});
