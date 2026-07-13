#!/usr/bin/env tsx
/**
 * CI guard: council config lives in `.ai-council.yml`, never `.agent-settings.yml`.
 *
 * Ported from the retired Python `src/scripts/check_council_config_location.py` (ADR-200).
 * The original two checks keep their pinned CLI contract — `--quiet` flag,
 * exit codes (0 clean, 1 at least one violation), byte-identical finding
 * messages, same `SCAN_GLOBS` (sorted), same fence tracking, same negation /
 * `ai_council:` block detection, and the same `<!-- council-config-allowed -->`
 * escape pragma.
 *
 * Additive since ADR-104: a third check (§3 below) flags project-tree
 * *placement* of the council file. The original two checks are unchanged; the
 * path check runs over its own `PATH_CHECK_GLOBS` (the council surfaces + the
 * settings template + the `.ai-council.yml.example`) so the settings template's
 * many legitimate `.agent-settings.yml` self-references never trip check §1.
 *
 * Per ADR-104 (superseding ADR-093) the council reads a dedicated
 * `.ai-council.yml` resolved ALWAYS from the user-global location
 * (`~/.event4u/agent-config/settings/.ai-council.yml`) — the project tree
 * is never searched (the only escape is the explicit `$AI_COUNCIL_CONFIG`
 * path). Keys are top-level in that file; the legacy `ai_council.*` block
 * under `.agent-settings.yml` was removed in Phase 0.
 *
 * What it flags:
 *
 *   1. A `.agent-settings.yml` reference that is NOT negated — i.e. an
 *      instruction to read/use it for council config. Corrective mentions
 *      ("NOT in `.agent-settings.yml`", "was removed", "never read") carry a
 *      negation marker on the same line and are allowed. (SCAN_GLOBS)
 *   2. A bare `ai_council:` YAML parent-block declaration — post-ADR-093 the
 *      keys are top-level in `.ai-council.yml`; there is no `ai_council:`
 *      namespace to nest under. (SCAN_GLOBS)
 *   3. A project-tree PLACEMENT of the council file — `agents/.ai-council.yml`,
 *      `agents/settings/.ai-council.yml`, or a `<project_root>/…/.ai-council.yml`
 *      path — that is NOT negated. The council file is user-global ONLY
 *      (ADR-104); any project-tree path is drift. Corrective mentions ("is
 *      ignored", "never read", "no project-local", "superseded") pass on the
 *      same line. (PATH_CHECK_GLOBS)
 *
 * Escape hatch: a line carrying `<!-- council-config-allowed -->` is exempt
 * (for a legitimate non-council `.agent-settings.yml` reference, e.g.
 * `personal.autonomy`, or a historical placement mention in a section
 * explicitly marked superseded).
 *
 * Exit codes:
 *   0 — clean.
 *   1 — at least one violation; details printed to stdout.
 *
 * Invocation (from project root):
 *   tsx src/scripts/check_council_config_location.ts [--quiet]
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const QUIET = process.argv.includes('--quiet');

// Agent-facing surfaces where council config must resolve to `.ai-council.yml`.
// Globs are relative to the repo root; non-existent paths are skipped silently.
const SCAN_GLOBS = [
    'src/domains/meta/council/**/*.md',
    'src/domains/product-basic/roadmap/ai-council/**/*.md',
    'src/skills/ai-council/**/*.md',
    'docs/contracts/ai-council-config.md',
] as const;

const AGENT_SETTINGS_RE = /\.agent-settings\.yml/;
// A negation marker on the same line marks a corrective reference (allowed).
const NEGATION_RE = /\b(not|never|removed|no\s+longer|neither|instead)\b/i;
// A YAML parent-block declaration: `ai_council:` alone (optionally indented,
// optional trailing comment). Inline-code mentions like `under `ai_council:``
// do not match because the line does not START with the key.
const AI_COUNCIL_BLOCK_RE = /^\s*ai_council:\s*(#.*)?$/;
const ALLOW_PRAGMA = '<!-- council-config-allowed -->';

// ── §3 project-tree placement check (ADR-104) ──────────────────────
// The council file is user-global ONLY. These are the surfaces where a
// stray project-tree placement instruction does real damage — the council
// command/skill surfaces + contract (SCAN_GLOBS) PLUS the settings template
// and the copy-from example. The template carries countless legitimate
// `.agent-settings.yml` self-references, so it is scanned ONLY by §3, never
// by §1.
const PATH_CHECK_GLOBS = [
    ...SCAN_GLOBS,
    'src/config/agent-settings.template.yml',
    'agents/templates/.ai-council.yml.example',
] as const;

// A project-tree PLACEMENT of the council file: `agents/.ai-council.yml`,
// `agents/settings/.ai-council.yml`, or any `<project_root>/…/.ai-council.yml`.
// Deliberately does NOT match the user-global `…/agent-config/settings/
// .ai-council.yml` (no literal `agents/` segment) nor the copy-from
// `agents/templates/.ai-council.yml.example` (segment is `templates/`, and
// `.example` is not the config file).
const PROJECT_PATH_COUNCIL_RE =
    /(?:agents\/(?:settings\/)?\.ai-council\.yml(?!\.example)|<project[_-]?root>[^\n`]*\.ai-council\.yml)/;

// Broader negation set for §3 — corrective placement mentions use vocabulary
// the §1 NEGATION_RE does not cover ("is ignored", "no project-local
// lookup", "superseded"). A match on the same line marks the reference
// corrective and is allowed.
const PATH_NEGATION_RE =
    /\b(not|never|removed|no\s+longer|neither|instead|ignored|superseded|no\s+project-local|not\s+read|does\s+not\s+read)\b/i;

/**
 * Mirror Python `str.lstrip()` — strips all leading Unicode whitespace.
 * Python's `str.lstrip()` (no args) strips the Unicode whitespace class;
 * JS `\s` in a regex covers the same set for the characters that occur in
 * source files. Use a regex to match Python's behaviour precisely.
 */
function _lstrip(s: string): string {
    return s.replace(/^\s+/, '');
}

/**
 * Yield matching files in sorted, de-duplicated order. Mirrors the Python
 * generator: each glob's matches are sorted, files only, first-seen wins.
 *
 * Python `Path.glob` with `**` matches across directory boundaries and follows
 * the same sort (component-wise via Path comparison). We approximate with a
 * recursive walk per glob pattern, sorting POSIX paths.
 */
function* iter_files(
    root: string,
    globs: readonly string[] = SCAN_GLOBS,
): Generator<string> {
    const seen = new Set<string>();
    for (const pattern of globs) {
        for (const p of _glob(root, pattern)) {
            if (_isFile(p) && !seen.has(p)) {
                seen.add(p);
                yield p;
            }
        }
    }
}

function _isFile(p: string): boolean {
    try {
        return fs.statSync(p).isFile();
    } catch {
        return false;
    }
}

function _isDir(p: string): boolean {
    try {
        return fs.statSync(p).isDirectory();
    } catch {
        return false;
    }
}

/**
 * Resolve a glob relative to `root` and return absolute paths, sorted the way
 * Python's `sorted(Path.glob(...))` sorts — component-wise on the PosixPath.
 * Supports the two shapes used here: a literal path, and `<dir>/**\/*.md`.
 */
function _glob(root: string, pattern: string): string[] {
    // Literal (no glob magic) — direct existence check.
    if (!pattern.includes('*')) {
        const full = path.join(root, pattern);
        return _isFile(full) ? [full] : [];
    }
    // Shape: <prefix>/**/*.md  → recursive *.md under <prefix>.
    const marker = '/**/';
    const idx = pattern.indexOf(marker);
    if (idx === -1) {
        return [];
    }
    const prefix = pattern.slice(0, idx);
    const suffixGlob = pattern.slice(idx + marker.length); // e.g. "*.md"
    if (suffixGlob !== '*.md') {
        return [];
    }
    const base = path.join(root, prefix);
    if (!_isDir(base)) {
        return [];
    }
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
            if (ent.isDirectory()) {
                walk(full);
            } else if (ent.isFile() && ent.name.endsWith('.md')) {
                out.push(full);
            }
        }
    };
    walk(base);
    // Sort like Python's sorted() over PosixPath — component-wise. The POSIX
    // string form sorts equivalently for these repo-relative paths.
    out.sort(_pathSort);
    return out;
}

/** Component-wise path comparison matching PosixPath ordering. */
function _pathSort(a: string, b: string): number {
    const pa = a.split(path.sep);
    const pb = b.split(path.sep);
    const n = Math.min(pa.length, pb.length);
    for (let i = 0; i < n; i++) {
        if (pa[i] !== pb[i]) {
            return pa[i]! < pb[i]! ? -1 : 1;
        }
    }
    return pa.length - pb.length;
}

/** POSIX-style relative path (Path.relative_to(...).as_posix() / str()). */
function _relPosix(base: string, target: string): string {
    return path.relative(base, target).split(path.sep).join('/');
}

function find_violations(root: string): string[] {
    const findings: string[] = [];
    for (const p of iter_files(root)) {
        const rel = _relPosix(root, p);
        let in_fence = false;
        const lines = fs.readFileSync(p, 'utf-8').split('\n');
        // Python `.splitlines()` drops a trailing empty element when the text
        // ends with a newline; `.split('\n')` keeps it. Mirror splitlines by
        // dropping a single trailing '' produced by a final newline.
        if (lines.length > 0 && lines[lines.length - 1] === '') {
            lines.pop();
        }
        for (let i = 0; i < lines.length; i++) {
            const lineno = i + 1;
            const raw = lines[i]!;
            const stripped = _lstrip(raw);
            if (stripped.startsWith('```') || stripped.startsWith('~~~')) {
                in_fence = !in_fence;
                continue;
            }
            if (raw.includes(ALLOW_PRAGMA)) {
                continue;
            }
            if (AGENT_SETTINGS_RE.test(raw) && !NEGATION_RE.test(raw)) {
                findings.push(
                    `${rel}:${lineno}: council config referenced via ` +
                        '`.agent-settings.yml` without a negation marker — council ' +
                        'config lives in `.ai-council.yml` (ADR-093). Point at the ' +
                        'resolved `.ai-council.yml`, or add a negation / ' +
                        `\`${ALLOW_PRAGMA}\` if this is a non-council reference.`,
                );
            }
            if (AI_COUNCIL_BLOCK_RE.test(raw)) {
                const where = in_fence ? 'fenced YAML' : 'prose';
                findings.push(
                    `${rel}:${lineno}: \`ai_council:\` parent block (${where}) — ` +
                        'post-ADR-093 the keys are top-level in `.ai-council.yml` ' +
                        '(no `ai_council:` wrapper).',
                );
            }
        }
    }
    return findings;
}

/**
 * §3 — flag project-tree PLACEMENT of the council config file (ADR-104).
 *
 * The council file is user-global only; any `agents/(settings/)?.ai-council.yml`
 * or `<project_root>/…/.ai-council.yml` path is drift. Corrective mentions
 * (same-line `PATH_NEGATION_RE`) and the `<!-- council-config-allowed -->`
 * pragma pass. Fenced code is skipped, mirroring §1/§2.
 */
function find_path_violations(root: string): string[] {
    const findings: string[] = [];
    for (const p of iter_files(root, PATH_CHECK_GLOBS)) {
        const rel = _relPosix(root, p);
        let in_fence = false;
        const lines = fs.readFileSync(p, 'utf-8').split('\n');
        if (lines.length > 0 && lines[lines.length - 1] === '') {
            lines.pop();
        }
        for (let i = 0; i < lines.length; i++) {
            const lineno = i + 1;
            const raw = lines[i]!;
            const stripped = _lstrip(raw);
            if (stripped.startsWith('```') || stripped.startsWith('~~~')) {
                in_fence = !in_fence;
                continue;
            }
            if (in_fence || raw.includes(ALLOW_PRAGMA)) {
                continue;
            }
            // Corrective sentences often wrap, leaving the negation
            // ("never reads", "no project-local lookup") on the previous
            // line and the path on this one. Check both lines for negation
            // so a correctly-negated wrapped mention is not flagged. A real
            // "place it here" instruction never carries a negation one line up.
            const prev = i > 0 ? lines[i - 1]! : '';
            const negated =
                PATH_NEGATION_RE.test(raw) || PATH_NEGATION_RE.test(prev);
            if (PROJECT_PATH_COUNCIL_RE.test(raw) && !negated) {
                findings.push(
                    `${rel}:${lineno}: council config placed in the project tree ` +
                        '— the `.ai-council.yml` file is user-global ONLY ' +
                        '(`~/.event4u/agent-config/settings/.ai-council.yml`, ADR-104). ' +
                        'The project tree is never searched. Point at the user-global ' +
                        'path, add a negation marker, or add ' +
                        `\`${ALLOW_PRAGMA}\` for a historical/superseded reference.`,
                );
            }
        }
    }
    return findings;
}

function main(): number {
    const root = process.cwd();
    const findings = [...find_violations(root), ...find_path_violations(root)];
    if (findings.length) {
        process.stdout.write('❌  Council config-location violations:\n\n');
        for (const f of findings) {
            process.stdout.write(`  - ${f}\n`);
        }
        process.stdout.write(
            '\nRule: council config lives in the user-global `.ai-council.yml` ' +
                '(`~/.event4u/agent-config/settings/.ai-council.yml`, ADR-104) — ' +
                'never in `.agent-settings.yml`, never in a project `agents/` tree.\n',
        );
        return 1;
    }
    if (!QUIET) {
        process.stdout.write('✅  Council config-location clean.\n');
    }
    return 0;
}

const _HERE = fileURLToPath(import.meta.url);
function _isCliEntry(): boolean {
    if (process.argv[1] === undefined) {
        return false;
    }
    const argvUrl = pathToFileURL(path.resolve(process.argv[1])).href;
    if (import.meta.url === argvUrl) {
        return true;
    }
    // A symlinked invocation (e.g. via an installed `.augment/` projection,
    // or macOS /var → /private/var temp dirs) makes the raw URLs differ:
    // import.meta.url is the resolved real path while argv[1] keeps the
    // symlink path. Compare realpaths so the entry guard still fires
    // (without this the CLI silently no-ops when run through a symlink).
    try {
        const here = fs.realpathSync(fileURLToPath(import.meta.url));
        const argv = fs.realpathSync(path.resolve(process.argv[1]));
        return here === argv;
    } catch {
        return false;
    }
}

if (_isCliEntry() || process.argv[1] === _HERE) {
    process.exit(main());
}

export {
    SCAN_GLOBS,
    PATH_CHECK_GLOBS,
    AGENT_SETTINGS_RE,
    NEGATION_RE,
    AI_COUNCIL_BLOCK_RE,
    PROJECT_PATH_COUNCIL_RE,
    PATH_NEGATION_RE,
    ALLOW_PRAGMA,
    iter_files,
    find_violations,
    find_path_violations,
    main,
};
