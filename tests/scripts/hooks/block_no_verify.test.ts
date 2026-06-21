// Tests for src/scripts/hooks/block_no_verify.ts (py2ts — git hook guard).
//
// Two layers:
//  1. Unit tests over the exported pure functions (shlexSplit, _split_subcommands,
//     _git_base, _is_blocked, _check_command, _extract_command).
//  2. Golden-parity: python3 block_no_verify.py vs tsx block_no_verify.ts, fed
//     identical synthetic hook-event JSON on stdin (clean + the blocked
//     --no-verify case + malformed) and identical --command strings, asserting
//     byte-identical stdout/stderr + exit. Parity skipped without python3.
import { describe, expect, it } from 'vitest';

import {
    _check_command,
    _extract_command,
    _git_base,
    _is_blocked,
    _split_subcommands,
    shlexSplit,
} from '../../../src/scripts/hooks/block_no_verify.js';



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

