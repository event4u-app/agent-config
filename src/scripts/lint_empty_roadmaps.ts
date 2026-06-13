#!/usr/bin/env node
/**
 * Hard-Gate linter: no empty roadmap files under `agents/roadmaps/`.
 *
 * TypeScript twin of `src/scripts/lint_empty_roadmaps.py` (ADR-094 migration).
 * Byte-identical CLI contract: same stdout, same exit codes (0 = clean,
 * 1 = at least one empty roadmap). `--quiet` is a bare argv membership check
 * (computed at import, NOT argparse), mirroring the Python original.
 *
 * A roadmap `.md` that is 0 bytes (or only whitespace) is never valid — it
 * carries no goal, no phases, no content. Scope: every `*.md` under
 * `agents/roadmaps/` (active, `archive/`, `skipped/`, `stubs/`, `later/`).
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

/** Mirror `QUIET = "--quiet" in sys.argv` (computed at import). */
const QUIET = process.argv.slice(2).includes('--quiet');

const ROADMAP_DIR = path.join('agents', 'roadmaps');

const _HERE = path.resolve(fileURLToPath(import.meta.url));

/** Walk up from CWD until a dir containing `agents/roadmaps` is found. */
function _repo_root(): string {
    const here = process.cwd();
    const chain = [here];
    let cur = here;
    while (true) {
        const parent = path.dirname(cur);
        if (parent === cur) break;
        chain.push(parent);
        cur = parent;
    }
    for (const candidate of chain) {
        try {
            if (fs.statSync(path.join(candidate, ROADMAP_DIR)).isDirectory()) {
                return candidate;
            }
        } catch {
            // not a dir / does not exist — keep walking
        }
    }
    return here;
}

/** `Path.is_dir()` following symlinks, never throwing. */
function _isDir(p: string): boolean {
    try {
        return fs.statSync(p).isDirectory();
    } catch {
        return false;
    }
}

/**
 * Mirror `sorted(base.rglob("*.md"))` — every descendant `*.md`, sorted by the
 * POSIX path-string key Python's `pathlib.Path` ordering uses (follows
 * directory symlinks, as `rglob` does).
 */
function _rglobMdSorted(base: string): string[] {
    const out: string[] = [];
    const walk = (dir: string): void => {
        let entries: fs.Dirent[];
        try {
            entries = fs.readdirSync(dir, { withFileTypes: true });
        } catch {
            return;
        }
        for (const ent of entries) {
            const full = path.join(dir, ent.name);
            if (ent.name.endsWith('.md')) {
                out.push(full);
            }
            if (ent.isDirectory() || (ent.isSymbolicLink() && _isDir(full))) {
                walk(full);
            }
        }
    };
    walk(base);
    return out.sort();
}

// Python `str.strip()` (no args) strips every character for which
// `str.isspace()` is true: ASCII whitespace + the C0 separators \x1c-\x1f +
// NEL \x85 + the Unicode whitespace set. Match that exact class so a
// "whitespace-only" file is detected identically to the Python original.
const _PY_WS = /[\t\n\v\f\r \u001c\u001d\u001e\u001f\u0085\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000]/g;

function _toPosix(target: string, root: string): string {
    return path.relative(root, target).split(path.sep).join('/');
}

function find_empty_roadmaps(root: string): string[] {
    const base = path.join(root, ROADMAP_DIR);
    if (!_isDir(base)) {
        return [];
    }
    const empties: string[] = [];
    for (const md of _rglobMdSorted(base)) {
        let text: string;
        try {
            text = fs.readFileSync(md, 'utf-8');
        } catch {
            // Unreadable / binary -> not an empty-text file; leave to other gates.
            continue;
        }
        if (text.replace(_PY_WS, '') === '') {
            empties.push(_toPosix(md, root));
        }
    }
    return empties;
}

function main(): number {
    const root = _repo_root();
    const empties = find_empty_roadmaps(root);

    if (empties.length === 0) {
        if (!QUIET) {
            console.log('✅  lint-empty-roadmaps: no empty roadmap files.');
        }
        return 0;
    }

    console.log('❌  lint-empty-roadmaps: empty (0-byte / whitespace-only) roadmap file(s):');
    for (const rel of empties) {
        console.log(`      ${rel}`);
    }
    console.log('');
    console.log('   A roadmap with no content is invalid. Either:');
    console.log('     • restore the intended content, or');
    console.log('     • delete the file (if its content lives in agents/roadmaps/archive/).');
    console.log('   Empty roadmap stubs are usually an artefact of an auto-commit that');
    console.log('   staged a 0-byte placeholder — remove it; do not commit it.');
    return 1;
}

const _isCliEntry =
    process.argv[1] !== undefined &&
    import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (_isCliEntry || process.argv[1] === _HERE) {
    process.exitCode = main();
}

export { QUIET, find_empty_roadmaps, main };
