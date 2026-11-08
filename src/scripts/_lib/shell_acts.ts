/**
 * Whether an agent's Bash command runs a given shell act (`git commit`, …).
 *
 * Agents chain: a prefix match finds 17 % of commits in real transcripts, so the
 * command is lexed into simple commands of words. One pass honours single and
 * double quotes, backslash escapes, `#` comments, line continuations, and the
 * separators `;` `&&` `||` `|` `&` and newline outside quotes. A heredoc operator
 * outside quotes queues its terminator (one word after quote removal, read by the
 * same quote reader as every other word, and empty when quoted as `''`); the
 * bodies follow the line in order, each ending at the line that is exactly its
 * terminator (leading tabs stripped for `<<-`).
 *
 * Supported syntax contract: the above, plus `VAR=…` prefixes, `sudo`/`command`/
 * `time`/`exec`/`nohup`, and `git -C`/`-c` values. An assignment prefix is only one
 * whose `NAME=` is unquoted: `'X=1' git push` runs a command named `X=1`. Not interpreted: `$(…)` and
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

/** One word after quote removal. `assign` holds when it opens with an unquoted `NAME=`. */
interface Word {
    text: string;
    assign: boolean;
}

/**
 * The quoted run that starts at `i` (a `'` or `"`), quotes removed, and the index
 * after its closing quote. Inside double quotes a backslash escapes only
 * $ ` " \ and newline; before anything else it stays a literal backslash.
 * Shared by words and heredoc terminators, so the two cannot diverge.
 */
function readQuoted(s: string, i: number): { text: string; end: number } {
    const q = s[i];
    const n = s.length;
    if (q === "'") {
        const close = s.indexOf("'", i + 1);
        const end = close === -1 ? n : close;
        return { text: s.slice(i + 1, end), end: end + 1 };
    }
    let text = '';
    let j = i + 1;
    while (j < n && s[j] !== '"') {
        if (s[j] === '\\' && j + 1 < n && '$`"\\\n'.includes(s[j + 1] as string)) {
            if (s[j + 1] !== '\n') text += s[j + 1];
            j += 2;
            continue;
        }
        text += s[j];
        j += 1;
    }
    return { text, end: j + 1 };
}

function lexCommands(command: string): Word[][] {
    const out: Word[][] = [];
    let words: Word[] = [];
    let word = '';
    let inWord = false;
    // Length of the word's leading unquoted, unescaped run; -1 while no quote or
    // escape has occurred in it. An assignment's `NAME=` must fit inside that run.
    let literal = -1;
    const pendingHeredocs: Array<{ tag: string; stripTabs: boolean }> = [];
    const endWord = (): void => {
        if (inWord) {
            const m = /^[A-Za-z_][A-Za-z0-9_]*=/.exec(word);
            const limit = literal === -1 ? word.length : literal;
            words.push({ text: word, assign: m !== null && m[0].length <= limit });
        }
        word = '';
        inWord = false;
        literal = -1;
    };
    const markQuoted = (): void => {
        if (literal === -1) literal = word.length;
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
            markQuoted();
            word += command[i + 1] ?? '';
            inWord = true;
            i += 2;
            continue;
        }
        if (ch === "'" || ch === '"') {
            markQuoted();
            const { text, end } = readQuoted(command, i);
            word += text;
            inWord = true;
            i = end;
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
            // The terminator is one word after quote removal: `E"OF"` and `'EOF'` are
            // EOF, `"E\\OF"` is E\OF, and a quoted empty word (`<<''`) is a valid,
            // empty terminator.
            let tag = '';
            let quoted = false;
            while (j < n && !/[\s;&|<>()]/.test(command[j] as string)) {
                const c = command[j] as string;
                if (c === "'" || c === '"') {
                    const { text, end } = readQuoted(command, j);
                    tag += text;
                    quoted = true;
                    j = end;
                } else if (c === '\\' && j + 1 < n) {
                    tag += command[j + 1];
                    quoted = true;
                    j += 2;
                } else {
                    tag += c;
                    j += 1;
                }
            }
            if (tag !== '' || quoted) pendingHeredocs.push({ tag, stripTabs });
            i = j > i + 2 ? j : i + 2;
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

/** The command's simple commands, each as its words with quotes removed. */
export function simpleCommands(command: string): string[][] {
    return lexCommands(command).map((ws) => ws.map((w) => w.text));
}

function normalise(words: readonly Word[]): string[] {
    let k = 0;
    // A quoted `'X=1'` is a command name, not an assignment: bash runs `X=1`.
    while (k < words.length && ((words[k] as Word).assign || PREFIX_WORDS.has((words[k] as Word).text))) k += 1;
    const t = words.slice(k).map((w) => w.text);
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
    return lexCommands(command).some((words) => {
        const w = normalise(words);
        return want.every((x, i) => w[i] === x);
    });
}
