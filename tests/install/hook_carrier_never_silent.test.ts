// road-to-a-hook-carrier-that-is-never-silent Phases 2 and 3: the installed hook
// command reaches a dispatcher the package staged under the machine root before
// it falls back to PATH, and where no dispatcher resolves on a THINNED layer it
// says so in the session and restores the full layer for the next one. These
// run the real manifest-derived commands under /bin/sh with a stripped PATH.

import { spawnSync } from 'node:child_process';
import {
    closeSync,
    existsSync,
    mkdirSync,
    mkdtempSync,
    openSync,
    readdirSync,
    readFileSync,
    rmSync,
    writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { build_claude_hook_matrix, THINNED_DEAD_CARRIER_LINE } from '../../src/scripts/_lib/claude_settings_hooks.js';
import { absoluteBodyLinkPrefix } from '../../src/scripts/_lib/thin_rules.js';
import {
    describeCarrierProbe,
    describeCarrierState,
    layerAfterInstall,
    layerAfterSession,
    markClaudeLayer,
    prepareClaudeCarrier,
    probeAndPromote,
    probeHookCommand,
    readCarrierState,
    recordCarrierProbe,
    stageRuntime,
    type LayerState,
} from '../../src/install/stagedRuntime.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const MATRIX = build_claude_hook_matrix(path.join(REPO_ROOT, 'src', 'scripts', 'hook_manifest.yaml'));

const FIXTURE_DISPATCHER =
    "const a = process.argv.slice(2);\n" +
    "if (a.includes('--read-exit')) process.stderr.write('dispatch_hook: --read-exit ok (2 chars, 0 payload keys)\\n');\n" +
    "else process.stdout.write('FIXTURE-DISPATCH ' + process.env.FIXTURE_TAG + ' ' + a.slice(0, 4).join(' ') + '\\n');\n";

let tmp: string;
let machine: string;
let project: string;
let layer: string;

function write(p: string, body: string): void {
    mkdirSync(path.dirname(p), { recursive: true });
    writeFileSync(p, body);
}

function fixturePackage(dir: string, withDispatcher: boolean): string {
    write(path.join(dir, 'package.json'), JSON.stringify({ name: '@event4u/agent-config', version: '9.9.9' }));
    write(path.join(dir, 'src', 'scripts', 'hook_manifest.yaml'), 'schema_version: 1\n');
    write(path.join(dir, 'dist', 'agent-src', 'rules', 'alpha.md'), '# alpha\n');
    if (withDispatcher) write(path.join(dir, 'dist', 'hooks', 'dispatch.js'), FIXTURE_DISPATCHER);
    return dir;
}

const FULL: Record<string, string> = {
    'alpha.md': '---\npackage: event4u/agent-config\n---\n# alpha — the whole body\n',
    'beta.md': '---\npackage: event4u/agent-config\n---\n# beta — the whole body\n',
};

function runtimeRoot(): string {
    return path.join(machine, 'runtime');
}

function run(native: string, extraPath = '', extraEnv: Record<string, string> = {}) {
    const stdinPath = path.join(tmp, 'stdin.json');
    writeFileSync(stdinPath, '{}');
    const fd = openSync(stdinPath, 'r');
    try {
        const res = spawnSync('/bin/sh', ['-c', MATRIX[native] as string], {
            cwd: project,
            stdio: [fd, 'pipe', 'pipe'],
            encoding: 'utf-8',
            env: {
                PATH: extraPath === '' ? '/usr/bin:/bin' : `${extraPath}:/usr/bin:/bin`,
                HOME: tmp,
                EVENT4U_CONFIG_HOME: machine,
                CLAUDE_PROJECT_DIR: project,
                FIXTURE_TAG: 'x',
                ...extraEnv,
            },
            timeout: 30000,
        });
        expect(res.error).toBeUndefined();
        return res;
    } finally {
        closeSync(fd);
    }
}

beforeEach(() => {
    tmp = mkdtempSync(path.join(tmpdir(), 'carrier-'));
    machine = path.join(tmp, 'machine');
    project = path.join(tmp, 'empty-project');
    layer = path.join(tmp, 'claude', 'rules');
    mkdirSync(project, { recursive: true });
});
afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
});

describe('2.1 — the staged dispatcher ahead of PATH', () => {
    it('reaches the staged dispatcher from an empty directory with PATH=/usr/bin:/bin', () => {
        stageRuntime({ packageRoot: fixturePackage(path.join(tmp, 'pkg'), true), runtimeRoot: runtimeRoot(), nodePath: process.execPath });
        const res = run('SessionStart', '', { FIXTURE_TAG: 'staged' });
        expect(res.status).toBe(0);
        expect(res.stdout).toContain('FIXTURE-DISPATCH staged --platform claude --event session_start');
    });

    it('every installed hook command reaches it, not only SessionStart (AC-1)', () => {
        stageRuntime({ packageRoot: fixturePackage(path.join(tmp, 'pkg'), true), runtimeRoot: runtimeRoot(), nodePath: process.execPath });
        for (const native of Object.keys(MATRIX)) {
            expect(run(native, '', { FIXTURE_TAG: 'staged' }).stdout, native).toContain('FIXTURE-DISPATCH staged');
        }
    });

    it('a project-local install still wins where present', () => {
        stageRuntime({ packageRoot: fixturePackage(path.join(tmp, 'pkg'), true), runtimeRoot: runtimeRoot(), nodePath: process.execPath });
        const local = path.join(project, 'node_modules', '@event4u', 'agent-config', 'dist', 'hooks', 'dispatch.js');
        write(local, FIXTURE_DISPATCHER.replace("' + process.env.FIXTURE_TAG + '", 'project-local'));
        const res = run('SessionStart', path.dirname(process.execPath));
        expect(res.stdout).toContain('FIXTURE-DISPATCH project-local');
    });
});

describe('2.2 — a probe the other files can read', () => {
    it('records reached, not reached and not probed, each with its own receipt line', () => {
        const command = MATRIX['SessionStart'] as string;
        const probeEnv = { HOME: tmp, EVENT4U_CONFIG_HOME: machine };
        expect(describeCarrierProbe(readCarrierState(runtimeRoot()).probe)).toEqual([
            'hook carrier (claude): not probed',
        ]);

        expect(probeHookCommand(command, probeEnv)).toBe('not-reached');
        recordCarrierProbe(runtimeRoot(), 'claude', 'not-reached', '9.9.9', new Date('2026-10-18T00:00:00Z'));
        expect(describeCarrierProbe(readCarrierState(runtimeRoot()).probe)).toEqual([
            'hook carrier (claude): NOT reached from a stripped environment (PATH=/usr/bin:/bin) — probed 2026-10-18, package 9.9.9',
        ]);

        stageRuntime({ packageRoot: fixturePackage(path.join(tmp, 'pkg'), true), runtimeRoot: runtimeRoot(), nodePath: process.execPath });
        expect(probeHookCommand(command, probeEnv)).toBe('reached');
        recordCarrierProbe(runtimeRoot(), 'claude', 'reached', '9.9.9', new Date('2026-10-18T00:00:00Z'));
        expect(describeCarrierProbe(readCarrierState(runtimeRoot()).probe)).toEqual([
            'hook carrier (claude): reached from a stripped environment (PATH=/usr/bin:/bin) — probed 2026-10-18, package 9.9.9',
        ]);
    });
});

describe('the install-time decision', () => {
    const env = () => ({ HOME: tmp, EVENT4U_CONFIG_HOME: machine });

    it('thins on a reached carrier, with pointers that outlive the package root (AC-2)', () => {
        const pkg = fixturePackage(path.join(tmp, 'npm-cache', '_npx', 'h', 'pkg'), true);
        const plan = prepareClaudeCarrier({
            packageRoot: pkg,
            rulesDir: layer,
            sessionStartCommand: MATRIX['SessionStart'] as string,
            wantsThin: true,
            env: env(),
        });
        expect(plan.thin).toBe(true);
        expect(plan.warnings).toEqual([]);
        rmSync(path.join(tmp, 'npm-cache'), { recursive: true, force: true });
        expect(existsSync(`${absoluteBodyLinkPrefix(plan.bodyLinkRoot as string)}alpha.md`)).toBe(true);
        expect(run('PreToolUse', '', { FIXTURE_TAG: 'after-cache' }).stdout).toContain('FIXTURE-DISPATCH after-cache');
    });

    it('keeps the layer full when the probe does not reach a dispatcher', () => {
        const plan = prepareClaudeCarrier({
            packageRoot: fixturePackage(path.join(tmp, 'pkg'), false),
            rulesDir: layer,
            sessionStartCommand: MATRIX['SessionStart'] as string,
            wantsThin: true,
            env: env(),
        });
        expect(plan.thin).toBe(false);
        expect(readCarrierState(runtimeRoot()).layer).toBe('full');
        expect(plan.lines[0]).toContain('NOT reached');
    });
});

describe('3.1 / 3.2 — silence only where it is free', () => {
    function stageThinnedLayer(): void {
        for (const [name, body] of Object.entries(FULL)) write(path.join(layer, name), body);
        write(path.join(layer, 'foreign.md'), '# a rule the user wrote\n');
        stageRuntime({
            packageRoot: fixturePackage(path.join(tmp, 'pkg'), false),
            runtimeRoot: runtimeRoot(),
            nodePath: process.execPath,
            claudeRulesDir: layer,
        });
        // The thin pass, reduced to what this test needs: stamped stubs.
        for (const name of Object.keys(FULL)) {
            write(path.join(layer, name), '---\npackage: event4u/agent-config\n---\n## stub\nBody: /x\n');
        }
        markClaudeLayer(runtimeRoot(), { thinned: true, rulesDir: layer });
    }

    it('a full layer with no dispatcher prints nothing', () => {
        stageRuntime({ packageRoot: fixturePackage(path.join(tmp, 'pkg'), false), runtimeRoot: runtimeRoot(), nodePath: process.execPath });
        for (const native of ['SessionStart', 'PreToolUse']) {
            const res = run(native);
            expect(res.status).toBe(0);
            expect(res.stdout).toBe('');
            expect(res.stderr).toBe('');
        }
    });

    it('a thinned layer with no dispatcher prints one line, exits 0, and restores the full layer', () => {
        stageThinnedLayer();
        const res = run('SessionStart');
        expect(res.status).toBe(0);
        expect(res.stdout.split('\n').filter((l) => l !== '')).toEqual([THINNED_DEAD_CARRIER_LINE]);
        expect(THINNED_DEAD_CARRIER_LINE.length).toBeLessThan(10_000);

        for (const [name, body] of Object.entries(FULL)) {
            expect(readFileSync(path.join(layer, name), 'utf8')).toBe(body);
        }
        expect(readFileSync(path.join(layer, 'foreign.md'), 'utf8')).toBe('# a rule the user wrote\n');
        expect(readdirSync(layer).sort()).toEqual(['alpha.md', 'beta.md', 'foreign.md']);
        expect(readCarrierState(runtimeRoot()).layer).toBe('demoted');

        const next = run('SessionStart');
        expect(next.stdout).toBe('');
    });

    it('a tool-call event on a thinned layer stays quiet and restores nothing', () => {
        stageThinnedLayer();
        const res = run('PreToolUse');
        expect(res.stdout).toBe('');
        expect(readCarrierState(runtimeRoot()).layer).toBe('thinned');
    });

    it('a foreign file carrying no stamp is never overwritten', () => {
        stageThinnedLayer();
        write(path.join(layer, 'alpha.md'), '# the user replaced this file\n');
        run('SessionStart');
        expect(readFileSync(path.join(layer, 'alpha.md'), 'utf8')).toBe('# the user replaced this file\n');
    });

    it('the probe never triggers the restore', () => {
        stageThinnedLayer();
        probeHookCommand(MATRIX['SessionStart'] as string, { HOME: tmp, EVENT4U_CONFIG_HOME: machine });
        expect(readCarrierState(runtimeRoot()).layer).toBe('thinned');
        expect(existsSync(path.join(layer, 'alpha.md'))).toBe(true);
    });
});

describe('3.3 — demotion is sticky', () => {
    it('alternating alive and dead sessions never re-thin a demoted machine', () => {
        let state: LayerState = 'thinned';
        const sessions = [true, false, true, false, true, true];
        const seen: LayerState[] = [];
        for (const alive of sessions) {
            state = layerAfterSession(state, alive);
            seen.push(state);
        }
        expect(seen).toEqual(['thinned', 'demoted', 'demoted', 'demoted', 'demoted', 'demoted']);
    });

    it('only an install, upgrade or doctor run that passes the probe promotes', () => {
        expect(layerAfterInstall('demoted', { wantsThin: true, probe: 'not-reached' })).toBe('demoted');
        expect(layerAfterInstall('demoted', { wantsThin: true, probe: 'reached' })).toBe('thinned');
        expect(layerAfterInstall('demoted', { wantsThin: false, probe: 'reached' })).toBe('full');
        expect(layerAfterInstall('full', { wantsThin: true, probe: 'not-reached' })).toBe('full');
        expect(layerAfterInstall('demoted', { wantsThin: false, probe: 'not-reached' })).toBe('full');
        expect(layerAfterInstall('thinned', { wantsThin: false, probe: 'not-reached' })).toBe('full');
    });

    it('doctor promotes a demoted machine only when its probe passes', () => {
        mkdirSync(runtimeRoot(), { recursive: true });
        writeFileSync(path.join(runtimeRoot(), 'demoted'), '');
        const env = { HOME: tmp, EVENT4U_CONFIG_HOME: machine };
        const command = MATRIX['SessionStart'] as string;
        stageRuntime({ packageRoot: fixturePackage(path.join(tmp, 'dead'), false), runtimeRoot: runtimeRoot(), nodePath: process.execPath });
        expect(probeAndPromote(command, env).layer).toBe('demoted');
        stageRuntime({ packageRoot: fixturePackage(path.join(tmp, 'alive'), true), runtimeRoot: runtimeRoot(), nodePath: process.execPath });
        const after = probeAndPromote(command, env);
        expect(after.layer).toBe('full');
        expect(describeCarrierState(after)).toMatch(/^hook carrier \(claude\): rule layer full, carrier reached since \d{4}-\d{2}-\d{2}$/);
    });

    it('the shell side writes demoted and only node code clears it', () => {
        mkdirSync(runtimeRoot(), { recursive: true });
        writeFileSync(path.join(runtimeRoot(), 'demoted'), '');
        stageRuntime({ packageRoot: fixturePackage(path.join(tmp, 'pkg'), true), runtimeRoot: runtimeRoot(), nodePath: process.execPath });
        run('SessionStart');
        expect(readCarrierState(runtimeRoot()).layer).toBe('demoted');
    });
});
