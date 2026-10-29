/**
 * Run one `verify:` clause read-only: allowlisted first token, no shell, a
 * timeout. Shared by the vacuity report (`roadmap_verify_share --run`) and the
 * step writer's `--verify`, so both refuse the same commands for the same reason.
 */
import { spawnSync } from 'node:child_process';

import type { Expectation, VerifyClause } from './verify_clause.js';

/** Read-only first tokens; nothing else is ever executed. */
export const RUN_ALLOWLIST: ReadonlySet<string> = new Set(['grep', 'test', 'ls', 'wc']);
export const RUN_TIMEOUT_MS = 5000;

export type SkipReason = 'not-allowlisted' | 'shell-syntax' | 'timeout' | 'spawn-error';

export type ClauseRun =
    | { readonly outcome: 'met' | 'unmet'; readonly implied: boolean }
    | { readonly outcome: 'skipped'; readonly reason: SkipReason };

/**
 * Split a command into argv the way a shell would for quoting only, or `null`
 * when it needs anything else a shell does: an unquoted pipe, redirect, `;`,
 * `&`, variable or glob, or a command substitution outside single quotes.
 */
export function argvOf(command: string): string[] | null {
    const out: string[] = [];
    let cur = '';
    let has = false;
    let quote: "'" | '"' | null = null;
    for (let i = 0; i < command.length; i += 1) {
        const ch = command[i] as string;
        if (quote === "'") {
            if (ch === "'") quote = null;
            else cur += ch;
            continue;
        }
        if (ch === '`' || (ch === '$' && command[i + 1] === '(')) return null;
        if (quote === '"') {
            if (ch === '"') quote = null;
            else if (ch === '\\' && i + 1 < command.length) cur += command[++i];
            else if (ch === '$') return null;
            else cur += ch;
            continue;
        }
        if (ch === "'" || ch === '"') {
            quote = ch;
            has = true;
        } else if (ch === '\\' && i + 1 < command.length) {
            cur += command[++i];
            has = true;
        } else if (/\s/.test(ch)) {
            if (has) out.push(cur);
            cur = '';
            has = false;
        } else if ('|&;<>$*?(){}'.includes(ch)) {
            return null;
        } else {
            cur += ch;
            has = true;
        }
    }
    if (quote !== null) return null;
    if (has) out.push(cur);
    return out.length === 0 ? null : out;
}

/** A regex reads stdout without its trailing newline, so `/^0$/` matches `grep -c`'s `0\n`. */
export function meets(expect: Expectation, status: number | null, stdout: string): boolean {
    if (expect.kind === 'exit') return status === expect.code;
    return new RegExp(expect.source).test(stdout.replace(/\n+$/, ''));
}

/** Run a command-bearing clause; anything not provably read-only is skipped, never run. */
export function runClause(clause: VerifyClause & { readonly command: string }, cwd: string): ClauseRun {
    const argv = argvOf(clause.command);
    if (argv === null) return { outcome: 'skipped', reason: 'shell-syntax' };
    if (!RUN_ALLOWLIST.has(argv[0] as string)) return { outcome: 'skipped', reason: 'not-allowlisted' };
    const res = spawnSync(argv[0] as string, argv.slice(1), {
        cwd,
        shell: false,
        input: '',
        encoding: 'utf-8',
        timeout: RUN_TIMEOUT_MS,
        maxBuffer: 4 * 1024 * 1024,
    });
    if (res.error !== undefined) {
        const timedOut = (res.error as NodeJS.ErrnoException).code === 'ETIMEDOUT';
        return { outcome: 'skipped', reason: timedOut ? 'timeout' : 'spawn-error' };
    }
    const expect: Expectation = clause.expect ?? { kind: 'exit', code: 0 };
    return { outcome: meets(expect, res.status, res.stdout ?? '') ? 'met' : 'unmet', implied: clause.expect === null };
}
