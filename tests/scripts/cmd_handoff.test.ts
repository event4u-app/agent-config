/**
 * cmd_handoff — CLI surface (road-to-agent-handoff-resume Phase 4).
 * House style: seams injected via MainOptions (out/err/isTTY/readLine/
 * runner) — no /dev/tty, no subprocess, no argv faking beyond main(argv).
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { LAUNCH_ADAPTERS, main } from '../../src/scripts/_cli/cmd_handoff.js';

let tmp: string;
let repoDir: string;
let histFile: string;
let savedHome: string | undefined;
let savedHist: string | undefined;

let stdout: string[];
let stderr: string[];

beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cmd-handoff-'));
    repoDir = path.join(tmp, 'repo');
    fs.mkdirSync(repoDir, { recursive: true });
    histFile = path.join(tmp, 'chat-history.jsonl');
    savedHome = process.env.HOME;
    savedHist = process.env.AGENT_CHAT_HISTORY_FILE;
    // point homedir-derived native stores at the empty tmp dir
    process.env.HOME = tmp;
    process.env.AGENT_CHAT_HISTORY_FILE = histFile;
    stdout = [];
    stderr = [];
});

afterEach(() => {
    if (savedHome === undefined) delete process.env.HOME;
    else process.env.HOME = savedHome;
    if (savedHist === undefined) delete process.env.AGENT_CHAT_HISTORY_FILE;
    else process.env.AGENT_CHAT_HISTORY_FILE = savedHist;
    fs.rmSync(tmp, { recursive: true, force: true });
});

function seams(extra: Record<string, unknown> = {}): {
    out: (t: string) => void;
    err: (t: string) => void;
    isTTY: boolean;
} & Record<string, unknown> {
    return {
        out: (t: string): void => void stdout.push(t),
        err: (t: string): void => void stderr.push(t),
        isTTY: false,
        ...extra,
    };
}

function writeHistory(): void {
    const lines = [
        JSON.stringify({ t: 'header', v: 4, started: '2026-08-01T00:00:00+00:00', freq: 'per_turn' }),
        JSON.stringify({
            t: 'user',
            text: 'build the picker',
            agent: 'claude',
            ts: '2026-08-01T10:00:00+00:00',
            s: 'aaaa000000000001',
        }),
        JSON.stringify({
            t: 'agent',
            text: 'picker built',
            agent: 'claude',
            ts: '2026-08-01T10:01:00+00:00',
            s: 'aaaa000000000001',
        }),
        JSON.stringify({
            t: 'user',
            text: 'ship the generator',
            agent: 'claude',
            ts: '2026-08-02T10:00:00+00:00',
            s: 'bbbb000000000002',
        }),
    ];
    fs.writeFileSync(histFile, lines.join('\n') + '\n', 'utf-8');
}

const stateFile = (): string => path.join(repoDir, 'agents', 'runtime', 'state', 'handoff-context.md');

describe('agent-config handoff', () => {
    it('--list prints one line per session, newest first', () => {
        writeHistory();
        const code = main(['--list', '--root', repoDir], seams());
        expect(code).toBe(0);
        const out = stdout.join('');
        const lines = out.trim().split('\n');
        expect(lines).toHaveLength(2);
        expect(lines[0]).toContain('ship the generator');
        expect(lines[0]).toContain('chat-history');
        expect(lines[1]).toContain('build the picker');
    });

    it('--list --json emits parseable session records', () => {
        writeHistory();
        const code = main(['--list', '--json', '--root', repoDir], seams());
        expect(code).toBe(0);
        const parsed = JSON.parse(stdout.join('')) as Array<Record<string, unknown>>;
        expect(parsed).toHaveLength(2);
        expect(parsed[0]?.id).toBe('bbbb000000000002');
        expect(parsed[0]?.source).toBe('chat-history');
    });

    it('--session writes the handoff state file non-interactively', () => {
        writeHistory();
        const code = main(['--session', 'aaaa000000000001', '--root', repoDir], seams());
        expect(code).toBe(0);
        const text = fs.readFileSync(stateFile(), 'utf-8');
        expect(text).toContain('Source-Session: aaaa000000000001');
        expect(text).toContain('- build the picker');
        expect(stdout.join('')).toContain('handoff written:');
        expect(stdout.join('')).toContain('injected automatically');
    });

    it('notes the replacement when an unconsumed handoff is overwritten', () => {
        writeHistory();
        expect(main(['--session', 'aaaa', '--root', repoDir], seams())).toBe(0);
        stdout = [];
        expect(main(['--session', 'bbbb', '--root', repoDir], seams())).toBe(0);
        expect(stdout.join('')).toContain('replaced an unconsumed handoff');
        const text = fs.readFileSync(stateFile(), 'utf-8');
        expect(text).toContain('Source-Session: bbbb000000000002');
    });

    it('non-TTY without --session prints the list and exits 2', () => {
        writeHistory();
        const code = main(['--root', repoDir], seams());
        expect(code).toBe(2);
        expect(stdout.join('')).toContain('ship the generator');
        expect(stderr.join('')).toContain('--session');
        expect(fs.existsSync(stateFile())).toBe(false);
    });

    it('TTY picker resolves a numbered selection', () => {
        writeHistory();
        const code = main(
            ['--root', repoDir],
            seams({ isTTY: true, readLine: (): string => '2' }),
        );
        expect(code).toBe(0);
        const text = fs.readFileSync(stateFile(), 'utf-8');
        expect(text).toContain('Source-Session: aaaa000000000001');
    });

    it('TTY picker rejects an invalid selection with exit 2', () => {
        writeHistory();
        const code = main(
            ['--root', repoDir],
            seams({ isTTY: true, readLine: (): string => 'nope' }),
        );
        expect(code).toBe(2);
        expect(fs.existsSync(stateFile())).toBe(false);
    });

    it('--print emits the handoff to stdout and bypasses the state file', () => {
        writeHistory();
        const code = main(['--session', 'bbbb', '--print', '--root', repoDir], seams());
        expect(code).toBe(0);
        expect(stdout.join('')).toContain('## User instructions (VERBATIM)');
        expect(stdout.join('')).toContain('ship the generator');
        expect(fs.existsSync(stateFile())).toBe(false);
    });

    it('--launch codex seeds via initial prompt and skips the state file', () => {
        writeHistory();
        const calls: string[][] = [];
        const code = main(
            ['--session', 'bbbb', '--launch', 'codex', '--root', repoDir],
            seams({ runner: (cmd: string[]): number => (calls.push(cmd), 0) }),
        );
        expect(code).toBe(0);
        expect(calls).toHaveLength(1);
        expect(calls[0]?.[0]).toBe('codex');
        expect(calls[0]?.[1]).toContain('## User instructions (VERBATIM)');
        expect(fs.existsSync(stateFile())).toBe(false);
    });

    it('--launch claude writes the state file first, then spawns bare claude', () => {
        writeHistory();
        const calls: string[][] = [];
        const code = main(
            ['--session', 'bbbb', '--launch', 'claude', '--root', repoDir],
            seams({ runner: (cmd: string[]): number => (calls.push(cmd), 0) }),
        );
        expect(code).toBe(0);
        expect(calls).toEqual([['claude']]);
        expect(fs.existsSync(stateFile())).toBe(true);
    });

    it('--launch gemini is a stub (supports_launch: false) and exits 2', () => {
        writeHistory();
        expect(LAUNCH_ADAPTERS.gemini?.supports_launch).toBe(false);
        const code = main(['--session', 'bbbb', '--launch', 'gemini', '--root', repoDir], seams());
        expect(code).toBe(2);
        expect(stderr.join('')).toContain('not supported yet');
    });

    it('--llm surfaces the v1 not-implemented seam with exit 2', () => {
        writeHistory();
        const code = main(['--session', 'bbbb', '--llm', '--root', repoDir], seams());
        expect(code).toBe(2);
        expect(stderr.join('')).toContain('not implemented');
    });

    it('exits 1 when no sessions exist', () => {
        const code = main(['--list', '--root', repoDir], seams());
        expect(code).toBe(1);
    });

    it('rejects an unknown flag with exit 2', () => {
        const code = main(['--bogus'], seams());
        expect(code).toBe(2);
        expect(stderr.join('')).toContain('unrecognized arguments');
    });

    it('rejects an unknown session id with exit 1', () => {
        writeHistory();
        const code = main(['--session', 'zzz', '--root', repoDir], seams());
        expect(code).toBe(1);
        expect(stderr.join('')).toContain('not found');
    });
});
