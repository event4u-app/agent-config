/**
 * Generated differential test: seeded commands built from the supported syntax
 * (prefixes, wrappers, quoting and escapes inside act words, separators, comments,
 * heredocs with every terminator form, here-strings) are run by real bash and must
 * produce the acts the recogniser reports. A hand-picked case list only checks the
 * forms someone thought of; this checks their combinations.
 *
 * `exec` is not generated: it ends the shell, so the commands after it are
 * potential acts bash never reaches. Commands bash rejects as syntax errors are
 * skipped and counted. `SHELL_ACTS_FUZZ_N` raises the count for a local sweep,
 * `SHELL_ACTS_FUZZ_SEED` moves its first seed.
 */
import { spawnSync } from 'node:child_process';

import { describe, expect, it } from 'vitest';

import { commandRunsAct } from '../../src/scripts/_lib/shell_acts.js';
import { ACTS, bashActs, hasBash } from '../_lib/bash_act_oracle.js';

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
const PREFIXES = ['', 'X=1 ', "'X=1' ", '"X"=1 ', 'X="a b" ', 'time ', '"time" ', 'nohup ', 'command ', 'sudo ', 'sudo X=1 ', 'nohup X=1 ', 'command X=1 ', 'time X=1 ', 'X=1 nohup ', 'time -p ', 'time -p X=1 ', 'command -- ', 'nohup -- ', 'command -v '];
const OTHERS = ['echo hi', 'echo "git push"', "echo 'git commit -m x'", 'cat <<< "git push"', 'cat <<<x', 'make', 'npm test', 'echo a # ; git push', 'echo "a; git push"', 'echo hello\\; git push'];
const TAGS: Array<[string, string, boolean]> = [
    ['EOF', 'EOF', false], ["'EOF'", 'EOF', true], ['"EOF"', 'EOF', true], ['E"OF"', 'EOF', true],
    ['EOF-1', 'EOF-1', false], ['"A\\\\B"', 'A\\B', true], ["''", '', true], ['EO\\\nF', 'EOF', false],
];

function act(r: () => number): string {
    const form = pick(r, ACT_FORMS);
    return pick(r, PREFIXES) + form.map((w, i) => (i === 0 || w.startsWith('-') || w.startsWith('"') ? w : mangle(r, w))).join(' ');
}

function simple(r: () => number): string {
    const s = r() < 0.6 ? act(r) : pick(r, OTHERS);
    return pick(r, ['', '', '', 'true && ', 'true || ']) + s;
}

/** A heredoc segment; it ends with its terminator line, so a newline must follow. */
function heredoc(r: () => number): string {
    const [spec, tag, quoted] = pick(r, TAGS);
    const lines: string[] = [];
    for (let k = Math.floor(r() * 3); k > 0; k -= 1) {
        lines.push(pick(r, [act(r), 'prose line', `  ${tag}`, ...(quoted ? [] : [`${tag.slice(0, 1)}\\`]), `${tag}x`]));
    }
    const tabbed = r() < 0.2;
    const body = lines.map((l) => (tabbed ? `\t${l}` : l));
    return `cat ${tabbed ? '<<-' : '<<'}${spec} > /dev/null\n${[...body, tabbed ? `\t${tag}` : tag].join('\n')}`;
}

function command(r: () => number): string {
    let out = '';
    let needNewline = false;
    for (let k = 1 + Math.floor(r() * 4); k > 0; k -= 1) {
        if (out !== '') out += needNewline ? '\n' : pick(r, ['; ', ' && ', ' | ', '\n', ' & ', ' || ']);
        if (out.endsWith('&& ') || out.endsWith('|| ')) out = `${out}true; `;
        const h = r() < 0.25;
        out += h ? heredoc(r) : simple(r);
        needNewline = h;
    }
    return out + (r() < 0.2 ? ' # trailing' : '');
}

const N = Number(process.env['SHELL_ACTS_FUZZ_N'] ?? 100);
const FIRST = Number(process.env['SHELL_ACTS_FUZZ_SEED'] ?? 1);

function bashAccepts(cmd: string): boolean {
    return spawnSync('bash', ['-n', '-c', cmd], { encoding: 'utf8' }).status === 0;
}

describe.skipIf(!hasBash)('generated commands: the recogniser agrees with bash', () => {
    it(`${N} seeded commands`, () => {
        const mismatches: string[] = [];
        let skipped = 0;
        for (let seed = FIRST; seed < FIRST + N; seed += 1) {
            const cmd = command(rng(seed));
            if (!bashAccepts(cmd)) {
                skipped += 1;
                continue;
            }
            const want = bashActs(cmd);
            const got = ACTS.filter((a) => commandRunsAct(cmd, a)).sort();
            if (JSON.stringify(want) !== JSON.stringify(got)) mismatches.push(`seed ${seed}: ${JSON.stringify(cmd)} bash=${JSON.stringify(want)} recogniser=${JSON.stringify(got)}`);
        }
        expect(skipped).toBeLessThan(N * 0.05);
        expect(mismatches).toEqual([]);
    }, Math.max(120_000, N * 300));
});
