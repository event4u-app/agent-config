/**
 * Whether an agent's Bash command runs a given shell act (`git commit`, …).
 *
 * Agents chain: a prefix match finds 17 % of commits in real transcripts, so the
 * command is segmented. Heredoc bodies are dropped first (prose in them is not a
 * command, and an apostrophe in them would unbalance the quote tracking), the rest
 * is split on `;`, `&&`, `||`, `|` and newlines outside quotes, and each segment is
 * normalised: leading `VAR=…` assignments and `sudo`/`command`/`time`/`exec`/
 * `nohup` dropped, `git -C <dir>` / `git -c k=v` skipped.
 *
 * Not recognised, by design: commands built at runtime (`eval`, `$CMD`), aliases
 * and shell functions, wrappers that run git themselves, and `bash -c "…"`. A
 * recognised act is a fact; an unrecognised one is no evidence that none ran.
 */

const PREFIX_WORDS = new Set(['sudo', 'command', 'time', 'exec', 'nohup']);

function stripHeredocs(cmd: string): string {
    const out: string[] = [];
    let tag: string | null = null;
    for (const line of cmd.split('\n')) {
        if (tag !== null) {
            if (line.trim() === tag) tag = null;
            continue;
        }
        out.push(line);
        const m = /<<-?\s*['"]?([A-Za-z_][A-Za-z0-9_]*)['"]?/.exec(line);
        if (m) tag = m[1] as string;
    }
    return out.join('\n');
}

function segments(raw: string): string[] {
    const cmd = stripHeredocs(raw);
    const out: string[] = [];
    let cur = '';
    let quote: string | null = null;
    for (let i = 0; i < cmd.length; i += 1) {
        const ch = cmd[i] as string;
        if (quote !== null) {
            cur += ch;
            if (ch === quote) quote = null;
            continue;
        }
        if (ch === '"' || ch === "'") {
            quote = ch;
            cur += ch;
            continue;
        }
        const pair = ch === '&' && cmd[i + 1] === '&';
        if (ch === ';' || ch === '\n' || ch === '|' || pair) {
            out.push(cur);
            cur = '';
            if (pair || (ch === '|' && cmd[i + 1] === '|')) i += 1;
            continue;
        }
        cur += ch;
    }
    out.push(cur);
    return out.map((s) => s.trim()).filter((s) => s !== '');
}

function words(segment: string): string[] {
    let t = segment.split(/\s+/);
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
    return segments(command).some((seg) => {
        const w = words(seg);
        return want.every((x, i) => w[i] === x);
    });
}
