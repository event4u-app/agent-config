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
    _looks_like_git_invocation,
    _split_subcommands,
    shlexSplit,
} from '../../../src/scripts/hooks/block_no_verify.js';

// Round-5 audit (2026-08-07). The fail-closed branch tested `/\bgit\b/` against
// the raw command string, so a mention was indistinguishable from an invocation.
// Measured: a heredoc write naming `git-history-discipline`, with apostrophes
// breaking shlex, was refused although no git ran.
describe('_looks_like_git_invocation', () => {
    const REFUSED = [
        "mkdir -p /tmp/x && cat > /tmp/x/notes.md <<'EOF'\n",
        "- rule git-history-discipline: round-1's reason didn't hold\n",
        '- see the git-authorization ledger\nEOF\necho saved',
    ].join('');

    it('does not fire on a mention with no git in command position', () => {
        expect(_looks_like_git_invocation(REFUSED)).toBe(false);
        expect(_looks_like_git_invocation('echo "don\'t"')).toBe(false);
        expect(
            _looks_like_git_invocation("cat > f.md <<'E'\ngit commit --no-verify isn't ok\nE"),
        ).toBe(false);
    });

    it('still fires on a real invocation in any command position', () => {
        expect(_looks_like_git_invocation('git commit -m "don\'t"')).toBe(true);
        expect(_looks_like_git_invocation('echo hi && git push --no-verify')).toBe(true);
        expect(_looks_like_git_invocation('GIT_DIR=x git status')).toBe(true);
        expect(_looks_like_git_invocation('/usr/bin/git commit -m "x"')).toBe(true);
    });

    it('recurses into a sh -c payload — the bypass the narrowing would have opened', () => {
        expect(_looks_like_git_invocation(`bash -c "git commit --no-verify -m 'x'"`)).toBe(true);
    });

    it('end to end: the refused command passes, a real --no-verify still blocks', () => {
        expect(_check_command(REFUSED)[0]).toBe(false);
        expect(_check_command('git commit --no-verify -m "x"')[0]).toBe(true);
    });
});



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

// --- Round 7 § 2.3 — the heredoc matrix, both directions --------------------
//
// Measured on this branch BEFORE the change, which is why both rows exist:
//   `git commit -F - <<'EOF' … maintainer's … EOF`  was BLOCKED (false positive)
//   `bash <<EOF … git commit --no-verify … EOF`     was ALLOWED (real bypass)
// The fix is one change — strip terminated heredocs before shlex, and scan a
// body only when a SHELL consumes it — and it moves both rows at once. The
// discrimination is the load-bearing part: a commit MESSAGE naming `--no-verify`
// is data and must pass, or the round-5 false positive comes back in a new shape.
describe('block_no_verify — heredoc bodies (round 7)', () => {
    const MSG_HEREDOC = "git commit -F - <<'EOF'\nfix(x): respect the maintainer's call\nEOF";
    const SHELL_HEREDOC = 'bash <<EOF\ngit commit --no-verify -m x\nEOF';

    it('an apostrophe in a commit-message body no longer aborts the parse', () => {
        expect(_check_command(MSG_HEREDOC)[0]).toBe(false);
    });

    it('a commit message that merely NAMES the flag is data, not code', () => {
        expect(
            _check_command(
                "git commit -F - <<'EOF'\ndocs: explain why we never pass --no-verify\nEOF",
            )[0],
        ).toBe(false);
    });

    it('a SHELL-consumed body carrying --no-verify is blocked', () => {
        expect(_check_command(SHELL_HEREDOC)[0]).toBe(true);
    });

    it('the shell consumer is recognised through a path prefix and an env prefix', () => {
        expect(_check_command('/bin/sh <<EOF\ngit commit -n\nEOF')[0]).toBe(true);
        expect(_check_command('env FOO=1 bash <<EOF\ngit commit -n\nEOF')[0]).toBe(true);
    });

    it('a bare mention of bash in an argument does NOT promote a message to code', () => {
        expect(
            _check_command("git commit -F - <<'EOF'\nchore: drop the bash wrapper\n--no-verify\nEOF")[0],
        ).toBe(false);
    });

    it('an UNTERMINATED heredoc still reaches the fail-closed branch', () => {
        // No closing delimiter ⇒ nothing is stripped ⇒ the raw string hits shlex,
        // which throws on the odd quote ⇒ fail-closed on a git-containing command.
        const [blocked, reason] = _check_command("git commit -F - <<'EOF'\nit's unterminated\n");
        expect(blocked).toBe(true);
        expect(reason).toContain('unbalanced');
    });

    it('the direct flags are unaffected — both still block', () => {
        expect(_check_command('git commit -n -m x')[0]).toBe(true);
        expect(_check_command('git commit --no-verify -m x')[0]).toBe(true);
    });

    it('the round-5 negative controls stay negative', () => {
        expect(_check_command('grep -n foo x.ts')[0]).toBe(false);
        expect(_check_command('[ -n "$X" ] && echo yes')[0]).toBe(false);
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

