/**
 * Generated differential test: seeded commands built from the supported syntax
 * (prefixes, wrappers, quoting and escapes inside act words, redirections at any
 * position, `!` / `{ }` / `if` compounds, separators, comments, heredocs with every terminator form, here-strings) are run by real bash and must
 * produce the acts the recogniser reports. A hand-picked case list only checks the
 * forms someone thought of; this checks their combinations.
 *
 * `exec` is not generated: it ends the shell, so the commands after it are
 * potential acts bash never reaches. Commands bash rejects as syntax errors are
 * skipped and counted. `SHELL_ACTS_FUZZ_N` raises the count for a local sweep,
 * `SHELL_ACTS_FUZZ_SEED` moves its first seed.
 */
import { describe, expect, it } from 'vitest';

import { commandRunsAct } from '../../src/scripts/_lib/shell_acts.js';
import { ACTS, bashAccepts, bashActs, hasBash, oracleBashMajor, oracleBashVersion } from '../_lib/bash_act_oracle.js';

function rng(seed: number): () => number {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function pick<T>(r: () => number, xs: readonly T[]): T {
    return xs[Math.floor(r() * xs.length)] as T;
}

/** One word, with a quote, an escape or a continuation inserted at random. */
function mangle(r: () => number, word: string): string {
    if (r() < 0.5 || word.length < 2) return word;
    const i = 1 + Math.floor(r() * (word.length - 1));
    const [a, b] = [word.slice(0, i), word.slice(i)];
    return pick(r, [`${a}\\${b}`, `${a}''${b}`, `${a}""${b}`, `${a}\\\n${b}`, `"${a}"${b}`, `${a}'${b}'`, `"${word}"`]);
}

const ACT_FORMS = [['git', 'commit', '-m', 'x'], ['git', 'push'], ['gh', 'pr', 'create', '-t', 't'], ['git', '-C', '"my dir"', 'commit', '-q']];
const PREFIXES = ['', 'X=1 ', "'X=1' ", '"X"=1 ', 'X="a b" ', 'time ', '"time" ', 'nohup ', 'command ', 'sudo ', 'sudo X=1 ', 'nohup X=1 ', 'command X=1 ', 'time X=1 ', 'X=1 nohup ', 'time -p ', 'time -p X=1 ', 'command -- ', 'nohup -- ', 'command -v ', 'nohup nohup ', 'command command ', 'nohup command ', 'time nohup ', 'nohup time '];
const OTHERS = ['echo hi', 'echo "git push"', "echo 'git commit -m x'", 'cat <<< "git push"', 'cat <<<x', 'make', 'npm test', 'echo a # ; git push', 'echo "a; git push"', 'echo hello\\; git push'];
const TAGS: Array<[string, string, boolean]> = [
    ['EOF', 'EOF', false], ["'EOF'", 'EOF', true], ['"EOF"', 'EOF', true], ['E"OF"', 'EOF', true],
    ['EOF-1', 'EOF-1', false], ['"A\\\\B"', 'A\\B', true], ["''", '', true], ['EO\\\nF', 'EOF', false],
];

// Redirections, some with operands that look like act words; one may be placed
// before the command or between any two of its words.
const REDIRECTS = ['>out', '> out', '2>&1', '1>&2', '<<<x', "<<< 'a b'", '>>log', '&>/dev/null', '2>/dev/null', '>|f', '<<<push', '>push', '<<<git', '< /dev/null', '2>&1<<<x', '>out 2>&1', '2>&1>log', '3>&1 1>&2 2>&3', '2>\\\n&1', '>\\\n>log', '<\\\n<<x', '2&>/dev/null', '1&>out'];

function act(r: () => number): string {
    const form = pick(r, ACT_FORMS);
    const words = form.map((w, i) => (i === 0 || w.startsWith('-') || w.startsWith('"') ? w : mangle(r, w)));
    let prefix = pick(r, PREFIXES);
    if (r() < 0.4) {
        const at = Math.floor(r() * (words.length + 1));
        if (at === 0 && r() < 0.5) prefix = `${pick(r, REDIRECTS)} ${prefix}`;
        else words.splice(at, 0, pick(r, REDIRECTS));
    }
    return prefix + words.join(' ');
}

function simple(r: () => number): string {
    const s = r() < 0.6 ? act(r) : pick(r, OTHERS);
    const lead = pick(r, ['', '', '', 'true && ', 'true || ']) + s;
    // Compound forms whose bodies hold the command; `if cond` takes both branches
    // across the oracle's runs of `cond`.
    // A comment would swallow the closing `}` / `fi`, so commented forms stay bare.
    if (s.includes('#')) return lead;
    return pick(r, [lead, lead, lead, `! ${s}`, `{ ${s}; }`, `if cond; then ${s}; fi`, `if cond; then ${s}; else ${act(r)}; fi`]);
}

/**
 * A heredoc segment; it ends with its terminator line, so a newline must follow.
 * The operator sits on `cat` or among an act's words, possibly next to another
 * redirection (`2>&1<<EOF`).
 */
function heredoc(r: () => number): string {
    const [spec, tag, quoted] = pick(r, TAGS);
    // A continuation may split the operator or stand before the terminator.
    const op = `${pick(r, ['', '', '2>&1', '>out '])}${pick(r, ['<<', '<<', '<<-', '<\\\n<', '<<\\\n ', '<<\\\n-'])}${spec}`;
    const lines: string[] = [];
    for (let k = Math.floor(r() * 3); k > 0; k -= 1) {
        lines.push(pick(r, [act(r), 'prose line', `  ${tag}`, ...(quoted ? [] : [`${tag.slice(0, 1)}\\`]), `${tag}x`]));
    }
    const tabbed = /<(\\\n)?<(\\\n)?-/.test(op);
    const body = lines.map((l) => (tabbed ? `\t${l}` : l));
    let head = `cat ${op} > /dev/null`;
    if (r() < 0.4) {
        const form = pick(r, ACT_FORMS);
        const words = form.map((w, i) => (i === 0 || w.startsWith('-') || w.startsWith('"') ? w : mangle(r, w)));
        words.splice(1 + Math.floor(r() * words.length), 0, op);
        head = pick(r, PREFIXES) + words.join(' ');
    }
    return `${head}\n${[...body, tabbed ? `\t${tag}` : tag].join('\n')}`;
}

function command(r: () => number): string {
    let out = '';
    let needNewline = false;
    for (let k = 1 + Math.floor(r() * 4); k > 0; k -= 1) {
        if (out !== '') out += needNewline ? '\n' : pick(r, ['; ', ' && ', ' | ', '\n', ' & ', ' || ', ' &\\\n& ', ' |\\\n| ']);
        // Commands after `&&` / `||` start behind `true;`: chaining the generated
        // commands directly would make one branch depend on the outcome of another,
        // which the oracle's eight runs cannot reach independently.
        if (/(&|\|)(\\\n)?\1 $/.test(out)) out = `${out}true; `;
        const h = r() < 0.25;
        out += h ? heredoc(r) : simple(r);
        needNewline = h;
    }
    // A comment after a heredoc's terminator would make it no terminator at all.
    return out + (!needNewline && r() < 0.2 ? ' # trailing' : '');
}

const N = Number(process.env['SHELL_ACTS_FUZZ_N'] ?? 60);
const FIRST = Number(process.env['SHELL_ACTS_FUZZ_SEED'] ?? 1);
// A malformed override must fail, not quietly run zero seeds.
if (!Number.isInteger(N) || N < 1 || !Number.isInteger(FIRST)) throw new Error(`bad SHELL_ACTS_FUZZ_N / SHELL_ACTS_FUZZ_SEED: ${String(N)} / ${String(FIRST)}`);


// The recogniser follows bash 5 where versions differ, so the generated comparison
// needs bash >= 4: on macOS run it with `BASH_ORACLE_IMAGE=ubuntu:24.04`.
const MAJOR = hasBash ? oracleBashMajor() : 0;
// Linux CI runners ship bash 5; macOS runners ship 3.2 and skip, as a Mac does locally.
if (process.env['CI'] && process.platform === 'linux' && MAJOR < 4) throw new Error(`the generated bash test needs bash >= 4 on Linux CI, found ${oracleBashVersion()}`);

describe.skipIf(MAJOR < 4)('generated commands: the recogniser agrees with bash', () => {
    it(`${N} seeded commands`, () => {
        const mismatches: string[] = [];
        let skipped = 0;
        for (let seed = FIRST; seed < FIRST + N; seed += 1) {
            const cmd = command(rng(seed));
            if (!bashAccepts(cmd)) {
                skipped += 1;
                if (process.env['SHELL_ACTS_FUZZ_SHOW_SKIPPED']) console.log('skipped', JSON.stringify(cmd));
                continue;
            }
            const want = bashActs(cmd);
            const got = ACTS.filter((a) => commandRunsAct(cmd, a)).sort();
            if (JSON.stringify(want) !== JSON.stringify(got)) mismatches.push(`seed ${seed}: ${JSON.stringify(cmd)} bash=${JSON.stringify(want)} recogniser=${JSON.stringify(got)}`);
        }
        expect(mismatches).toEqual([]);
        expect(skipped).toBeLessThan(N * 0.05);
    }, Math.max(120_000, N * 1500));
});
