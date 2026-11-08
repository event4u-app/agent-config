/**
 * Shell-grounded oracle for the act recogniser: every case is run by real bash
 * (`tests/_lib/bash_act_oracle.ts`). Each case also states the acts it expects, so the oracle checks
 * false positives (an act the recogniser reports and bash never reaches) as well as
 * misses, and a stub or fixture defect shows up as bash disagreeing with the case.
 */
import { describe, expect, it } from 'vitest';

import { bashActs, C, G, hasBash, oracleBashMajor, P } from '../_lib/bash_act_oracle.js';

import { commandRunsAct } from '../../src/scripts/_lib/shell_acts.js';


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
    // Round-5 counterexamples: an assignment is a prefix only before the command
    // name or after `time` / `sudo`; a continuation inside a heredoc terminator is
    // removed, as in any other word.
    ['command X=1 git push', []],
    ['nohup X=1 git push', []],
    ['exec X=1 git push', []],
    ['time X=1 git push', [P]],
    ['sudo X=1 git push', [P]],
    ['X=1 nohup git push', [P]],
    ['nohup git push', [P]],
    ['command git commit -m x', [C]],
    ['cat <<EO\\\nF\nbody\nEOF\ngit push', [P]],
    ['cat <<EO\\\nF\ngit push\nEOF', []],
    // Round-6 counterexamples: a here-string is not a heredoc; an unquoted
    // terminator's body joins backslash-newlines before the comparison; a quoted
    // `time` is the time(1) program, not the keyword.
    ['cat <<< "hello"\ngit push', [P]],
    ['cat <<<hello; git push', [P]],
    ['cat <<EOF\nbody\nE\\\nOF\ngit push\nEOF', [P]],
    ["cat <<'EOF'\nbody\nE\\\nOF\ngit push\nEOF", []],
    ['cat <<EOF\nE\\\\\nOF\ngit push\nEOF', []],
    ['"time" X=1 git push', []],
    ['"time" git push', [P]],
    ["'nohup' git push", [P]],
    // Found by the generated test: `time` is the keyword only at the start of a
    // pipeline and of a command; elsewhere it is time(1).
    ['echo a | time X=1 git push', []],
    ['echo a | time git push', [P]],
    ['true || time X=1 git push', [P]],
    ['X=1 time Y=2 git push', []],
    ['time -p git push', [P]],
    ['time -p X=1 git push', [P]],
    ['echo hi | time -p git push', [P]],
    ['echo hi | time -p X=1 git push', []],
    ['command -- git push', [P]],
    ['nohup -- git push', [P]],
    ['command -v git push', []],
    ['command -V git commit -m x', []],
    // Round-7 counterexamples: a redirection's operand is not an argument, and a
    // redirection may stand anywhere among the words.
    ['git <<<x push', [P]],
    ['<<<git push', []],
    ['git <<<push status', []],
    ['git >out push', [P]],
    ['>out git push', [P]],
    ['git > out push', [P]],
    ['git >push status', []],
    ['2>/dev/null git commit -m x', [C]],
    ['git 2>&1 push', [P]],
    ['git &>/dev/null push', [P]],
    ['X=1 >f git push', [P]],
    ['nohup >f X=1 git push', []],
    ["git <<< 'a b' push", [P]],
    ['>out time X=1 git push', []],
    // Round-8 counterexample: adjacent redirections, a heredoc among them.
    ['git 2>&1<<EOF push\nEOF', [P]],
    ['git 2>&1<<<x push', [P]],
    ['git >out 2>&1 push', [P]],
    ['git 2>&1>log push', [P]],
    ['git 3>&1 1>&2 2>&3 push', [P]],
    ['git <<EOF 2>&1 push\ngit commit -m x\nEOF', [P]],
    // Round-9 counterexample and its class: a continuation inside an operator or
    // before a heredoc terminator is removed before bash reads the operator.
    ['cat <<\\\n EOF\ngit push\nEOF', []],
    ['cat << \\\n \\\n EOF\ngit push\nEOF', []],
    ['cat <\\\n<EOF\ngit push\nEOF', []],
    ['cat <<\\\n-EOF\n\tgit push\n\tEOF', []],
    ['true &\\\n& git push', [P]],
    ['true |\\\n| git push', [P]],
    ['git 2>\\\n&1 push', [P]],
    ['git >\\\n> log push', [P]],
    ['cat <<\\\n<x; git push', [P]],
    ['echo a # c \\\ngit push', [P]],
    ['cat <<EOF \\\n> /dev/null\nbody\nEOF\ngit push', [P]],
    // Round-10 dispute, settled by bash 3.2 and 5.3 alike: with `<<-` the leading
    // tabs are stripped from the joined line, so a tab after a continuation stays.
    ['cat <<-EOF\nE\\\n\tOF\ngit push\nEOF', []],
    ['cat <<-EOF\n\tE\\\nOF\ngit push\nEOF', [P]],
    ['>out time git push', [P]],
    // Reserved words open a command; they do not name it.
    ['! git push', [P]],
    ['if true; then git push; fi', [P]],
    ['if true; then git push; else git commit -m x; fi', [C, P]],
    ['{ git push; }', [P]],
    ['true && { X=1 git push; }', [P]],
    ['! time X=1 git push', [P]],
    ['{ time X=1 git push; }', [P]],
    ['if true; then time X=1 git push; fi', [P]],
    ['if time X=1 git push; then :; fi', [P]],
    ['while time X=1 git push; do break; done', [P]],
    ['{ ! time X=1 git push; }', [P]],
    ['time ! X=1 git push', [P]],
    ['{ 2>/dev/null time X=1 git push; }', []],
    ['echo a | { time X=1 git push; }', [P]],
    ['echo a | if cond; then time X=1 git push; fi', [P]],
    ["'if' git push", []],
];

describe.skipIf(!hasBash)('the bash stubs log what they are asked to run', () => {
    it.each([['git push', [P]], ['git commit -m x', [C]], ['gh pr create -t t', [G]], ['git status', []]] as Array<[string, string[]]>)('%j', (command, expected) => {
        expect(bashActs(command)).toEqual(expected);
    });
});

// CI must not pass this suite by skipping it.
if (!hasBash && process.env['CI']) throw new Error('the bash oracle needs bash on CI');

// Where bash 3.2 (macOS's /bin/bash) reaches fewer acts than bash 5, which the
// recogniser follows: `time` after `!`, `if`, `elif`, `while` or `until` is time(1)
// there, so the assignment after it is a command name.
const BASH3: Record<string, string[]> = {
    '! time X=1 git push': [],
    'if time X=1 git push; then :; fi': [],
    'while time X=1 git push; do break; done': [],
    '{ ! time X=1 git push; }': [],
};

describe.skipIf(!hasBash)('the recogniser agrees with bash', () => {
    const major = hasBash ? oracleBashMajor() : 0;
    it.each(CASES)('%j', (command, expected) => {
        const fromBash = major < 4 && BASH3[command] ? BASH3[command] : expected;
        expect(bashActs(command)).toEqual([...fromBash].sort());
        const recognised = [C, P, G].filter((act) => commandRunsAct(command, act)).sort();
        expect(recognised).toEqual([...expected].sort());
    });
});
