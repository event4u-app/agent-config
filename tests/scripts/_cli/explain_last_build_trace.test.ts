// Golden-parity tests for the explain_last trace builder + Markdown renderer
// (py2ts Phase 1, ADR-200): index.ts (build_trace), render.ts, state_loader.ts,
// and the core slot builders (route / inputs / memory / council / assumptions /
// halt / provider) exercised end-to-end on synthetic `.work-state.json`
// fixtures.
//
// Strategy: build an isolated tmp project root (router.json + state +
// council-responses + memory sidecar), then run the REAL python3
// `build_trace` + `render` and the tsx twins on the SAME root with an
// injected `now`, and assert byte-identical:
//   - the rendered Markdown (footer + quiet), and
//   - the trace JSON serialized with a PyFloat-aware
//     `json.dumps(indent=2, sort_keys=True, ensure_ascii=False)` twin (so the
//     `float()` hit_score renders `N.0` identically on both sides).
//
// The Python side imports the package (`scripts._cli.explain_last`) with
// PYTHONPATH=["src", repo] — the package `__init__` pulls every sibling, so a
// per-file importlib loader is not used here; the scrubber test covers the
// leaf-module direct-file path. mtimes are pinned so the council ±1h window
// and the mtime-fallback run_id are deterministic; `now` is injected.
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { build_trace } from '../../../src/scripts/_cli/explain_last/index.js';
import { PyFloat } from '../../../src/scripts/_cli/explain_last/memory.js';
import { render } from '../../../src/scripts/_cli/explain_last/render.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..', '..');

function hasPython3(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}
const HAVE_PYTHON = hasPython3();

// Fixed instant injected as `now` on both sides (ms-aligned so the Python
// `datetime` and the JS `Date` agree to the microsecond).
const NOW_ISO = '2026-06-17T12:00:00+00:00';
const NOW_DATE = new Date(Date.UTC(2026, 5, 17, 12, 0, 0));
// Pinned mtimes (epoch seconds): state anchor + a council file inside the window.
const STATE_MTIME = 1718000000.0;
const COUNCIL_MTIME = 1718000010.0;

let root: string;
beforeEach(() => {
    root = mkdtempSync(path.join(tmpdir(), 'explast-'));
});
afterEach(() => {
    rmSync(root, { recursive: true, force: true });
});

// ---- PyFloat-aware json.dumps(indent=2, sort_keys=True, ensure_ascii=False)
function pyJsonStr(s: string): string {
    let out = '"';
    for (const ch of s) {
        const code = ch.codePointAt(0) as number;
        if (ch === '"') out += '\\"';
        else if (ch === '\\') out += '\\\\';
        else if (ch === '\n') out += '\\n';
        else if (ch === '\r') out += '\\r';
        else if (ch === '\t') out += '\\t';
        else if (ch === '\b') out += '\\b';
        else if (ch === '\f') out += '\\f';
        else if (code < 0x20) out += `\\u${code.toString(16).padStart(4, '0')}`;
        else out += ch;
    }
    return `${out}"`;
}
function pyFloatRepr(n: number): string {
    if (!Number.isFinite(n)) return Number.isNaN(n) ? 'NaN' : n > 0 ? 'Infinity' : '-Infinity';
    return Number.isInteger(n) ? `${n}.0` : String(n);
}
function dumpSorted(v: unknown, depth: number): string {
    const pad = '  '.repeat(depth + 1);
    const close = '  '.repeat(depth);
    if (v === null || v === undefined) return 'null';
    if (v instanceof PyFloat) return pyFloatRepr(v.value);
    if (typeof v === 'boolean') return v ? 'true' : 'false';
    if (typeof v === 'number') return String(v);
    if (typeof v === 'string') return pyJsonStr(v);
    if (Array.isArray(v)) {
        if (v.length === 0) return '[]';
        return `[\n${v.map((x) => pad + dumpSorted(x, depth + 1)).join(',\n')}\n${close}]`;
    }
    const o = v as Record<string, unknown>;
    const keys = Object.keys(o).sort();
    if (keys.length === 0) return '{}';
    return `{\n${keys
        .map((k) => `${pad}${pyJsonStr(k)}: ${dumpSorted(o[k], depth + 1)}`)
        .join(',\n')}\n${close}}`;
}

interface PyOut {
    status: number;
    json: string;
    footer: string;
    quiet: string;
    stderr: string;
}

/** Run the python3 build_trace + render on `projectRoot` with the pinned now. */
function runPy(projectRoot: string, stateRel = '.work-state.json'): PyOut {
    const code = [
        'import json, sys, datetime, pathlib',
        'from scripts._cli.explain_last import build_trace',
        'from scripts._cli.explain_last.render import render',
        `root = pathlib.Path(${JSON.stringify(projectRoot)})`,
        'now = datetime.datetime(2026,6,17,12,0,0, tzinfo=datetime.timezone.utc)',
        `trace = build_trace(root, root / ${JSON.stringify(stateRel)}, now=now)`,
        'parts = {',
        '  "json": json.dumps(trace, indent=2, sort_keys=True, ensure_ascii=False),',
        '  "footer": render(trace, with_footer=True),',
        '  "quiet": render(trace, with_footer=False),',
        '}',
        'sys.stdout.write(json.dumps(parts, ensure_ascii=False))',
    ].join('\n');
    const res = spawnSync('python3', ['-c', code], {
        cwd: REPO_ROOT,
        encoding: 'utf8',
        env: {
            ...process.env,
            PYTHONPATH: [path.join(REPO_ROOT, 'src'), REPO_ROOT].join(path.delimiter),
        },
    });
    if (res.status !== 0) {
        return { status: res.status ?? -1, json: '', footer: '', quiet: '', stderr: res.stderr };
    }
    const parsed = JSON.parse(res.stdout) as { json: string; footer: string; quiet: string };
    return { status: 0, ...parsed, stderr: res.stderr };
}

function writeJson(p: string, obj: unknown): void {
    writeFileSync(p, JSON.stringify(obj), 'utf-8');
}

/** Build the "rich" fixture: every slot populated, scrubber-active values. */
function buildRichFixture(): void {
    mkdirSync(path.join(root, 'dist'), { recursive: true });
    mkdirSync(path.join(root, '.agent-memory'), { recursive: true });
    mkdirSync(path.join(root, 'agents', 'runtime', 'council', 'sessions', 's1'), {
        recursive: true,
    });
    writeJson(path.join(root, 'dist', 'router.json'), {
        kernel: ['k-one', 'k-two'],
        tier_1: [{ id: 't-a' }, { id: 't-b' }, { bad: 'noid' }, { id: 123 }],
    });
    writeFileSync(
        path.join(root, '.agent-memory', 'hits.jsonl'),
        `${JSON.stringify({ entry_id: 'm1', hit_score: 2, used_in: 'refine', run_id: 'TICK-1' })}\n`
        + `${JSON.stringify({ id: 'm2', score: 0.5 })}\n`
        + 'not json line\n'
        + `${JSON.stringify({ entry_id: 'other', run_id: 'OTHER' })}\n`,
        'utf-8',
    );
    const councilFile = path.join(
        root, 'agents', 'runtime', 'council', 'sessions', 's1', 'council-responses.json',
    );
    writeJson(councilFile, {
        responses: [
            {
                provider: 'anthropic', model: 'sonnet',
                text: 'Verdict line one\nignored second',
                citations: ['c1', 'note about srv.local'],
            },
            { provider: 'openai', model: 'gpt', text: '   ' },
            { model: 'solo', text: 'only model' },
        ],
    });
    const state = {
        version: 1,
        directive_set: '',
        input: {
            kind: 'ticket',
            data: {
                id: 'TICK-1',
                assumptions: [
                    'first assumption',
                    '   ',
                    { id: 'a2', accepted: false, source: 'halt' },
                ],
            },
        },
        persona: 'developer',
        memory: [{ entry_id: 's-mem', hit_score: 1.25, used_in: 'plan' }],
        halts: [{ reason: 'needs review', step: 'refine', surface: ['line A', 'line B'] }],
    };
    const stateFile = path.join(root, '.work-state.json');
    writeJson(stateFile, state);
    utimesSync(stateFile, STATE_MTIME, STATE_MTIME);
    utimesSync(councilFile, COUNCIL_MTIME, COUNCIL_MTIME);
}

describe('explain_last build_trace + render — golden parity', () => {
    it.runIf(HAVE_PYTHON)('rich fixture: trace JSON + both renders are byte-identical', () => {
        buildRichFixture();
        const py = runPy(root);
        expect(py.status, py.stderr).toBe(0);
        const stateFile = path.join(root, '.work-state.json');
        const trace = build_trace(root, stateFile, { now: NOW_DATE });
        expect(dumpSorted(trace, 0)).toBe(py.json);
        expect(render(trace, { with_footer: true })).toBe(py.footer);
        expect(render(trace, { with_footer: false })).toBe(py.quiet);
        // spot-checks: PyFloat carries the int-valued float; scrubber fired.
        const mem = trace.memory as Array<Record<string, unknown>>;
        expect(mem[1]?.hit_score).toBeInstanceOf(PyFloat);
        expect(py.json).toContain('"hit_score": 2.0');
        expect(py.json).toContain('<host>'); // srv.local citation scrubbed
    });

    it.runIf(HAVE_PYTHON)('empty/minimal state: every slot degrades to null/placeholder', () => {
        const state = { version: 1, input: { kind: 'prompt', data: {} } };
        const stateFile = path.join(root, '.work-state.json');
        writeJson(stateFile, state);
        utimesSync(stateFile, STATE_MTIME, STATE_MTIME);
        const py = runPy(root);
        expect(py.status, py.stderr).toBe(0);
        const trace = build_trace(root, stateFile, { now: NOW_DATE });
        expect(dumpSorted(trace, 0)).toBe(py.json);
        expect(render(trace, { with_footer: true })).toBe(py.footer);
        expect(trace.run_id).toBe('2024-06-10T06:13:20+00:00'); // mtime fallback, no µs
    });

    it.runIf(HAVE_PYTHON)('video subject: provider slot + section populate and scrub', () => {
        const state = {
            version: 1,
            directive_set: 'video',
            input: { kind: 'file', data: {} },
            video_provider: { id: 'sora', selection_reason: 'budget on host.internal $40/m' },
        };
        const stateFile = path.join(root, '.work-state.json');
        writeJson(stateFile, state);
        utimesSync(stateFile, 1718000000.5, 1718000000.5); // fractional → µs in run_id
        const py = runPy(root);
        expect(py.status, py.stderr).toBe(0);
        const trace = build_trace(root, stateFile, { now: NOW_DATE });
        expect(dumpSorted(trace, 0)).toBe(py.json);
        expect(render(trace, { with_footer: false })).toBe(py.quiet);
        expect(trace.run_id).toBe('2024-06-10T06:13:20.500000+00:00');
        expect((trace.provider as Record<string, unknown>).selection_reason).toBe(
            'budget on <host> <money>/m',
        );
    });

    it.runIf(HAVE_PYTHON)('council out of ±1h window → null', () => {
        mkdirSync(path.join(root, 'agents', 'runtime', 'council', 'sessions', 's9'), {
            recursive: true,
        });
        const cf = path.join(
            root, 'agents', 'runtime', 'council', 'sessions', 's9', 'council-responses.json',
        );
        writeJson(cf, { responses: [{ provider: 'x', model: 'y', text: 'v' }] });
        const state = { version: 1, input: { kind: 'diff', data: { id: '  spaced  ' } } };
        const stateFile = path.join(root, '.work-state.json');
        writeJson(stateFile, state);
        utimesSync(stateFile, STATE_MTIME, STATE_MTIME);
        utimesSync(cf, STATE_MTIME + 99999, STATE_MTIME + 99999); // outside window
        const py = runPy(root);
        expect(py.status, py.stderr).toBe(0);
        const trace = build_trace(root, stateFile, { now: NOW_DATE });
        expect(dumpSorted(trace, 0)).toBe(py.json);
        expect(trace.council).toBe(null);
        expect(trace.run_id).toBe('spaced'); // raw_id.strip() then scrub
    });

    it.runIf(HAVE_PYTHON)('subject derivation: council/video override, kind map, unknown', () => {
        const cases: Array<[Record<string, unknown>, string]> = [
            [{ directive_set: 'council', input: { kind: 'ticket', data: {} } }, 'council'],
            [{ directive_set: 'video', input: { kind: 'ticket', data: {} } }, 'video'],
            [{ input: { kind: 'prompt', data: {} } }, 'work'],
            [{ input: { kind: 'diff', data: {} } }, 'work'],
            [{ input: { kind: 'file', data: {} } }, 'work'],
            [{ input: { kind: 'mystery', data: {} } }, 'unknown'],
            [{ input: { data: {} } }, 'unknown'],
        ];
        for (const [extra, expectedSubject] of cases) {
            const stateFile = path.join(root, '.work-state.json');
            writeJson(stateFile, { version: 1, ...extra });
            utimesSync(stateFile, STATE_MTIME, STATE_MTIME);
            const py = runPy(root);
            expect(py.status, py.stderr).toBe(0);
            const trace = build_trace(root, stateFile, { now: NOW_DATE });
            expect(trace.subject).toBe(expectedSubject);
            expect(dumpSorted(trace, 0)).toBe(py.json);
        }
    });
});

// keep NOW_ISO referenced (documents the injected instant for readers)
void NOW_ISO;
