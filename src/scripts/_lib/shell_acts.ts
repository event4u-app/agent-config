/**
 * Identifies the shell acts (`git commit`, …) an agent's Bash command names: a
 * syntactic candidate per simple command, not a claim that the command reaches it.
 * Correctness is measured against bash on the grammar of
 * `tests/scripts/shell_acts_bash_fuzz.test.ts`; beyond it the result is best effort.
 *
 * Agents chain: a prefix match finds 17 % of commits in real transcripts, so the
 * command is lexed into simple commands of words. One pass honours single and
 * double quotes, backslash escapes, `#` comments, line continuations, and the
 * separators `;` `&&` `||` `|` `&` and newline outside quotes. A heredoc operator
 * outside quotes queues its terminator (one word after quote removal, read by the
 * same quote reader as every other word, and empty when quoted as `''`); the
 * bodies follow the line in order, each ending at the line that is exactly its
 * terminator (leading tabs stripped for `<<-`; with an unquoted terminator, body
 * lines joined across backslash-newline first). Every other redirection (`>`, `>>`,
 * `<`, `<>`, `>|`, `>&`, `<&`, `&>`, `&>>`, the here-string `<<<`, each with an
 * optional fd number) is dropped together with its operand word, wherever it stands.
 *
 * Supported syntax contract: the above, plus `VAR=…` prefixes, `sudo`/`command`/
 * `time`/`exec`/`nohup`, and `git -C`/`-c` values. An assignment prefix is only one
 * whose `NAME=` is unquoted and that stands before the command name or after
 * `time` / `sudo`: `'X=1' git push` and `nohup X=1 git push` run a command named `X=1`.
 * `time` is the keyword only unquoted at the start of a pipeline; `-p` after any `time`, and `--`
 * after `command` / `nohup`, are skipped; `command -v` / `-V` run nothing. Other
 * wrapper options (`sudo -u …`, `command -p`) are not interpreted. Leading unquoted
 * reserved words (`!`, `{`, `if`, `then`, `else`, `elif`, `do`, `while`, `until`) open
 * the command rather than name it. After `exec` / `nohup` / `sudo` / time(1) a
 * following `exec` is a program name, not a wrapper. Where bash versions differ,
 * this follows bash 5. Not interpreted: `$(…)` and
 * backticks (their text stays inside the word), subshell parentheses, `eval`,
 * aliases, functions, `bash -c` strings. Per command, leading
 * `VAR=…` assignments and `sudo`/`command`/`time`/`exec`/`nohup` are dropped and
 * `git -C <dir>` / `git -c k=v` are skipped, quoted values included.
 *
 * A match is a candidate act: some simple command names it. Control flow is not
 * evaluated, so a branch that never runs still counts, and so does a command after
 * `exec git push;`, which ends the shell.
 * Not recognised, by design: commands built at runtime (`eval`, `$CMD`), aliases
 * and shell functions, wrappers that run git themselves, and `bash -c "…"`. A
 * recognised act is a fact about the command; an unrecognised one is no evidence
 * that none ran.
 */

const PREFIX_WORDS = new Set(['sudo', 'command', 'time', 'exec', 'nohup']);
// Reserved words that open a command list or a pipeline; unquoted and leading,
// the command proper starts after them (`if true; then git push; fi`, `! git push`).
const LEADING_RESERVED = new Set(['!', '{', 'if', 'then', 'else', 'elif', 'do', 'while', 'until']);


/**
 * One word after quote removal. `assign` holds when it opens with an unquoted
 * `NAME=`; `quoted` when any part of it was quoted or escaped.
 */
interface Word {
    text: string;
    assign: boolean;
    quoted: boolean;
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

/**
 * A simple command's words; whether it follows a `|` inside a pipeline; and the
 * index of the word the first redirection stood before (-1 if none), since a
 * redirection before `time` keeps it from being the keyword.
 */
interface Simple {
    words: Word[];
    piped: boolean;
    redirectAt: number;
}

function lexCommands(command: string): Simple[] {
    const out: Simple[] = [];
    let piped = false;
    let redirectAt = -1;
    let words: Word[] = [];
    let word = '';
    let inWord = false;
    // Length of the word's leading unquoted, unescaped run; -1 while no quote or
    // escape has occurred in it. An assignment's `NAME=` must fit inside that run.
    let literal = -1;
    const pendingHeredocs: Array<{ tag: string; stripTabs: boolean; quoted: boolean }> = [];
    // Set by a redirection operator: the next word is its operand, not an argument.
    let operand = false;
    const endWord = (): void => {
        if (inWord && operand) operand = false;
        else if (inWord) {
            const m = /^[A-Za-z_][A-Za-z0-9_]*=/.exec(word);
            const limit = literal === -1 ? word.length : literal;
            words.push({ text: word, assign: m !== null && m[0].length <= limit, quoted: literal !== -1 });
        }
        word = '';
        inWord = false;
        literal = -1;
    };
    const markQuoted = (): void => {
        if (literal === -1) literal = word.length;
    };
    // Before a redirection operator, a word of digits is its file descriptor —
    // unless an earlier operator is still waiting for its operand, which that
    // word then is (`2>&1<<EOF`: `1` belongs to `>&`).
    const endWordBeforeRedirect = (): void => {
        if (inWord && !operand && literal === -1 && /^\d+$/.test(word)) {
            word = '';
            inWord = false;
        } else endWord();
    };
    const endCommand = (nextPiped = false): void => {
        endWord();
        operand = false;
        if (words.length > 0) out.push({ words, piped, redirectAt });
        words = [];
        piped = nextPiped;
        redirectAt = -1;
    };
    const n = command.length;
    // Bash removes backslash-newline before it reads operators, so one may stand
    // inside `<<`, `&&`, `2>&1` or before a heredoc terminator. `skip` steps over
    // them; `next(j)` is the index of the next real character after `j`.
    const skip = (j: number): number => {
        while (command[j] === '\\' && command[j + 1] === '\n') j += 2;
        return j;
    };
    const next = (j: number): number => skip(j + 1);
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
        if (ch === '<' && command[next(i)] === '<' && command[next(next(i))] !== '<') {
            endWordBeforeRedirect();
            if (redirectAt === -1) redirectAt = words.length;
            let j = next(next(i));
            const stripTabs = command[j] === '-';
            if (stripTabs) j = next(j);
            while (command[j] === ' ' || command[j] === '\t' || (command[j] === '\\' && command[j + 1] === '\n')) j += command[j] === '\\' ? 2 : 1;
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
                } else if (c === '\\' && command[j + 1] === '\n') {
                    // A line continuation is removed here as in any other word.
                    j += 2;
                } else if (c === '\\' && j + 1 < n) {
                    tag += command[j + 1];
                    quoted = true;
                    j += 2;
                } else {
                    tag += c;
                    j += 1;
                }
            }
            if (tag !== '' || quoted) pendingHeredocs.push({ tag, stripTabs, quoted });
            i = j;
            continue;
        }
        if (ch === '\n') {
            endCommand();
            i += 1;
            // Each pending heredoc body follows in order, each up to the line that
            // is exactly its terminator (leading tabs stripped for `<<-`). With an
            // unquoted terminator a body line ending in an odd run of backslashes
            // continues onto the next before the comparison, as in bash.
            for (const { tag, stripTabs, quoted } of pendingHeredocs.splice(0)) {
                while (i < n) {
                    let line = '';
                    for (;;) {
                        const eol = command.indexOf('\n', i);
                        const part = command.slice(i, eol === -1 ? n : eol);
                        i = eol === -1 ? n : eol + 1;
                        const run = /\\*$/.exec(part)?.[0].length ?? 0;
                        if (quoted || run % 2 === 0 || eol === -1) {
                            line += part;
                            break;
                        }
                        line += part.slice(0, -1);
                    }
                    if ((stripTabs ? line.replace(/^\t+/, '') : line) === tag) break;
                }
            }
            continue;
        }
        // Any other redirection, a here-string `<<<` included: the operator and its
        // operand word are dropped, wherever they stand among the arguments.
        if (ch === '<' || ch === '>' || (ch === '&' && command[next(i)] === '>')) {
            // `&>` takes no fd number: in `git 2&>/dev/null push` the 2 is an argument.
            if (ch === '&') endWord();
            else endWordBeforeRedirect();
            if (redirectAt === -1) redirectAt = words.length;
            // The operator's characters, continuations between them removed.
            const at = [i, next(i), next(next(i))];
            const text = at.map((k) => command[k] ?? '').join('');
            const op = /^(?:&>>|&>|<<<|>>|>\||>&|<&|<>|>|<)/.exec(text) as RegExpExecArray;
            i = (at[op[0].length - 1] as number) + 1;
            operand = true;
            continue;
        }
        if (ch === ';' || ch === '|' || (ch === '&' && command[next(i)] === '&')) {
            const double = (ch === '&' || ch === '|') && command[next(i)] === ch;
            endCommand(ch === '|' && !double);
            i = double ? next(i) + 1 : i + 1;
            continue;
        }
        // A lone `&` backgrounds the command before it (`>&` and `&>` are redirections, read above).
        if (ch === '&') {
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
    return lexCommands(command).map((c) => c.words.map((w) => w.text));
}

function normalise({ words, piped, redirectAt }: Simple): string[] {
    // The grammar prefix of a command, as bash 5 reads it: any sequence of leading
    // reserved words (`!`, `{`, `if`, …) and the `time` keyword with its `-p`. Each
    // counts only unquoted and before any redirection (`>f ! git push` runs `!`).
    // `time` is the keyword at the start of a pipeline or after another prefix
    // token; after `|` alone it is time(1). Bash 3.2 reads fewer of these.
    let k = 0;
    let prefixed = false;
    const grammar = (j: number): boolean => {
        const w = words[j];
        return w !== undefined && !w.quoted && (redirectAt === -1 || redirectAt > j);
    };
    while (grammar(k)) {
        const w = (words[k] as Word).text;
        if (LEADING_RESERVED.has(w)) k += 1;
        else if (w === 'time' && (prefixed || !piped)) {
            k += 1;
            if (grammar(k) && (words[k] as Word).text === '-p') k += 1;
        } else break;
        prefixed = true;
    }
    // A quoted `'X=1'` is a command name, not an assignment: bash runs `X=1`.
    let assignOk = true;
    // After `exec`, `nohup`, `sudo` or time(1) the next word is looked up as an
    // external program, and there is no `exec` program: `exec exec git push` runs
    // nothing. `command` and `time` exist as programs on POSIX systems and are
    // taken to (the larger set of candidate acts).
    let external = false;
    while (k < words.length) {
        const w = words[k] as Word;
        if (w.assign && assignOk) k += 1;
        else if (PREFIX_WORDS.has(w.text) && !(external && w.text === 'exec')) {
            // Every keyword `time` was taken above; one here is time(1), after which
            // `X=1` is the command name.
            // sudo(8) applies `VAR=value` arguments; after `command`, `exec`, `nohup`
            // and time(1) an assignment is the name of the command run.
            assignOk = w.text === 'sudo';
            external = w.text === 'exec' || w.text === 'nohup' || w.text === 'sudo' || w.text === 'time';
            k += 1;
            const next = words[k]?.text;
            // `command -v` / `-V` only describe the command; they run nothing.
            if (w.text === 'command' && (next === '-v' || next === '-V')) return [];
            // Options of time(1), `command` and `nohup` are arguments: a redirection
            // before them changes nothing.
            if ((w.text === 'time' && next === '-p') || ((w.text === 'command' || w.text === 'nohup') && next === '--')) k += 1;
        } else break;
    }
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
    // Each simple command is judged on its own; nothing evaluates control flow, so
    // `exec git push; git commit` names both acts although exec ends the shell.
    return lexCommands(command).some((simple) => {
        const w = normalise(simple);
        return want.every((x, i) => w[i] === x);
    });
}
