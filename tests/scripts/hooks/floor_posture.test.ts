/**
 * The destructive-action floor's posture, as `hooks:doctor` reports it.
 *
 * When the trampoline reaches neither a bundle, the runtime nor the CLI it exits 0, so
 * every hook — the floor included — silently does not run. These tests pin
 * that the doctor names that state "floor not running" rather than leaving it
 * indistinguishable from a quiet session, and that it reports, never writes.
 */
import * as path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
    readFloorPosture,
    renderFloorPosture,
    type FloorPostureDeps,
} from '../../../src/scripts/_lib/floor_posture.js';

const PROJECT = '/proj';
const HOME = '/home/u';

function deps(files: Record<string, string>, opts: { onPath?: string[]; executable?: string[] } = {}): FloorPostureDeps {
    return {
        projectRoot: PROJECT,
        homeDir: HOME,
        env: {},
        readFile: (p) => (p in files ? (files[p] as string) : null),
        exists: (p) => p in files,
        isExecutable: (p) => (opts.executable ?? []).includes(p),
        onPath: (bin) => (opts.onPath ?? []).includes(bin),
    };
}

const USER = path.join(HOME, '.claude', 'settings.json');
const PROJ_LOCAL = path.join(PROJECT, '.claude', 'settings.local.json');

describe('floor posture — whether the hook runtime resolves', () => {
    it('floor-not-running: no bundle, no runtime and no CLI is named, not silent', () => {
        const posture = readFloorPosture(deps({}));
        expect(posture.runtime).toBe('floor-not-running');
        expect(renderFloorPosture(posture).join('\n')).toContain('floor not running');
    });

    it('floor-not-running: a bundle without node on PATH does not run either', () => {
        const bundle = path.join(PROJECT, 'node_modules', '@event4u', 'agent-config', 'dist', 'hooks', 'dispatch.js');
        expect(readFloorPosture(deps({ [bundle]: '' })).runtime).toBe('floor-not-running');
        expect(readFloorPosture(deps({ [bundle]: '' }, { onPath: ['node'] })).runtime).toBe('project-bundle');
    });

    it('resolves in the trampoline order: bundle, runtime, CLI', () => {
        const current = path.join(HOME, '.event4u', 'agent-config', 'runtime', 'current');
        const node = '/opt/node/bin/node';
        const runtime = { [path.join(current, 'node')]: `${node}\n`, [path.join(current, 'dist', 'hooks', 'dispatch.js')]: '' };
        expect(readFloorPosture(deps(runtime, { executable: [node] })).runtime).toBe('runtime-current');
        expect(readFloorPosture(deps(runtime)).runtime).toBe('floor-not-running');
        expect(readFloorPosture(deps({}, { onPath: ['agent-config'] })).runtime).toBe('cli');
        const local = path.join(PROJECT, 'agent-config');
        expect(readFloorPosture(deps({ [local]: '' }, { executable: [local] })).runtime).toBe('cli');
    });
});

describe('floor posture — sandbox settings, read and never written', () => {
    it('reports each sandbox key, absent included', () => {
        const lines = renderFloorPosture(readFloorPosture(deps({}))).join('\n');
        expect(lines).toContain('sandbox.enabled: absent');
        expect(lines).toContain('sandbox.failIfUnavailable: absent');
        expect(lines).toContain('sandbox.allowUnsandboxedCommands: absent');
    });

    it('the later layer wins, as in the host', () => {
        const posture = readFloorPosture(
            deps({
                [USER]: JSON.stringify({ sandbox: { enabled: false, allowUnsandboxedCommands: true } }),
                [PROJ_LOCAL]: JSON.stringify({ sandbox: { enabled: true, failIfUnavailable: true } }),
            }),
        );
        expect(posture.sandbox).toEqual({ enabled: true, failIfUnavailable: true, allowUnsandboxedCommands: true });
    });

    it('an unreadable layer is reported, not repaired', () => {
        const posture = readFloorPosture(deps({ [USER]: '{not json' }));
        expect(posture.unreadable).toEqual([USER]);
        expect(renderFloorPosture(posture).join('\n')).toContain('unreadable');
    });
});

describe('floor posture — a neighbour PreToolUse hook', () => {
    it('counts a PreToolUse hook that is not this package, which could rewrite the command after its verdict', () => {
        const hooks = {
            hooks: {
                PreToolUse: [
                    { hooks: [{ type: 'command', command: 'node .../dist/hooks/dispatch.js --platform claude' }] },
                    { matcher: 'Bash', hooks: [{ type: 'command', command: 'my-rewriter' }] },
                ],
            },
        };
        const posture = readFloorPosture(deps({ [USER]: JSON.stringify(hooks) }));
        expect(posture.foreignPreToolUseHooks).toBe(1);
        expect(renderFloorPosture(posture).join('\n')).toContain('1 PreToolUse hook');
    });

    it('none registered reads as none, not as unknown', () => {
        expect(renderFloorPosture(readFloorPosture(deps({}))).join('\n')).toContain('other PreToolUse hooks: none');
    });
});

describe('floor posture — reaches the doctor', () => {
    it('floor-not-running: the doctor table carries the posture section', async () => {
        const doctor = await import('../../../src/scripts/hooks_doctor.js');
        const { _load_yaml } = await import('../../../src/scripts/hooks/dispatch_hook.js');
        const manifest = _load_yaml(path.join(process.cwd(), 'src', 'scripts', 'hook_manifest.yaml'));
        const payload = doctor.collect(process.cwd(), manifest);
        expect(payload.floor_posture).toBeDefined();
        const off = { ...payload, floor_posture: readFloorPosture(deps({})) };
        const table = doctor._render_table(off);
        expect(table).toContain('Floor posture');
        expect(table).toContain('floor not running');
        expect(doctor._final_exit_code(off, true)).toBe(doctor._final_exit_code(payload, true));
    });
});
