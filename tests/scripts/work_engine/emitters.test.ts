// Intent tests for work_engine/emitters.ts (ADR-096 py2ts Phase 1 —
// work_engine TOP/integration layer). The python byte-parity rig is gone; this
// asserts the tsx module's own contract directly. Coverage: `_emit_halt`
// (stderr surface, fallback `halt:` line, exit-2, halts[] persistence when the
// state file pre-exists). The halt timestamp is wall-clock.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { _emit_halt } from '../../../src/agent-src/templates/scripts/work_engine/emitters.js';
import { HookHalt } from '../../../src/agent-src/templates/scripts/work_engine/hooks/index.js';
import { Input, WorkState, dump, load } from '../../../src/agent-src/templates/scripts/work_engine/state.js';

let tmp: string;
beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'emit-'));
});
afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
});

// ── _emit_halt (stderr + persistence) ─────────────────────────────────────

describe('_emit_halt — stderr + exit code', () => {
    it('returns 2 and writes the surface to stderr', () => {
        const chunks: string[] = [];
        const orig = process.stderr.write.bind(process.stderr);
        (process.stderr.write as unknown) = (s: string) => {
            chunks.push(s);
            return true;
        };
        let rc: number;
        try {
            rc = _emit_halt(new HookHalt('blocked by gate', ['line 1', 'line 2']));
        } finally {
            (process.stderr.write as unknown) = orig;
        }
        expect(rc).toBe(2);
        expect(chunks.join('')).toBe('line 1\nline 2\n');
    });

    it('falls back to `halt: <reason>` when surface is empty', () => {
        const chunks: string[] = [];
        const orig = process.stderr.write.bind(process.stderr);
        (process.stderr.write as unknown) = (s: string) => {
            chunks.push(s);
            return true;
        };
        try {
            _emit_halt(new HookHalt('no surface', null));
        } finally {
            (process.stderr.write as unknown) = orig;
        }
        expect(chunks.join('')).toBe('halt: no surface\n');
    });

    it('appends to halts[] and re-saves when the state file pre-exists', () => {
        const stateFile = path.join(tmp, '.work-state.json');
        const w = new WorkState({ input: new Input('ticket', { id: 'T' }) });
        // Write it first so _emit_halt detects an existing file.
        dump(w, stateFile);

        const orig = process.stderr.write.bind(process.stderr);
        (process.stderr.write as unknown) = () => true;
        try {
            _emit_halt(new HookHalt('gate halt', ['surf']), { work: w, state_file: stateFile, event: 'AFTER_LOAD' });
        } finally {
            (process.stderr.write as unknown) = orig;
        }
        const reloaded = load(stateFile);
        expect(reloaded.halts.length).toBe(1);
        const h = reloaded.halts[0] as Record<string, unknown>;
        expect(h['reason']).toBe('gate halt');
        expect(h['step']).toBe('AFTER_LOAD');
        expect(h['surface']).toEqual(['surf']);
        expect(typeof h['timestamp']).toBe('string');
        // CPython aware-UTC isoformat shape: ...+00:00 with µs precision.
        expect(h['timestamp']).toMatch(/T.*\+00:00$/);
    });

    it('does NOT write state when the file is absent (fresh-run contract)', () => {
        const stateFile = path.join(tmp, 'absent.json');
        const w = new WorkState({ input: new Input('ticket', {}) });
        const orig = process.stderr.write.bind(process.stderr);
        (process.stderr.write as unknown) = () => true;
        try {
            _emit_halt(new HookHalt('x', ['s']), { work: w, state_file: stateFile, event: 'BEFORE_LOAD' });
        } finally {
            (process.stderr.write as unknown) = orig;
        }
        expect(fs.existsSync(stateFile)).toBe(false);
    });
});
