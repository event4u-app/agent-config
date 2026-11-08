/**
 * Whether an agent's Bash command runs a given shell act (`git commit`, …).
 *
 * Agents chain: a prefix match finds 17 % of commits in real transcripts, so the
 * command is lexed into simple commands of words. One pass honours single and
 * double quotes, backslash escapes, `#` comments, line continuations, and the
 * separators `;` `&&` `||` `|` `&` and newline outside quotes. A heredoc operator
 * outside quotes queues its terminator (any unquoted word, or a quoted one); the
 * bodies follow the line in order, each ending at the line that is exactly its
 * terminator (leading tabs stripped for `<<-`).
 *
 * Supported syntax contract: the above, plus `VAR=…` prefixes, `sudo`/`command`/
 * `time`/`exec`/`nohup`, and `git -C`/`-c` values. Not interpreted: `$(…)` and
 * backticks (their text stays inside the word), subshell parentheses, `eval`,
 * aliases, functions, `bash -c` strings. Per command, leading
 * `VAR=…` assignments and `sudo`/`command`/`time`/`exec`/`nohup` are dropped and
 * `git -C <dir>` / `git -c k=v` are skipped, quoted values included.
 *
 * A match is a potential act: it was invoked, which does not mean it succeeded.
 * Not recognised, by design: commands built at runtime (`eval`, `$CMD`), aliases
 * and shell functions, wrappers that run git themselves, and `bash -c "…"`. A
 * recognised act is a fact about the command; an unrecognised one is no evidence
 * that none ran.
 */

const PREFIX_WORDS = new Set(['sudo', 'command', 'time', 'exec', 'nohup']);

/** The command's simple commands, each as its words with quotes removed. */
export function simpleCommands(command: string): string[][] {
    const out: string[][] = [];
    let words: string[] = [];
    let word = '';
    let inWord = false;
    const pendingHeredocs: Array<{ tag: string; stripTabs: boolean }> = [];
    const endWord = (): void => {
        if (inWord) words.push(word);
        word = '';
        inWord = false;
    };
    const endCommand = (): void => {
        endWord();
        if (words.length > 0) out.push(words);
        words = [];
    };
    const n = command.length;
    let i = 0;
    while (i < n) {
        const ch = command[i] as string;
        if (ch === '\\') {
            if (command[i + 1] === '\n') {
                i += 2;
                continue;
            }
            word += command[i + 1] ?? '';
            inWord = true;
            i += 2;
            continue;
        }
        if (ch === "'") {
            const close = command.indexOf("'", i + 1);
            const end = close === -1 ? n : close;
            word += command.slice(i + 1, end);
            inWord = true;
            i = end + 1;
            continue;
        }
        if (ch === '"') {
            i += 1;
            while (i < n && command[i] !== '"') {
                if (command[i] === '\\' && i + 1 < n) {
                    word += command[i + 1];
                    i += 2;
                    continue;
                }
                word += command[i];
                i += 1;
            }
            inWord = true;
            i += 1;
            continue;
        }
        if (ch === '#' && !inWord) {
            while (i < n && command[i] !== '\n') i += 1;
            continue;
        }
        if (ch === '<' && command[i + 1] === '<' && command[i + 2] !== '<') {
            endWord();
            let j = i + 2;
            const stripTabs = command[j] === '-';
            if (stripTabs) j += 1;
            while (command[j] === ' ' || command[j] === '\t') j += 1;
            const m = /^(?:'([^'\n]+)'|"([^"\n]+)"|([^\s;&|<>()'"]+))/.exec(command.slice(j));
            if (m) {
                pendingHeredocs.push({ tag: (m[1] ?? m[2] ?? m[3]) as string, stripTabs });
                i = j + m[0].length;
                continue;
            }
            i += 2;
            continue;
        }
        if (ch === '\n') {
            endCommand();
            i += 1;
            // Each pending heredoc body follows in order, each up to the line that
            // is exactly its terminator (leading tabs stripped for `<<-`).
            for (const { tag, stripTabs } of pendingHeredocs.splice(0)) {
                while (i < n) {
                    const eol = command.indexOf('\n', i);
                    const line = command.slice(i, eol === -1 ? n : eol);
                    i = eol === -1 ? n : eol + 1;
                    if ((stripTabs ? line.replace(/^\t+/, '') : line) === tag) break;
                }
            }
            continue;
        }
        if (ch === ';' || ch === '|' || (ch === '&' && command[i + 1] === '&')) {
            endCommand();
            i += (ch === '&' || (ch === '|' && command[i + 1] === '|')) ? 2 : 1;
            continue;
        }
        // A lone `&` backgrounds the command before it; `2>&1` and `&>f` are redirections.
        if (ch === '&' && command[i + 1] !== '>' && !(inWord && /[<>]$/.test(word))) {
            endCommand();
            i += 1;
            continue;
        }
        if (ch === ' ' || ch === '\t') {
            endWord();
            i += 1;
            continue;
        }
        word += ch;
        inWord = true;
        i += 1;
    }
    endCommand();
    return out;
}

function normalise(words: readonly string[]): string[] {
    let t = [...words];
    while (t.length > 0 && (/^[A-Za-z_][A-Za-z0-9_]*=/.test(t[0] as string) || PREFIX_WORDS.has(t[0] as string))) t = t.slice(1);
    if (t[0] === 'git') {
        let i = 1;
        while (i < t.length && (t[i] === '-C' || t[i] === '-c')) i += 2;
        return ['git', ...t.slice(i)];
    }
    return t;
}

/** True when some simple command in `command` begins with the words of `act`. */
export function commandRunsAct(command: string, act: string): boolean {
    const want = act.split(' ');
    return simpleCommands(command).some((words) => {
        const w = normalise(words);
        return want.every((x, i) => w[i] === x);
    });
}
