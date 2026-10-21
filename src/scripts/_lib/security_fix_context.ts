/**
 * Reads the facts the routing table needs from the repository and, where the
 * user's own `gh` login reaches it, the forge. Kept apart from
 * `security_fix.ts` so the table stays pure and the hook bundle never holds a
 * process call.
 */

import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';

import type { Finding } from './advisory_verdicts.js';
import type { RoutingContext } from './security_fix.js';

export type Exec = (cmd: string, args: string[], cwd: string) => string | null;

export const defaultExec: Exec = (cmd, args, cwd) => {
    try {
        return execFileSync(cmd, args, { cwd, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 15000 });
    } catch {
        return null;
    }
};

function trunkRef(root: string, exec: Exec): string | null {
    for (const ref of ['refs/remotes/origin/main', 'refs/remotes/origin/master', 'refs/heads/main', 'refs/heads/master']) {
        if (exec('git', ['rev-parse', '--verify', '--quiet', ref], root) !== null) return ref;
    }
    return null;
}

/** The project publishes releases: an npm package that is not private, or a Composer library. */
export function isLibrary(root: string): boolean {
    try {
        const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf-8')) as Record<string, unknown>;
        if (pkg['private'] !== true && typeof pkg['name'] === 'string' && typeof pkg['version'] === 'string' && (pkg['main'] !== undefined || pkg['exports'] !== undefined || pkg['bin'] !== undefined)) {
            return true;
        }
    } catch {
        /* no package.json */
    }
    try {
        const c = JSON.parse(fs.readFileSync(path.join(root, 'composer.json'), 'utf-8')) as Record<string, unknown>;
        if (c['type'] === 'library') return true;
    } catch {
        /* no composer.json */
    }
    return false;
}

export function readRoutingContext(root: string, f: Finding, opts: { exec?: Exec; userWantsCurrent?: boolean } = {}): RoutingContext {
    const exec = opts.exec ?? defaultExec;
    const trunk = trunkRef(root, exec);
    const head = exec('git', ['rev-parse', 'HEAD'], root)?.trim() ?? null;
    const branch = exec('git', ['symbolic-ref', '-q', '--short', 'HEAD'], root)?.trim() ?? null;
    const trunkSha = trunk === null ? null : (exec('git', ['rev-parse', trunk], root)?.trim() ?? null);
    const trunkShort = trunk === null ? null : trunk.replace(/^refs\/(remotes\/origin|heads)\//, '');
    const onTrunk = branch === trunkShort || (branch === null && head !== null && head === trunkSha);
    const clean = (exec('git', ['--no-optional-locks', 'status', '--porcelain'], root) ?? 'x').trim() === '';

    let branchTouchesFile = false;
    let branchIntroducedDependency = false;
    if (!onTrunk && trunk !== null && f.file !== '') {
        const base = exec('git', ['merge-base', trunk, 'HEAD'], root)?.trim() ?? null;
        if (base !== null) {
            const changed = (exec('git', ['diff', '--name-only', base], root) ?? '').split('\n');
            branchTouchesFile = changed.includes(f.file);
            const atBase = exec('git', ['show', `${base}:${f.file}`], root);
            const now = (() => {
                try {
                    return fs.readFileSync(path.join(root, f.file), 'utf-8');
                } catch {
                    return null;
                }
            })();
            const needle = `"${f.package}"`;
            const inLock = (t: string | null): boolean => t !== null && (t.includes(`node_modules/${f.package}"`) || t.includes(`"name": ${needle}`) || t.includes(needle));
            branchIntroducedDependency = atBase !== null ? !inLock(atBase) && inLock(now) : inLock(now);
        }
    }

    let openBotPr: number | null = null;
    const prs = exec('gh', ['pr', 'list', '--state', 'open', '--search', `${f.package} in:title`, '--json', 'number,author'], root);
    if (prs !== null) {
        try {
            const list = JSON.parse(prs) as Array<{ number?: number; author?: { login?: string } }>;
            const bot = list.find((p) => /dependabot|renovate/i.test(p.author?.login ?? ''));
            if (bot && typeof bot.number === 'number') openBotPr = bot.number;
        } catch {
            /* unreadable list: no bot PR is known, which is the conservative reading */
        }
    }

    return {
        onTrunk,
        clean,
        branchTouchesFile,
        branchIntroducedDependency,
        userWantsCurrent: opts.userWantsCurrent === true,
        openBotPr,
        isLibrary: isLibrary(root),
        isRuntime: f.ecosystem === 'runtime',
    };
}
