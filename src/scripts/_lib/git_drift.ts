/**
 * Path drift against an anchor commit — shared by the memory-pointer report and
 * roadmap revalidation.
 *
 * The anchor means "the revision this text was verified against", so drift is a
 * re-verification prompt, never a staleness verdict: a file can change a hundred
 * times without touching the claim that cites it.
 */
import { spawnSync } from 'node:child_process';

import { gitEnv } from './git_env.js';

function git(root: string, args: readonly string[]): { ok: boolean; out: string } {
    const res = spawnSync('git', ['-C', root, ...args], { encoding: 'utf-8', env: gitEnv() });
    return { ok: res.status === 0 && typeof res.stdout === 'string', out: typeof res.stdout === 'string' ? res.stdout : '' };
}

/**
 * Cited paths that changed since the anchor, deletions included. Against HEAD by
 * default; `workingTree` also counts uncommitted edits, which is what a plan
 * about to be executed in this checkout has to see. Empty when the anchor does
 * not resolve; callers check `anchorResolves` first.
 */
export function driftedPaths(
    root: string,
    anchor: string,
    targets: readonly string[],
    opts: { workingTree?: boolean } = {},
): string[] {
    if (targets.length === 0) return [];
    const range = opts.workingTree === true ? [anchor] : [`${anchor}..HEAD`];
    const res = git(root, ['diff', '--name-only', ...range, '--', ...targets]);
    if (!res.ok) return [];
    return res.out.split('\n').map((s) => s.trim()).filter(Boolean).sort();
}

export function anchorResolves(root: string, anchor: string): boolean {
    return git(root, ['cat-file', '-e', `${anchor}^{commit}`]).ok;
}

/** Whether `rel` existed in the anchor commit's tree. */
export function existedAt(root: string, anchor: string, rel: string): boolean {
    return git(root, ['cat-file', '-e', `${anchor}:${rel}`]).ok;
}

export function headSha(root: string, short = 10): string | null {
    const res = git(root, ['rev-parse', `--short=${String(short)}`, 'HEAD']);
    return res.ok ? res.out.trim() : null;
}

/** The diff of `paths` since the anchor, cut to `maxLines`. */
export function diffSince(root: string, anchor: string, paths: readonly string[], maxLines = 120): string {
    if (paths.length === 0) return '';
    const res = git(root, ['diff', anchor, '--', ...paths]);
    if (!res.ok) return '';
    const lines = res.out.split('\n');
    return lines.length <= maxLines ? res.out : `${lines.slice(0, maxLines).join('\n')}\n… (${String(lines.length - maxLines)} more lines)`;
}
