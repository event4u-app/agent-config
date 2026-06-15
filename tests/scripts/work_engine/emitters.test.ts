// Golden-parity tests for work_engine/emitters.ts vs emitters.py (ADR-096
// py2ts Phase 1 — work_engine TOP/integration layer).
//
// `emitters.py` imports `.delivery_state`, `.hooks`, `.state` (package-relative
// imports through the real `work_engine` package), so the parity harness runs
// it via sys.path + import_module. Coverage: `_emit` SUCCESS (report on stdout)
// + halt branches ([halt] line + questions), and `_emit_halt` (stderr surface,
// fallback `halt:` line, exit-2, halts[] persistence when the state file
// pre-exists). The halt timestamp is wall-clock — normalised in both engines.
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { _emit, _emit_halt } from '../../../src/agent-src/templates/scripts/work_engine/emitters.js';
import { Outcome } from '../../../src/agent-src/templates/scripts/work_engine/delivery_state.js';
import { HookHalt } from '../../../src/agent-src/templates/scripts/work_engine/hooks/index.js';
import { Input, WorkState, dump, load } from '../../../src/agent-src/templates/scripts/work_engine/state.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..', '..');
const SCRIPTS_ROOT = path.join(REPO_ROOT, 'src', 'agent-src', 'templates', 'scripts');

function hasPython3(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}

let tmp: string;
beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'emit-'));
});
afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
});

const py = hasPython3();
const describeParity = py ? describe : describe.skip;

// ── _emit (stdout) ───────────────────────────────────────────────────────

/** Run `_emit` on python3 with the given report/final/halting/questions. */
function pyEmit(report: string, final: string, halting: string | null, questions: string[]): string {
    const code = [
        'import sys, json',
        `sys.path.insert(0, ${JSON.stringify(SCRIPTS_ROOT)})`,
        'from work_engine.emitters import _emit',
        'from work_engine.delivery_state import Outcome',
        'from work_engine.state import Input, WorkState',
        'spec = json.loads(sys.argv[1])',
        'w = WorkState(input=Input(kind="ticket", data={}))',
        'w.report = spec["report"]',
        'w.questions = spec["questions"]',
        'final = Outcome(spec["final"])',
        'halting = spec["halting"]',
        '_emit(w, final, halting)',
    ].join('\n');
    const r = spawnSync('python3', ['-c', code, JSON.stringify({ report, final, halting, questions })], {
        encoding: 'utf8',
    });
    if (r.status !== 0) {
        throw new Error(`python3 failed: ${r.stderr || r.stdout}`);
    }
    return r.stdout;
}

function tsEmit(report: string, final: Outcome, halting: string | null, questions: string[]): string {
    const w = new WorkState({ input: new Input('ticket', {}) });
    w.report = report;
    w.questions = questions;
    const chunks: string[] = [];
    const orig = process.stdout.write.bind(process.stdout);
    (process.stdout.write as unknown) = (s: string) => {
        chunks.push(s);
        return true;
    };
    try {
        _emit(w, final, halting);
    } finally {
        (process.stdout.write as unknown) = orig;
    }
    return chunks.join('');
}

describeParity('_emit — stdout parity', () => {
    it('SUCCESS prints the report', () => {
        expect(tsEmit('the delivery report', Outcome.SUCCESS, null, [])).toBe(
            pyEmit('the delivery report', 'success', null, []),
        );
    });
    it('BLOCKED prints the halt line + questions', () => {
        expect(tsEmit('', Outcome.BLOCKED, 'plan', ['1. opt a', '2. opt b'])).toBe(
            pyEmit('', 'blocked', 'plan', ['1. opt a', '2. opt b']),
        );
    });
    it('PARTIAL with no halting step prints (none)', () => {
        expect(tsEmit('', Outcome.PARTIAL, null, ['q'])).toBe(pyEmit('', 'partial', null, ['q']));
    });
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
