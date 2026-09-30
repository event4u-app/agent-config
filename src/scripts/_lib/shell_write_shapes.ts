/**
 * The shell shapes that mean "this path is being WRITTEN", shared by the
 * PreToolUse guards that refuse a write to a governed file.
 *
 * WHY IT IS SHARED. `block_kernel_rule_writes.ts` grew this parser after the
 * S0.2 spike measured a real gap: a guard keyed on the TOOL NAME let
 * `Bash sed -i … src/rules/commit-policy.md` reach the outcome the Write
 * branch refuses, and a two-step `Write` → `Bash mv` sequence did the same with
 * every individual step allowed. `block_plumbing_writes.ts`
 * (road-to-a-kernel-that-guards-its-plumbing 1.2) refuses a different file set
 * against the same shapes. Two copies of a shell-shape parser is two places a
 * verb can be added to one and forgotten in the other, and the guard that
 * silently stopped recognising `tee` would look exactly like the guard that
 * never had to.
 *
 * DELIBERATELY NARROW (council 2026-08-02 cut, option ii, recorded on the
 * kernel guard and inherited here unchanged): only redirection into the path,
 * an in-place `sed`, a `tee`/`truncate`/`rm`/`shred` naming it, or a
 * `mv`/`cp`/`install`/`rsync` whose DESTINATION it is. Reads stay allowed —
 * `cat`, `grep`, `head`, `diff`, `git show` carry none of these shapes — and no
 * attempt is made to understand arbitrary shell. Recognising every conceivable
 * write verb would make this a shell sandbox, which is the failure mode the
 * council named.
 *
 * KNOWN-OPEN, stated rather than implied: a write routed through an
 * interpreter (`python -c`, a heredoc fed to `sh`) carries none of these
 * shapes and is not detected. This is a guard, not write mediation.
 */
import * as path from 'node:path';

/** In-place mutators that name their target as a plain argument. */
const MUTATOR_VERBS: ReadonlySet<string> = new Set(['sed', 'tee', 'truncate', 'rm', 'shred']);

/** Verbs whose LAST positional argument is the destination. */
const DEST_LAST_VERBS: ReadonlySet<string> = new Set(['mv', 'cp', 'install', 'rsync']);

/**
 * The first governed target a command WRITES, or `null`.
 *
 * @param command the raw shell string off the tool envelope
 * @param match   classifies one token: a non-null return names the governed
 *                target that token resolves to, and is what this returns
 */
export function shellWriteTarget<T>(command: string, match: (token: string) => T | null): T | null {
    const tokens = command.split(/\s+/).filter((t) => t.length > 0);
    const stripped = tokens.map((t) => t.replace(/^['"]|['"]$/g, ''));

    // Cheap reject first: no governed path in the string at all.
    if (!stripped.some((t) => match(t) !== null)) {
        return null;
    }

    // 1. Redirection into the path: `> p`, `>> p`, `>p`, `>>p`.
    for (let i = 0; i < stripped.length; i += 1) {
        const tok = stripped[i] as string;
        const inline = /^>{1,2}(.+)$/.exec(tok);
        if (inline) {
            const r = match(inline[1] as string);
            if (r !== null) {
                return r;
            }
        }
        if (tok === '>' || tok === '>>') {
            const next = stripped[i + 1];
            if (typeof next === 'string') {
                const r = match(next);
                if (r !== null) {
                    return r;
                }
            }
        }
    }

    // 2. A mutator verb anywhere in the pipeline, with the path as an argument.
    //    `sed` only counts in its in-place form — `sed 's/x/y/' file` prints.
    const verbs = new Set<string>();
    let prevWasSeparator = true;
    for (const tok of stripped) {
        if (['&&', '||', ';', '|'].includes(tok)) {
            prevWasSeparator = true;
            continue;
        }
        if (prevWasSeparator && !tok.startsWith('-')) {
            verbs.add(path.basename(tok));
            prevWasSeparator = false;
        }
    }
    const sedInPlace = verbs.has('sed') && stripped.some((t) => /^-i/.test(t));
    for (const verb of verbs) {
        if (verb === 'sed' && !sedInPlace) {
            continue;
        }
        if (MUTATOR_VERBS.has(verb)) {
            const hit = stripped.map(match).find((r) => r !== null);
            if (hit !== undefined && hit !== null) {
                return hit;
            }
        }
        if (DEST_LAST_VERBS.has(verb)) {
            const last = stripped[stripped.length - 1] as string;
            const r = match(last);
            if (r !== null) {
                return r;
            }
        }
    }
    return null;
}
