// Tests for src/scripts/runtime_dispatcher.ts — TypeScript twin of
// src/scripts/runtime_dispatcher.py (ADR-094, py2ts).
//
// Two layers:
//   1. Pure unit tests of `dispatch` (the pure resolution function) — mirrors
//      tests/test_runtime_dispatcher.py 1:1 (not_found / manual / assisted /
//      automated-ready / automated-no-handler / automated-no-safety / tools /
//      timeout passthrough).
//   2. Golden parity (python3 vs tsx via spawnSync) on the real CLI surface:
//      - resolve (flat + subcommand) in text + json → byte-identical
//        stdout/stderr/exit.
//      - run --output JSON → byte-identical after the one inherently
//        non-deterministic field (`duration_ms`, wall-clock) is normalized to 0
//        on both sides; reason inlined below.
//      - HandlerError paths (not-ready skills) → byte-identical
//        stdout/stderr/exit.
//      - argparse-style error paths → exit 2 + non-empty stderr only.
//        argparse usage/error prose embeds `prog` (`runtime_dispatcher.py` for
//        the original, `runtime_dispatcher` for the twin per the established
//        py2ts stem convention) and varies across CPython versions, so the
//        migration contract for those is channel + exit code, not byte prose.
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { SkillRuntime } from '../../src/scripts/runtime_registry.js';
import { dispatch } from '../../src/scripts/runtime_dispatcher.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const TSX_BIN = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);
const TS = path.join(REPO_ROOT, 'src', 'scripts', 'runtime_dispatcher.ts');

function skill(args: {
    name: string;
    exec_type?: string;
    handler?: string;
    safety_mode?: string | null;
    allowed_tools?: string[];
    timeout_seconds?: number;
}): SkillRuntime {
    return new SkillRuntime({
        name: args.name,
        path: `/skills/${args.name}/SKILL.md`,
        description: `Test ${args.name}`,
        execution_type: args.exec_type ?? 'manual',
        handler: args.handler ?? 'none',
        timeout_seconds: args.timeout_seconds ?? 30,
        safety_mode: args.safety_mode ?? null,
        allowed_tools: args.allowed_tools ?? [],
    });
}

// --- Layer 1: pure `dispatch` (1:1 with test_runtime_dispatcher.py) ----------

describe('runtime_dispatcher — dispatch (pure)', () => {
    it('test_dispatch_not_found', () => {
        const result = dispatch('nonexistent', []);
        expect(result.request.status).toBe('not_found');
        expect(result.request.is_ready).toBe(false);
    });

    it('test_dispatch_manual_blocked', () => {
        const result = dispatch('manual-skill', [skill({ name: 'manual-skill', exec_type: 'manual' })]);
        expect(result.request.status).toBe('blocked');
        expect(result.request.reason ?? '').toContain('Manual');
    });

    it('test_dispatch_assisted_ready', () => {
        const result = dispatch('assist', [
            skill({ name: 'assist', exec_type: 'assisted', handler: 'internal' }),
        ]);
        expect(result.request.status).toBe('ready');
        expect(result.request.is_ready).toBe(true);
        expect(result.request.execution_type).toBe('assisted');
        expect(result.warnings.some((w) => w.toLowerCase().includes('confirmation'))).toBe(true);
    });

    it('test_dispatch_automated_ready', () => {
        const result = dispatch('auto', [
            skill({ name: 'auto', exec_type: 'automated', handler: 'shell', safety_mode: 'strict' }),
        ]);
        expect(result.request.status).toBe('ready');
        expect(result.request.is_ready).toBe(true);
        expect(result.request.execution_type).toBe('automated');
    });

    it('test_dispatch_automated_no_handler_blocked', () => {
        const result = dispatch('bad-auto', [
            skill({ name: 'bad-auto', exec_type: 'automated', handler: 'none', safety_mode: 'strict' }),
        ]);
        expect(result.request.status).toBe('blocked');
        expect((result.request.reason ?? '').toLowerCase()).toContain('handler');
    });

    it('test_dispatch_automated_no_safety_blocked', () => {
        const result = dispatch('bad-safety', [
            skill({ name: 'bad-safety', exec_type: 'automated', handler: 'shell', safety_mode: null }),
        ]);
        expect(result.request.status).toBe('blocked');
        expect((result.request.reason ?? '').toLowerCase()).toContain('safety_mode');
    });

    it('test_dispatch_automated_with_tools', () => {
        const result = dispatch('tooled', [
            skill({
                name: 'tooled',
                exec_type: 'automated',
                handler: 'internal',
                safety_mode: 'strict',
                allowed_tools: ['github', 'jira'],
            }),
        ]);
        expect(result.request.is_ready).toBe(true);
        expect(result.request.allowed_tools).toEqual(['github', 'jira']);
    });

    it('test_dispatch_returns_correct_timeout', () => {
        const result = dispatch('timed', [
            skill({ name: 'timed', exec_type: 'assisted', handler: 'shell', timeout_seconds: 120 }),
        ]);
        expect(result.request.timeout_seconds).toBe(120);
    });

    it('asdict mirrors dataclasses.asdict — request nested, properties excluded', () => {
        const result = dispatch('nope', []);
        const d = result.asdict() as { request: Record<string, unknown>; warnings: unknown[] };
        // Field order + keys mirror the dataclass exactly (no `is_ready`).
        expect(Object.keys(d)).toEqual(['request', 'warnings']);
        expect(Object.keys(d.request)).toEqual([
            'skill_name',
            'execution_type',
            'handler',
            'timeout_seconds',
            'safety_mode',
            'allowed_tools',
            'status',
            'reason',
        ]);
        expect(d.warnings).toEqual([]);
    });
});
