/**
 * `doctor --no-forge` / `--offline`, and the `--check <id>` path —
 * `road-to-findings-that-get-a-disposition` step 3.1.
 *
 * The property is that neither path spawns anything: no `git ls-remote` and no
 * `gh` call. Every case injects the runner, so a spawn is observed rather than
 * inferred from the output. Each "spawns nothing" case has a control beside it
 * that drives the SAME seam with the default posture and sees the `git` call —
 * without that, a runner that is never wired in would pass every negative case.
 *
 * The cases go through `_emit_json` and `_parse`, the composition the command
 * itself runs, not only through `forgeProtectionJsonFor` one layer down.
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { _emit_json, _parse } from '../../src/scripts/_cli/cmd_doctor.js';
import { forgeDepsFor, forgeProtectionJsonFor } from '../../src/scripts/_cli/doctor_execution.js';
import type { Runner } from '../../src/scripts/_lib/forge_reader.js';

type Call = { cmd: string; args: readonly string[] };

/** A runner that records every spawn and answers "no such remote". */
function recordingRunner(): { run: Runner; calls: Call[] } {
    const calls: Call[] = [];
    const run: Runner = (cmd, args) => {
        calls.push({ cmd, args });
        return { status: 1, stdout: '' };
    };
    return { run, calls };
}

const tmpRoots: string[] = [];

function mkTmpRoot(): string {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'doctor-offline-flag-'));
    tmpRoots.push(root);
    return root;
}

afterAll(() => {
    for (const root of tmpRoots) fs.rmSync(root, { recursive: true, force: true });
});

/** Runs `_emit_json` for the parsed argv and returns the payload plus the spawns. */
function emit(argv: string[]): { payload: Record<string, unknown>; calls: Call[] } {
    const opts = _parse(argv);
    const { run, calls } = recordingRunner();
    let out = '';
    const spy = vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
        out += String(chunk);
        return true;
    });
    try {
        _emit_json(mkTmpRoot(), [], [], [], [], null, 'explicit', { ...forgeDepsFor(opts), run });
    } finally {
        spy.mockRestore();
    }
    return { payload: JSON.parse(out) as Record<string, unknown>, calls };
}

function forgeBlock(payload: Record<string, unknown>): Record<string, unknown> {
    return payload['forge_protection'] as Record<string, unknown>;
}

describe('argv', () => {
    it('reads --no-forge and its alias --offline, and defaults to off', () => {
        expect(_parse(['--json']).no_forge).toBe(false);
        expect(_parse(['--json', '--no-forge']).no_forge).toBe(true);
        expect(_parse(['--json', '--offline']).no_forge).toBe(true);
    });

    it('derives the posture from the flag and from --check, and from nothing else', () => {
        expect(forgeDepsFor({ no_forge: false, check: null })).toEqual({ offline: false });
        expect(forgeDepsFor({ no_forge: true, check: null })).toEqual({ offline: true });
        expect(forgeDepsFor({ no_forge: false, check: 'scope' })).toEqual({ offline: true });
    });
});

describe('doctor --json spawns nothing on either offline path', () => {
    // The environment opt-outs would make the control case vacuous, so they are
    // cleared: what is under test is the flag, not the switch.
    beforeEach(() => {
        vi.stubEnv('AGENT_CONFIG_DOCTOR_NO_FORGE', '');
        vi.stubEnv('AGENT_CONFIG_OFFLINE', '');
    });
    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it('control: the default run reaches the runner with git ls-remote', () => {
        const { calls } = emit(['--json']);
        expect(calls.length).toBeGreaterThan(0);
        expect(calls[0]?.cmd).toBe('git');
        expect(calls[0]?.args).toEqual(['ls-remote', '--get-url', 'origin']);
    });

    it('--no-forge makes no git and no gh call', () => {
        const { payload, calls } = emit(['--json', '--no-forge']);
        expect(calls).toEqual([]);
        expect(forgeBlock(payload)['read_from_forge']).toBe(false);
    });

    it('--offline makes no git and no gh call', () => {
        const { calls } = emit(['--json', '--offline']);
        expect(calls).toEqual([]);
    });

    it('--check <id> makes no git and no gh call, since no check reads the block', () => {
        const { calls } = emit(['--json', '--check', 'scope']);
        expect(calls).toEqual([]);
    });

    it('keeps the block shape: five unread rows and no repository', () => {
        const block = forgeBlock(emit(['--json', '--no-forge']).payload);
        const rows = block['rows'] as Array<{ state: string; source: string }>;
        expect(rows).toHaveLength(5);
        for (const r of rows) {
            expect(r.state).toBe('unread');
            expect(r.source).not.toBe('');
        }
        expect(block['repository']).toBeNull();
    });
});

describe('forgeProtectionJsonFor', () => {
    it('returns before the runner when offline, and reaches it otherwise', () => {
        const offline = recordingRunner();
        forgeProtectionJsonFor(mkTmpRoot(), { env: {}, run: offline.run, offline: true });
        expect(offline.calls).toEqual([]);

        const online = recordingRunner();
        forgeProtectionJsonFor(mkTmpRoot(), { env: {}, run: online.run });
        expect(online.calls.map((c) => c.cmd)).toEqual(['git']);
    });
});
