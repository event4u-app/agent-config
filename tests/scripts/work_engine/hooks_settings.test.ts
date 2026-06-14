// Golden-parity tests for the py2ts work_engine.hooks `settings` twin
// (ADR-094). `settings.py` reads `.agent-settings.yml` via
// work_engine._lib.agent_settings and parses the decision_engine block; the
// TS twin mirrors the resolution exactly. Each scenario resolves the same
// fixture on both engines and compares the full resolved HookSettings view.
//
// A non-existent `user_global_path` is passed on both sides so the host's
// real user-global config never leaks into the comparison.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { load_hook_settings } from '../../../src/agent-src/templates/scripts/work_engine/hooks/settings.js';
import { hasPython3, runPyHooks } from './_hooks_pyloader.js';

const describePy = hasPython3() ? describe : describe.skip;

let tmp: string;
let NO_GLOBAL: string;
beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hooks-settings-'));
    NO_GLOBAL = path.join(tmp, 'does-not-exist-user-global.yml');
});
afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
});

/** Snapshot a HookSettings into a plain comparable object. */
function snapshotTs(settings_path: string): Record<string, unknown> {
    const s = load_hook_settings(settings_path, NO_GLOBAL);
    return {
        enabled: s.enabled,
        trace: s.trace,
        halt_surface_audit: s.halt_surface_audit,
        state_shape_validation: s.state_shape_validation,
        directive_set_guard: s.directive_set_guard,
        decision_trace: s.decision_trace,
        memory_visibility: s.memory_visibility,
        memory_visibility_off: s.memory_visibility_off,
        memory_cadence: s.memory_cadence,
        chat_history_enabled: s.chat_history_enabled,
        chat_history_script: s.chat_history_script,
        de_surface_traces: s.decision_engine.surface_traces,
        de_min_confidence: s.decision_engine.min_confidence,
        de_block_on_risk: s.decision_engine.block_on_risk,
        de_require_memory_hits: s.decision_engine.require_memory_hits,
        de_on_block: s.decision_engine.on_block,
        de_on_block_fallback: s.decision_engine.on_block_fallback,
    };
}

/** Resolve the same fixture in python3 and snapshot the dataclass fields. */
function snapshotPy(settings_path: string): Record<string, unknown> {
    const r = runPyHooks(
        {
            we: ['_lib.user_global_paths', '_lib.agent_settings', 'scoring.decision_engine'],
            foundation: ['settings'],
        },
        [
            `s = settings.load_hook_settings(${JSON.stringify(settings_path)}, ${JSON.stringify(NO_GLOBAL)})`,
            'out = {',
            '  "enabled": s.enabled,',
            '  "trace": s.trace,',
            '  "halt_surface_audit": s.halt_surface_audit,',
            '  "state_shape_validation": s.state_shape_validation,',
            '  "directive_set_guard": s.directive_set_guard,',
            '  "decision_trace": s.decision_trace,',
            '  "memory_visibility": s.memory_visibility,',
            '  "memory_visibility_off": s.memory_visibility_off,',
            '  "memory_cadence": s.memory_cadence,',
            '  "chat_history_enabled": s.chat_history_enabled,',
            '  "chat_history_script": s.chat_history_script,',
            '  "de_surface_traces": s.decision_engine.surface_traces,',
            '  "de_min_confidence": s.decision_engine.min_confidence,',
            '  "de_block_on_risk": s.decision_engine.block_on_risk,',
            '  "de_require_memory_hits": s.decision_engine.require_memory_hits,',
            '  "de_on_block": s.decision_engine.on_block,',
            '  "de_on_block_fallback": s.decision_engine.on_block_fallback,',
            '}',
            'print(json.dumps(out, sort_keys=True))',
        ].join('\n'),
    );
    if (r.status !== 0) {
        throw new Error(`python3 settings probe failed: ${r.stderr || r.stdout}`);
    }
    return JSON.parse(r.stdout.trim()) as Record<string, unknown>;
}

function writeYaml(body: string): string {
    const p = path.join(tmp, `${Math.random().toString(36).slice(2)}.agent-settings.yml`);
    fs.writeFileSync(p, body, 'utf-8');
    return p;
}

describe('work_engine.hooks.settings — TS unit checks', () => {
    it('missing file → default-permissive (everything off)', () => {
        const snap = snapshotTs(path.join(tmp, 'nope.yml'));
        expect(snap['enabled']).toBe(false);
        expect(snap['halt_surface_audit']).toBe(false);
        expect(snap['chat_history_enabled']).toBe(false);
        expect(snap['memory_cadence']).toBe('always');
        expect(snap['chat_history_script']).toBe('scripts/chat_history.py');
    });

    it('hooks block absent → defaults', () => {
        const p = writeYaml('foo: bar\n');
        const snap = snapshotTs(p);
        expect(snap['enabled']).toBe(false);
    });

    it('master switch on → per-hook defaults apply', () => {
        const p = writeYaml('hooks:\n  enabled: true\n');
        const snap = snapshotTs(p);
        expect(snap['enabled']).toBe(true);
        expect(snap['halt_surface_audit']).toBe(true);
        expect(snap['state_shape_validation']).toBe(true);
        expect(snap['directive_set_guard']).toBe(true);
        expect(snap['trace']).toBe(false);
        expect(snap['memory_visibility']).toBe(true);
    });

    it('chat-history gates on both switches', () => {
        const both = writeYaml('hooks:\n  enabled: true\n  chat_history:\n    enabled: true\nchat_history:\n  enabled: true\n');
        expect(snapshotTs(both)['chat_history_enabled']).toBe(true);
        const onlyHook = writeYaml('hooks:\n  enabled: true\n  chat_history:\n    enabled: true\n');
        expect(snapshotTs(onlyHook)['chat_history_enabled']).toBe(false);
    });

    it('memory.visibility: off flips memory_visibility_off', () => {
        const p = writeYaml('hooks:\n  enabled: true\nmemory:\n  visibility: off\n  cadence: AUTO\n');
        const snap = snapshotTs(p);
        expect(snap['memory_visibility_off']).toBe(true);
        expect(snap['memory_cadence']).toBe('auto');
    });

    it('decision_engine.surface_traces mirrors into decision_trace', () => {
        const p = writeYaml('hooks:\n  enabled: true\ndecision_engine:\n  surface_traces: true\n');
        const snap = snapshotTs(p);
        expect(snap['de_surface_traces']).toBe(true);
        expect(snap['decision_trace']).toBe(true);
    });
});

describePy('work_engine.hooks.settings — parity (python3 vs TS)', () => {
    const cases: Array<[string, string]> = [
        ['default (master off)', 'hooks:\n  enabled: false\n'],
        ['master on + defaults', 'hooks:\n  enabled: true\n'],
        [
            'chat-history both on',
            'hooks:\n  enabled: true\n  chat_history:\n    enabled: true\n    script: scripts/custom_ch.py\nchat_history:\n  enabled: true\n',
        ],
        ['memory off + cadence', 'hooks:\n  enabled: true\nmemory:\n  visibility: off\n  cadence: auto\n'],
        [
            'decision_engine gates',
            'hooks:\n  enabled: true\ndecision_engine:\n  surface_traces: true\n  min_confidence: medium\n  block_on_risk: high\n  on_block: ask\n  on_block_fallback: warn\n',
        ],
        [
            'per-hook overrides false',
            'hooks:\n  enabled: true\n  trace: true\n  halt_surface_audit: false\n  state_shape_validation: false\n  directive_set_guard: false\n  memory_visibility:\n    enabled: false\n',
        ],
        ['malformed decision_engine → defaults', 'hooks:\n  enabled: true\ndecision_engine:\n  bogus_key: 1\n'],
    ];

    for (const [name, yaml] of cases) {
        it(`resolves identically: ${name}`, () => {
            const p = writeYaml(yaml);
            expect(snapshotTs(p)).toEqual(snapshotPy(p));
        });
    }

    it('missing file resolves identically (both default-permissive)', () => {
        const p = path.join(tmp, 'absent.yml');
        expect(snapshotTs(p)).toEqual(snapshotPy(p));
    });
});
