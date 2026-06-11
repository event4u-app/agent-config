#!/usr/bin/env node
/**
 * Routing-metadata + routing-eval linter for visible commands.
 *
 * TypeScript twin of `src/scripts/lint_command_routing.py` (ADR-088, Phase 4 /
 * Wave 4b). Mirrors the Python CLI contract exactly: same `--quiet` flag,
 * scan scope (src/domains/**\/command.md, legacy packages fallback), file
 * ordering, frontmatter parsing, finding messages, stdout/stderr split, and
 * exit codes (0 clean, 1 violations, 3 internal error). No behaviour changes —
 * latent bugs replicated.
 *
 * Every VISIBLE command (tier 0/1) must carry:
 *   - `intent`     — non-empty one-line existence justification
 *   - `routes_to`  — non-empty list of skill / cluster-sub / command slugs
 *   - `replaces`   — a list (may be empty `[]`); the key must be present
 *   - a routing eval at the central eval store with >= MIN_CASES cases.
 *
 * Internal commands (tier 2 / absent) are exempt.
 *
 * Exit codes: 0 = clean, 1 = violations found, 3 = internal error.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parse as parseYaml } from 'yaml';

// src/scripts/lint_command_routing.ts → repo root is two dirs up. Mirrors the
// Python `Path(__file__).resolve().parent.parent.parent`.
const _HERE = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(_HERE), '..', '..');

// Frontmatter pattern: `^---\n(.*?)\n---` with DOTALL (no MULTILINE), so `^`
// anchors to string start and `.*?` is non-greedy across newlines.
const FM_RE = /^---\n([\s\S]*?)\n---/;
const VISIBLE_TIERS: ReadonlySet<number> = new Set([0, 1]);
const MIN_CASES = 5; // roadmap Step 5: "5–10 example prompts"

interface Violation {
    file: string;
    reason: string;
}

function _isDir(p: string): boolean {
    try {
        return fs.statSync(p).isDirectory();
    } catch {
        return false;
    }
}

function _exists(p: string): boolean {
    try {
        fs.statSync(p);
        return true;
    } catch {
        return false;
    }
}

/** POSIX relative path of `target` under `root` (str(Path.relative_to)). */
function _relTo(target: string, root: string): string {
    return path.relative(root, target).split(path.sep).join('/');
}

/** Recursively list files matching `name` under `dir`, sorted (sorted(rglob)). */
function _rglobNameSorted(dir: string, name: string): string[] {
    const out: string[] = [];
    const walk = (current: string): void => {
        let entries: fs.Dirent[];
        try {
            entries = fs.readdirSync(current, { withFileTypes: true });
        } catch {
            return;
        }
        for (const entry of entries) {
            const full = path.join(current, entry.name);
            if (entry.isDirectory()) {
                walk(full);
            } else if (entry.isFile() && entry.name === name) {
                out.push(full);
            }
        }
    };
    walk(dir);
    return out.sort();
}

/** Recursively list `*.md` files under `dir`, sorted. */
function _rglobMdSorted(dir: string): string[] {
    const out: string[] = [];
    const walk = (current: string): void => {
        let entries: fs.Dirent[];
        try {
            entries = fs.readdirSync(current, { withFileTypes: true });
        } catch {
            return;
        }
        for (const entry of entries) {
            const full = path.join(current, entry.name);
            if (entry.isDirectory()) {
                walk(full);
            } else if (entry.isFile() && entry.name.endsWith('.md')) {
                out.push(full);
            }
        }
    };
    walk(dir);
    return out.sort();
}

/**
 * Discover command sources in the post-ADR-051 layout.
 *
 * Authoring lives at src/domains/<domain>/**\/command.md; the legacy
 * packages/*\/.agent-src.uncondensed/commands tree is kept as a fallback for
 * older checkouts.
 */
function _command_files(): string[] {
    const domains = path.join(ROOT, 'src', 'domains');
    if (_isDir(domains)) {
        return _rglobNameSorted(domains, 'command.md');
    }
    const packagesDir = path.join(ROOT, 'packages');
    const legacyRoots: string[] = [];
    let entries: fs.Dirent[];
    try {
        entries = fs.readdirSync(packagesDir, { withFileTypes: true });
    } catch {
        entries = [];
    }
    // glob("*/.agent-src.uncondensed/commands") — sorted, dirs only.
    for (const entry of entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))) {
        const d = path.join(packagesDir, entry.name, '.agent-src.uncondensed', 'commands');
        if (_isDir(d)) {
            legacyRoots.push(d);
        }
    }
    const out: string[] = [];
    for (const root of legacyRoots) {
        out.push(..._rglobMdSorted(root));
    }
    return out;
}

// Central eval store in the post-ADR-051 layout. Eval stems use the
// command's `name` or one of its `replaces` aliases.
const EVALS_DIR = path.join(ROOT, 'src', 'agent-src', 'commands', 'evals');

function _frontmatter(text: string): Record<string, unknown> {
    const m = FM_RE.exec(text);
    if (!m) {
        return {};
    }
    try {
        const data = parseYaml(m[1]!, { version: '1.1' });
        if (data === null || data === undefined) {
            return {};
        }
        return data as Record<string, unknown>;
    } catch {
        // Mirror `except yaml.YAMLError: return {}`.
        return {};
    }
}

function _isNonEmptyString(v: unknown): v is string {
    return typeof v === 'string' && v.trim().length > 0;
}

function check(md: string): Violation[] {
    const fm = _frontmatter(fs.readFileSync(md, 'utf-8'));
    const tier = 'tier' in fm ? (fm['tier'] as unknown) : 2;
    if (typeof tier !== 'number' || !VISIBLE_TIERS.has(tier)) {
        return [];
    }
    const rel = _relTo(md, ROOT);
    const vio: Violation[] = [];

    const intent = fm['intent'];
    if (!_isNonEmptyString(intent)) {
        vio.push({ file: rel, reason: 'missing/empty `intent` (Step 4b)' });
    }

    const routes = fm['routes_to'];
    if (!(Array.isArray(routes) && routes.length > 0)) {
        vio.push({ file: rel, reason: 'missing/empty `routes_to` list (Step 4b)' });
    }

    if (!('replaces' in fm) || !Array.isArray(fm['replaces'])) {
        vio.push({
            file: rel,
            reason:
                'missing `replaces` key (use `[]` when it replaces nothing) (Step 4b)',
        });
    }

    const replaces = Array.isArray(fm['replaces']) ? (fm['replaces'] as unknown[]) : [];
    const candidates: unknown[] = [fm['name'], ...replaces];
    const eval_keys = candidates.filter((k): k is string => _isNonEmptyString(k));

    // next(...) — first eval key whose file exists, else the legacy per-dir path.
    let eval_path: string | undefined;
    for (const k of eval_keys) {
        const p = path.join(EVALS_DIR, `${k}.json`);
        if (_exists(p)) {
            eval_path = p;
            break;
        }
    }
    if (eval_path === undefined) {
        const stem = path.basename(md, path.extname(md));
        eval_path = path.join(path.dirname(md), 'evals', `${stem}.json`);
    }

    if (!_exists(eval_path)) {
        const stem = path.basename(md, path.extname(md));
        const display = eval_keys.length > 0 ? eval_keys : [stem];
        vio.push({
            file: rel,
            reason:
                `missing routing eval under \`${_relTo(EVALS_DIR, ROOT)}/\` for any of ` +
                `${_pyListRepr(display)} (Step 5)`,
        });
    } else {
        let data: unknown;
        try {
            data = JSON.parse(fs.readFileSync(eval_path, 'utf-8'));
        } catch (exc) {
            vio.push({
                file: rel,
                reason: `routing eval is invalid JSON: ${_jsonErr(exc, eval_path)}`,
            });
            return vio;
        }
        const cases =
            data !== null && typeof data === 'object' && !Array.isArray(data)
                ? (data as Record<string, unknown>)['cases']
                : undefined;
        if (!(Array.isArray(cases) && cases.length >= MIN_CASES)) {
            vio.push({
                file: rel,
                reason: `routing eval has < ${MIN_CASES} cases (Step 5: 5–10 prompts)`,
            });
        } else if (
            !cases.every(
                (c) =>
                    c !== null &&
                    typeof c === 'object' &&
                    !Array.isArray(c) &&
                    _truthy((c as Record<string, unknown>)['prompt']) &&
                    _truthy((c as Record<string, unknown>)['expected']),
            )
        ) {
            vio.push({ file: rel, reason: 'routing eval case missing `prompt`/`expected`' });
        }
    }
    return vio;
}

/** Python truthiness for JSON values (empty string / 0 / [] / {} / null/false → falsy). */
function _truthy(v: unknown): boolean {
    if (v === null || v === undefined || v === false) {
        return false;
    }
    if (typeof v === 'string') {
        return v.length > 0;
    }
    if (typeof v === 'number') {
        return v !== 0;
    }
    if (Array.isArray(v)) {
        return v.length > 0;
    }
    if (typeof v === 'object') {
        return Object.keys(v).length > 0;
    }
    return Boolean(v);
}

/** Mirror Python `repr(list[str])` for the finding message. */
function _pyListRepr(items: string[]): string {
    return '[' + items.map((s) => `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`).join(', ') + ']';
}

/** Best-effort mirror of Python `json.JSONDecodeError` message text. */
function _jsonErr(exc: unknown, _file: string): string {
    return exc instanceof Error ? exc.message : String(exc);
}

function main(): number {
    parse_args(process.argv.slice(2));
    const quiet = _quiet;

    const files = _command_files();
    if (files.length === 0) {
        process.stderr.write('❌  No command roots found.\n');
        return 3;
    }

    let visible = 0;
    const violations: Violation[] = [];
    for (const md of files) {
        const parts = md.split(path.sep);
        if (
            path.basename(md) === 'AGENTS.md' ||
            parts.includes('_archive') ||
            path.basename(path.dirname(md)) === 'evals'
        ) {
            continue;
        }
        const fm = _frontmatter(fs.readFileSync(md, 'utf-8'));
        const tier = 'tier' in fm ? (fm['tier'] as unknown) : 2;
        if (typeof tier === 'number' && VISIBLE_TIERS.has(tier)) {
            visible += 1;
        }
        violations.push(...check(md));
    }

    if (violations.length > 0) {
        process.stdout.write(
            `❌  ${violations.length} routing-metadata violation(s) across ` +
                `${visible} visible command(s):\n`,
        );
        for (const v of violations) {
            process.stdout.write(`  • ${v.file} — ${v.reason}\n`);
        }
        process.stdout.write(
            '\nSee command.schema.json (intent/routes_to/replaces) and ' +
                'docs/contracts/command-clusters.md § routing metadata.\n',
        );
        return 1;
    }
    if (!quiet) {
        process.stdout.write(
            `✅  ${visible} visible command(s) carry intent/routes_to/replaces ` +
                '+ a routing eval.\n',
        );
    }
    return 0;
}

let _quiet = false;

function parse_args(argv: readonly string[]): void {
    for (const arg of argv) {
        if (arg === '--quiet') {
            _quiet = true;
        } else if (arg === '-h' || arg === '--help') {
            process.stdout.write('usage: lint_command_routing [-h] [--quiet]\n');
            process.exit(0);
        } else {
            process.stderr.write(`lint_command_routing: error: unrecognized arguments: ${arg}\n`);
            process.exit(2);
        }
    }
}

const _isCliEntry =
    process.argv[1] !== undefined &&
    import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (_isCliEntry || process.argv[1] === _HERE) {
    process.exit(main());
}

export {
    type Violation,
    ROOT,
    FM_RE,
    VISIBLE_TIERS,
    MIN_CASES,
    EVALS_DIR,
    _command_files,
    _frontmatter,
    check,
    main,
};
