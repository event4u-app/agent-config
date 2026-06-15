// Tests for src/scripts/hooks/block_no_verify.ts (py2ts — git hook guard).
//
// Two layers:
//  1. Unit tests over the exported pure functions (shlexSplit, _split_subcommands,
//     _git_base, _is_blocked, _check_command, _extract_command).
//  2. Golden-parity: python3 block_no_verify.py vs tsx block_no_verify.ts, fed
//     identical synthetic hook-event JSON on stdin (clean + the blocked
//     --no-verify case + malformed) and identical --command strings, asserting
//     byte-identical stdout/stderr + exit. Parity skipped without python3.
import { spawnSync } from 'node:child_process';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import {
    _check_command,
    _extract_command,
    _git_base,
    _is_blocked,
    _split_subcommands,
    shlexSplit,
} from '../../../src/scripts/hooks/block_no_verify.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..', '..');
const PY_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'hooks', 'block_no_verify.py');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'hooks', 'block_no_verify.ts');
const TSX_BIN = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);

function hasPython3(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}

// --- shlexSplit -------------------------------------------------------------

describe('block_no_verify — shlexSplit', () => {
    it('tokenises whitespace + quotes like POSIX shlex', () => {
        expect(shlexSplit("git commit --no-verify -m 'x'")).toEqual([
            'git',
            'commit',
            '--no-verify',
            '-m',
            'x',
        ]);
    });
    it('keeps shell separators as ordinary word tokens', () => {
        expect(shlexSplit('git push && git -n commit')).toEqual([
            'git',
            'push',
            '&&',
            'git',
            '-n',
            'commit',
        ]);
    });
    it('handles tabs as whitespace', () => {
        expect(shlexSplit('git\tcommit')).toEqual(['git', 'commit']);
    });
    it('throws on an unterminated quote', () => {
        expect(() => shlexSplit('git commit -m "unterminated')).toThrow('No closing quotation');
    });
});

// --- _split_subcommands / _git_base -----------------------------------------

describe('block_no_verify — subcommand split + git base', () => {
    it('splits on &&, ||, ;, |', () => {
        expect(_split_subcommands(['a', '&&', 'b', '|', 'c'])).toEqual([['a'], ['b'], ['c']]);
    });
    it('strips leading env assignments before git', () => {
        expect(_git_base(['FOO=1', 'BAR=2', 'git', 'commit'])).toEqual(['git', 'commit']);
    });
    it('returns null when not a git command', () => {
        expect(_git_base(['echo', 'hi'])).toBeNull();
    });
});

// --- _is_blocked ------------------------------------------------------------

describe('block_no_verify — _is_blocked', () => {
    it('blocks --no-verify', () => {
        expect(_is_blocked(['git', 'commit', '--no-verify'])[0]).toBe(true);
    });
    it('blocks -n', () => {
        expect(_is_blocked(['git', 'commit', '-n'])[0]).toBe(true);
    });
    it('blocks -nm bundle', () => {
        expect(_is_blocked(['git', 'commit', '-nm', 'msg'])[0]).toBe(true);
    });
    it('blocks -c core.hooksPath=', () => {
        expect(_is_blocked(['git', '-c', 'core.hooksPath=/dev/null', 'commit'])[0]).toBe(true);
    });
    it('blocks --config core.hooksPath=', () => {
        expect(_is_blocked(['git', '--config', 'core.hooksPath=x', 'commit'])[0]).toBe(true);
    });
    it('blocks -c=core.hooksPath=', () => {
        expect(_is_blocked(['git', 'commit', '-c=core.hooksPath=x'])[0]).toBe(true);
    });
    it('allows a clean commit', () => {
        expect(_is_blocked(['git', 'commit', '-m', 'safe'])[0]).toBe(false);
    });
});

// --- _check_command (fail-closed) -------------------------------------------

describe('block_no_verify — _check_command', () => {
    it('fail-closed on parse error for a git command', () => {
        const [blocked, reason] = _check_command('git commit -m "unterminated');
        expect(blocked).toBe(true);
        expect(reason).toContain('fail-closed');
    });
    it('allows a parse error on a non-git command', () => {
        expect(_check_command('echo "unterminated')[0]).toBe(false);
    });
    it('catches --no-verify after a separator', () => {
        expect(_check_command('echo hi && git commit -n')[0]).toBe(true);
    });
});

// --- _extract_command -------------------------------------------------------

describe('block_no_verify — _extract_command', () => {
    it('reads payload.tool_input.command', () => {
        expect(
            _extract_command({ payload: { tool_input: { command: 'git commit -n' } } }),
        ).toBe('git commit -n');
    });
    it('falls back to payload.command', () => {
        expect(_extract_command({ payload: { command: 'git status' } })).toBe('git status');
    });
    it('returns null when no command present', () => {
        expect(_extract_command({ payload: {} })).toBeNull();
    });
});

// --- Golden parity (python3 vs tsx) -----------------------------------------

const py3 = hasPython3();

describe.skipIf(!py3)('block_no_verify — golden parity (python3 vs tsx)', () => {
    function runPy(args: readonly string[], input = '') {
        return spawnSync('python3', [PY_SCRIPT, ...args], { input, encoding: 'utf8' });
    }
    function runTs(args: readonly string[], input = '') {
        return spawnSync(TSX_BIN, [TS_SCRIPT, ...args], { input, encoding: 'utf8' });
    }
    function expectMatch(args: readonly string[], input = '') {
        const py = runPy(args, input);
        const ts = runTs(args, input);
        expect(ts.stdout, `args=${JSON.stringify(args)}`).toBe(py.stdout);
        expect(ts.stderr, `args=${JSON.stringify(args)}`).toBe(py.stderr);
        expect(ts.status, `args=${JSON.stringify(args)}`).toBe(py.status);
    }

    // --command path
    for (const cmd of [
        'git commit --no-verify',
        'git commit -nm wip',
        'git -c core.hooksPath=/dev/null commit',
        'git --config core.hooksPath=x commit',
        "git commit -m 'a safe message'",
        'echo hi | git -n commit',
        'FOO=1 git commit -n',
        'git commit -m "unterminated',
        'echo "unterminated',
        '',
    ]) {
        it(`--command parity: ${cmd || '(empty)'}`, () => {
            expectMatch(['--command', cmd]);
        });
    }

    it('--platform is accepted and ignored', () => {
        expectMatch(['--command', 'git commit -n', '--platform', 'claude']);
    });

    // stdin envelope path — clean
    it('stdin envelope (clean) parity', () => {
        const env = JSON.stringify({ payload: { tool_input: { command: 'git status' } } });
        expectMatch([], env);
    });

    // stdin envelope path — blocked --no-verify
    it('stdin envelope (blocked --no-verify) parity', () => {
        const env = JSON.stringify({
            payload: { tool_input: { command: 'git commit --no-verify -m wip' } },
        });
        expectMatch([], env);
    });

    // stdin envelope — legacy payload.command
    it('stdin envelope (legacy payload.command) parity', () => {
        const env = JSON.stringify({ payload: { command: 'git commit -n' } });
        expectMatch([], env);
    });

    // malformed stdin (not JSON) → allow (exit 0)
    it('malformed stdin parity', () => {
        expectMatch([], '{not json at all');
    });

    // empty stdin → allow
    it('empty stdin parity', () => {
        expectMatch([], '');
    });

    // usage error
    it('unknown arg parity (exit 2)', () => {
        expectMatch(['--bogus']);
    });
});
