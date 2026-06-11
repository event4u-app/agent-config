#!/usr/bin/env tsx
// Lint generic skills/rules/commands for framework/language leakage.
//
// TypeScript twin of src/scripts/lint_framework_leakage.py. Exits 1 on hit
// (CI-blocking). Enforces the framework-neutrality rule. Replicates the
// carve-out filename exemption, inventory exemption, framework-frontmatter
// exemption, the auto cross-stack ±10-line window heuristic, the allowlist
// (logical-path matching via strip_source_prefix), JSON/quiet modes, the
// path-does-not-exist exit(2), and the `_`-prefixed-file skip.
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { artefact_roots, strip_source_prefix } from './_lib/agent_src.js';

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
        '\\bnpm (install|run|test|ci)\\b',
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
        '\\buv (add|sync|run|pip)\\b', '\\bvenv\\b'],
    node: ['\\bExpress\\b', '\\bNext\\.?js\\b', '\\bNode\\.?js\\b', '\\bnpx\\b',
        '\\bvitest\\b', '\\bjest\\b', '\\beslint\\b', '\\bprettier\\b'],
    go: ['\\bgo (test|build|run|mod)\\b', '\\bgolangci-lint\\b', '\\bGoLand\\b'],
    rust: ['\\bcargo (test|build|run|check|fmt|clippy|add|update)\\b',
        '\\bClippy\\b', '\\brustfmt\\b', '\\bCargo\\.toml\\b'],
    dotnet: ['\\bdotnet (test|build|run|add|restore)\\b', '\\b\\.NET\\b'],
    java: ['\\bSpring\\b', '\\bmvn (test|clean|install|package)\\b',
        '\\bgradle\\b', '\\bMaven\\b'],
};
const CROSS_STACK_RE: Record<string, RegExp> = Object.fromEntries(
    Object.entries(CROSS_STACK_HINTS).map(([fam, pats]) => [fam, new RegExp(pats.join('|'))]),
);

const FRONTMATTER_FRAMEWORK_RE = /^---\s*\n([\s\S]*?)\n---/m;
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
    if (
        path.basename(rel) === 'README.md' &&
        parts.length === 2 &&
        (parts[0] === '.agent-src.uncondensed' || parts[0] === 'dist/agent-src')
    ) {
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
    reason?: string;
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

function _allowlisted(rel_path: string, line_no: number, allowlist: Allowlist): boolean {
    const logical = strip_source_prefix(rel_path);
    for (const entry of allowlist.entries ?? []) {
        const entry_file = entry.file;
        const entry_logical =
            typeof entry_file === 'string' ? strip_source_prefix(entry_file) : null;
        if (entry_file !== rel_path && (logical === null || entry_logical !== logical)) {
            continue;
        }
        const lines = entry.lines;
        if (lines === '*') {
            return true;
        }
        if (Array.isArray(lines) && lines.includes(line_no)) {
            return true;
        }
    }
    return false;
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
                    const families = _families_in_window(lines, i);
                    hits.push({
                        line: i + 1,
                        category,
                        pattern: pat,
                        snippet: line.trim().slice(0, 160),
                        cross_stack: families.size >= 2,
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
        for (const f of collected) {
            if (path.basename(f).startsWith('_')) {
                continue;
            }
            yield f;
        }
    }
}

function parse_args(argv: readonly string[]): { json: boolean; quiet: boolean; paths: string[] } {
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
    return { json, quiet, paths: paths.length > 0 ? paths : _default_paths() };
}

export function main(argv?: readonly string[]): number {
    const args = parse_args(argv ?? process.argv.slice(2));

    const allowlist = _load_allowlist();
    const file_hits: Array<[string, Hit[]]> = [];
    let total_hits = 0;
    let allowlisted_total = 0;

    for (const f of iter_md_files(args.paths)) {
        if (is_carve_out(f)) {
            continue;
        }
        if (is_inventory_file(f)) {
            continue;
        }
        if (has_framework_frontmatter(f)) {
            continue;
        }
        const rel = relToRepo(f);
        const raw_hits = scan_file(f);
        if (raw_hits.length === 0) {
            continue;
        }
        const kept: Hit[] = [];
        for (const h of raw_hits) {
            if (h.cross_stack) {
                continue;
            }
            if (_allowlisted(rel, h.line, allowlist)) {
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
        }
    }

    const summary = {
        total_hits,
        files: file_hits.length,
        allowlisted: allowlisted_total,
    };

    if (args.json) {
        const out = {
            version: 1,
            hits: file_hits.flatMap(([p, hits]) =>
                hits.map((h) => ({ file: relToRepo(p), ...h })),
            ),
            summary,
        };
        process.stdout.write(`${JSON.stringify(out, null, 2)}\n`);
        return total_hits ? 1 : 0;
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
            }
        }
    }

    process.stdout.write(
        `\n${total_hits} hits across ${file_hits.length} files ` +
            `(${allowlisted_total} allowlisted)\n`,
    );
    return total_hits ? 1 : 0;
}

const _HERE = fileURLToPath(import.meta.url);
const _isCliEntry =
    process.argv[1] !== undefined &&
    import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (_isCliEntry || process.argv[1] === _HERE) {
    process.exit(main());
}
