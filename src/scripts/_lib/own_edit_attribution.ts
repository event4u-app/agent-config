/**
 * How many non-doc lines THIS session changed — the count `end_review_nudge`
 * should charge, instead of the whole working tree minus a session-start total.
 *
 * The nudge diffs the shared worktree, so a parallel writer's lines, or the
 * whole tree again once the session commits (`head-moved`), are charged to a
 * session that may have written nothing. Council D4 (2026-11-21) settled the
 * accounting this module implements:
 *
 *   · Evidence of authorship is the session's own write calls: the paths of
 *     its Edit/Write/MultiEdit/NotebookEdit calls, plus the LITERAL targets of
 *     shell writes (`> f`, `>> f`, `tee f`, `sed -i … f`, `cp|mv … f`).
 *   · The count is the diff from the session's START head to the working tree,
 *     restricted to those paths, so the session's own commits stay counted and
 *     everyone else's paths do not; untracked written files count by lines.
 *   · Uncertainty resolves toward UNDER-reporting. A shell write whose target
 *     cannot be read from the text (a computed path, an interpreter, `git
 *     apply|merge|checkout`, `find -exec`, `xargs`) makes the result
 *     `fallback`: the verified count is still reported and the nudge fires
 *     only when it alone clears the threshold. A complete reading is `own`.
 *
 * RESIDUAL, stated rather than hidden: a file both this session and another
 * writer changed is charged in full to this session — a path says who touched
 * a file, not whose lines are in it.
 *
 * NOT WIRED: no hook imports this module. Wiring it into the nudge grows the
 * live hook bundle, whose byte ceiling has no headroom for it.
 */
import { spawnSync } from 'node:child_process';
import * as path from 'node:path';

import {
    isDocPath,
    parseNumstat,
    untrackedFileLineCount,
    type NumstatRow,
} from '../hooks/end_review_nudge_hook.js';

export type Attribution = 'own' | 'fallback';

export interface SessionWrites {
    /** Workspace-relative paths this session wrote. */
    readonly paths: ReadonlySet<string>;
    /** A shell write was seen whose target the command text does not name. */
    readonly unresolvedShellWrite: boolean;
}

export interface OwnEditCount {
    readonly lines: number;
    readonly attribution: Attribution;
}

const WRITE_TOOLS: ReadonlySet<string> = new Set(['Edit', 'Write', 'MultiEdit', 'NotebookEdit']);
const SHELL_TOOLS: ReadonlySet<string> = new Set(['Bash', 'bash', 'shell', 'run_shell_command']);

/** Commands that write files whose targets no literal operand names. */
const OPAQUE_WRITER =
    /(?:^|[\s;&|(])(?:python3?|node|ruby|perl|php|deno|bun|patch|xargs|rsync)\b|\bgit\s+(?:apply|am|merge|pull|checkout|restore|reset|stash|cherry-pick|revert|rebase|switch)\b|\bfind\b[^;&|]*-(?:exec|delete)\b|\bnpm\s+(?:install|i|ci|update)\b/;

const REDIRECT_TARGET = /(?:^|[^0-9&<>])>>?\s*([^\s;&|<>]+)/g;

function relative(cwd: string, p: string): string {
    const rel = path.isAbsolute(p) ? path.relative(cwd, p) : path.normalize(p);
    return rel.split(path.sep).join('/');
}

const literal = (w: string): boolean => w !== '' && !/[$`*?{}[\]~]/.test(w);

/** Literal write targets of one shell command, or null when one cannot be read. */
export function shellWriteTargets(command: string): { targets: string[]; unresolved: boolean } {
    const targets: string[] = [];
    let unresolved = OPAQUE_WRITER.test(command);

    for (const m of command.matchAll(REDIRECT_TARGET)) {
        const t = (m[1] as string).replace(/^['"]|['"]$/g, '');
        if (t === '/dev/null' || t.startsWith('&')) continue;
        if (literal(t)) targets.push(t);
        else unresolved = true;
    }
    for (const segment of command.split(/&&|\|\||[;|]/)) {
        const words = segment.trim().split(/\s+/).filter((w) => w !== '');
        const head = (words[0] ?? '').replace(/^.*\//, '');
        const operands = words
            .slice(1)
            .filter((w) => !w.startsWith('-') && !/^[<>]/.test(w))
            .map((w) => w.replace(/^['"]|['"]$/g, ''))
            .filter((w) => w !== '');
        let written: string[] = [];
        if (head === 'tee') written = operands;
        else if (head === 'sed' && words.some((w) => /^-[a-zA-Z]*i/.test(w) || w === '--in-place' || w.startsWith('--in-place='))) {
            written = operands.slice(words.some((w) => w === '-e' || w === '--expression' || w === '-f') ? 0 : 1);
        } else if ((head === 'cp' || head === 'mv') && operands.length >= 2) written = [operands[operands.length - 1] as string];
        for (const t of written) {
            if (literal(t)) targets.push(t);
            else unresolved = true;
        }
    }
    return { targets, unresolved };
}

/** The session's write evidence, read from its transcript (JSONL). */
export function sessionWritesFromTranscript(transcript: string, cwd: string): SessionWrites {
    const paths = new Set<string>();
    let unresolvedShellWrite = false;
    for (const line of transcript.split('\n')) {
        if (!line.includes('tool_use')) continue;
        let entry: unknown;
        try {
            entry = JSON.parse(line);
        } catch {
            continue;
        }
        const content = (entry as { message?: { content?: unknown } }).message?.content;
        if (!Array.isArray(content)) continue;
        for (const block of content as Array<Record<string, unknown>>) {
            if (block['type'] !== 'tool_use' || typeof block['name'] !== 'string') continue;
            const input = (block['input'] ?? {}) as Record<string, unknown>;
            if (WRITE_TOOLS.has(block['name'])) {
                const p = input['file_path'] ?? input['notebook_path'] ?? input['path'];
                if (typeof p === 'string' && p !== '') paths.add(relative(cwd, p));
            } else if (SHELL_TOOLS.has(block['name']) && typeof input['command'] === 'string') {
                const shell = shellWriteTargets(input['command']);
                for (const t of shell.targets) paths.add(relative(cwd, t));
                if (shell.unresolved) unresolvedShellWrite = true;
            }
        }
    }
    return { paths, unresolvedShellWrite };
}

/**
 * Lines charged to the session: non-doc numstat rows on written paths plus
 * written untracked files, each written path's start-of-session dirt removed.
 */
export function countOwnLines(
    rows: readonly NumstatRow[],
    untracked: ReadonlyMap<string, number>,
    writes: SessionWrites,
    dirtAtStart: ReadonlyMap<string, number> = new Map(),
): OwnEditCount {
    let lines = 0;
    const charge = (p: string, n: number): void => {
        if (!writes.paths.has(p) || isDocPath(p)) return;
        lines += Math.max(0, n - (dirtAtStart.get(p) ?? 0));
    };
    for (const r of rows) charge(r.path, r.added + r.deleted);
    for (const [p, n] of untracked) charge(p, n);
    return { lines, attribution: writes.unresolvedShellWrite ? 'fallback' : 'own' };
}

function git(cwd: string, args: string[]): string | null {
    const r = spawnSync('git', args, { cwd, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
    return r.status === 0 ? (r.stdout ?? '') : null;
}

/**
 * The session's own non-doc lines in `cwd`: the diff from `startHead` (the head
 * recorded at session start, or HEAD when none was) to the working tree,
 * restricted to `writes`. Null when git cannot answer.
 */
export function ownEditCount(cwd: string, startHead: string | null, writes: SessionWrites): OwnEditCount | null {
    const base = startHead !== null && git(cwd, ['cat-file', '-e', `${startHead}^{commit}`]) !== null ? startHead : 'HEAD';
    const numstat = git(cwd, ['diff', '--numstat', base]);
    if (numstat === null) return null;
    const untrackedOut = git(cwd, ['ls-files', '--others', '--exclude-standard']) ?? '';
    const untracked = new Map<string, number>();
    for (const p of untrackedOut.split('\n').map((l) => l.trim())) {
        if (p !== '' && writes.paths.has(p)) untracked.set(p, untrackedFileLineCount(cwd, p));
    }
    return countOwnLines(parseNumstat(numstat), untracked, writes);
}
