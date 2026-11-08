/**
 * Shell-grounded oracle for the act recogniser: every case is run by real bash
 * with `git` and `gh` replaced by functions that log their arguments, in an empty
 * temp directory, and the recogniser must agree with what bash actually invoked.
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
    // The recogniser reports a potential act before anything runs, so the oracle
    // makes every branch reachable: `true` fails, letting `||` alternatives run.
    'true() { return 1; }',
].join('\n');

function bashActs(command: string): string[] {
    const dir = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'acts-oracle-'));
    try {
        const log = path.join(dir, 'acts.log');
        fs.writeFileSync(log, '');
        spawnSync('bash', ['-c', `${STUBS}\n${command}\nwait`], { cwd: dir, env: { PATH: process.env['PATH'] ?? '', ACT_LOG: log }, encoding: 'utf8', timeout: 10_000 });
        return fs.readFileSync(log, 'utf8').split('\n').filter((l) => l !== '');
    } finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
}

const CASES = [
    'git commit -m "x"',
    'git add a && git commit -q -m "x"',
    'cd /w && git -C /w commit -m x',
    'GIT_AUTHOR_NAME=a git commit -m x',
    'npm test; git push origin HEAD',
    'true || gh pr create --title t',
    "cat > f <<'EOF'\nit's prose\nEOF\ngit commit -m done",
    'git -C "my repo" commit -m x',
    'git commit -m x # done',
    "echo '<<EOF'; git commit -m x",
    'make && \\\n  git push',
    'cat > f <<EOF-1\nprose\nEOF-1\ngit commit -m x',
    'cat > a <<A > b <<B\none\nA\ntwo\nB\ngit push',
    'cat > f <<-EOF\n\tbody\n\tEOF\ngit commit -m x',
    'sleep 1 & git push',
    'git com\\mit -m x',
    'git "commit" -m x',
    'git com\\\nmit -m x',
    'cat <<E"OF"\nbody\nEOF\ngit push',
    'echo "git commit"',
    "cat > notes.md <<'EOF'\nthen run git commit\nEOF",
    'echo hello\; git push',
    'echo x # ; git push',
    'echo "a; git push"',
    'git -C "dir; git push" status',
    'cat > f <<EOF\n  EOF\ngit push\nEOF',
    'git "com\\mit" -m x',
    'cat <<E"OF"\ngit push\nEOF',
];

const hasBash = spawnSync('bash', ['-c', 'true']).status === 0;

describe.skipIf(!hasBash)('the recogniser agrees with bash', () => {
    it.each(CASES)('%j', (command) => {
        const ran = bashActs(command);
        expect(commandRunsAct(command, 'git commit')).toBe(ran.includes('git commit'));
        expect(commandRunsAct(command, 'git push')).toBe(ran.includes('git push'));
        expect(commandRunsAct(command, 'gh pr create')).toBe(ran.includes('gh pr create'));
    });
});
