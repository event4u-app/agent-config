// Tests for src/scripts/chat_history.ts (py2ts, ADR-094).
//
// The Python original (chat_history.py) was deleted after the migration, so
// this suite tests the tsx twin directly — no parity legs. Wall-clock fields
// (`ts`, `started`) are the only genuinely non-deterministic tokens; they are
// normalised with an inline regex before file/stdout assertions.
//
// Two layers:
//   1. CLI intent tests (in-process main(), subprocess only for the stdin
//      path) for the settings-independent surface — init / append / status /
//      read / sessions / reset / prepend / prune-sessions / rotate / clear,
//      plus the argparse error/usage paths. COLUMNS=80 pins argparse wrapping.
//   2. In-process tests for the five functions the MCP tools layer consumes
//      (SCHEMA_VERSION, init, append, read_header, read_entries) and for the
//      settings-dependent hook surface (hook_append / hook_dispatch). These
//      run in-process because the settings-dependent path needs
//      `require('yaml')`, which resolves inside vitest but NOT inside a bare
//      tsx ESM subprocess (a pre-existing `agent_settings.ts` constraint —
//      see report). The CLI layer therefore covers only settings-independent
//      commands.
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

import * as ch from '../../src/scripts/chat_history.js';
import { main } from '../../src/scripts/chat_history.js';
import { runInProc } from '../_lib/run_in_process.js';

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

/** Run tsx chat_history.ts with $AGENT_CHAT_HISTORY_FILE pinned + COLUMNS=80. */
function runCli(file: string, args: string[], stdin = ''): RunResult {
    if (stdin) {
        // stdin redirect requires subprocess — rare path (only reset --entries-stdin)
        const r = spawnSync(TSX_BIN, [TS_SCRIPT, ...args], {
            encoding: 'utf8',
            cwd: REPO_ROOT,
            input: stdin,
            env: { ...process.env, AGENT_CHAT_HISTORY_FILE: file, COLUMNS: '80' },
            maxBuffer: 64 * 1024 * 1024,
        });
        return { status: r.status ?? 1, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
    }
    return runInProc(main, args, { env: { AGENT_CHAT_HISTORY_FILE: file, COLUMNS: '80' } });
}

/** Normalise the two wall-clock fields so file/stdout assertions stay deterministic. */
function normTs(text: string): string {
    return text
        .replace(/"ts": "[^"]*"/g, '"ts": "TS"')
        .replace(/"started": "[^"]*"/g, '"started": "TS"');
}

/** Read the on-disk JSONL (or "" when absent). */
function readFile(p: string): string {
    return fs.existsSync(p) ? fs.readFileSync(p, 'utf-8') : '';
}

/** Parse every JSONL line of the on-disk history file. */
function readLines(p: string): Array<Record<string, unknown>> {
    return readFile(p)
        .trim()
        .split('\n')
        .filter((l) => l.length > 0)
        .map((l) => JSON.parse(l) as Record<string, unknown>);
}

/** Run an op sequence against a fresh history file; returns the file path. */
function seq(ops: string[][]): string {
    const file = path.join(mkTmp(), '.agent-chat-history');
    for (const args of ops) {
        runCli(file, args);
    }
    return file;
}

// ---------------------------------------------------------------------
// Layer 1 — CLI intent tests (settings-independent surface)
// ---------------------------------------------------------------------

describe('chat_history — CLI surface', () => {
    it('init writes the v4 header (stdout + file)', () => {
        const file = path.join(mkTmp(), '.agent-chat-history');
        const r = runCli(file, ['init', '--freq', 'per_phase']);
        expect(r.status).toBe(0);
        expect(r.stderr).toBe('');
        expect(normTs(r.stdout)).toBe(
            '{"t": "header", "v": 4, "started": "TS", "freq": "per_phase"}\n',
        );
        expect(normTs(readFile(file))).toBe(
            '{"t": "header", "v": 4, "started": "TS", "freq": "per_phase"}\n',
        );
    });

    it('append writes the expected body for a multi-session sequence', () => {
        const file = seq([
            ['init', '--freq', 'per_phase'],
            ['append', '--type', 'user', '--json', '{"text":"first  prompt","agent":"claude"}', '--session-id', 'sessA'],
            ['append', '--type', 'tool', '--json', '{"tool":"Bash","text":"ls"}', '--session-id', 'sessA'],
            ['append', '--type', 'phase', '--json', '{"text":"unicode café ☕ 日本語 🎉"}', '--session-id', 'sessB'],
        ]);
        const tagA = ch.derive_session_tag('sessA');
        const tagB = ch.derive_session_tag('sessB');
        const lines = readLines(file);
        expect(lines).toHaveLength(4);
        expect(lines[0]).toMatchObject({ t: 'header', v: 4, freq: 'per_phase' });
        expect(lines[1]).toMatchObject({ t: 'user', text: 'first  prompt', agent: 'claude', s: tagA });
        expect(lines[2]).toMatchObject({ t: 'tool', tool: 'Bash', text: 'ls', s: tagA });
        expect(lines[3]).toMatchObject({ t: 'phase', text: 'unicode café ☕ 日本語 🎉', s: tagB });
    });

    // A fixed-`ts` fixture so the read-only commands carry zero wall-clock
    // nondeterminism (timestamp ties in last_ts then sort identically).
    const FIXTURE =
        '{"t": "header", "v": 4, "started": "2026-01-01T00:00:00+00:00", "freq": "per_phase"}\n' +
        '{"text": "first  prompt", "agent": "claude", "t": "user", "ts": "2026-01-01T00:00:01+00:00", "s": "AAAA"}\n' +
        '{"tool": "Bash", "text": "ls", "t": "tool", "ts": "2026-01-01T00:00:01+00:00", "s": "AAAA"}\n' +
        '{"text": "unicode café ☕ 日本語 🎉", "t": "phase", "ts": "2026-01-01T00:00:02+00:00", "s": "BBBB"}\n';

    function fixtureFile(): string {
        const file = path.join(mkTmp(), '.agent-chat-history');
        fs.writeFileSync(file, FIXTURE);
        return file;
    }

    it('read (default) returns only the latest session as JSON', () => {
        const r = runCli(fixtureFile(), ['read']);
        expect(r.status).toBe(0);
        const entries = JSON.parse(r.stdout) as Array<Record<string, unknown>>;
        expect(entries).toHaveLength(1);
        expect(entries[0]).toMatchObject({ t: 'phase', s: 'BBBB', text: 'unicode café ☕ 日本語 🎉' });
    });

    it('read --all returns every entry in file order', () => {
        const r = runCli(fixtureFile(), ['read', '--all']);
        expect(r.status).toBe(0);
        const entries = JSON.parse(r.stdout) as Array<Record<string, unknown>>;
        expect(entries.map((e) => e['text'])).toEqual(['first  prompt', 'ls', 'unicode café ☕ 日本語 🎉']);
    });

    it('read --last N caps the entries of the latest session', () => {
        // latest session (BBBB) has three entries; --last 2 keeps the newest two.
        const file = path.join(mkTmp(), '.agent-chat-history');
        fs.writeFileSync(
            file,
            '{"t": "header", "v": 4, "started": "2026-01-01T00:00:00+00:00", "freq": "per_phase"}\n' +
                '{"t": "phase", "s": "BBBB", "text": "one", "ts": "2026-01-01T00:00:01+00:00"}\n' +
                '{"t": "phase", "s": "BBBB", "text": "two", "ts": "2026-01-01T00:00:02+00:00"}\n' +
                '{"t": "phase", "s": "BBBB", "text": "three", "ts": "2026-01-01T00:00:03+00:00"}\n',
        );
        const r = runCli(file, ['read', '--last', '2']);
        expect(r.status).toBe(0);
        const entries = JSON.parse(r.stdout) as Array<Record<string, unknown>>;
        expect(entries.map((e) => e['text'])).toEqual(['two', 'three']);
    });

    it('status reports size, entry count, header, and agent mix', () => {
        const file = fixtureFile();
        const r = runCli(file, ['status']);
        expect(r.status).toBe(0);
        const doc = JSON.parse(r.stdout) as Record<string, unknown>;
        expect(doc['exists']).toBe(true);
        expect(doc['path']).toBe(file);
        expect(doc['entries']).toBe(3);
        expect(doc['header']).toMatchObject({ t: 'header', v: 4, freq: 'per_phase' });
        expect(doc['agents']).toEqual({ total: 2, per_agent: { '<unknown>': 2, claude: 1 } });
    });

    it('sessions renders the table, latest session first', () => {
        const r = runCli(fixtureFile(), ['sessions']);
        expect(r.status).toBe(0);
        expect(r.stdout).toContain('ID    COUNT  AGENTS');
        expect(r.stdout).toContain('BBBB  1      <unknown>');
        expect(r.stdout).toContain('AAAA  2      <unknown>,claude');
        expect(r.stdout.indexOf('BBBB')).toBeLessThan(r.stdout.indexOf('AAAA'));
    });

    it('sessions --json emits structured session records', () => {
        const r = runCli(fixtureFile(), ['sessions', '--json']);
        expect(r.status).toBe(0);
        const doc = JSON.parse(r.stdout) as Array<Record<string, unknown>>;
        expect(doc.map((s) => s['id'])).toEqual(['BBBB', 'AAAA']);
        expect(doc[1]).toMatchObject({
            id: 'AAAA',
            count: 2,
            preview: 'first prompt',
            agents: ['<unknown>', 'claude'],
        });
    });

    it('sessions --summary renders per-session summaries', () => {
        const r = runCli(fixtureFile(), ['sessions', '--summary']);
        expect(r.status).toBe(0);
        expect(r.stdout).toContain('SUMMARY');
        expect(r.stdout).toContain('BBBB');
        expect(r.stdout).toContain('first prompt');
    });

    it('read --agent filter matches', () => {
        const file = seq([
            ['init'],
            ['append', '--type', 'user', '--json', '{"text":"a","agent":"claude"}', '--session-id', 'sessA'],
            ['append', '--type', 'tool', '--json', '{"tool":"x"}', '--session-id', 'sessA'],
        ]);
        const r = runCli(file, ['read', '--all', '--agent', 'claude']);
        expect(r.status).toBe(0);
        const entries = JSON.parse(r.stdout) as Array<Record<string, unknown>>;
        expect(entries).toHaveLength(1);
        expect(entries[0]).toMatchObject({ t: 'user', text: 'a', agent: 'claude' });
    });

    it('read --session filter (computed tag) matches', () => {
        const tag = ch.derive_session_tag('sessA');
        const file = seq([
            ['init'],
            ['append', '--type', 'user', '--json', '{"text":"a"}', '--session-id', 'sessA'],
            ['append', '--type', 'user', '--json', '{"text":"b"}', '--session-id', 'sessB'],
        ]);
        // --all overrides the session filter, so filter without it.
        const r = runCli(file, ['read', '--session', tag]);
        expect(r.status).toBe(0);
        const entries = JSON.parse(r.stdout) as Array<Record<string, unknown>>;
        expect(entries.map((e) => e['text'])).toEqual(['a']);
        expect(entries[0]!['s']).toBe(tag);
    });

    it('reset writes a fresh header + the given entries', () => {
        const entries = '[{"t":"user","text":"a","s":"S1"},{"t":"phase","text":"b","s":"S2"}]';
        const file = seq([['reset', '--entries-json', entries, '--freq', 'per_turn']]);
        const lines = readLines(file);
        expect(lines).toHaveLength(3);
        expect(lines[0]).toMatchObject({ t: 'header', v: 4, freq: 'per_turn' });
        expect(lines[1]).toMatchObject({ t: 'user', text: 'a', s: 'S1' });
        expect(lines[2]).toMatchObject({ t: 'phase', text: 'b', s: 'S2' });
    });

    it('reset --entries-stdin writes the piped entries (stdin path)', () => {
        const file = path.join(mkTmp(), '.agent-chat-history');
        const r = runCli(file, ['reset', '--entries-stdin'], '[{"t":"user","text":"x","s":"S1"}]');
        expect(r.status).toBe(0);
        expect(r.stderr).toBe('');
        const lines = readLines(file);
        expect(lines).toHaveLength(2);
        expect(lines[0]).toMatchObject({ t: 'header', v: 4 });
        expect(lines[1]).toMatchObject({ t: 'user', text: 'x', s: 'S1' });
    });

    it('prepend inserts after the header', () => {
        const file = seq([
            ['reset', '--entries-json', '[{"t":"user","text":"newest","s":"S1"}]'],
            ['prepend', '--entries-json', '[{"t":"phase","text":"older"}]'],
        ]);
        const lines = readLines(file);
        expect(lines.map((l) => l['t'])).toEqual(['header', 'phase', 'user']);
        expect(lines.map((l) => l['text'])).toEqual([undefined, 'older', 'newest']);
        const r = runCli(file, ['read', '--all']);
        const entries = JSON.parse(r.stdout) as Array<Record<string, unknown>>;
        expect(entries.map((e) => e['text'])).toEqual(['older', 'newest']);
    });

    it('prune-sessions --max-sessions trims the oldest session, then noops', () => {
        const file = seq([
            ['reset', '--entries-json', '[{"t":"a","text":"1","s":"S1"},{"t":"b","text":"2","s":"S2"},{"t":"c","text":"3","s":"S3"}]'],
        ]);
        const first = runCli(file, ['prune-sessions', '--max-sessions', '2']);
        expect(first.status).toBe(0);
        expect(first.stdout).toBe(
            '{"action": "pruned", "kept_sessions": 2, "dropped_sessions": 1, "dropped_entries": 1}\n',
        );
        expect(readLines(file).map((l) => l['s'])).toEqual([undefined, 'S2', 'S3']);

        const again = runCli(file, ['prune-sessions', '--max-sessions', '2']);
        expect(again.stdout).toBe(
            '{"action": "noop", "kept_sessions": 2, "dropped_sessions": 0, "dropped_entries": 0}\n',
        );
        expect(readLines(file)).toHaveLength(3);
    });

    it('rotate (mode rotate) drops the oldest entries', () => {
        const big = 'x'.repeat(300);
        const entries = `[{"t":"a","text":"${big}","s":"S"},{"t":"b","text":"${big}","s":"S"},{"t":"c","text":"${big}","s":"S"}]`;
        const file = seq([['reset', '--entries-json', entries]]);
        const r = runCli(file, ['rotate', '--max-kb', '1']);
        expect(r.status).toBe(0);
        expect(r.stdout).toBe('{"action": "rotate", "kept": 2, "dropped": 1}\n');
        // oldest entry ("a") dropped; header + newest two kept
        expect(readLines(file).map((l) => l['t'])).toEqual(['header', 'b', 'c']);
    });

    it('rotate --mode condense appends the needs_condense marker', () => {
        const big = 'y'.repeat(300);
        const entries = `[{"t":"a","text":"${big}"},{"t":"b","text":"${big}"}]`;
        const file = seq([['reset', '--entries-json', entries]]);
        const r = runCli(file, ['rotate', '--max-kb', '0', '--mode', 'condense']);
        expect(r.status).toBe(0);
        expect(r.stdout).toBe('{"action": "condense_marked", "kept": 2, "dropped": 0}\n');
        const lines = readLines(file);
        expect(lines.map((l) => l['t'])).toEqual(['header', 'a', 'b', 'needs_condense']);
        expect(lines[3]!['reason']).toBe('file exceeded 0 KB, condense-mode requested');

        // re-running marks again (marker itself now counts as an entry)
        const again = runCli(file, ['rotate', '--max-kb', '0', '--mode', 'condense']);
        expect(again.stdout).toBe('{"action": "condense_marked", "kept": 3, "dropped": 0}\n');
    });

    it('rotate noop on a small file', () => {
        const file = seq([['init']]);
        const r = runCli(file, ['rotate', '--max-kb', '256']);
        expect(r.status).toBe(0);
        expect(r.stdout).toBe('{"action": "noop", "kept": null, "dropped": 0}\n');
    });

    it('clear deletes the file', () => {
        const file = seq([['init']]);
        expect(fs.existsSync(file)).toBe(true);
        const r = runCli(file, ['clear']);
        expect(r.status).toBe(0);
        expect(fs.existsSync(file)).toBe(false);
    });

    it('status on a missing file', () => {
        const file = path.join(mkTmp(), '.agent-chat-history');
        const r = runCli(file, ['status']);
        expect(r.status).toBe(0);
        expect(JSON.parse(r.stdout)).toEqual({ exists: false, path: file });
    });

    it('sessions on an empty (no-body) file', () => {
        const file = seq([['init']]);
        const r = runCli(file, ['sessions']);
        expect(r.status).toBe(0);
        expect(r.stdout).toBe('(no sessions)\n');
    });

    // ---- error / argparse paths --------------------------------------

    it('no subcommand → usage + exit 2', () => {
        const f = path.join(mkTmp(), '.agent-chat-history');
        const r = runCli(f, []);
        expect(r.status).toBe(2);
        expect(r.stdout).toBe('');
        expect(r.stderr).toContain('usage:');
        expect(r.stderr).toContain('the following arguments are required: cmd');
    });

    it('invalid subcommand → usage + exit 2', () => {
        const f = path.join(mkTmp(), '.agent-chat-history');
        const r = runCli(f, ['bogus']);
        expect(r.status).toBe(2);
        expect(r.stderr).toContain("invalid choice: 'bogus'");
    });

    it('init --freq invalid choice → usage + exit 2', () => {
        const f = path.join(mkTmp(), '.agent-chat-history');
        const r = runCli(f, ['init', '--freq', 'nope']);
        expect(r.status).toBe(2);
        expect(r.stderr).toContain(
            "argument --freq: invalid choice: 'nope' (choose from 'per_phase', 'per_tool', 'per_turn')",
        );
    });

    it('read --last with --all → mutually-exclusive error + exit 2', () => {
        const f = path.join(mkTmp(), '.agent-chat-history');
        const r = runCli(f, ['read', '--last', '1', '--all']);
        expect(r.status).toBe(2);
        expect(r.stderr).toContain('argument --all: not allowed with argument --last');
    });

    it('rotate --mode invalid choice → usage + exit 2', () => {
        const f = path.join(mkTmp(), '.agent-chat-history');
        const r = runCli(f, ['rotate', '--mode', 'nope']);
        expect(r.status).toBe(2);
        expect(r.stderr).toContain(
            "argument --mode: invalid choice: 'nope' (choose from 'condense', 'rotate')",
        );
    });

    it('append with neither --type nor a t key → error + exit 2', () => {
        const f = path.join(mkTmp(), '.agent-chat-history');
        const r = runCli(f, ['append', '--json', '{"text":"x"}']);
        expect(r.status).toBe(2);
        expect(r.stderr).toContain("--type or a 't' key in --json is required");
    });

    // ---- legacy chat-history filename fallbacks ----------------------
    // The default file path is agents/runtime/.agent-chat-history but the CLI
    // honours any $AGENT_CHAT_HISTORY_FILE; legacy installs used
    // agents/.agent-chat-history or .agent-chat-history. The behaviour is
    // identical regardless of which path the env var points at — verify the
    // flat legacy filename and a v3-style header are both read.
    it('reads a flat legacy .agent-chat-history', () => {
        const file = path.join(mkTmp(), '.agent-chat-history');
        fs.writeFileSync(
            file,
            '{"t": "header", "v": 4, "started": "2026-01-01T00:00:00+00:00", "freq": "per_phase"}\n' +
                '{"t": "user", "text": "legacy", "s": "S1", "ts": "2026-01-01T00:00:01+00:00"}\n',
        );
        const r = runCli(file, ['read', '--all']);
        expect(r.status).toBe(0);
        const entries = JSON.parse(r.stdout) as Array<Record<string, unknown>>;
        expect(entries.map((e) => e['text'])).toEqual(['legacy']);
    });

    it('status still reads a stale v3 header (forward-compatible)', () => {
        const file = path.join(mkTmp(), '.agent-chat-history');
        fs.writeFileSync(
            file,
            '{"t": "header", "v": 3, "started": "2026-01-01T00:00:00+00:00", "freq": "per_phase", "fp": "abc"}\n' +
                '{"t": "phase", "text": "x", "s": "S1", "ts": "2026-01-01T00:00:01+00:00"}\n',
        );
        const r = runCli(file, ['status']);
        expect(r.status).toBe(0);
        const doc = JSON.parse(r.stdout) as Record<string, unknown>;
        expect(doc['exists']).toBe(true);
        expect(doc['entries']).toBe(1);
        expect(doc['header']).toMatchObject({ t: 'header', v: 3, fp: 'abc' });
    });

    // ---- hook with no settings (settings-independent: disabled / unmapped)
    it('hook-append with a missing settings file → disabled (no write)', () => {
        const f = path.join(mkTmp(), '.agent-chat-history');
        const missing = path.join(mkTmp(), 'nope.yml');
        const r = runCli(f, ['hook-append', '--event', 'phase', '--session-id', 'S1', '--payload', '{"text":"x"}', '--settings', missing]);
        expect(r.status).toBe(0);
        expect(r.stdout).toBe('{"action": "disabled", "event": "phase"}\n');
        expect(fs.existsSync(f)).toBe(false);
    });

    it('hook-dispatch unmapped event → skipped_unmapped_event', () => {
        const f = path.join(mkTmp(), '.agent-chat-history');
        const missing = path.join(mkTmp(), 'nope.yml');
        const r = runCli(f, ['hook-dispatch', '--platform', 'claude', '--settings', missing], '{"hook_event_name":"Weird"}');
        expect(r.status).toBe(0);
        expect(r.stdout).toBe(
            '{"action": "skipped_unmapped_event", "platform": "claude", "raw_event": "Weird"}\n',
        );
    });

    it('hook-dispatch unknown platform → error + exit 2', () => {
        const f = path.join(mkTmp(), '.agent-chat-history');
        const r = runCli(f, ['hook-dispatch', '--platform', 'bogus'], '{}');
        expect(r.status).toBe(2);
        expect(r.stderr).toContain("argument --platform: invalid choice: 'bogus'");
    });
});

// ---------------------------------------------------------------------
// Layer 2 — in-process tests for the five tools-consumed functions
// ---------------------------------------------------------------------


describe('chat_history — in-process function surface (tools.ts)', () => {
    it('SCHEMA_VERSION matches', () => {
        expect(ch.SCHEMA_VERSION).toBe(4);
    });

    it('init + append write a well-formed JSONL', () => {
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

    it('read_header parses the header dict', () => {
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

    it('read_entries applies last/session filters', () => {
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

    it('append raises for a header entry type', () => {
        const file = path.join(mkTmp(), '.agent-chat-history');
        expect(() => ch.append({ t: 'header' }, { path: file })).toThrow(/use init/);
    });
});

// ---------------------------------------------------------------------
// Layer 2b — settings-dependent hook surface (in-process; needs yaml)
// ---------------------------------------------------------------------

describe('chat_history — hook_append / hook_dispatch (settings-enabled)', () => {
    function writeSettings(dir: string, body: string): string {
        const p = path.join(dir, '.agent-settings.yml');
        fs.writeFileSync(p, body);
        return p;
    }

    it('hook_append per_phase appends the entry', () => {
        const dir = mkTmp();
        const settings = writeSettings(dir, 'chat_history:\n  enabled: true\n  frequency: per_phase\n');
        const tsFile = path.join(mkTmp(), '.agent-chat-history');

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
        const tsResult = ch.hook_append('tool_use', {
            session_id: 'S1',
            payload: { text: 'x', tool: 'Bash' },
            path: tsFile,
            settings_path: settings,
        });
        expect(tsResult).toEqual({ action: 'skipped_cadence', event: 'tool_use', frequency: 'per_phase' });
    });

    it('hook_append dry_run resolves the entry_preview without writing', () => {
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

    it('hook_dispatch (claude PostToolUse) appends the tool entry', () => {
        const dir = mkTmp();
        const settings = writeSettings(dir, 'chat_history:\n  enabled: true\n  frequency: per_tool\n');
        const tsFile = path.join(mkTmp(), '.agent-chat-history');
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
