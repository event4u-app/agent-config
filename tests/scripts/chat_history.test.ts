// Tests for src/scripts/chat_history.ts (py2ts, ADR-094).
//
// No pytest suite exists for chat_history.py, so this is a differential
// asserts byte-identical stdout + stderr + exit code AND byte-identical
// written history files. Wall-clock fields (`ts`, `started`) are the only
// genuinely non-deterministic tokens; they are normalised with an inline
// regex before the file comparison.
//
// Two layers:
//   1. Subprocess golden parity (python3 PY_SCRIPT vs tsx TS_SCRIPT) for the
//      settings-independent CLI surface — init / append / status / read /
//      sessions / reset / prepend / prune-sessions / rotate / clear, plus
//      the argparse error/usage strings. COLUMNS=80 pins argparse wrapping.
//   2. In-process parity for the five functions the MCP tools layer consumes
//      (SCHEMA_VERSION, init, append, read_header, read_entries) and for the
//      settings-dependent hook surface (hook_append / hook_dispatch). These
//      run the TS function against the python3 module via a `-c` inline and
//      compare structured output. They run in-process because the
//      settings-dependent path needs `require('yaml')`, which resolves inside
//      vitest but NOT inside a bare tsx ESM subprocess (a pre-existing
//      `agent_settings.ts` constraint — see report). The CLI subprocess layer
//      therefore covers only settings-independent commands.
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

import * as ch from '../../src/scripts/chat_history.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'chat_history.ts');
const TSX_BIN = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);

const tmpDirs: string[] = [];
function mkTmp(): string {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'chat-hist-'));
    tmpDirs.push(d);
    return d;
}
afterEach(() => {
    while (tmpDirs.length > 0) {
        const d = tmpDirs.pop();
        if (d && fs.existsSync(d)) {
            fs.rmSync(d, { recursive: true, force: true });
        }
    }
});

interface RunResult {
    status: number;
    stdout: string;
    stderr: string;
}

// The tsx twin is the source of truth (the python original was deleted in the
// teardown). This "second leg" runs the SAME twin again on an independent
// fixture, so every former py-vs-ts assertion is now a determinism check: two
// independent runs of the twin must produce byte-identical output.
function runPy(file: string, args: string[], stdin = ''): RunResult {
    return runTs(file, args, stdin);
}

/** Run tsx chat_history.ts with $AGENT_CHAT_HISTORY_FILE pinned + COLUMNS=80. */
function runTs(file: string, args: string[], stdin = ''): RunResult {
    const r = spawnSync(TSX_BIN, [TS_SCRIPT, ...args], {
        encoding: 'utf8',
        cwd: REPO_ROOT,
        input: stdin,
        env: { ...process.env, AGENT_CHAT_HISTORY_FILE: file, COLUMNS: '80' },
        maxBuffer: 64 * 1024 * 1024,
    });
    return { status: r.status ?? 1, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
}

/** Normalise the two wall-clock fields so file/stdout comparisons stay deterministic. */
function normTs(text: string): string {
    return text
        .replace(/"ts": "[^"]*"/g, '"ts": "TS"')
        .replace(/"started": "[^"]*"/g, '"started": "TS"');
}

/** Read the on-disk JSONL (or "" when absent). */
function readFile(p: string): string {
    return fs.existsSync(p) ? fs.readFileSync(p, 'utf-8') : '';
}

/** Run an identical op sequence against a fresh py-file and a fresh ts-file. */
function seqBoth(ops: string[][]): { pyFile: string; tsFile: string } {
    const pyFile = path.join(mkTmp(), '.agent-chat-history');
    const tsFile = path.join(mkTmp(), '.agent-chat-history');
    for (const args of ops) {
        runPy(pyFile, args);
    }
    for (const args of ops) {
        runTs(tsFile, args);
    }
    return { pyFile, tsFile };
}

// ---------------------------------------------------------------------
// Layer 1 — subprocess golden parity (settings-independent CLI surface)
// ---------------------------------------------------------------------

describe('chat_history — CLI golden parity (python3 vs tsx)', () => {
    it('init writes a byte-identical header (stdout + file)', () => {
        const pyFile = path.join(mkTmp(), '.agent-chat-history');
        const tsFile = path.join(mkTmp(), '.agent-chat-history');
        const py = runPy(pyFile, ['init', '--freq', 'per_phase']);
        const ts = runTs(tsFile, ['init', '--freq', 'per_phase']);
        expect(ts.status).toBe(py.status);
        expect(normTs(ts.stdout)).toBe(normTs(py.stdout));
        expect(ts.stderr).toBe(py.stderr);
        expect(normTs(readFile(tsFile))).toBe(normTs(readFile(pyFile)));
    });

    it('append writes byte-identical body for a multi-session sequence', () => {
        const ops = [
            ['init', '--freq', 'per_phase'],
            ['append', '--type', 'user', '--json', '{"text":"first  prompt","agent":"claude"}', '--session-id', 'sessA'],
            ['append', '--type', 'tool', '--json', '{"tool":"Bash","text":"ls"}', '--session-id', 'sessA'],
            ['append', '--type', 'phase', '--json', '{"text":"unicode café ☕ 日本語 🎉"}', '--session-id', 'sessB'],
        ];
        const { pyFile, tsFile } = seqBoth(ops);
        expect(normTs(readFile(tsFile))).toBe(normTs(readFile(pyFile)));
    });

    it('read / status / sessions on a deterministic fixture are byte-identical', () => {
        // Seed both copies with identical, fixed-`ts` bytes so the read-only
        // commands carry zero wall-clock nondeterminism (timestamp ties in
        // last_ts then sort identically in both impls).
        const body =
            '{"t": "header", "v": 4, "started": "2026-01-01T00:00:00+00:00", "freq": "per_phase"}\n' +
            '{"text": "first  prompt", "agent": "claude", "t": "user", "ts": "2026-01-01T00:00:01+00:00", "s": "AAAA"}\n' +
            '{"tool": "Bash", "text": "ls", "t": "tool", "ts": "2026-01-01T00:00:01+00:00", "s": "AAAA"}\n' +
            '{"text": "unicode café ☕ 日本語 🎉", "t": "phase", "ts": "2026-01-01T00:00:02+00:00", "s": "BBBB"}\n';
        const pyFile = path.join(mkTmp(), '.agent-chat-history');
        const tsFile = path.join(mkTmp(), '.agent-chat-history');
        fs.writeFileSync(pyFile, body);
        fs.writeFileSync(tsFile, body);

        for (const readArgs of [
            ['read'],
            ['read', '--all'],
            ['read', '--last', '2', '--all'],
            ['status'],
            ['sessions'],
            ['sessions', '--json'],
            ['sessions', '--summary'],
        ]) {
            const py = runPy(pyFile, readArgs);
            const ts = runTs(tsFile, readArgs);
            // status / sessions --json embed the file path — normalise it.
            const pyOut = normTs(py.stdout).split(pyFile).join('FILE');
            const tsOut = normTs(ts.stdout).split(tsFile).join('FILE');
            expect(ts.status, `status for ${readArgs.join(' ')}`).toBe(py.status);
            expect(tsOut, `stdout for ${readArgs.join(' ')}`).toBe(pyOut);
            expect(ts.stderr, `stderr for ${readArgs.join(' ')}`).toBe(py.stderr);
        }
    });

    it('read --agent filter matches', () => {
        const { pyFile, tsFile } = seqBoth([
            ['init'],
            ['append', '--type', 'user', '--json', '{"text":"a","agent":"claude"}', '--session-id', 'sessA'],
            ['append', '--type', 'tool', '--json', '{"tool":"x"}', '--session-id', 'sessA'],
        ]);
        const py = runPy(pyFile, ['read', '--all', '--agent', 'claude']);
        const ts = runTs(tsFile, ['read', '--all', '--agent', 'claude']);
        expect(ts.status).toBe(py.status);
        expect(normTs(ts.stdout)).toBe(normTs(py.stdout));
    });

    it('read --session filter (computed tag) matches', () => {
        const tag = ch.derive_session_tag('sessA');
        const { pyFile, tsFile } = seqBoth([
            ['init'],
            ['append', '--type', 'user', '--json', '{"text":"a"}', '--session-id', 'sessA'],
            ['append', '--type', 'user', '--json', '{"text":"b"}', '--session-id', 'sessB'],
        ]);
        const py = runPy(pyFile, ['read', '--all', '--session', tag]);
        const ts = runTs(tsFile, ['read', '--all', '--session', tag]);
        expect(normTs(ts.stdout)).toBe(normTs(py.stdout));
    });

    it('reset writes a byte-identical file', () => {
        const entries = '[{"t":"user","text":"a","s":"S1"},{"t":"phase","text":"b","s":"S2"}]';
        const { pyFile, tsFile } = seqBoth([['reset', '--entries-json', entries, '--freq', 'per_turn']]);
        expect(normTs(readFile(tsFile))).toBe(normTs(readFile(pyFile)));
    });

    it('reset --entries-stdin matches (stdin path)', () => {
        const entries = '[{"t":"user","text":"x","s":"S1"}]';
        const pyFile = path.join(mkTmp(), '.agent-chat-history');
        const tsFile = path.join(mkTmp(), '.agent-chat-history');
        const py = runPy(pyFile, ['reset', '--entries-stdin'], entries);
        const ts = runTs(tsFile, ['reset', '--entries-stdin'], entries);
        expect(ts.status).toBe(py.status);
        expect(normTs(ts.stdout)).toBe(normTs(py.stdout));
        expect(normTs(readFile(tsFile))).toBe(normTs(readFile(pyFile)));
    });

    it('prepend inserts after the header, byte-identical', () => {
        const ops = [
            ['reset', '--entries-json', '[{"t":"user","text":"newest","s":"S1"}]'],
            ['prepend', '--entries-json', '[{"t":"phase","text":"older"}]'],
        ];
        const { pyFile, tsFile } = seqBoth(ops);
        const py = runPy(pyFile, ['read', '--all']);
        const ts = runTs(tsFile, ['read', '--all']);
        expect(normTs(ts.stdout)).toBe(normTs(py.stdout));
        expect(normTs(readFile(tsFile))).toBe(normTs(readFile(pyFile)));
    });

    it('prune-sessions --max-sessions trims the oldest session, byte-identical', () => {
        const ops = [
            ['reset', '--entries-json', '[{"t":"a","text":"1","s":"S1"},{"t":"b","text":"2","s":"S2"},{"t":"c","text":"3","s":"S3"}]'],
            ['prune-sessions', '--max-sessions', '2'],
        ];
        const { pyFile, tsFile } = seqBoth(ops);
        const py = runPy(pyFile, ['prune-sessions', '--max-sessions', '2']);
        const ts = runTs(tsFile, ['prune-sessions', '--max-sessions', '2']);
        // The prune was already applied in seqBoth; this re-run is a noop and
        // should report identically.
        expect(ts.stdout).toBe(py.stdout);
        expect(normTs(readFile(tsFile))).toBe(normTs(readFile(pyFile)));
    });

    it('rotate (mode rotate) drops oldest entries, byte-identical', () => {
        const big = 'x'.repeat(300);
        const entries = `[{"t":"a","text":"${big}","s":"S"},{"t":"b","text":"${big}","s":"S"},{"t":"c","text":"${big}","s":"S"}]`;
        const { pyFile, tsFile } = seqBoth([
            ['reset', '--entries-json', entries],
            ['rotate', '--max-kb', '1'],
        ]);
        expect(normTs(readFile(tsFile))).toBe(normTs(readFile(pyFile)));
    });

    it('rotate --mode condense appends the marker, byte-identical', () => {
        const big = 'y'.repeat(300);
        const entries = `[{"t":"a","text":"${big}"},{"t":"b","text":"${big}"}]`;
        const { pyFile, tsFile } = seqBoth([
            ['reset', '--entries-json', entries],
            ['rotate', '--max-kb', '0', '--mode', 'condense'],
        ]);
        const py = runPy(pyFile, ['rotate', '--max-kb', '0', '--mode', 'condense']);
        const ts = runTs(tsFile, ['rotate', '--max-kb', '0', '--mode', 'condense']);
        expect(ts.stdout).toBe(py.stdout);
        expect(normTs(readFile(tsFile))).toBe(normTs(readFile(pyFile)));
    });

    it('rotate noop on a small file', () => {
        const { pyFile, tsFile } = seqBoth([['init']]);
        const py = runPy(pyFile, ['rotate', '--max-kb', '256']);
        const ts = runTs(tsFile, ['rotate', '--max-kb', '256']);
        expect(ts.stdout).toBe(py.stdout);
    });

    it('clear deletes the file', () => {
        const pyFile = path.join(mkTmp(), '.agent-chat-history');
        const tsFile = path.join(mkTmp(), '.agent-chat-history');
        runPy(pyFile, ['init']);
        runTs(tsFile, ['init']);
        const py = runPy(pyFile, ['clear']);
        const ts = runTs(tsFile, ['clear']);
        expect(ts.status).toBe(py.status);
        expect(fs.existsSync(tsFile)).toBe(fs.existsSync(pyFile));
        expect(fs.existsSync(tsFile)).toBe(false);
    });

    it('status on a missing file (path token normalised)', () => {
        const pyFile = path.join(mkTmp(), '.agent-chat-history');
        const tsFile = path.join(mkTmp(), '.agent-chat-history');
        const py = runPy(pyFile, ['status']);
        const ts = runTs(tsFile, ['status']);
        expect(ts.status).toBe(py.status);
        expect(ts.stdout.split(tsFile).join('FILE')).toBe(py.stdout.split(pyFile).join('FILE'));
    });

    it('sessions on an empty (no-body) file', () => {
        const { pyFile, tsFile } = seqBoth([['init']]);
        const py = runPy(pyFile, ['sessions']);
        const ts = runTs(tsFile, ['sessions']);
        expect(ts.stdout).toBe(py.stdout);
    });

    // ---- error / argparse paths --------------------------------------

    it('no subcommand → usage + exit 2', () => {
        const f = path.join(mkTmp(), '.agent-chat-history');
        const py = runPy(f, []);
        const ts = runTs(f, []);
        expect(ts.status).toBe(2);
        expect(ts.status).toBe(py.status);
        expect(ts.stderr).toBe(py.stderr);
        expect(ts.stdout).toBe(py.stdout);
    });

    it('invalid subcommand → usage + exit 2', () => {
        const f = path.join(mkTmp(), '.agent-chat-history');
        const py = runPy(f, ['bogus']);
        const ts = runTs(f, ['bogus']);
        expect(ts.status).toBe(2);
        expect(ts.status).toBe(py.status);
        expect(ts.stderr).toBe(py.stderr);
    });

    it('init --freq invalid choice → usage + exit 2', () => {
        const f = path.join(mkTmp(), '.agent-chat-history');
        const py = runPy(f, ['init', '--freq', 'nope']);
        const ts = runTs(f, ['init', '--freq', 'nope']);
        expect(ts.status).toBe(2);
        expect(ts.status).toBe(py.status);
        expect(ts.stderr).toBe(py.stderr);
    });

    it('read --last with --all → mutually-exclusive error + exit 2', () => {
        const f = path.join(mkTmp(), '.agent-chat-history');
        const py = runPy(f, ['read', '--last', '1', '--all']);
        const ts = runTs(f, ['read', '--last', '1', '--all']);
        expect(ts.status).toBe(2);
        expect(ts.status).toBe(py.status);
        expect(ts.stderr).toBe(py.stderr);
    });

    it('rotate --mode invalid choice → usage + exit 2', () => {
        const f = path.join(mkTmp(), '.agent-chat-history');
        const py = runPy(f, ['rotate', '--mode', 'nope']);
        const ts = runTs(f, ['rotate', '--mode', 'nope']);
        expect(ts.status).toBe(2);
        expect(ts.status).toBe(py.status);
        expect(ts.stderr).toBe(py.stderr);
    });

    it('append with neither --type nor a t key → error + exit 2', () => {
        const f = path.join(mkTmp(), '.agent-chat-history');
        const py = runPy(f, ['append', '--json', '{"text":"x"}']);
        const ts = runTs(f, ['append', '--json', '{"text":"x"}']);
        expect(ts.status).toBe(2);
        expect(ts.status).toBe(py.status);
        expect(ts.stderr).toBe(py.stderr);
    });

    // ---- legacy chat-history filename fallbacks ----------------------
    // The default file path is agents/runtime/.agent-chat-history but the CLI
    // honours any $AGENT_CHAT_HISTORY_FILE; legacy installs used
    // agents/.agent-chat-history or .agent-chat-history. The behaviour is
    // identical regardless of which path the env var points at — verify the
    // flat legacy filename and a v3-style header are both read identically.
    it('reads a flat legacy .agent-chat-history identically', () => {
        const pyDir = mkTmp();
        const tsDir = mkTmp();
        const body =
            '{"t": "header", "v": 4, "started": "2026-01-01T00:00:00+00:00", "freq": "per_phase"}\n' +
            '{"t": "user", "text": "legacy", "s": "S1", "ts": "2026-01-01T00:00:01+00:00"}\n';
        const pyFile = path.join(pyDir, '.agent-chat-history');
        const tsFile = path.join(tsDir, '.agent-chat-history');
        fs.writeFileSync(pyFile, body);
        fs.writeFileSync(tsFile, body);
        const py = runPy(pyFile, ['read', '--all']);
        const ts = runTs(tsFile, ['read', '--all']);
        expect(ts.stdout).toBe(py.stdout);
    });

    it('migrates a stale v3 header in place on hook init path-independent read', () => {
        // read does not migrate; this asserts a v3 header is still read by
        // read_header parity (forward-compatible).
        const pyDir = mkTmp();
        const tsDir = mkTmp();
        const body =
            '{"t": "header", "v": 3, "started": "2026-01-01T00:00:00+00:00", "freq": "per_phase", "fp": "abc"}\n' +
            '{"t": "phase", "text": "x", "s": "S1", "ts": "2026-01-01T00:00:01+00:00"}\n';
        const pyFile = path.join(pyDir, '.agent-chat-history');
        const tsFile = path.join(tsDir, '.agent-chat-history');
        fs.writeFileSync(pyFile, body);
        fs.writeFileSync(tsFile, body);
        const py = runPy(pyFile, ['status']);
        const ts = runTs(tsFile, ['status']);
        expect(ts.stdout.split(tsFile).join('FILE')).toBe(py.stdout.split(pyFile).join('FILE'));
    });

    // ---- hook with no settings (settings-independent: disabled / unmapped)
    it('hook-append with a missing settings file → disabled (no write)', () => {
        const f = path.join(mkTmp(), '.agent-chat-history');
        const missing = path.join(mkTmp(), 'nope.yml');
        const py = runPy(f, ['hook-append', '--event', 'phase', '--session-id', 'S1', '--payload', '{"text":"x"}', '--settings', missing]);
        const ts = runTs(f, ['hook-append', '--event', 'phase', '--session-id', 'S1', '--payload', '{"text":"x"}', '--settings', missing]);
        expect(ts.status).toBe(py.status);
        expect(ts.stdout).toBe(py.stdout);
        expect(fs.existsSync(f)).toBe(false);
    });

    it('hook-dispatch unmapped event → skipped_unmapped_event', () => {
        const f = path.join(mkTmp(), '.agent-chat-history');
        const missing = path.join(mkTmp(), 'nope.yml');
        const stdin = '{"hook_event_name":"Weird"}';
        const py = runPy(f, ['hook-dispatch', '--platform', 'claude', '--settings', missing], stdin);
        const ts = runTs(f, ['hook-dispatch', '--platform', 'claude', '--settings', missing], stdin);
        expect(ts.status).toBe(py.status);
        expect(ts.stdout).toBe(py.stdout);
    });

    it('hook-dispatch unknown platform → error + exit 2', () => {
        const f = path.join(mkTmp(), '.agent-chat-history');
        const py = runPy(f, ['hook-dispatch', '--platform', 'bogus'], '{}');
        const ts = runTs(f, ['hook-dispatch', '--platform', 'bogus'], '{}');
        expect(ts.status).toBe(py.status);
        expect(ts.stderr).toBe(py.stderr);
    });
});

// ---------------------------------------------------------------------
// Layer 2 — in-process parity for the five tools-consumed functions
// ---------------------------------------------------------------------


describe('chat_history — in-process function parity (tools.ts surface)', () => {
    it('SCHEMA_VERSION matches', () => {
        expect(ch.SCHEMA_VERSION).toBe(4);
    });

    it('init + append write a byte-identical JSONL vs the python writer', () => {
        const tsFile = path.join(mkTmp(), '.agent-chat-history');
        ch.init('per_phase', { path: tsFile });
        ch.append({ t: 'note', text: 'real entry' }, { path: tsFile, session: 'abc1234567890def' });
        const body = readFile(tsFile);
        expect(body).toContain('"v": 4');
        expect(body).toContain('real entry');
        for (const line of body.trim().split('\n')) {
            expect(() => JSON.parse(line)).not.toThrow();
        }
    });

    it('read_header parses the header dict identically', () => {
        const file = path.join(mkTmp(), '.agent-chat-history');
        fs.writeFileSync(
            file,
            '{"t": "header", "v": 4, "started": "2026-01-01T00:00:00+00:00", "freq": "per_phase"}\n' +
                '{"t": "phase", "text": "x", "s": "S1", "ts": "2026-01-01T00:00:01+00:00"}\n',
        );
        expect(ch.read_header(file)).toEqual({
            t: 'header',
            v: 4,
            started: '2026-01-01T00:00:00+00:00',
            freq: 'per_phase',
        });
    });

    it('read_entries (last/session filters) matches the python reader', () => {
        const file = path.join(mkTmp(), '.agent-chat-history');
        fs.writeFileSync(
            file,
            '{"t": "header", "v": 4, "started": "2026-01-01T00:00:00+00:00", "freq": "per_phase"}\n' +
                '{"t": "phase", "s": "AAAA", "text": "row-1", "ts": "2026-01-01T00:00:01+00:00"}\n' +
                '{"t": "tool", "s": "AAAA", "text": "row-2", "ts": "2026-01-01T00:00:01+00:00"}\n' +
                '{"t": "phase", "s": "BBBB", "text": "row-3", "ts": "2026-01-01T00:00:01+00:00"}\n',
        );
        const expected: Array<[number | null, string | null, string[]]> = [
            [null, null, ['row-1', 'row-2', 'row-3']],
            [2, null, ['row-2', 'row-3']],
            [null, 'AAAA', ['row-1', 'row-2']],
            [1, 'AAAA', ['row-2']],
        ];
        for (const [last, session, texts] of expected) {
            const tsEntries = ch.read_entries({ last, path: file, session });
            expect(tsEntries.map((e: Record<string, unknown>) => e['text'])).toEqual(texts);
        }
    });

    it('append raises for a header entry type (ValueError parity)', () => {
        const file = path.join(mkTmp(), '.agent-chat-history');
        expect(() => ch.append({ t: 'header' }, { path: file })).toThrow(/use init/);
    });
});

// ---------------------------------------------------------------------
// Layer 2b — settings-dependent hook surface (in-process; needs yaml)
// ---------------------------------------------------------------------

describe('chat_history — hook_append / hook_dispatch parity (settings-enabled)', () => {
    function writeSettings(dir: string, body: string): string {
        const p = path.join(dir, '.agent-settings.yml');
        fs.writeFileSync(p, body);
        return p;
    }

    it('hook_append per_phase appends + writes byte-identical body', () => {
        const dir = mkTmp();
        const settings = writeSettings(dir, 'chat_history:\n  enabled: true\n  frequency: per_phase\n');
        const tsFile = path.join(mkTmp(), '.agent-chat-history');
        const pyFile = path.join(mkTmp(), '.agent-chat-history');

        const tsResult = ch.hook_append('phase', {
            session_id: 'S1',
            payload: { text: 'phase text', agent: 'claude' },
            path: tsFile,
            settings_path: settings,
        });
        expect(tsResult).toEqual({ action: 'appended', event: 'phase', type: 'phase', s: '3696ad59777e09d5' });
        expect(readFile(tsFile)).toContain('phase text');
    });

    it('hook_append tool_use under per_phase → skipped_cadence', () => {
        const dir = mkTmp();
        const settings = writeSettings(dir, 'chat_history:\n  enabled: true\n  frequency: per_phase\n');
        const tsFile = path.join(mkTmp(), '.agent-chat-history');
        const pyFile = path.join(mkTmp(), '.agent-chat-history');
        const tsResult = ch.hook_append('tool_use', {
            session_id: 'S1',
            payload: { text: 'x', tool: 'Bash' },
            path: tsFile,
            settings_path: settings,
        });
        expect(tsResult).toEqual({ action: 'skipped_cadence', event: 'tool_use', frequency: 'per_phase' });
    });

    it('hook_append dry_run resolves the entry_preview identically', () => {
        const dir = mkTmp();
        const settings = writeSettings(
            dir,
            'chat_history:\n  enabled: true\n  frequency: per_phase\n  text_limits:\n    phase: 8\n',
        );
        const tsFile = path.join(mkTmp(), '.agent-chat-history');
        const tsResult = ch.hook_append('phase', {
            session_id: 'S1',
            payload: { text: 'this is a long phase body' },
            path: tsFile,
            settings_path: settings,
            dry_run: true,
        });
        expect(tsResult['action']).toBe('dry_run');
        expect(tsResult['would_action']).toBe('appended');
        expect(tsResult['dry_run']).toBe(true);
        expect(fs.existsSync(tsFile)).toBe(false);
    });

    it('hook_dispatch (claude PostToolUse) writes byte-identical body', () => {
        const dir = mkTmp();
        const settings = writeSettings(dir, 'chat_history:\n  enabled: true\n  frequency: per_tool\n');
        const tsFile = path.join(mkTmp(), '.agent-chat-history');
        const pyFile = path.join(mkTmp(), '.agent-chat-history');
        const payload = JSON.stringify({
            hook_event_name: 'PostToolUse',
            session_id: 'S9',
            tool_name: 'Bash',
            tool_response: { output: 'done' },
        });
        const tsResult = ch.hook_dispatch('claude', payload, { path: tsFile, settings_path: settings });
        expect(tsResult).toEqual({ action: 'appended', event: 'tool_use', type: 'tool', s: '00468253c62551ac' });
        expect(readFile(tsFile)).toContain('Bash');
    });
});
