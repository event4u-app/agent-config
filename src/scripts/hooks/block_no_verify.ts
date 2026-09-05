#!/usr/bin/env tsx
/**
 * PreToolUse guard: block git --no-verify and hook-bypass patterns.
 *
 * Ported from the retired Python `src/scripts/hooks/block_no_verify.py` (ADR-200,
 * Python→TypeScript migration). The CLI/stdin contract is mirrored EXACTLY —
 * `--command` / `--platform` argparse flags, the JSON-envelope-on-stdin shape,
 * shlex tokenisation (POSIX, no comments), the subcommand split on shell
 * separators, the fail-closed-on-parse-error-for-git behaviour, byte-identical
 * stderr block message, and exit codes (0 allow · 1 block; 2 = argparse error).
 * snake_case kept. Historical quirks are preserved deliberately — tests and downstream consumers pin the exact behaviour.
 *
 * Intercepts the agent's Bash tool calls BEFORE git runs so that
 * `git --no-verify` / `git -n` / `git -c core.hooksPath=` cannot silently
 * bypass the pre-commit and pre-push hooks that enforce code quality gates.
 *
 * Exit codes (per docs/contracts/hook-architecture-v1.md):
 *   0 — allow (command is safe)
 *   1 — block (command would bypass hooks; agent is told to stop)
 *   2 — warn  (not used by this guard)
 *
 * No ALLOW_NO_VERIFY-style env bypass is provided. See src/rules/git-history-discipline.md
 *
 * WHAT THIS GUARD DOES NOT SEE. Command substitutions ARE now checked — see
 * `_check_command` for why they were not, and why the well-formed case was the
 * unprotected one. What remains uncovered is an invocation whose command word
 * only exists at runtime (`P=commit; git $P --no-verify` via indirection, or a
 * word composed by `xargs`). Those execute under bash and are not classified
 * here. Stated rather than left implied: this file's own round-5 defect was a
 * docstring that described coverage it did not have.
 */

import * as fs from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import * as path from 'node:path';
import { readHookStdin } from './hook_stdin.js';
import { substitutionPayloads } from './git_command_classifier.js';

const _HERE = fileURLToPath(import.meta.url);

const _SHELL_SEPARATORS: ReadonlySet<string> = new Set(['&&', '||', ';', '|', '&']);
/** Characters that begin a shell separator, for `shlexSplit(s, true)`. */
const _OPERATOR_CHARS = ';|&';
const _NO_VERIFY_FLAGS: ReadonlySet<string> = new Set(['--no-verify']);
const _NO_VERIFY_SHORT: ReadonlySet<string> = new Set(['-n']);
const _HOOKS_PATH_RE = /^core\.hooksPath\s*=/i;
/** Bare key form, as `git config core.hooksPath <value>` spells it. */
const _HOOKS_PATH_KEY_RE = /^core\.hooksPath$/i;
/**
 * `git config` flags that make the invocation a READ or a RESTORE rather than
 * a write. `--unset` removes the override — the opposite of disabling hooks —
 * so it stays allowed, or the gate would block its own remediation.
 */
/** Global `git` options that consume the following token as their value. */
const _GIT_GLOBAL_OPTS_WITH_VALUE: ReadonlySet<string> = new Set([
    '-C',
    '-c',
    '--config',
    '--git-dir',
    '--work-tree',
    '--namespace',
    '--exec-path',
    '--super-prefix',
]);
const _CONFIG_READ_OR_RESTORE: ReadonlySet<string> = new Set([
    '--get',
    '--get-all',
    '--get-regexp',
    '--get-urlmatch',
    '--list',
    '-l',
    '--unset',
    '--unset-all',
]);

type JsonValue = string | number | boolean | null | JsonValue[] | { [k: string]: JsonValue };
type JsonObject = { [k: string]: JsonValue };

/**
 * Faithful port of `shlex.split(s, comments=False, posix=True)` for the
 * subset block_no_verify needs: whitespace tokenisation, single + double
 * quotes, backslash escaping (POSIX), and a `ValueError("No closing
 * quotation")` on an unterminated quote.
 *
 * `splitOperators` (default OFF, so the port stays faithful for
 * `rtk_wrap_hook`, its other caller) additionally emits an UNQUOTED shell
 * separator as its own token, maximal-munch for `&&` and `||`.
 *
 * WHY IT EXISTS. Without it, POSIX shlex leaves a separator attached to the
 * preceding word — `git status; sed -n 1,5p f` tokenises as
 * `['git','status;','sed','-n',...]`, one token, no separator. This docstring
 * previously asserted the opposite ("they survive as embedded tokens ... the
 * separator split below matches them as whole tokens"); that holds only when
 * the separator is surrounded by whitespace, and the guard's segmentation is
 * built on it. Measured 2026-08-20, the mistake had TWO faces and the second
 * is the serious one:
 *
 *   git status; sed -n 1,5p f          → REFUSED  (false positive: the `-n`
 *                                        of `sed` is read as git's)
 *   echo hi; git commit --no-verify    → ALLOWED  (BYPASS: the group starts
 *                                        with `echo`, so `_git_base` returns
 *                                        null and the git command is never
 *                                        scanned at all)
 *
 * Quote- and escape-safe by construction: the operator check lives in the
 * unquoted word path only, so `git commit -m "a;b"` and `git commit -m a\;b`
 * keep their semicolon inside one token and cannot be split into a group that
 * no longer starts with `git`.
 */
class ShlexError extends Error {}

function shlexSplit(s: string, splitOperators = false): string[] {
    const whitespace = ' \t\r\n\f\v';
    const quotes = '\'"';
    const escape = '\\';
    const escapedquotes = '"';

    const tokens: string[] = [];
    let token: string | null = null; // null => no token in progress (mirrors shlex token = '')
    let i = 0;
    const n = s.length;

    // shlex state: ' ' (whitespace), 'a' (in word), quote char (in quote),
    // or escape char (in escape). We track via explicit flags for clarity.
    let state: 'ws' | 'word' = 'ws';

    const push = (ch: string): void => {
        token = (token ?? '') + ch;
    };

    while (i < n) {
        const c = s[i] as string;

        if (state === 'ws') {
            if (whitespace.includes(c)) {
                i += 1;
                continue;
            }
            // start a new token
            state = 'word';
            token = '';
            // fall through to word handling without advancing
        }

        // state === 'word'
        if (whitespace.includes(c)) {
            tokens.push(token as string);
            token = null;
            state = 'ws';
            i += 1;
            continue;
        }
        if (quotes.includes(c)) {
            const quote = c;
            i += 1;
            // read until matching close quote
            let closed = false;
            while (i < n) {
                const qc = s[i] as string;
                if (qc === quote) {
                    closed = true;
                    i += 1;
                    break;
                }
                if (escape.includes(qc) && escapedquotes.includes(quote)) {
                    // POSIX: inside double quotes, backslash escapes only
                    // the escape char itself and the surrounding quote.
                    const nxt = i + 1 < n ? (s[i + 1] as string) : null;
                    if (nxt !== null && (nxt === escape || nxt === quote)) {
                        push(nxt);
                        i += 2;
                        continue;
                    }
                    push(qc);
                    i += 1;
                    continue;
                }
                push(qc);
                i += 1;
            }
            if (!closed) {
                throw new ShlexError('No closing quotation');
            }
            continue;
        }
        if (splitOperators && _OPERATOR_CHARS.includes(c)) {
            // Unquoted separator: close the word in progress, then emit the
            // operator as its own token. Maximal munch so `&&` and `||` stay
            // one token rather than two, matching _SHELL_SEPARATORS.
            if (token !== null) {
                tokens.push(token);
                token = null;
            }
            const nxt = i + 1 < n ? (s[i + 1] as string) : null;
            if (nxt === c && (c === '&' || c === '|')) {
                tokens.push(c + c);
                i += 2;
            } else {
                tokens.push(c);
                i += 1;
            }
            state = 'ws';
            continue;
        }
        if (escape.includes(c)) {
            // POSIX escape outside quotes: backslash preserves the next char.
            const nxt = i + 1 < n ? (s[i + 1] as string) : null;
            if (nxt === null) {
                // shlex raises "No escaped character" at EOF; block_no_verify
                // does not exercise this, but mirror the error class.
                throw new ShlexError('No escaped character');
            }
            push(nxt);
            i += 2;
            continue;
        }
        push(c);
        i += 1;
    }

    if (token !== null) {
        tokens.push(token);
    }
    return tokens;
}

function _is_env_assignment(token: string): boolean {
    return /^[A-Za-z_][A-Za-z0-9_]*=/.test(token);
}

function _split_subcommands(tokens: string[]): string[][] {
    const groups: string[][] = [];
    let current: string[] = [];
    for (const tok of tokens) {
        if (_SHELL_SEPARATORS.has(tok)) {
            if (current.length) {
                groups.push(current);
            }
            current = [];
        } else {
            current.push(tok);
        }
    }
    if (current.length) {
        groups.push(current);
    }
    return groups;
}

function _git_base(tokens: string[]): string[] | null {
    let i = 0;
    while (i < tokens.length && _is_env_assignment(tokens[i] as string)) {
        i += 1;
    }
    if (i < tokens.length && tokens[i] === 'git') {
        return tokens.slice(i);
    }
    return null;
}

/**
 * `git config … core.hooksPath <value>` — the subcommand form of the hooksPath
 * override, distinct from the `-c` / `--config` global-option form handled in
 * `_is_blocked`.
 *
 * Closed by road-to-governance-invariants Phase 1 after the S0.2 spike measured
 * it: `git-history-discipline` already claimed `core.hooksPath` overrides were
 * "deterministically blocked", and only the inline `-c` form was. That made
 * `git config core.hooksPath /dev/null` → `git commit` a two-step sequence
 * whose every step this gate allowed and whose composition is exactly the
 * outcome the gate exists to prevent.
 *
 * Deliberately narrow, per the 2026-08-02 council cut (option ii — widen only
 * the exact shapes with no plausible legitimate use):
 *   - a READ (`--get`, `--list`, or the key with no value) is allowed;
 *   - `--unset` is allowed — it restores hooks, it does not disable them;
 *   - non-git ways of disabling a hook (`mv`/`chmod`/`rm` on `.git/hooks/*`)
 *     are NOT matched here. Recognising them would turn this guard into a
 *     shell sandbox and those verbs have ordinary legitimate uses. That gap
 *     is published rather than papered over — see the S0.2 spike.
 */
function _is_config_hookspath_write(git_tokens: string[]): [boolean, string] {
    const rest = git_tokens.slice(1);
    // The subcommand is the first token that is neither a global option nor
    // the VALUE of one — `git -C /repo config …` must still resolve to
    // `config`, not to `/repo`.
    let subIdx = -1;
    for (let k = 0; k < rest.length; k += 1) {
        const tok = rest[k] as string;
        if (!tok.startsWith('-')) {
            subIdx = k;
            break;
        }
        if (_GIT_GLOBAL_OPTS_WITH_VALUE.has(tok)) {
            k += 1; // consume its value
        }
    }
    if (subIdx === -1 || rest[subIdx] !== 'config') {
        return [false, ''];
    }
    const args = rest.slice(subIdx + 1);
    if (args.some((t) => _CONFIG_READ_OR_RESTORE.has(t))) {
        return [false, ''];
    }
    for (let k = 0; k < args.length; k += 1) {
        const tok = args[k] as string;
        // `core.hooksPath=<value>` — one token, always a write.
        if (_HOOKS_PATH_RE.test(tok)) {
            return [
                true,
                `'git config ${tok}' disables git hooks via hooksPath (git-history-discipline)`,
            ];
        }
        if (!_HOOKS_PATH_KEY_RE.test(tok)) {
            continue;
        }
        // Bare key: a write only when a value follows.
        const next = args.slice(k + 1).find((t) => !t.startsWith('-'));
        if (next !== undefined) {
            return [
                true,
                `'git config ${tok} ${next}' disables git hooks via hooksPath (git-history-discipline)`,
            ];
        }
        return [false, ''];
    }
    return [false, ''];
}

function _is_blocked(git_tokens: string[]): [boolean, string] {
    const [cfgBlocked, cfgReason] = _is_config_hookspath_write(git_tokens);
    if (cfgBlocked) {
        return [cfgBlocked, cfgReason];
    }
    let i = 1; // skip 'git'
    while (i < git_tokens.length) {
        const tok = git_tokens[i] as string;
        if (_NO_VERIFY_FLAGS.has(tok)) {
            return [true, `'${tok}' bypasses git hooks (git-history-discipline).`
                    + ' Let the hooks run and fix what they report; that is the only path this guard leaves open.'];
        }
        if (_NO_VERIFY_SHORT.has(tok)) {
            return [
                true,
                `'${tok}' is short for --no-verify and bypasses git hooks (git-history-discipline).`
                    + ' Let the hooks run and fix what they report; that is the only path this guard leaves open.',
            ];
        }
        // Short flag bundles containing 'n': -nm, -mn, etc.
        if (/^-[a-zA-Z]*n[a-zA-Z]*$/.test(tok) && !tok.startsWith('--')) {
            return [
                true,
                `'${tok}' contains -n (--no-verify) and bypasses git hooks (git-history-discipline).`
                    + ' Let the hooks run and fix what they report; that is the only path this guard leaves open.',
            ];
        }
        if (tok === '-c') {
            if (i + 1 < git_tokens.length) {
                const val = git_tokens[i + 1] as string;
                if (_HOOKS_PATH_RE.test(val)) {
                    return [true, `'-c ${val}' disables git hooks via hooksPath (git-history-discipline)`];
                }
                i += 1;
            }
        } else if (tok.startsWith('-c=')) {
            const val = tok.slice(3);
            if (_HOOKS_PATH_RE.test(val)) {
                return [true, `'${tok}' disables git hooks via hooksPath (git-history-discipline)`];
            }
        } else if (tok === '--config') {
            if (i + 1 < git_tokens.length) {
                const val = git_tokens[i + 1] as string;
                if (_HOOKS_PATH_RE.test(val)) {
                    return [
                        true,
                        `'--config ${val}' disables git hooks via hooksPath (git-history-discipline)`,
                    ];
                }
                i += 1;
            }
        }
        i += 1;
    }
    return [false, ''];
}

/**
 * Does an unparseable command plausibly INVOKE git?
 *
 * The fail-closed branch below used to test `/\bgit\b/` against the raw command
 * string. That is a mention, not an invocation, and the difference is not
 * academic: measured in the round-5 audit (2026-08-07), a
 * `mkdir -p … && cat > notes.md <<HEREDOC … HEREDOC` with no git anywhere in
 * command position was refused, because the heredoc body named rules such as
 * `git-history-discipline` and contained apostrophes — so shlex failed and the
 * substring matched. The message's own remedy (`git commit -F <file>`) could not
 * apply, because there was no commit.
 *
 * Fail-closed is still the right posture for the case it was written for: a
 * genuinely unparseable command that DOES invoke git. So the test moves from
 * "the string contains git" to "some command position is git", with heredoc
 * bodies removed first — the same data-not-command distinction
 * `git_command_classifier` already makes.
 *
 * Deliberately regex-shaped rather than tokenised: shlex has already failed by
 * the time this runs, so no reliable token stream exists. It therefore stays
 * conservative — a `git` at the head of any line or after any separator counts,
 * quoted or not.
 */
export function _looks_like_git_invocation(cmd: string, depth = 0): boolean {
    if (depth > 3) {
        return false;
    }
    const withoutHeredocs = cmd.replace(
        /<<-?\s*(['"]?)([A-Za-z_][A-Za-z0-9_]*)\1[\s\S]*?^\s*\2\s*$/gm,
        '<<HEREDOC',
    );
    for (const rawSeg of withoutHeredocs.split(/\n|;|&&|\|\||\||&|\$\(|`/)) {
        // Drop leading env assignments: `GIT_DIR=x git status`.
        const seg = rawSeg
            .trim()
            .replace(/^(?:[A-Za-z_][A-Za-z0-9_]*=(?:"[^"]*"|'[^']*'|\S*)\s+)+/, '');
        // A `sh -c '<payload>'` payload IS command context — recurse, or the
        // narrowing above would open a bypass this guard did not have before.
        // Caught by the adversarial case, not by review.
        const wrapped =
            /^(?:\S*\/)?(?:ba|z|k)?sh\s+-[a-z]*c\s+(?:"([^"]*)"|'([^']*)'|(\S+))/.exec(seg);
        if (wrapped !== null) {
            if (_looks_like_git_invocation(wrapped[1] ?? wrapped[2] ?? wrapped[3] ?? '', depth + 1)) {
                return true;
            }
            continue;
        }
        // Command position: optional path prefix, then `git` as its own word.
        if (/^(?:\S*\/)?git(?:\s|$)/.test(seg)) {
            return true;
        }
    }
    return false;
}

/**
 * Return (blocked, reason). Fail-closed on parse error for git commands.
 *
 * COMMAND SUBSTITUTIONS ARE CHECKED SEPARATELY, and the reason they were not is
 * the shape of the hole: this file does split on `$(` and backtick, but only
 * inside `_looks_like_git_invocation`, which runs exclusively in the
 * shlex-failure branch. A well-formed `echo "$(git commit --no-verify)"` parses
 * cleanly, so shlex succeeds, the substitution stays inside one token, and
 * `_git_base` never sees git. The more parseable the command, the less it was
 * protected. Classification inside the payload is by command position, so a
 * substitution that INVOKES git is checked and one that merely names it in an
 * argument is not — matching what `git_command_classifier` does one level up.
 *
 * Heredoc bodies are removed before extraction: a backtick or `$(` inside a
 * commit message being written to a file is data, and feeding it back through
 * this function is exactly the false positive the round-5 repair closed.
 *
 * ROUND 7 — THREAT MODEL for extending that removal to the shlex path (§ 2.1).
 * Until round 7 the stripped string fed only `substitutionPayloads`; `shlexSplit`
 * still received the RAW command. Both halves of that were measured, on this
 * branch, before anything changed:
 *
 *   `git commit -F - <<'EOF' … maintainer's … EOF`   → BLOCKED   (false positive)
 *   `bash <<EOF … git commit --no-verify … EOF`       → ALLOWED   (real bypass)
 *
 * So this is not the round-6 trade of one false positive for two false negatives.
 * The bypass PRE-EXISTS: with the body inline, `shlexSplit` succeeds, the tokens
 * are `bash <<EOF git commit --no-verify EOF`, command position is `bash`, and
 * `_git_base` never sees git. Stripping before shlex fixes the false positive;
 * scanning the bodies fixes the bypass. Both directions verified by probe.
 *
 * What an attacker can hide in a heredoc body, and how each is handled:
 *
 *   - a body consumed by a SHELL (`sh`/`bash`/`zsh`/`ksh`, with or without a path
 *     prefix or an `env` prefix) IS a command list → scanned recursively.
 *   - a body consumed by anything else (`git commit -F -`, `cat > f`, `tee`) is
 *     DATA. Scanning it would re-open the exact false positive above, since a
 *     commit message may legitimately contain the words `--no-verify`.
 *   - an UNTERMINATED heredoc never matches the delimiter, so nothing is stripped
 *     and the raw string still reaches shlex — the fail-closed branch keeps it.
 */

/** One heredoc: its body, and whether a shell is the thing consuming it. */
interface Heredoc {
    body: string;
    shellConsumed: boolean;
}

/**
 * Command position on the line that opens the heredoc is a shell interpreter, so
 * the body is a command list rather than data. Anchored to the segment start or a
 * shell separator, exactly like `_looks_like_git_invocation` does one level up —
 * a bare mention of `bash` in an argument must not promote a message to code.
 */
const _SHELL_CONSUMER_RE =
    /(?:^|[|&;]|\$\(|`)\s*(?:env\s+(?:[A-Za-z_][A-Za-z0-9_]*=\S*\s+)*)?(?:\S*\/)?(?:ba|z|k)?sh\b/;

export function _heredocs(cmd: string): { stripped: string; docs: Heredoc[] } {
    const re = /<<-?\s*(['"]?)([A-Za-z_][A-Za-z0-9_]*)\1([\s\S]*?)^\s*\2\s*$/gm;
    const docs: Heredoc[] = [];
    let stripped = '';
    let last = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(cmd)) !== null) {
        const lineStart = cmd.lastIndexOf('\n', m.index) + 1;
        const prefix = cmd.slice(lineStart, m.index);
        docs.push({ body: m[3] ?? '', shellConsumed: _SHELL_CONSUMER_RE.test(prefix) });
        stripped += cmd.slice(last, m.index) + '<<HEREDOC';
        last = m.index + m[0].length;
    }
    stripped += cmd.slice(last);
    return { stripped, docs };
}

function _check_command(cmd: string, depth = 0): [boolean, string] {
    // Round 7 § 2.2 — the stripped string now feeds shlex as well, not only the
    // substitution scan. `<<HEREDOC` is a plain token, so an apostrophe in a
    // commit message can no longer abort the parse of the command carrying it.
    const { stripped, docs } = depth <= 3 ? _heredocs(cmd) : { stripped: cmd, docs: [] };
    if (depth <= 3) {
        for (const payload of substitutionPayloads(stripped)) {
            const [blocked, reason] = _check_command(payload, depth + 1);
            if (blocked) {
                return [true, reason];
            }
        }
        // A shell-consumed body is a command list, so it is checked like one.
        for (const doc of docs) {
            if (!doc.shellConsumed) {
                continue;
            }
            const [blocked, reason] = _check_command(doc.body, depth + 1);
            if (blocked) {
                return [true, reason];
            }
        }
    }
    let tokens: string[];
    try {
        // splitOperators: an unquoted `;` / `&&` / `||` / `|` / `&` becomes its
        // own token, so _split_subcommands can see it. Without it a separator
        // attached to the preceding word (`status;`) kept the whole line in one
        // group — refusing `git status; sed -n 1,5p f` and, in the other
        // direction, never scanning `echo hi; git commit --no-verify` at all.
        tokens = shlexSplit(stripped, true);
    } catch (e) {
        if (e instanceof ShlexError) {
            // Tested against the string that actually failed to parse. Round 7
            // § 2.4: the message no longer prescribes the message-in-a-file
            // workaround, because a TERMINATED heredoc is now stripped before
            // this point and can no longer be the cause. What reaches here is
            // genuinely unbalanced quoting — an unterminated heredoc, or an odd
            // quote outside one — which bash itself refuses to run.
            if (_looks_like_git_invocation(stripped)) {
                return [
                    true,
                    'command parse failed (shlex) on a git-containing command — fail-closed (git-history-discipline). \n'
                    + 'The quoting is unbalanced OUTSIDE any terminated heredoc — an unterminated heredoc, or an odd quote. \n'
                    + 'bash refuses this command too; fix the quoting rather than working around the guard.',
                ];
            }
            return [false, ''];
        }
        throw e;
    }

    for (const sub of _split_subcommands(tokens)) {
        const git_tokens = _git_base(sub);
        if (git_tokens === null) {
            continue;
        }
        const [blocked, reason] = _is_blocked(git_tokens);
        if (blocked) {
            return [true, reason];
        }
    }
    return [false, ''];
}

function _extract_command(envelope: JsonObject): string | null {
    const payload = (_asObject(envelope['payload']) ?? {}) as JsonObject;
    const tool_input = (_asObject(payload['tool_input']) ?? {}) as JsonObject;
    let cmd = tool_input['command'];
    if (typeof cmd === 'string') {
        return cmd;
    }
    cmd = payload['command'];
    if (typeof cmd === 'string') {
        return cmd;
    }
    return null;
}

function _asObject(v: JsonValue | undefined): JsonObject | null {
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
        return v as JsonObject;
    }
    return null;
}

interface ParsedArgs {
    command: string;
    platform: string;
}

/**
 * Mirror argparse for `--command` / `--platform` (both string, default '').
 * Unknown argument → usage error on stderr + exit 2. `-h`/`--help` → usage on
 * stdout + exit 0. We never byte-compare --help prose per the migration brief.
 */
function _parseArgs(argv: string[]): { args?: ParsedArgs; exitCode?: number } {
    if (argv.includes('-h') || argv.includes('--help')) {
        process.stdout.write(_usage());
        return { exitCode: 0 };
    }
    let command = '';
    let platform = '';
    let i = 0;
    while (i < argv.length) {
        const a = argv[i] as string;
        if (a === '--command') {
            command = (argv[i + 1] as string) ?? '';
            i += 2;
            continue;
        }
        if (a.startsWith('--command=')) {
            command = a.slice('--command='.length);
            i += 1;
            continue;
        }
        if (a === '--platform') {
            platform = (argv[i + 1] as string) ?? '';
            i += 2;
            continue;
        }
        if (a.startsWith('--platform=')) {
            platform = a.slice('--platform='.length);
            i += 1;
            continue;
        }
        process.stderr.write(_usageError(a));
        return { exitCode: 2 };
    }
    return { args: { command, platform } };
}

function _usage(): string {
    return 'usage: block_no_verify.py [-h] [--command COMMAND] [--platform PLATFORM]\n';
}

function _usageError(arg: string): string {
    return (
        'usage: block_no_verify.py [-h] [--command COMMAND] [--platform PLATFORM]\n' +
        `block_no_verify.py: error: unrecognized arguments: ${arg}\n`
    );
}

function _readStdin(): string {
    // Mirror `sys.stdin.read() if not sys.stdin.isatty() else ""`.
    return readHookStdin();
}

export function main(argv?: string[]): number {
    const parsed = _parseArgs(argv ?? process.argv.slice(2));
    if (parsed.exitCode !== undefined) {
        return parsed.exitCode;
    }
    const args = parsed.args as ParsedArgs;

    let cmd: string;
    if (args.command) {
        cmd = args.command;
    } else {
        const raw = _readStdin();
        let envelope: JsonObject = {};
        if (raw.trim()) {
            try {
                const obj = JSON.parse(raw) as JsonValue;
                envelope = (_asObject(obj) ?? {}) as JsonObject;
            } catch {
                envelope = {};
            }
        }
        cmd = _extract_command(envelope) ?? '';
    }

    if (!cmd) {
        return 0;
    }

    const [blocked, reason] = _check_command(cmd);
    if (blocked) {
        process.stderr.write(
            `block-no-verify: BLOCKED — ${reason}\n` +
                `  Legitimate bypass requires a human action outside the agent session:\n` +
                `  disable or remove the 'block-no-verify' entry in src/scripts/hook_manifest.yaml.\n` +
                `  Rule: src/rules/git-history-discipline.md\n`,
        );
        return 1; // EXIT_BLOCK
    }

    return 0; // EXIT_ALLOW
}

// Bundle-safety: never auto-run when inlined into an esbuild bundle, where
// every module shares the bundle's `import.meta.url` (see cmd_migrate.ts).
declare const __AGENT_CONFIG_BUNDLE__: boolean | undefined;
function _isCliEntry(): boolean {
    if (typeof __AGENT_CONFIG_BUNDLE__ !== 'undefined' && __AGENT_CONFIG_BUNDLE__) {
        return false;
    }
    if (process.argv[1] === undefined) {
        return false;
    }
    const argvUrl = pathToFileURL(path.resolve(process.argv[1])).href;
    if (import.meta.url === argvUrl) {
        return true;
    }
    // A symlinked invocation (e.g. via an installed `.augment/` projection,
    // or macOS /var → /private/var temp dirs) makes the raw URLs differ:
    // import.meta.url is the resolved real path while argv[1] keeps the
    // symlink path. Compare realpaths so the entry guard still fires
    // (without this the CLI silently no-ops when run through a symlink).
    try {
        const here = fs.realpathSync(fileURLToPath(import.meta.url));
        const argv = fs.realpathSync(path.resolve(process.argv[1]));
        return here === argv;
    } catch {
        return false;
    }
}

if (_isCliEntry() || (typeof __AGENT_CONFIG_BUNDLE__ === 'undefined' && process.argv[1] === _HERE)) {
    process.exitCode = main();
}

export {
    _SHELL_SEPARATORS,
    _NO_VERIFY_FLAGS,
    _NO_VERIFY_SHORT,
    _HOOKS_PATH_RE,
    ShlexError,
    shlexSplit,
    _is_env_assignment,
    _split_subcommands,
    _git_base,
    _is_blocked,
    _check_command,
    _extract_command,
};
