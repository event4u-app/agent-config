/**
 * Tests for the consumer_matrix.ts hook-lifecycle leg (road-to-feedback-8.11
 * Phase 0 — "Consumer-matrix hook lifecycle").
 *
 * No network, no real `npm pack` / global install: every case exercises the
 * pure building blocks the leg is built from — hook-command discovery,
 * envelope shaping, dist-manifest graph walking, and single-command
 * invocation — against small on-disk fixtures. This is the same pattern
 * `tests/scripts/_cli/cmd_conformance.test.ts` uses for its dispatcher smoke
 * (a fake runner script instead of the real dispatcher).
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { MANAGED_SIGNATURE } from '../../src/scripts/_lib/claude_settings_hooks.js';
import {
    buildHookEnvelope,
    checkDistManifestCompleteness,
    invokeHookCommand,
    parseRelativeSpecifiers,
    readInstalledClaudeHookCommands,
    walkEsmModuleGraph,
} from '../../src/scripts/consumer_matrix.js';

let tmp: string;
beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), 'consumer-matrix-hook-lifecycle-'));
});
afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
});

// ── parseRelativeSpecifiers ─────────────────────────────────────────

describe('parseRelativeSpecifiers', () => {
    it('extracts static, bare, and dynamic relative specifiers', () => {
        const source = [
            'import { a } from "./a.js";',
            'import "./bare-side-effect.js";',
            'export { b } from "../b.js";',
            'const p = import("./dynamic.js");',
        ].join('\n');
        expect(parseRelativeSpecifiers(source).sort()).toEqual(
            ['../b.js', './a.js', './bare-side-effect.js', './dynamic.js'].sort(),
        );
    });

    it('ignores bare package specifiers', () => {
        const source = "import Fastify from 'fastify';\nimport { Command } from 'commander';\n";
        expect(parseRelativeSpecifiers(source)).toEqual([]);
    });

    it('de-duplicates repeated specifiers', () => {
        const source = 'import "./x.js";\nimport "./x.js";\n';
        expect(parseRelativeSpecifiers(source)).toEqual(['./x.js']);
    });
});

// ── walkEsmModuleGraph / checkDistManifestCompleteness ──────────────
//
// Reproduces the historical bug class this leg exists to catch: an
// entrypoint whose compiled import graph references a sibling `.js` that
// was never committed (dist/install/rule_scope.js, PR #882).

describe('walkEsmModuleGraph — dist-manifest completeness', () => {
    it('clean graph: every relative import resolves', () => {
        const cli = join(tmp, 'cli');
        const install = join(tmp, 'install');
        mkdirSync(cli, { recursive: true });
        mkdirSync(install, { recursive: true });
        writeFileSync(join(cli, 'agent-config.js'), 'void import("./main.js");\n');
        writeFileSync(join(cli, 'main.js'), 'import { x } from "../install/rule_scope.js";\n');
        writeFileSync(join(install, 'rule_scope.js'), 'export const x = 1;\n');

        const { visited, missing } = walkEsmModuleGraph(join(cli, 'agent-config.js'));
        expect(missing).toEqual([]);
        expect(visited).toHaveLength(3);

        const result = checkDistManifestCompleteness(join(cli, 'agent-config.js'));
        expect(result.ok).toBe(true);
        expect(result.message).toContain('3 module(s)');
    });

    it('SABOTAGE: a missing sibling module fails deterministically (rule_scope.js class)', () => {
        const cli = join(tmp, 'cli');
        const server = join(tmp, 'server');
        mkdirSync(cli, { recursive: true });
        mkdirSync(server, { recursive: true });
        writeFileSync(join(cli, 'agent-config.js'), 'void import("./main.js");\n');
        writeFileSync(join(cli, 'main.js'), 'import { createApp } from "../server/app.js";\n');
        // `../install/rule_scope.js` is imported by app.js but never written —
        // the exact shape of the historical bug (PR #882).
        writeFileSync(join(server, 'app.js'), 'import { ruleScopeFromSettings } from "../install/rule_scope.js";\n');

        const { missing } = walkEsmModuleGraph(join(cli, 'agent-config.js'));
        expect(missing).toHaveLength(1);
        expect(missing[0]!.spec).toBe('../install/rule_scope.js');

        const result = checkDistManifestCompleteness(join(cli, 'agent-config.js'));
        expect(result.ok).toBe(false);
        expect(result.message).toContain('rule_scope.js');
        expect(result.message).toContain('1 missing module');
    });

    it('SABOTAGE: the entrypoint itself is missing', () => {
        const result = checkDistManifestCompleteness(join(tmp, 'no-such-entry.js'));
        expect(result.ok).toBe(false);
        expect(result.message).toContain('missing');
    });
});

// ── readInstalledClaudeHookCommands ─────────────────────────────────

function writeSettings(path_: string, hooks: Record<string, unknown>): void {
    writeFileSync(path_, JSON.stringify({ hooks }, null, 2));
}

describe('readInstalledClaudeHookCommands', () => {
    it('returns only managed groups, keyed by native event', () => {
        const settingsPath = join(tmp, 'settings.json');
        writeSettings(settingsPath, {
            SessionStart: [
                { hooks: [{ type: 'command', command: `echo user-owned` }] },
                {
                    hooks: [
                        {
                            type: 'command',
                            command: `"$BIN" ${MANAGED_SIGNATURE} --event session_start --native-event SessionStart`,
                        },
                    ],
                },
            ],
            Stop: [{ hooks: [{ type: 'command', command: 'echo untouched-user-hook' }] }],
        });

        const entries = readInstalledClaudeHookCommands(settingsPath);
        expect(entries).toHaveLength(1);
        expect(entries[0]!.nativeEvent).toBe('SessionStart');
        expect(entries[0]!.command).toContain(MANAGED_SIGNATURE);
    });

    it('missing settings file → empty result, no throw', () => {
        expect(readInstalledClaudeHookCommands(join(tmp, 'absent.json'))).toEqual([]);
    });
});

// ── buildHookEnvelope ────────────────────────────────────────────────

describe('buildHookEnvelope', () => {
    it('shapes a PreToolUse envelope with tool_name + tool_input', () => {
        const env = JSON.parse(buildHookEnvelope('PreToolUse', '/proj')) as Record<string, unknown>;
        expect(env['hook_event_name']).toBe('PreToolUse');
        expect(env['tool_name']).toBe('Read');
        expect(env['tool_input']).toBeDefined();
    });

    it('shapes a Stop envelope with stop_hook_active', () => {
        const env = JSON.parse(buildHookEnvelope('Stop', '/proj')) as Record<string, unknown>;
        expect(env['hook_event_name']).toBe('Stop');
        expect(env['stop_hook_active']).toBe(false);
    });

    it('falls back to a SessionStart-shaped envelope for unknown events', () => {
        const env = JSON.parse(buildHookEnvelope('SomethingNew', '/proj')) as Record<string, unknown>;
        expect(env['source']).toBe('startup');
    });
});

// ── invokeHookCommand ────────────────────────────────────────────────

describe('invokeHookCommand', () => {
    it('a clean command exits 0', () => {
        const result = invokeHookCommand(
            { nativeEvent: 'Stop', command: 'cat >/dev/null; exit 0' },
            { cwd: tmp, env: process.env, projectDir: tmp },
        );
        expect(result.ok).toBe(true);
        expect(result.status).toBe(0);
    });

    it('SABOTAGE: a hook entrypoint referencing a missing module fails the leg', () => {
        // Same shape as the real hook command ("$BIN" dispatch:hook …) but the
        // resolved script requires a module that does not exist — the
        // ERR_MODULE_NOT_FOUND class this leg exists to surface.
        const entry = join(tmp, 'broken-entry.mjs');
        writeFileSync(entry, "import './does-not-exist.mjs';\n");
        const result = invokeHookCommand(
            { nativeEvent: 'Stop', command: `node ${entry}` },
            { cwd: tmp, env: process.env, projectDir: tmp },
        );
        expect(result.ok).toBe(false);
        expect(result.status).not.toBe(0);
        expect(result.stderrTail.length).toBeGreaterThan(0);
        expect(result.stderrTail).toMatch(/does-not-exist|MODULE_NOT_FOUND|Cannot find/);
    });
});
