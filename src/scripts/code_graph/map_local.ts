/**
 * Keeps the local parts of a committed map folder local in every repository
 * that already uses it, without waiting for the root ignore block to update:
 * the folder carries its own `.gitignore` for `index.html` and `.build/`, and a
 * viewer page an older release left tracked is removed from the index
 * (`git rm --cached`; the file stays on disk). The removal is staged, never
 * committed, and is skipped while a merge, rebase, cherry-pick or revert is in
 * progress, so it lands in the user's next ordinary commit.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

import { writeContained } from '../_lib/contained_write.js';
import { gitProbe } from '../_lib/spawn_env.js';
import { stampViewer } from './map_stored.js';

export const MAP_IGNORE_LINES = ['/index.html', '/.build/'] as const;

const MAP_IGNORE_HEADER = '# Written by agent-config: the viewer page and the build folder are local; index.html is rendered from the committed map data.';

/** Git states in which staging a removal would mix into an operation the user is in the middle of. */
const BUSY = ['MERGE_HEAD', 'CHERRY_PICK_HEAD', 'REVERT_HEAD', 'rebase-merge', 'rebase-apply'] as const;

export type LocalOutcome = { ignore: 'written' | 'present' | 'skipped'; untracked: boolean };

function toplevel(dir: string): string | null {
    try {
        return fs.realpathSync(gitProbe(dir, ['rev-parse', '--show-toplevel']).trim());
    } catch {
        return null;
    }
}

function busy(top: string): boolean {
    return BUSY.some((name) => {
        try {
            const p = gitProbe(top, ['rev-parse', '--git-path', name]).trim();
            return fs.existsSync(path.isAbsolute(p) ? p : path.join(top, p));
        } catch {
            return true;
        }
    });
}

/** The map folder's own `.gitignore`, with any line it lacks appended; the user's own lines stay. */
function ensureIgnore(top: string, mapDir: string): LocalOutcome['ignore'] {
    const file = path.join(mapDir, '.gitignore');
    let current = '';
    try {
        current = fs.readFileSync(file, 'utf-8');
    } catch {
        /* none yet */
    }
    const have = new Set(current.split('\n').map((l) => l.trim()));
    const missing = MAP_IGNORE_LINES.filter((l) => !have.has(l));
    if (missing.length === 0) return 'present';
    const head = current === '' ? `${MAP_IGNORE_HEADER}\n` : current.endsWith('\n') ? current : `${current}\n`;
    return writeContained(top, file, `${head}${missing.join('\n')}\n`) ? 'written' : 'skipped';
}

/**
 * Make `mapDir` keep its viewer page and build folder out of git, in the
 * repository it sits in. A folder outside any work tree (the user-global hub)
 * is left alone. Never throws.
 */
export function keepMapLocal(mapDir: string): LocalOutcome {
    const out: LocalOutcome = { ignore: 'skipped', untracked: false };
    try {
        if (!fs.existsSync(mapDir)) return out;
        const top = toplevel(mapDir);
        const real = fs.realpathSync(mapDir);
        if (top === null || (real !== top && !real.startsWith(`${top}${path.sep}`))) return out;
        out.ignore = ensureIgnore(top, real);
        const rel = path.relative(top, path.join(real, 'index.html')).split(path.sep).join('/');
        let tracked = false;
        try {
            tracked = gitProbe(top, ['ls-files', '--', rel]).trim() !== '';
        } catch {
            tracked = false;
        }
        if (tracked && !busy(top)) {
            try {
                gitProbe(top, ['rm', '--cached', '--quiet', '--', rel]);
                out.untracked = true;
            } catch {
                /* the index is locked or the staged page differs; the next run tries again */
            }
        }
    } catch {
        /* upkeep never fails the refresh it rides on */
    }
    return out;
}

/** After a redraw: record the page's source data and keep the folder's local parts local. */
export function keepViewerLocal(mapDir: string): void {
    stampViewer(mapDir);
    keepMapLocal(mapDir);
}
