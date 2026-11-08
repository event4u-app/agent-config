/**
 * Shell-grounded oracle for the act recogniser: every case is run by real bash
 * with `git` and `gh` replaced by functions that log their arguments, in an empty
 * temp directory. Each case also states the acts it expects, so the oracle checks
 * false positives (an act the recogniser reports and bash never reaches) as well as
 * misses, and a stub or fixture defect shows up as bash disagreeing with the case.
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { describe, expect, it } from 'vitest';

import { commandRunsAct } from '../../src/scripts/_lib/shell_acts.js';

const STUBS = [
    'git() { while [ "$1" = -C ] || [ "$1" = -c ]; do shift 2; done; printf "git %s\\n" "$1" >> "$ACT_LOG"; }',
    'gh() { printf "gh %s %s\\n" "$1" "$2" >> "$ACT_LOG"; }',
    'cat() { command cat > /dev/null; }',
    'sudo() { "$@"; }',
    'make() { :; }', 'npm() { :; }', 'sleep() { :; }', 'cd() { :; }',
].join('\n');

/**
 * Acts bash invokes, as the union of two runs: `true` succeeding and `true`
 * failing. The recogniser reports a potential act, so both `&&` and `||` branches
 * have to be reachable for bash to be its oracle.
 */
function bashActs(command: string): string[] {
    const acts = new Set([C, P, G]);
    return [...new Set([...bashRun(command, 0), ...bashRun(command, 1)])].filter((a) => acts.has(a)).sort();
}

function bashRun(command: string, trueStatus: number): string[] {
    const dir = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'acts-oracle-'));
    try {
        const log = path.join(dir, 'acts.log');
        fs.writeFileSync(log, '');
        const r = spawnSync('bash', ['-c', `${STUBS}\ntrue() { return ${trueStatus}; }\n${command}\nwait`], { cwd: dir, env: { PATH: process.env['PATH'] ?? '', ACT_LOG: log }, encoding: 'utf8', timeout: 10_000 });
        if (r.error || r.signal) throw new Error(`bash did not finish: ${String(r.error ?? r.signal)}`);
        return fs.readFileSync(log, 'utf8').split('\n').filter((l) => l !== '');
    } finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
}

const C = 'git commit';
const P = 'git push';
const G = 'gh pr create';

/** Each case: the command and the acts it runs. */
const CASES: Array<[string, string[]]> = [
    ['git commit -m "x"', [C]],
    ['git add a && git commit -q -m "x"', [C]],
    ['cd /w && git -C /w commit -m x', [C]],
    ['GIT_AUTHOR_NAME=a git commit -m x', [C]],
    ['npm test; git push origin HEAD', [P]],
    ['true || gh pr create --title t', [G]],
    ["cat > f <<'EOF'\nit's prose\nEOF\ngit commit -m done", [C]],
    ['git -C "my repo" commit -m x', [C]],
    ['git commit -m x # done', [C]],
    ["echo '<<EOF'; git commit -m x", [C]],
    ['make && \\\n  git push', [P]],
    ['cat > f <<EOF-1\nprose\nEOF-1\ngit commit -m x', [C]],
    ['cat > a <<A > b <<B\none\nA\ntwo\nB\ngit push', [P]],
    ['cat > f <<-EOF\n\tbody\n\tEOF\ngit commit -m x', [C]],
    ['sleep 1 & git push', [P]],
    ['git com\\mit -m x', [C]],
    ['git "commit" -m x', [C]],
    ['git com\\\nmit -m x', [C]],
    ['cat <<E"OF"\nbody\nEOF\ngit push', [P]],
    ['echo "git commit"', []],
    ["cat > notes.md <<'EOF'\nthen run git commit\nEOF", []],
    ['echo hello\\; git push', []],
    ['echo x # ; git push', []],
    ['echo "a; git push"', []],
    ['git -C "dir; git push" status', []],
    ['cat > f <<EOF\n  EOF\ngit push\nEOF', []],
    ['git "com\\mit" -m x', []],
    ['cat <<E"OF"\ngit push\nEOF', []],
    // Round-4 counterexamples: escapes inside a quoted terminator, an empty
    // terminator, and assignment words that are quoted.
    ['cat <<"A\\\\B"\ngit push\nA\\B\ngit commit -m done', [C]],
    ["cat <<'A\\B'\ngit push\nA\\B\ngit commit -m done", [C]],
    ["cat <<''\ngit push\n\ngit commit -m x", [C]],
    ['cat <<""\ngit push\n\ngit commit -m x', [C]],
    ["'X=1' git push", []],
    ['"X"=1 git push', []],
    ['X\\=1 git push', []],
    ['X="a b" git push', [P]],
    ["X='a' Y=2 git push", [P]],
];

const hasBash = spawnSync('bash', ['-c', 'true']).status === 0;

describe.skipIf(!hasBash)('the recogniser agrees with bash', () => {
    it.each(CASES)('%j', (command, expected) => {
        expect(bashActs(command)).toEqual([...expected].sort());
        const recognised = [C, P, G].filter((act) => commandRunsAct(command, act)).sort();
        expect(recognised).toEqual([...expected].sort());
    });
});
