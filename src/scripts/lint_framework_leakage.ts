#!/usr/bin/env tsx
// Lint generic skills/rules/commands for framework/language leakage.
//
// TypeScript port of the retired Python src/scripts/lint_framework_leakage.py. Exits 1 on hit
// (CI-blocking). Enforces the framework-neutrality rule. Replicates the
// carve-out filename exemption, inventory exemption, framework-frontmatter
// exemption, the auto cross-stack ±10-line window heuristic, the allowlist
// (logical-path matching via strip_source_prefix), JSON/quiet modes, the
// path-does-not-exist exit(2), and the `_`-prefixed-file skip.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { artefact_roots, strip_source_prefix } from './_lib/agent_src.js';
import { GateLedger } from './_lib/gate_ledger.js';
import { runGateCli, runSelfTest } from './_lib/gate_self_test.js';

const SCRIPTS_DIR = path.dirname(fileURLToPath(import.meta.url));
const REAL_REPO_ROOT = path.dirname(path.dirname(SCRIPTS_DIR));

// Mutable test-overridable state (mirrors the pytest monkeypatch of
// `mod.REPO_ROOT` and `mod.ALLOWLIST_FILE`).
let REPO_ROOT = REAL_REPO_ROOT;
let ALLOWLIST_FILE = path.join(REAL_REPO_ROOT, 'src/scripts/lint_framework_leakage_allowlist.json');

export function _setReposForTest(opts: { repoRoot?: string; allowlistFile?: string }): void {
    if (opts.repoRoot !== undefined) {
        REPO_ROOT = opts.repoRoot;
    }
    if (opts.allowlistFile !== undefined) {
        ALLOWLIST_FILE = opts.allowlistFile;
    }
}

export function _resetReposForTest(): void {
    REPO_ROOT = REAL_REPO_ROOT;
    ALLOWLIST_FILE = path.join(
        REAL_REPO_ROOT,
        'src/scripts/lint_framework_leakage_allowlist.json',
    );
}

const _SUBDIRS = ['skills', 'rules', 'commands'] as const;

function _exists(p: string): boolean {
    try {
        fs.statSync(p);
        return true;
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

function _isFile(p: string): boolean {
    try {
        return fs.statSync(p).isFile();
    } catch {
        return false;
    }
}

function toPosix(p: string): string {
    return p.split(path.sep).join('/');
}

function relToRepo(p: string): string {
    return toPosix(path.relative(REPO_ROOT, p));
}

function _default_paths(): string[] {
    const out: string[] = [];
    for (const root of artefact_roots()) {
        // root.relative_to(REPO_ROOT); skip on ValueError (not under repo).
        const rel = path.relative(REPO_ROOT, root);
        if (rel.startsWith('..') || path.isAbsolute(rel)) {
            continue;
        }
        for (const sub of _SUBDIRS) {
            const target = path.join(root, sub);
            if (_isDir(target)) {
                out.push(toPosix(path.join(rel, sub)));
            }
        }
    }
    return out;
}

const CARVE_OUT_PATTERNS = [
    'laravel', '^php-', '^eloquent', '^blade', '^livewire', '^flux',
    '^pest-', '^artisan-', '^composer-', '^jobs-events$', '^symfony',
    '^nextjs', '^react-', '^async-python', '^openapi$', '^quality-tools',
    '^sql-writing', '^tailwind', '^terraform', '^terragrunt', '^traefik',
    '^mobile-e2e',
    '^project-analysis-(laravel|symfony|nextjs|react|node-express|zend-laminas)',
    '^docker', '^aws-', '^grafana', '^playwright',
    // JS/TS workspace tooling. Same class as `^composer-` one line up: a skill
    // ABOUT a package manager cannot describe it without naming its manifest.
    // `package.json` / `node_modules` in these two files is the subject, not a
    // mandate that some unrelated project adopt Node.
    '^monorepo-workspace$', '^workspace-link$',
    '^laravel-', '^docker-', '^symfony-', '^copilot-', '^devcontainer',
    '-routing$',
];
const CARVE_OUT_RE = new RegExp(CARVE_OUT_PATTERNS.join('|'), 'i');

// Insertion order is significant — JS object literals preserve string-key
// insertion order, matching Python dict iteration order.
const LEAKAGE: Record<string, string[]> = {
    Laravel: [
        '\\bLaravel\\b', '\\bEloquent\\b', '\\bArtisan\\b', '\\bFormRequest\\b',
        '\\bForm Request\\b', '\\bBlade\\b(?! Runner)', '\\bLivewire\\b',
        '\\bResource::(make|collection)\\b', '\\bModel::\\b',
        '\\bapp/Http/', '\\broutes/(api|web)\\.php',
        '\\bdatabase/(migrations|seeders|factories)\\b',
        '\\bphp artisan\\b', '\\bIlluminate\\\\\\\\', '\\bIlluminate\\\\',
        '\\bbootstrap/app\\.php',
    ],
    PHP: [
        '\\bPHPStan\\b', '\\bPest\\b(?! Control)', '\\bPHPUnit\\b', '\\bRector\\b',
        '\\bECS\\b', '\\bcomposer\\.json\\b', '\\bvendor/bin/',
        '\\bdeclare\\(strict_types=1\\)', '\\.php\\b',
        '\\bnamespace App\\\\\\\\', '\\bnamespace App\\\\',
        '\\bcomposer (require|install|update|dump-autoload)\\b',
    ],
    Symfony: [
        '\\bSymfony\\b', '\\bbin/console\\b', '\\bDoctrine\\b', '\\bTwig\\b',
    ],
    'JS-specific': [
        '\\bpackage\\.json\\b',
        '\\bnpm (install|run|test|ci|update|audit|exec)\\b',
        '\\byarn (install|add|test)\\b',
        '\\bpnpm (install|add|run|test)\\b',
        '\\bnode_modules\\b',
    ],
    'Python-specific': [
        '\\bpyproject\\.toml\\b', '\\brequirements\\.txt\\b',
        '\\bpip install\\b', '\\bpytest\\b',
    ],
};

const FAMILY: Record<string, string> = {
    Laravel: 'php', PHP: 'php', Symfony: 'php',
    'JS-specific': 'js', 'Python-specific': 'python',
};

const CROSS_STACK_HINTS: Record<string, string[]> = {
    ruby: ['\\bRails\\b', '\\bbin/rails\\b', '\\bGemfile\\b', '\\bbundle exec\\b'],
    python: ['\\bDjango\\b', '\\bFastAPI\\b', '\\bFlask\\b', '\\bpoetry\\b',
        '\\buv (add|sync|run|pip)\\b', '\\bvenv\\b', '\\bPydantic\\b', '\\bJinja\\b',
        'docs\\.python\\.org', '\\bPython\\b'],
    node: ['\\bExpress\\b', '\\bNext\\.?js\\b', '\\bNode\\.?js\\b', '\\bnpx\\b',
        '\\bvitest\\b', '\\bjest\\b', '\\beslint\\b', '\\bprettier\\b',
        '\\bReact\\b', '\\bVue\\b', '\\bNestJS\\b', '\\bTypeScript\\b',
        '\\btsc\\b', '\\bzod\\b', '\\bPrisma\\b', '\\bTailwind\\b',
        '\\bTurborepo\\b', '\\bclass-validator\\b', '\\bInertia\\b',
        '\\bJSX\\b', '\\bNx\\b',
        '\\.tsx?\\b', 'typescriptlang\\.org', '\\bTS\\b', '\\bJS\\b'],
    go: ['\\bgo (test|build|run|mod)\\b', '\\bgolangci-lint\\b', '\\bGoLand\\b',
        '\\bGolang\\b', '\\bgo\\.dev\\b'],
    rust: ['\\bcargo (test|build|run|check|fmt|clippy|add|update)\\b',
        '\\bClippy\\b', '\\brustfmt\\b', '\\bCargo\\.toml\\b',
        'rust-lang\\.org', '\\bRust\\b'],
    dotnet: ['\\bdotnet (test|build|run|add|restore)\\b', '\\b\\.NET\\b'],
    java: ['\\bSpring\\b', '\\bmvn (test|clean|install|package)\\b',
        '\\bgradle\\b', '\\bMaven\\b'],
    // Additional hint vocabulary for the PHP family — the LEAKAGE patterns
    // are hit patterns; these are window-only hints so a JS/Python hit next
    // to plain-language PHP mentions self-suppresses as cross-stack docs.
    php: ['\\bvendor/', '\\bPHP\\b'],
    // Bare LANGUAGE names (Python / Rust / TS / JS above) are the same class of
    // window-only hint the `php` family already had, and their absence was an
    // asymmetry, not a policy: a checklist row naming "PHP typed properties +
    // declare(strict_types=1), TS strict, Python type hints, Go / Rust" — five
    // ecosystems on ONE line, the rule's textbook "multi-stack peers" case —
    // matched the PHP hit pattern and found no cross-stack hint, because only
    // PHP had a plain-language entry. So the linter flagged the exact shape
    // framework-neutrality documents as allowed.
    //
    // `\bGo\b` is deliberately NOT added. These hints SUPPRESS, so an
    // over-broad one hides real leakage — and "go to" / "go ahead" would fire
    // constantly in prose. Golang / `go test|build|run|mod` / go.dev stay the
    // Go signals; a Go-only line with none of those is not self-evidently
    // cross-stack anyway.
    // Polyglot-runner pseudo-family: a Taskfile/Makefile mention marks the
    // window as multi-stack tooling documentation (runner files are
    // ecosystem-neutral by definition).
    'polyglot-runner': ['\\bTaskfile(\\.ya?ml)?\\b', '\\bMakefile\\b'],
};
// Case-insensitive on purpose (fix G2): "Prettier" / "ESLint" in prose are
// the same hint as their lowercase binary names.
const CROSS_STACK_RE: Record<string, RegExp> = Object.fromEntries(
    Object.entries(CROSS_STACK_HINTS).map(([fam, pats]) => [fam, new RegExp(pats.join('|'), 'i')]),
);

// Framework-name pair rule (fix G3): Laravel and Symfony share the `php`
// family, so a genuine Laravel-vs-Symfony comparison never counted as
// cross-stack. Two DISTINCT framework names in the window are documentation
// of alternatives, not a mandate.
const FRAMEWORK_NAMES: readonly string[] = [
    'Laravel', 'Symfony', 'Django', 'Rails', 'NestJS', 'Next\\.js', 'Spring',
    'Flask', 'FastAPI',
];
const FRAMEWORK_NAME_RES: readonly RegExp[] = FRAMEWORK_NAMES.map(
    (n) => new RegExp(`\\b${n}\\b`),
);

// Carve-out-pointer suppression (fix G6): the neutrality rule's own
// "Allowed: carve-out pointers" shape — a handoff line linking to a
// framework-specific artifact, or the sanctioned `→ ` pointer prefix.
const POINTER_LINK_RE = /\]\((?:\.\.\/)+([a-z0-9-]+)\//;
function _is_carve_out_pointer_line(line: string): boolean {
    const trimmed = line.trimStart();
    if (trimmed.startsWith('→ ') || trimmed.startsWith('→')) {
        return true;
    }
    const m = POINTER_LINK_RE.exec(line);
    return m !== null && CARVE_OUT_RE.test(m[1] as string);
}

// Sanctioned single-stack annotation (fix G5): the corpus-wide
// "(Laravel shape: …)" / "Laravel example:" marker on a generic mechanism
// (road-to-configurable-modules Phase D decision).
const SHAPE_EXAMPLE_RE =
    /\((?:Laravel|Symfony|Django|Rails|Next\.js)[^)]*\b(?:shape|example)\b|\b(?:Laravel|Symfony|Django|Rails) (?:shape|example):/i;

/**
 * Real frontmatter only — the block that OPENS the file, not any `---` fence.
 *
 * This carried `/m` with no start-of-file guard, the only such parser in the
 * suite (every sibling anchors at index 0). With `/m`, a file that has no
 * leading frontmatter latched onto the first `---`-delimited span anywhere in
 * its body — and since a non-null match makes the caller `continue`, the whole
 * file was then exempted from leakage scanning. What collides with it is the
 * house convention of quoting a `---`-fenced frontmatter EXAMPLE in prose: one
 * such example carrying a `framework:` line silently disarms the gate for that
 * file (road-to-gates-that-can-fail Phase 6.2, finding 4).
 */
const FRONTMATTER_FRAMEWORK_RE = /^---[ \t]*\n([\s\S]*?)\n---/;
const FRAMEWORK_KEY_RE = /^(?:framework|\s+framework)\s*:\s*(\S+)/m;

export function is_carve_out(p: string): boolean {
    for (const part of p.split(path.sep)) {
        const stem = part.endsWith('.md') ? part.slice(0, -3) : part;
        if (CARVE_OUT_RE.test(stem)) {
            return true;
        }
    }
    return false;
}

export function is_inventory_file(p: string): boolean {
    const rel = path.relative(REPO_ROOT, p);
    if (rel.startsWith('..') || path.isAbsolute(rel)) {
        return false;
    }
    const parts = toPosix(rel).split('/');
    if (parts.includes('contexts')) {
        return true;
    }
    // DEAD-ROOT REPAIR (road-to-renewal-foundation Phase 1). Both comparisons
    // were unreachable: `.agent-src.uncondensed` was deleted by ADR-051, and
    // `'dist/agent-src'` can never equal a single `/`-split segment. So the
    // inventory-README exemption never fired for any file, and the real
    // inventory file (`src/agent-src/README.md`) got no exemption at all.
    if (path.basename(rel) === 'README.md' && parts.length === 3 && parts[0] === 'src') {
        return true;
    }
    return false;
}

export function has_framework_frontmatter(p: string): string | null {
    let text: string;
    try {
        text = fs.readFileSync(p, 'utf-8');
    } catch {
        return null;
    }
    const m = FRONTMATTER_FRAMEWORK_RE.exec(text);
    if (!m || m[1] === undefined) {
        return null;
    }
    const fm = m[1];
    const key = FRAMEWORK_KEY_RE.exec(fm);
    if (key && key[1] !== undefined) {
        let val = key[1].trim();
        val = val.replace(/^"+|"+$/g, '').replace(/^'+|'+$/g, '');
        if (val && !['none', 'null', '~', ''].includes(val.toLowerCase())) {
            return val;
        }
    }
    return null;
}

interface AllowlistEntry {
    file?: string;
    lines?: number[] | '*';
    /**
     * Content anchor — a substring of the exempted line. The only per-line key.
     *
     * Position keying (`lines: [100]`) is retired, not merely discouraged.
     * Inserting a paragraph above line 100 re-fires the ratchet on an entry
     * nobody touched — recorded twice in one pull request — and, worse, it rots
     * in silence: the migration that introduced this comment found three shipped
     * entries that had stopped exempting anything, one naming line 100 of a
     * 68-line file and two naming blank lines. Nothing reported it, because a
     * drifted position key still parses.
     *
     * An anchor keys the exemption to the content being exempted, so it survives
     * the edit that moves it and fails loudly when that content is gone.
     * `validate_allowlist` additionally requires it to match exactly one line:
     * `includes` is file-scoped, so a too-short anchor would silently exempt a
     * second line nobody reviewed.
     */
    anchor?: string;
    reason?: string;
    falsifier?: string;
}
interface Allowlist {
    entries: AllowlistEntry[];
}

function _load_allowlist(): Allowlist {
    if (!_isFile(ALLOWLIST_FILE)) {
        return { entries: [] };
    }
    try {
        const data = JSON.parse(fs.readFileSync(ALLOWLIST_FILE, 'utf-8'));
        return data as Allowlist;
    } catch {
        return { entries: [] };
    }
}

/**
 * Every allowlist entry must still exempt something, and exactly one thing.
 *
 * A position-keyed entry rots in silence: the line it names drifts, the entry
 * keeps parsing, and nothing reports that an exemption stopped exempting. This
 * repository shipped three such entries — one naming line 100 of a 68-line file,
 * two naming blank lines — and the rot was invisible until the whole set was read
 * at once. An anchor cannot drift, but it can over-reach: `includes` is
 * file-scoped, so an anchor occurring twice silently exempts a second line nobody
 * reviewed.
 *
 * Both failures are decidable from the file, so they are checked rather than
 * trusted. `lines: '*'` stays legal — a deliberate whole-file exemption is a
 * different thing from a position key, and it cannot drift.
 */
/**
 * The exact text `_allowlisted` compares an anchor against.
 *
 * The matcher sees `Hit.snippet`, not the raw line — trimmed and cut at 160
 * chars. A validator reading the raw line would clear an anchor copied with its
 * indentation, or drawn from past column 160, and the gate would then fail to
 * suppress a hit the maintainer was told is exempt. One function, both callers.
 */
export function anchor_haystack(line: string): string {
    return line.trim().slice(0, 160);
}

export function validate_allowlist(allowlist: Allowlist, repo_root?: string): string[] {
    // Default to the MUTABLE root, not the real one: the scan resolves entry
    // paths against `REPO_ROOT`, and a validator resolving them anywhere else
    // would report every entry missing the moment a caller redirects the tree.
    const root = repo_root ?? REPO_ROOT;
    const problems: string[] = [];
    for (const entry of allowlist.entries ?? []) {
        const file = entry.file;
        if (typeof file !== 'string' || file === '') {
            problems.push('entry without a `file`');
            continue;
        }
        if (Array.isArray(entry.lines)) {
            problems.push(
                `${file}: position-keyed (\`lines: [${entry.lines.join(', ')}]\`) — ` +
                    'use `anchor` with a substring of the exempted line; a line number ' +
                    'drifts out from under its own exemption on any edit above it',
            );
            continue;
        }
        if (entry.lines === '*') {
            // A whole-file exemption never consults the anchor, so validating one
            // here would stop every scan for a field the matcher does not read.
            continue;
        }
        const anchor = entry.anchor;
        if (typeof anchor !== 'string' || anchor === '') {
            problems.push(`${file}: neither an \`anchor\` nor \`lines: "*"\``);
            continue;
        }
        const abs = path.join(root, file);
        if (!_isFile(abs)) {
            problems.push(`${file}: anchored entry names a file that does not exist`);
            continue;
        }
        const matches = fs
            .readFileSync(abs, 'utf-8')
            .split('\n')
            .filter((l) => anchor_haystack(l).includes(anchor)).length;
        if (matches === 0) {
            problems.push(
                `${file}: anchor matches no line — the exempted content is gone, so the ` +
                    `entry exempts nothing: ${JSON.stringify(anchor.slice(0, 50))}`,
            );
        } else if (matches > 1) {
            problems.push(
                `${file}: anchor matches ${matches} lines — it would exempt more than the ` +
                    `reviewed one; lengthen it: ${JSON.stringify(anchor.slice(0, 50))}`,
            );
        }
    }
    return problems;
}

/**
 * Index of the entry that exempts this hit, or `-1`.
 *
 * Returns the index rather than a boolean so the run can report which
 * exemptions were never used. An entry that suppresses nothing is the failure
 * this gate shipped: three had rotted under position keys, and re-keying them to
 * anchors preserved the rot, because an anchor resolving to a line says nothing
 * about that line producing a hit.
 */
function _allowlist_index(
    rel_path: string,
    line_no: number,
    allowlist: Allowlist,
    line_text = '',
): number {
    const logical = strip_source_prefix(rel_path);
    const entries = allowlist.entries ?? [];
    for (let i = 0; i < entries.length; i += 1) {
        const entry = entries[i] as AllowlistEntry;
        const entry_file = entry.file;
        const entry_logical =
            typeof entry_file === 'string' ? strip_source_prefix(entry_file) : null;
        if (entry_file !== rel_path && (logical === null || entry_logical !== logical)) {
            continue;
        }
        if (entry.lines === '*') {
            return i;
        }
        // Content anchor, and nothing else. A numeric `lines` entry never reaches
        // this point — `validate_allowlist` stops the run on one — so matching it
        // here would be a branch that only fires for input the gate rejects.
        const anchor = entry.anchor;
        if (typeof anchor === 'string' && anchor !== '' && line_text.includes(anchor)) {
            return i;
        }
    }
    return -1;
}

function _families_in_window(lines: string[], idx: number, radius = 10): Set<string> {
    const families = new Set<string>();
    const lo = Math.max(0, idx - radius);
    const hi = Math.min(lines.length, idx + radius + 1);
    for (let j = lo; j < hi; j++) {
        const line = lines[j] as string;
        for (const [category, patterns] of Object.entries(LEAKAGE)) {
            const fam = FAMILY[category] as string;
            if (families.has(fam)) {
                continue;
            }
            for (const pat of patterns) {
                if (new RegExp(pat).test(line)) {
                    families.add(fam);
                    break;
                }
            }
        }
        for (const [fam, rx] of Object.entries(CROSS_STACK_RE)) {
            if (families.has(fam)) {
                continue;
            }
            if (rx.test(line)) {
                families.add(fam);
            }
        }
    }
    return families;
}

/** Fix G3: count DISTINCT framework names in the window (pair rule). */
function _framework_names_in_window(lines: string[], idx: number, radius = 10): number {
    const lo = Math.max(0, idx - radius);
    const hi = Math.min(lines.length, idx + radius + 1);
    const seen = new Set<number>();
    for (let j = lo; j < hi; j++) {
        const line = lines[j] as string;
        for (let k = 0; k < FRAMEWORK_NAME_RES.length; k++) {
            if (!seen.has(k) && (FRAMEWORK_NAME_RES[k] as RegExp).test(line)) {
                seen.add(k);
            }
        }
    }
    return seen.size;
}

export interface Hit {
    line: number;
    category: string;
    pattern: string;
    snippet: string;
    cross_stack: boolean;
    allowlisted?: boolean;
}

export function scan_file(p: string): Hit[] {
    const text = fs.readFileSync(p, 'utf-8');
    // str.splitlines() — split on universal newlines, no trailing empty.
    const lines = text.split(/\r\n|\r|\n/);
    if (lines.length > 0 && lines[lines.length - 1] === '') {
        lines.pop();
    }
    const hits: Hit[] = [];
    for (const [category, patterns] of Object.entries(LEAKAGE)) {
        for (const pat of patterns) {
            const rx = new RegExp(pat);
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i] as string;
                if (rx.test(line)) {
                    // Sanctioned shapes suppress the hit outright (fixes G5/G6):
                    // a carve-out pointer line or a "(Laravel shape/example)"
                    // annotation on a generic mechanism is the neutrality
                    // rule's OWN allowed form, not leakage.
                    if (_is_carve_out_pointer_line(line) || SHAPE_EXAMPLE_RE.test(line)) {
                        continue;
                    }
                    const families = _families_in_window(lines, i);
                    const cross =
                        families.size >= 2 ||
                        _framework_names_in_window(lines, i) >= 2;
                    hits.push({
                        line: i + 1,
                        category,
                        pattern: pat,
                        snippet: line.trim().slice(0, 160),
                        cross_stack: cross,
                    });
                }
            }
        }
    }
    return hits;
}

/** Yield .md files; exit(2) on a path that does not exist (mirrors generator). */
function* iter_md_files(paths: Iterable<string>): Generator<string> {
    for (const raw of paths) {
        const target = path.isAbsolute(raw) ? raw : path.join(REPO_ROOT, raw);
        if (!_exists(target)) {
            process.stderr.write(`error: path does not exist: ${raw}\n`);
            process.exit(2);
        }
        if (_isFile(target) && target.endsWith('.md')) {
            yield target;
            continue;
        }
        // sorted(target.rglob("*.md"))
        const collected: string[] = [];
        const walk = (d: string): void => {
            let entries: fs.Dirent[];
            try {
                entries = fs.readdirSync(d, { withFileTypes: true });
            } catch {
                return;
            }
            for (const e of entries) {
                const full = path.join(d, e.name);
                if (e.isDirectory()) {
                    walk(full);
                } else if (e.isFile() && e.name.endsWith('.md')) {
                    collected.push(full);
                }
            }
        };
        if (_isDir(target)) {
            walk(target);
        }
        collected.sort((a, b) => {
            const pa = toPosix(a);
            const pb = toPosix(b);
            return pa < pb ? -1 : pa > pb ? 1 : 0;
        });
        // Underscore-prefixed files are NOT filtered here. They used to be, and
        // that made them invisible to every count downstream: the generator
        // dropped them before `scannedFiles` ever saw one. The exclusion is
        // still applied — in `main`, where the ledger records it as a named
        // out-of-scope outcome instead of a silent `continue`.
        for (const f of collected) {
            yield f;
        }
    }
}

function parse_args(argv: readonly string[]): {
    json: boolean;
    quiet: boolean;
    narrowed: boolean;
    paths: string[];
} {
    let json = false;
    let quiet = false;
    const paths: string[] = [];
    let collectingPaths = false;
    for (const arg of argv) {
        if (arg === '--json') {
            json = true;
            collectingPaths = false;
        } else if (arg === '--quiet') {
            quiet = true;
            collectingPaths = false;
        } else if (arg === '--paths') {
            collectingPaths = true;
        } else if (arg === '-h' || arg === '--help') {
            process.stdout.write(
                'usage: lint_framework_leakage.py [-h] [--json] [--quiet] [--paths PATHS [PATHS ...]]\n',
            );
            process.exit(0);
        } else if (arg.startsWith('-') && !collectingPaths) {
            process.stderr.write(
                `lint_framework_leakage.py: error: unrecognized arguments: ${arg}\n`,
            );
            process.exit(2);
        } else if (collectingPaths) {
            paths.push(arg);
        } else {
            process.stderr.write(
                `lint_framework_leakage.py: error: unrecognized arguments: ${arg}\n`,
            );
            process.exit(2);
        }
    }
    // `narrowed` distinguishes an explicit `--paths` from the default full set.
    // `paths.length === 0` cannot: the default is three subdirectories, so a full
    // run also arrives here with a non-empty list — which silently disabled the
    // unused-exemption check the first time it was written against that test.
    return {
        json,
        quiet,
        narrowed: paths.length > 0,
        paths: paths.length > 0 ? paths : _default_paths(),
    };
}

/**
 * The allowlist entry that would silence one finding, ready to paste.
 *
 * Anchored on the matched token rather than on the line number: a position key
 * re-fires the moment an insertion above moves the line, on an entry nobody
 * touched. The form is no longer merely discouraged — `validate_allowlist`
 * refuses it, and the last 18 position-keyed entries were migrated to anchors
 * in the change that introduced the refusal.
 */
export function suppressionKey(rel: string, hit: Hit): string {
    const anchor = hit.snippet.trim().slice(0, 60);
    return JSON.stringify({
        file: rel,
        anchor,
        reason: '<why this token is quoted content rather than a mandate>',
        falsifier: `./scripts-run src/scripts/lint_framework_leakage --paths ${rel}`,
    });
}

/**
 * Prove, against the real CLI, that this gate still rejects what it must.
 *
 * The floor is 3 cases with at least 2 rejecting: a clean file alone would be a
 * suite that only ever passes, which proves nothing about detection.
 */
export function selfTest(): number {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'fwl-selftest-'));
    const write = (rel: string, body: string): string => {
        const p = path.join(tmp, rel);
        fs.mkdirSync(path.dirname(p), { recursive: true });
        fs.writeFileSync(p, body, 'utf-8');
        return p;
    };
    const run = (target: string): number =>
        runGateCli(REAL_REPO_ROOT, 'src/scripts/lint_framework_leakage.ts', ['--paths', target, '--quiet'], REAL_REPO_ROOT);

    try {
        const leak = write('generic/skills/demo/SKILL.md', '# Demo\n\nAlways run `php artisan migrate` here.\n');
        const clean = write('clean/skills/demo/SKILL.md', '# Demo\n\nRun the project migration command.\n');
        const framed = write(
            'framed/skills/demo/SKILL.md',
            '---\nframework: laravel\n---\n\n# Demo\n\nAlways run `php artisan migrate` here.\n',
        );
        return runSelfTest({
            gate: 'lint_framework_leakage',
            minCases: 3,
            minRejectCases: 2,
            cases: [
                { name: 'a framework mandate in a generic artefact is rejected', expect: 'reject', run: () => run(leak) },
                { name: 'a neutral artefact passes', expect: 'accept', run: () => run(clean) },
                {
                    name: 'a second family (PHP tooling, not Laravel) is rejected — detection is not one pattern',
                    expect: 'reject',
                    run: () =>
                        run(write('generic2/skills/demo/SKILL.md', '# Demo\n\nRun PHPStan before every commit.\n')),
                },
                {
                    name: 'a `framework:`-declared artefact is exempt',
                    expect: 'accept',
                    run: () => run(framed),
                },
            ],
        });
    } finally {
        fs.rmSync(tmp, { recursive: true, force: true });
    }
}

export function main(argv?: readonly string[]): number {
    const raw = argv ?? process.argv.slice(2);
    if (raw.includes('--self-test')) {
        return selfTest();
    }
    const args = parse_args(raw);

    const allowlist = _load_allowlist();
    // Judge the exemptions before judging any file. A rotted entry produces a
    // green run that means nothing, which is the one failure mode a gate must
    // not have. Structural problems are collected here and reported at the end,
    // NOT returned on early: an early return skipped the `scanned:` line the
    // gate-coverage collector consumes and left `--json` emitting nothing, so a
    // consumer parsing the envelope threw on exactly the runs where the gate
    // reports itself unusable.
    const allowlist_problems = validate_allowlist(allowlist);
    const file_hits: Array<[string, Hit[]]> = [];
    // Which exemptions actually suppressed something. Only meaningful over a full
    // scan: with `--paths` narrowing the tree, an entry for a file outside the
    // scope is unused for a reason that says nothing about the entry.
    const used_entries = new Set<number>();
    let total_hits = 0;
    let allowlisted_total = 0;
    // Every enumerated file is planned up front, so the five exemption branches
    // below stop being invisible `continue`s. Before the ledger, `scannedFiles`
    // counted files *enumerated*, not files *judged* — a carve-out and a clean
    // file were indistinguishable in the published number.
    const ledger = new GateLedger('lint_framework_leakage');
    const enumerated = [...iter_md_files(args.paths)];
    ledger.plan(enumerated.map(relToRepo));

    for (const f of enumerated) {
        const rel = relToRepo(f);
        // Partials are fragments included into a parent artefact; the parent is
        // the unit this gate judges.
        if (path.basename(f).startsWith('_')) {
            ledger.outOfScope(rel, 'not_applicable_kind');
            continue;
        }
        if (is_carve_out(f)) {
            ledger.outOfScope(rel, 'declared_exemption');
            continue;
        }
        if (is_inventory_file(f)) {
            ledger.outOfScope(rel, 'not_applicable_kind');
            continue;
        }
        if (has_framework_frontmatter(f)) {
            ledger.outOfScope(rel, 'declared_exemption');
            continue;
        }
        // Self-exemption: the neutrality rule itself enumerates the forbidden
        // tokens (frontmatter triggers + fix table) — it can never be clean
        // by construction.
        if (f.endsWith(`${path.sep}framework-neutrality-in-generic-skills.md`)) {
            ledger.outOfScope(rel, 'declared_exemption');
            continue;
        }
        const raw_hits = scan_file(f);
        if (raw_hits.length === 0) {
            ledger.complete(rel);
            continue;
        }
        const kept: Hit[] = [];
        for (const h of raw_hits) {
            if (h.cross_stack) {
                continue;
            }
            const idx = _allowlist_index(rel, h.line, allowlist, h.snippet);
            if (idx >= 0) {
                used_entries.add(idx);
                h.allowlisted = true;
                allowlisted_total += 1;
                continue;
            }
            h.allowlisted = false;
            kept.push(h);
        }
        if (kept.length > 0) {
            file_hits.push([f, kept]);
            total_hits += kept.length;
            ledger.fail(rel, `${String(kept.length)} un-allowlisted leakage hit(s)`);
        } else {
            // Every raw hit was cross-stack or allowlisted: the file WAS judged.
            ledger.complete(rel);
        }
    }

    // An exemption that suppressed nothing over a FULL scan exempts nothing at
    // all — the rot the anchor migration was supposed to end, and which anchoring
    // alone does not end: an anchor resolving to a line says nothing about that
    // line producing a hit. Only checked on a full scan, because `--paths` makes
    // "unused" mean "out of scope" instead.
    if (!args.narrowed) {
        const entries = allowlist.entries ?? [];
        for (let i = 0; i < entries.length; i += 1) {
            if (used_entries.has(i)) {
                continue;
            }
            const e = entries[i] as AllowlistEntry;
            allowlist_problems.push(
                `${String(e.file)}: exemption suppressed nothing this run — the line it names ` +
                    'produces no leakage hit, so it exempts nothing: ' +
                    JSON.stringify(String(e.anchor ?? e.lines).slice(0, 50)),
            );
        }
    }

    const summary = {
        total_hits,
        files: file_hits.length,
        allowlisted: allowlisted_total,
        allowlist_problems: allowlist_problems.length,
    };

    // Finalize before either output branch: an unaccounted target must throw
    // rather than let a formatted result be printed over it.
    const tally = ledger.finalize();

    if (args.json) {
        const out = {
            version: 1,
            hits: file_hits.flatMap(([p, hits]) =>
                hits.map((h) => ({ file: relToRepo(p), ...h })),
            ),
            summary,
            allowlist_problems,
            ledger: tally,
        };
        process.stdout.write(`${JSON.stringify(out, null, 2)}\n`);
        return total_hits || allowlist_problems.length ? 1 : 0;
    }

    if (!args.quiet) {
        for (const [p, hits] of file_hits) {
            const rel = relToRepo(p);
            process.stdout.write(`\n${rel}\n`);
            for (const h of hits) {
                // f"  L{h['line']:4d}  {h['category']:<16s}  /{h['pattern']}/  {h['snippet']}"
                const lineCol = String(h.line).padStart(4, ' ');
                const catCol = h.category.padEnd(16, ' ');
                process.stdout.write(`  L${lineCol}  ${catCol}  /${h.pattern}/  ${h.snippet}\n`);
                // The suppression key travels WITH the finding, copy-pasteable and
                // anchor-keyed. Friction in the narrow path is what pushes a
                // maintainer to the blunt off-switch instead; and an anchor keeps
                // matching after an edit moves the line, which `lines: [N]` cannot.
                process.stdout.write(`        suppress: ${suppressionKey(rel, h)}\n`);
            }
        }
    }

    process.stdout.write(
        `\n${total_hits} hits across ${file_hits.length} files ` +
            `(${allowlisted_total} allowlisted)\n`,
    );
    ledger.report();
    // gate-coverage contract (src/config/gate-coverage.yml): files actually
    // JUDGED — completed plus failed. It used to be files *enumerated*, which
    // over-reported coverage by every exempted file (438 published against 368
    // judged) and is the same "reading M as coverage" trap the human summary
    // carries. The ledger makes the honest number the cheap one to publish.
    process.stderr.write(`scanned: ${String(tally.completed + tally.failed)}\n`);

    // Reported AFTER the ledger and the `scanned:` line, so a broken allowlist
    // still produces both output contracts. An exemption problem fails the run
    // on its own: a gate that scans cleanly through unusable exemptions is
    // reporting on a question nobody asked.
    if (allowlist_problems.length > 0) {
        process.stderr.write(
            `\n❌  ${allowlist_problems.length} unusable allowlist entr` +
                `${allowlist_problems.length === 1 ? 'y' : 'ies'}:\n`,
        );
        for (const p of allowlist_problems) {
            process.stderr.write(`  · ${p}\n`);
        }
        process.stderr.write(
            '  An exemption that names nothing, suppresses nothing, or reaches further\n' +
                '  than the line it was reviewed for is not an exemption. Remove it or\n' +
                '  re-anchor it to the content it is meant to cover.\n',
        );
        return 1;
    }
    return total_hits ? 1 : 0;
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
