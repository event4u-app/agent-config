/**
 * Operands that name no file — a search pattern, a jq filter, a commit message,
 * an `echo` argument — so a credential-looking token in them is not a read.
 *
 * `segmentVerdict` treats every word of a reading command as a path, which is
 * the safe default for an open set of commands and refuses `rg ".env" src`,
 * `git commit -m "docs: mention .env"` and `gh … --jq '.license.key'`. This
 * module removes exactly those operands and asks `segmentVerdict` again about
 * what is left. It only ever NARROWS: a segment the guard allows is never
 * refused here, and a segment is re-judged only when every option before the
 * removed operand is one this module knows.
 *
 * Threat pass (a refused read must stay refused):
 *   · A misread option can only move the "pattern" EARLIER than the real one,
 *     never later — the pattern is the first operand — so a file operand is
 *     never removed; an unknown option aborts the narrowing instead.
 *   · `-f`/`--file`/`--from-file`, `--exclude-from`, `--slurpfile`/`--rawfile`
 *     and `git commit -F` read a file: never removed, and `-f` also means no
 *     positional pattern exists.
 *   · Command substitution, process substitution and redirections (`$(`, a
 *     backtick, `<`, `>`) abort the narrowing: their words are not operands.
 *   · `echo`/`printf` are narrowed only on a line with no pipe and no `xargs`,
 *     so `echo .env | xargs cat` stays refused.
 *   · Wrappers (`sudo grep .env x`) and `env` are not narrowed; the guard's
 *     conservative reading of them is kept.
 *
 * NOT WIRED: no hook imports this module. The guard is a ratification-watched
 * file and the live hook bundle's byte ceiling has no headroom for the swap.
 */
import {
    HOST,
    commandWords,
    segmentVerdict,
    type CredentialFileClass,
    type PathHost,
} from './credential_files.js';

type Verdict = { class: CredentialFileClass; what: string } | null;

const ASSIGNMENT = /^[A-Za-z_][A-Za-z0-9_]*=/;
const NOT_PLAIN_WORDS = /\$\(|`|[<>]/;

interface OptionGrammar {
    /** Single-letter options that take no value. */
    readonly bool: string;
    /** Single-letter options whose value is the NEXT word or the rest of the cluster. */
    readonly value: string;
    /** Single-letter options whose value is a pattern/program (removed). */
    readonly pattern: string;
    /** Single-letter options whose value is a FILE holding the pattern (kept; no positional pattern). */
    readonly patternFile: string;
    readonly longBool: ReadonlySet<string>;
    readonly longValue: ReadonlySet<string>;
    readonly longPattern: ReadonlySet<string>;
    readonly longPatternFile: ReadonlySet<string>;
    /** Long options that consume TWO following words. */
    readonly longTwoValues?: ReadonlySet<string>;
}

const GREP: OptionGrammar = {
    bool: 'inrRlLcvwxosqhHEFGPIazNSuUb',
    value: 'ABCmgtTdDjM',
    pattern: 'e',
    patternFile: 'f',
    longBool: new Set([
        '--ignore-case', '--line-number', '--recursive', '--files-with-matches', '--files-without-match', '--count',
        '--invert-match', '--word-regexp', '--line-regexp', '--only-matching', '--no-messages', '--quiet', '--silent',
        '--no-filename', '--with-filename', '--extended-regexp', '--fixed-strings', '--perl-regexp', '--basic-regexp',
        '--text', '--null', '--smart-case', '--hidden', '--no-ignore', '--no-heading', '--heading', '--json',
        '--follow', '--multiline', '--pcre2', '--case-sensitive', '--no-line-number', '--column', '--vimgrep',
        '--files', '--sort-files', '--pretty', '--trim', '--binary', '--search-zip',
    ]),
    longValue: new Set([
        '--max-count', '--glob', '--iglob', '--type', '--type-not', '--include', '--exclude', '--exclude-dir',
        '--context', '--after-context', '--before-context', '--max-columns', '--threads', '--max-depth',
        '--sort', '--sortr', '--color', '--colour', '--replace',
    ]),
    longPattern: new Set(['--regexp']),
    longPatternFile: new Set(['--file']),
};

const SED: OptionGrammar = {
    bool: 'nErsuzi',
    value: 'l',
    pattern: 'e',
    patternFile: 'f',
    longBool: new Set([
        '--quiet', '--silent', '--regexp-extended', '--in-place', '--null-data', '--posix', '--separate',
        '--unbuffered', '--debug', '--sandbox', '--follow-symlinks',
    ]),
    longValue: new Set(['--line-length']),
    longPattern: new Set(['--expression']),
    longPatternFile: new Set(['--file']),
};

const AWK: OptionGrammar = {
    bool: '',
    value: 'Fv',
    pattern: '',
    patternFile: 'f',
    longBool: new Set(),
    longValue: new Set(['--field-separator', '--assign']),
    longPattern: new Set(),
    longPatternFile: new Set(['--file']),
};

const JQ: OptionGrammar = {
    bool: 'rcnesSjaCMRj',
    value: 'L',
    pattern: '',
    patternFile: 'f',
    longBool: new Set([
        '--raw-output', '--compact-output', '--null-input', '--exit-status', '--slurp', '--sort-keys', '--join-output',
        '--ascii-output', '--color-output', '--monochrome-output', '--raw-input', '--tab', '--seq', '--stream',
        '--raw-output0',
    ]),
    longValue: new Set(['--indent']),
    longPattern: new Set(),
    longPatternFile: new Set(['--from-file']),
    longTwoValues: new Set(['--arg', '--argjson', '--slurpfile', '--rawfile']),
};

const GRAMMARS: Readonly<Record<string, OptionGrammar>> = {
    grep: GREP,
    egrep: GREP,
    fgrep: GREP,
    rg: GREP,
    ag: GREP,
    ack: GREP,
    sed: SED,
    gsed: SED,
    awk: AWK,
    gawk: AWK,
    mawk: AWK,
    nawk: AWK,
    jq: JQ,
};

/**
 * Indices of the words that are a pattern, program or filter for a
 * grep/sed/awk/jq-shaped command, or null when the options cannot all be read.
 * `start` is the index of the first argument after the command word.
 */
export function patternOperands(words: readonly string[], start: number, g: OptionGrammar): number[] | null {
    const strip: number[] = [];
    let patternFromOption = false;
    let k = start;
    let positional = -1;
    for (; k < words.length; k += 1) {
        const w = words[k] as string;
        if (w === '--') {
            positional = k + 1 < words.length ? k + 1 : -1;
            break;
        }
        if (!w.startsWith('-') || w === '-') {
            positional = k;
            break;
        }
        if (w.startsWith('--')) {
            const eq = w.indexOf('=');
            const name = eq === -1 ? w : w.slice(0, eq);
            if (g.longBool.has(name) && (eq === -1 || name === '--in-place' || name === '--color' || name === '--colour')) continue;
            if (g.longValue.has(name)) {
                if (eq === -1) k += 1;
                continue;
            }
            if (g.longPattern.has(name)) {
                patternFromOption = true;
                if (eq === -1) {
                    strip.push(k + 1);
                    k += 1;
                } else {
                    strip.push(k);
                }
                continue;
            }
            if (g.longPatternFile.has(name)) {
                patternFromOption = true;
                if (eq === -1) k += 1;
                continue;
            }
            if (g.longTwoValues?.has(name) === true && eq === -1) {
                k += 2;
                continue;
            }
            return null;
        }
        // A short cluster: every letter boolean except possibly the one that takes a value.
        const letters = w.slice(1);
        for (let j = 0; j < letters.length; j += 1) {
            const ch = letters[j] as string;
            const rest = letters.slice(j + 1);
            if (g.pattern.includes(ch) || g.patternFile.includes(ch) || g.value.includes(ch)) {
                const isPattern = g.pattern.includes(ch);
                if (isPattern || g.patternFile.includes(ch)) patternFromOption = true;
                if (rest === '') {
                    if (isPattern) strip.push(k + 1);
                    k += 1;
                } else if (isPattern) {
                    strip.push(k);
                }
                break;
            }
            if (ch === 'i' && g === SED) {
                break; // `-i.bak`: the rest is a backup suffix
            }
            if (!g.bool.includes(ch)) return null;
        }
    }
    if (!patternFromOption && positional >= 0) strip.push(positional);
    return strip;
}

/** `git commit` message words (`-m`, `--message`, a cluster ending in `m`). */
function commitMessages(words: readonly string[], start: number): number[] | null {
    if (words[start] !== 'commit') return null;
    const strip: number[] = [];
    for (let k = start + 1; k < words.length; k += 1) {
        const w = words[k] as string;
        if (w === '--message' || /^-[aqsnv]*m$/.test(w)) {
            strip.push(k + 1);
            k += 1;
        } else if (w.startsWith('--message=') || /^-[aqsnv]*m./.test(w)) {
            strip.push(k);
        }
    }
    return strip;
}

/** `gh … -q FILTER` / `--jq FILTER` / `--jq=FILTER`. */
function ghFilters(words: readonly string[], start: number): number[] {
    const strip: number[] = [];
    for (let k = start; k < words.length; k += 1) {
        const w = words[k] as string;
        if (w === '-q' || w === '--jq') {
            strip.push(k + 1);
            k += 1;
        } else if (w.startsWith('--jq=')) {
            strip.push(k);
        }
    }
    return strip;
}

const quote = (w: string): string => `'${w.replace(/'/g, `'\\''`)}'`;

/**
 * `segmentVerdict` with pattern-like operands removed first. Returns the guard's
 * own verdict unchanged whenever the segment cannot be narrowed safely.
 * `lineFeedsAnother` is true when the whole command pipes or runs `xargs`.
 */
export function narrowedSegmentVerdict(segment: string, lineFeedsAnother: boolean, host: PathHost = HOST): Verdict {
    const verdict = segmentVerdict(segment, host);
    if (verdict === null || NOT_PLAIN_WORDS.test(segment)) return verdict;
    const words = commandWords(segment);
    let i = 0;
    while (i < words.length && ASSIGNMENT.test(words[i] as string)) i += 1;
    const cmd = (words[i] ?? '').replace(/^.*\//, '');

    let strip: number[] | null = null;
    const grammar = GRAMMARS[cmd];
    if (grammar !== undefined) strip = patternOperands(words, i + 1, grammar);
    else if (cmd === 'git') strip = commitMessages(words, i + 1);
    else if (cmd === 'gh') strip = ghFilters(words, i + 1);
    else if ((cmd === 'echo' || cmd === 'printf') && !lineFeedsAnother) {
        strip = words.map((_, k) => k).filter((k) => k > i);
    }
    if (strip === null || strip.length === 0) return verdict;

    const removed = new Set(strip);
    const rebuilt = words.map((w, k) => (removed.has(k) ? "'operand'" : quote(w))).join(' ');
    return segmentVerdict(rebuilt, host);
}

/** True when a command line hands its output to another command. */
export function lineFeedsAnother(command: string): boolean {
    return /\|/.test(command.replace(/\|\|/g, '')) || /\bxargs\b/.test(command);
}
