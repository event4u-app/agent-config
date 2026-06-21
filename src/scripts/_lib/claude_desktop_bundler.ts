/**
 * Claude Desktop skill ZIP bundler (Phase 4 of event4u-namespace roadmap).
 *
 * TypeScript twin of `src/scripts/_lib/claude_desktop_bundler.py`
 * (ADR-200 py2ts Phase 2 / Wave 1).
 *
 * Claude Desktop has no filesystem convention for skills; the Customize →
 * Skills UI accepts a ZIP per skill via the Upload button. This module
 * walks `<package_root>/dist/agent-src/skills/*` and produces one
 * `<skill-name>.zip` per directory into `dest_dir`. It additionally
 * walks `<package_root>/dist/agent-src/commands/` and produces one
 * `<command-slug>.zip` per command `.md` file so Claude Desktop sees
 * the same surface that Claude Code exposes via the `.claude/skills/`
 * symlink wrapper layer.
 *
 * Contract:
 *
 * - Each ZIP contains `SKILL.md` plus every sibling file under the same
 *   directory (recursive). Symlinks are dereferenced so the ZIP is
 *   self-contained.
 * - Command bundles wrap a single `dist/agent-src/commands/<path>.md` file
 *   as `SKILL.md` inside the ZIP. Nested commands flatten to
 *   `<cluster>-<leaf>` slugs (e.g. `council/default.md` →
 *   `council-default.zip`) to mirror `condense.py`.
 * - Exclusions: `.git*`, `__pycache__`, `*.pyc` — matched on the
 *   basename of any path component.
 * - A skill folder without a `SKILL.md` is skipped (defensive: avoids
 *   shipping Claude-Code orchestrator stubs that don't follow the
 *   Anthropic skill schema).
 * - Command files named `AGENTS.md` are skipped (cluster authoring docs,
 *   not invocable commands).
 * - A command slug that collides with an existing skill name is skipped —
 *   the real skill bundle wins, matching `condense.generate_claude_commands`.
 * - Writes are atomic via tempfile → `fs.renameSync`.
 * - Idempotent: each ZIP gets a sibling `<slug>.sha256` recording
 *   the manifest digest. If the recomputed digest matches the recorded
 *   one, the existing ZIP is left untouched (unless `force=true`).
 */
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';

import { zip_write_sync } from './zip_min.js';

// Filenames or path components that are never included in a bundle.
const _EXCLUDED_BASENAMES: ReadonlySet<string> = new Set(['__pycache__', '.DS_Store']);
const _EXCLUDED_PREFIXES: readonly string[] = ['.git'];
const _EXCLUDED_SUFFIXES: readonly string[] = ['.pyc', '.pyo'];

/** A bundle member: absolute source path + relative-path components inside the ZIP. */
type FileEntry = readonly [abs_path: string, rel_parts: readonly string[]];

/** Return true if any component matches the exclusion lists. */
function _is_excluded(rel_parts: readonly string[]): boolean {
    for (const part of rel_parts) {
        if (_EXCLUDED_BASENAMES.has(part)) {
            return true;
        }
        if (_EXCLUDED_PREFIXES.some((prefix) => part.startsWith(prefix))) {
            return true;
        }
        if (_EXCLUDED_SUFFIXES.some((suffix) => part.endsWith(suffix))) {
            return true;
        }
    }
    return false;
}

/** Path.is_dir() semantics: follow symlinks, never throw (dangling → false). */
function _is_dir(p: string): boolean {
    try {
        return fs.statSync(p).isDirectory();
    } catch {
        return false;
    }
}

/** Compare rel_parts tuples like Python tuple-of-str ordering ('\0' < any path char). */
function _compare_rel_parts(a: readonly string[], b: readonly string[]): number {
    const ja = a.join('\u0000');
    const jb = b.join('\u0000');
    return ja < jb ? -1 : ja > jb ? 1 : 0;
}

/**
 * Return `[(abs_path, rel_parts), ...]` for every file in the skill.
 *
 * Symlinks are followed (mirrors `os.walk(..., followlinks=True)`) so a
 * bundle from a symlinked entry under `dist/agent-src/skills/` contains
 * the actual target content, not a dangling symlink.
 */
function _walk_skill_files(skill_dir: string): FileEntry[] {
    const out: Array<[string, string[]]> = [];
    const resolved = fs.realpathSync(skill_dir);

    const walk = (root: string, relRoot: readonly string[]): void => {
        const dirNames: string[] = [];
        const fileNames: string[] = [];
        for (const dirent of fs.readdirSync(root, { withFileTypes: true })) {
            const full = path.join(root, dirent.name);
            // followlinks=True: classify symlinks by their target type.
            const isDir = dirent.isDirectory() || (dirent.isSymbolicLink() && _is_dir(full));
            if (isDir) {
                dirNames.push(dirent.name);
            } else {
                fileNames.push(dirent.name);
            }
        }
        for (const fname of fileNames) {
            const rel_parts = [...relRoot, fname];
            if (_is_excluded(rel_parts)) {
                continue;
            }
            out.push([path.join(root, fname), rel_parts]);
        }
        // Prune excluded dirs so the walk skips them (os.walk dirs[:] mirror).
        for (const dname of dirNames) {
            if (_is_excluded([dname])) {
                continue;
            }
            walk(path.join(root, dname), [...relRoot, dname]);
        }
    };

    walk(resolved, []);
    out.sort((x, y) => _compare_rel_parts(x[1], y[1]));
    return out;
}

/**
 * Hash sorted (rel_path, content_sha256) pairs into one digest.
 *
 * Stable across runs as long as the input set + bytes are stable. Used
 * as the idempotency token written to `<skill>.sha256`.
 */
function _manifest_digest(files: Iterable<FileEntry>): string {
    const h = crypto.createHash('sha256');
    for (const [abs_path, rel_parts] of files) {
        const rel = rel_parts.join('/');
        h.update(Buffer.from(rel, 'utf-8'));
        h.update(Buffer.from([0]));
        h.update(crypto.createHash('sha256').update(fs.readFileSync(abs_path)).digest());
        h.update(Buffer.from([0]));
    }
    return h.digest('hex');
}

/** Write `files` into `zip_path` atomically (temp + rename). */
function _atomic_write_zip(zip_path: string, files: readonly FileEntry[]): void {
    fs.mkdirSync(path.dirname(zip_path), { recursive: true });
    const stem = path.basename(zip_path, path.extname(zip_path));
    const tmp_path = path.join(
        path.dirname(zip_path),
        `.${stem}.${crypto.randomBytes(6).toString('hex')}.zip.tmp`,
    );
    try {
        const entries = files.map(([abs_path, rel_parts]) => ({
            name: rel_parts.join('/'),
            data: fs.readFileSync(abs_path),
        }));
        fs.writeFileSync(tmp_path, zip_write_sync(entries));
        fs.renameSync(tmp_path, zip_path);
    } finally {
        if (fs.existsSync(tmp_path)) {
            fs.unlinkSync(tmp_path);
        }
    }
}

/** Shared digest-gated write step for skill + command bundles. */
function _write_if_changed(
    dest_dir: string,
    slug: string,
    files: readonly FileEntry[],
    force: boolean,
    written: string[],
): void {
    const digest = _manifest_digest(files);
    const zip_path = path.join(dest_dir, `${slug}.zip`);
    const digest_path = path.join(dest_dir, `${slug}.sha256`);
    const recorded = fs.existsSync(digest_path)
        ? fs.readFileSync(digest_path, 'utf-8').trim()
        : '';
    if (!force && recorded === digest && fs.existsSync(zip_path)) {
        return;
    }
    _atomic_write_zip(zip_path, files);
    fs.writeFileSync(digest_path, digest + '\n', 'utf-8');
    written.push(zip_path);
}

/**
 * Build per-skill ZIPs under `dest_dir`.
 *
 * Returns the list of ZIP paths that were (re-)written this call. ZIPs
 * skipped because their content digest matched the existing sidecar
 * are not in the returned list (but remain on disk).
 *
 * `curation` optionally restricts the build to the given skill
 * names; `null` bundles every skill folder containing `SKILL.md`.
 */
export function build_skill_bundles(
    package_root: string,
    dest_dir: string,
    force = false,
    curation: readonly string[] | null = null,
): string[] {
    const skills_root = path.join(package_root, 'dist/agent-src', 'skills');
    if (!_is_dir(skills_root)) {
        return [];
    }
    fs.mkdirSync(dest_dir, { recursive: true });
    const written: string[] = [];
    for (const name of fs.readdirSync(skills_root).sort()) {
        const entry = path.join(skills_root, name);
        const isSymlink = fs.lstatSync(entry).isSymbolicLink();
        if (!(_is_dir(entry) || isSymlink)) {
            continue;
        }
        const skill_name = name;
        if (curation !== null && !curation.includes(skill_name)) {
            continue;
        }
        const skill_md = path.join(entry, 'SKILL.md');
        if (!fs.existsSync(skill_md)) {
            continue;
        }
        const files = _walk_skill_files(entry);
        if (files.length === 0) {
            continue;
        }
        _write_if_changed(dest_dir, skill_name, files, force, written);
    }
    return written;
}

/**
 * Return the flat slug for a command source file.
 *
 * Mirrors `scripts/condense.py::_command_slug`: top-level commands
 * keep their stem (`commit.md` → `commit`); nested commands flatten
 * the relative path with `-` (`council/default.md` →
 * `council-default`).
 */
function _command_slug(source_file: string, commands_root: string): string {
    const rel = path.relative(commands_root, source_file);
    const noExt = rel.slice(0, rel.length - path.extname(rel).length);
    return noExt.split(path.sep).join('-');
}

/**
 * Yield every command `.md` file under `commands_root` (recursive).
 *
 * Skips `AGENTS.md` cluster authoring docs, matching
 * `scripts/condense.py::_iter_commands`.
 */
function _iter_command_files(commands_root: string): string[] {
    const found: string[] = [];
    const walk = (dir: string): void => {
        for (const dirent of fs.readdirSync(dir, { withFileTypes: true })) {
            const full = path.join(dir, dirent.name);
            if (dirent.isDirectory() || (dirent.isSymbolicLink() && _is_dir(full))) {
                walk(full);
            } else if (dirent.name.endsWith('.md')) {
                found.push(full);
            }
        }
    };
    walk(commands_root);
    found.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    return found.filter((source_file) => path.basename(source_file) !== 'AGENTS.md');
}

/**
 * Build per-command ZIPs under `dest_dir`.
 *
 * Each ZIP contains a single `SKILL.md` whose bytes are the source
 * command `.md` file — same wrapping pattern that
 * `condense.generate_claude_commands` uses for Claude Code via
 * `.claude/skills/<slug>/SKILL.md` symlinks.
 *
 * Slugs that collide with an existing skill folder under
 * `<package_root>/dist/agent-src/skills/` are skipped so the real skill
 * bundle wins.
 *
 * Returns the list of ZIP paths that were (re-)written this call. ZIPs
 * skipped because their content digest matched the existing sidecar
 * are not in the returned list (but remain on disk).
 *
 * `curation` optionally restricts the build to the given command
 * slugs; `null` bundles every command file.
 */
export function build_command_bundles(
    package_root: string,
    dest_dir: string,
    force = false,
    curation: readonly string[] | null = null,
): string[] {
    const commands_root = path.join(package_root, 'dist/agent-src', 'commands');
    if (!_is_dir(commands_root)) {
        return [];
    }
    const skills_root = path.join(package_root, 'dist/agent-src', 'skills');
    let skill_names: Set<string> = new Set();
    if (_is_dir(skills_root)) {
        skill_names = new Set(
            fs.readdirSync(skills_root).filter((name) => _is_dir(path.join(skills_root, name))),
        );
    }
    fs.mkdirSync(dest_dir, { recursive: true });
    const written: string[] = [];
    for (const source_file of _iter_command_files(commands_root)) {
        const slug = _command_slug(source_file, commands_root);
        if (skill_names.has(slug)) {
            continue;
        }
        if (curation !== null && !curation.includes(slug)) {
            continue;
        }
        const files: FileEntry[] = [[fs.realpathSync(source_file), ['SKILL.md']]];
        _write_if_changed(dest_dir, slug, files, force, written);
    }
    return written;
}
