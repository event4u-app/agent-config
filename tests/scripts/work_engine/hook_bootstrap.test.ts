// Golden-parity tests for work_engine/hook_bootstrap.ts vs hook_bootstrap.py
// (ADR-096 py2ts Phase 1 — work_engine TOP/integration layer).
//
// `hook_bootstrap.py` assembles a HookRegistry from `.agent-settings.yml`. The
// registered callbacks are closures (not comparable across engines), so parity
// is on the *per-event callback count* — the observable shape of the registry.
// Cases: --no-hooks (empty), missing/empty settings (empty), hooks.enabled
// with the per-hook defaults, and chat-history enabled. The Python module is
// run through the real package on sys.path.
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { ParsedArgs } from '../../../src/agent-src/templates/scripts/work_engine/cli_args.js';
import { _build_hook_registry } from '../../../src/agent-src/templates/scripts/work_engine/hook_bootstrap.js';
import { HookEvent } from '../../../src/agent-src/templates/scripts/work_engine/hooks/index.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..', '..');
const SCRIPTS_ROOT = path.join(REPO_ROOT, 'src', 'agent-src', 'templates', 'scripts');

function hasPython3(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}

function hasPyYaml(): boolean {
    return spawnSync('python3', ['-c', 'import yaml'], { encoding: 'utf8' }).status === 0;
}

let tmp: string;
beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hb-'));
});
afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
});

const py = hasPython3() && hasPyYaml();
const describeParity = py ? describe : describe.skip;

function baseArgs(over: Partial<ParsedArgs> = {}): ParsedArgs {
    return {
        state_file: '.work-state.json',
        ticket_file: null,
        prompt_file: null,
        diff_file: null,
        file_file: null,
        persona: null,
        no_hooks: false,
        hooks_config: null,
        ...over,
    };
}

const ALL_EVENTS = Object.values(HookEvent) as HookEvent[];

/** TS: per-event callback counts for the registry built from `args`. */
function tsCounts(args: ParsedArgs): Record<string, number> {
    const reg = _build_hook_registry(args);
    const out: Record<string, number> = {};
    for (const ev of ALL_EVENTS) {
        out[ev] = reg.for_event(ev).length;
    }
    return out;
}

/** Python: per-event callback counts for the registry built from `args`. */
function pyCounts(noHooks: boolean, hooksConfig: string | null): Record<string, number> {
    const code = [
        'import sys, json, argparse',
        `sys.path.insert(0, ${JSON.stringify(SCRIPTS_ROOT)})`,
        'from work_engine.hook_bootstrap import _build_hook_registry',
        'from work_engine.hooks import HookEvent',
        'cfg = json.loads(sys.argv[2])',
        'import pathlib',
        'ns = argparse.Namespace(no_hooks=json.loads(sys.argv[1]), hooks_config=(pathlib.Path(cfg) if cfg else None))',
        'reg = _build_hook_registry(ns)',
        'out = {ev.value: len(reg.for_event(ev)) for ev in HookEvent}',
        'sys.stdout.write(json.dumps(out, sort_keys=True))',
    ].join('\n');
    const r = spawnSync('python3', ['-c', code, JSON.stringify(noHooks), JSON.stringify(hooksConfig)], {
        encoding: 'utf8',
    });
    if (r.status !== 0) {
        throw new Error(`python3 failed: ${r.stderr || r.stdout}`);
    }
    return JSON.parse(r.stdout) as Record<string, number>;
}

function sortObj(o: Record<string, number>): Record<string, number> {
    const s: Record<string, number> = {};
    for (const k of Object.keys(o).sort()) s[k] = o[k] as number;
    return s;
}

describe('_build_hook_registry — local', () => {
    it('--no-hooks yields an empty registry', () => {
        const counts = tsCounts(baseArgs({ no_hooks: true }));
        expect(Object.values(counts).every((n) => n === 0)).toBe(true);
    });

    it('missing settings file yields an empty registry', () => {
        const counts = tsCounts(baseArgs({ hooks_config: path.join(tmp, 'absent.yml') }));
        expect(Object.values(counts).every((n) => n === 0)).toBe(true);
    });
});

describeParity('_build_hook_registry — per-event count parity', () => {
    it('--no-hooks', () => {
        expect(sortObj(tsCounts(baseArgs({ no_hooks: true })))).toEqual(pyCounts(true, null));
    });

    it('absent settings → empty', () => {
        const cfg = path.join(tmp, 'absent.yml');
        expect(sortObj(tsCounts(baseArgs({ hooks_config: cfg })))).toEqual(pyCounts(false, cfg));
    });

    it('hooks.enabled: false → empty', () => {
        const cfg = path.join(tmp, 'off.yml');
        fs.writeFileSync(cfg, 'hooks:\n  enabled: false\n', 'utf-8');
        expect(sortObj(tsCounts(baseArgs({ hooks_config: cfg })))).toEqual(pyCounts(false, cfg));
    });

    it('hooks.enabled: true → per-hook defaults', () => {
        const cfg = path.join(tmp, 'on.yml');
        fs.writeFileSync(cfg, 'hooks:\n  enabled: true\n', 'utf-8');
        expect(sortObj(tsCounts(baseArgs({ hooks_config: cfg })))).toEqual(pyCounts(false, cfg));
    });

    it('hooks.enabled + chat_history enabled', () => {
        const cfg = path.join(tmp, 'chat.yml');
        fs.writeFileSync(
            cfg,
            'hooks:\n  enabled: true\n  chat_history:\n    enabled: true\n    script: scripts/chat_history.py\n',
            'utf-8',
        );
        expect(sortObj(tsCounts(baseArgs({ hooks_config: cfg })))).toEqual(pyCounts(false, cfg));
    });

    it('hooks.enabled + trace only (others off)', () => {
        const cfg = path.join(tmp, 'trace.yml');
        fs.writeFileSync(
            cfg,
            'hooks:\n  enabled: true\n  trace: true\n  halt_surface_audit: false\n  state_shape_validation: false\n  directive_set_guard: false\n  memory_visibility:\n    enabled: false\n',
            'utf-8',
        );
        expect(sortObj(tsCounts(baseArgs({ hooks_config: cfg })))).toEqual(pyCounts(false, cfg));
    });
});
