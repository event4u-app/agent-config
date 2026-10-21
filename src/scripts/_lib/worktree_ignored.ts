/**
 * Which ignored files a worktree removal would lose that a rebuild does not
 * restore. `git worktree remove` deletes ignored files without refusing, so
 * this is the check between a merged tree and a lost local `.env`.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

import { tryGit } from './worktree_git.js';

/**
 * Ignored paths that rebuild themselves. `git worktree remove` without
 * `--force` refuses a dirty tree but deletes ignored files without a word
 * (reproduced 2026-10-21), so a local `.env` would vanish with a merged tree.
 * A pattern counts as regenerable when it is one of these well-known build and
 * dependency outputs, or when the `.gitignore` comment block directly above the
 * matching pattern says the path is generated.
 */
export const REGENERABLE_IGNORED = [
    // Built in only where a path is never hand-edited: dependency trees the
    // package manager rebuilds from the lockfile, interpreter and tool caches,
    // and OS litter. `dist/`, `build/`, `vendor/`, `.venv/` are deliberately NOT
    // here — each can hold a patched dependency or an artefact someone kept
    // (council 2026-10-21, both seats). A repository that knows they are
    // generated says so in its own `.gitignore` comment, which this module reads.
    'node_modules',
    '__pycache__',
    '.pytest_cache',
    '.mypy_cache',
    '.ruff_cache',
    '.parcel-cache',
    '.turbo',
    '.cache',
    '.DS_Store',
] as const;

const GENERATED_COMMENT = /generat|build output|rebuilt by|projection|byproduct/i;

function isRegenerablePattern(pattern: string): boolean {
    const bare = pattern.replace(/^!/, '').replace(/^\/+/, '').replace(/\/+$/, '');
    const last = bare.split('/').pop() ?? bare;
    return (REGENERABLE_IGNORED as readonly string[]).includes(last) || /\.tsbuildinfo$|\.pyc$/.test(bare);
}

/** A pattern naming a secret or a local override is never regenerable, whatever its comment says. */
const NEVER_REGENERABLE = /\.env|secret|credential|token|\bkey|local|\.pem|\.p12|password/i;

/**
 * True when the comment group IMMEDIATELY above `line` (1-based) reads as
 * "generated". Another pattern line in between ends the search: a comment
 * vouches for the one pattern it sits on, never for a later rule appended
 * under it (`# generated` / `dist/` / `.env` must not cover `.env`).
 */
function commentSaysGenerated(lines: string[], line: number, pattern: string): boolean {
    if (NEVER_REGENERABLE.test(pattern)) return false;
    let i = line - 2;
    if (i < 0 || !lines[i]!.trim().startsWith('#')) return false;
    for (; i >= 0 && lines[i]!.trim().startsWith('#'); i--) {
        if (GENERATED_COMMENT.test(lines[i]!)) return true;
    }
    return false;
}

/**
 * Ignored paths in `worktreePath` that are NOT regenerable. Empty means losing
 * every ignored file with the tree costs nothing a rebuild would not restore.
 */
export function localOnlyIgnored(worktreePath: string, trunk: string | null = null): string[] {
    const status = tryGit(worktreePath, ['status', '--ignored=matching', '--porcelain']);
    if (status === null) return ['(ignored files could not be listed)'];
    const ignored = status
        .split('\n')
        .filter((l) => l.startsWith('!! '))
        .map((l) => l.slice(3));
    if (ignored.length === 0) return [];
    const verbose = tryGit(worktreePath, ['check-ignore', '-v', '--no-index', '--stdin'], ignored.join('\n'));
    const sourceOf = new Map<string, { file: string; line: number; pattern: string }>();
    for (const row of (verbose ?? '').split('\n')) {
        const m = /^(.*?):(\d+):(.*)\t(.+)$/.exec(row);
        if (m) sourceOf.set(m[4]!, { file: m[1]!, line: Number(m[2]), pattern: m[3]! });
    }
    const fileCache = new Map<string, string[]>();
    const readLines = (file: string): string[] => {
        const abs = path.isAbsolute(file) ? file : path.join(worktreePath, file);
        if (!fileCache.has(abs)) {
            try {
                fileCache.set(abs, fs.readFileSync(abs, 'utf-8').split('\n'));
            } catch {
                fileCache.set(abs, []);
            }
        }
        return fileCache.get(abs)!;
    };
    // The trunk's copy of the same ignore file speaks for an old branch too: a
    // repository that declares a path generated today should not have to wait
    // for every long-lived branch to pick the comment up.
    const trunkCache = new Map<string, string[]>();
    const trunkLines = (file: string): string[] => {
        if (trunk === null || path.isAbsolute(file)) return [];
        if (!trunkCache.has(file)) {
            const text = tryGit(worktreePath, ['show', `${trunk}:${file}`]);
            trunkCache.set(file, text === null ? [] : text.split('\n'));
        }
        return trunkCache.get(file)!;
    };
    return ignored.filter((p) => {
        const src = sourceOf.get(p);
        if (src === undefined) return true;
        if (isRegenerablePattern(src.pattern)) return false;
        if (commentSaysGenerated(readLines(src.file), src.line, src.pattern)) return false;
        const t = trunkLines(src.file);
        const idx = t.findIndex((l) => l.trim() === src.pattern.trim());
        return !(idx >= 0 && commentSaysGenerated(t, idx + 1, src.pattern));
    });
}
