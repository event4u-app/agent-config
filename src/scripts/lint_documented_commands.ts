#!/usr/bin/env tsx
/**
 * Documented-command resolver — every backtick-quoted PACKAGE command named in a
 * shipped skill/rule/command doc must resolve to something real: a CLI registry
 * entry, an MCP tool, an npm script, a task target, or a slash-command cluster.
 *
 * The bug class this exists to close: a skill/rule ships prose that tells the
 * agent to run `agent-config foo-bar` (or `task some-target`, or a bare
 * `ns:verb`-shaped invocation like `council:debate`) and the command does not
 * exist anywhere — the doc lied, silently, until a human hit it at runtime.
 * This linter makes that class structurally impossible: every command-shaped
 * backtick span or bash/sh fenced line is checked against the real registries
 * at lint time, deterministically, no network, no LLM.
 *
 * PRIMARY CI GATE: this script's behaviour is pinned by
 * `tests/scripts/lint_documented_commands.test.ts` (vitest) — that suite runs
 * in the `node-tests` job on every PR, which is the primary gate. The
 * `lint-documented-commands` task target (below) is a convenience for local
 * runs and the `ci`/`ci-strict` aggregate; either path catches a regression.
 *
 * Shape mirrored from `src/scripts/check_no_roadmap_refs.ts` (per its own
 * "read one existing linter for shape first" precedent): `--format` / `--root`
 * flags, exit codes (0 clean, 1 violations, 2 usage error, 3 internal error),
 * stdout-only output, self-documenting allowlist, fenced-code-aware scan.
 *
 * Contract: road-to-reachable-code-memory Phase 1 (the load-bearing
 * lint_documented_commands item).
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { load as yamlLoad } from 'js-yaml';

// NOTE: deliberately no runtime module dependency on the CLI registry —
// src/cli/ is outside the package.json `files` whitelist, so importing it
// would crash a global install (prepack-check). The registry file is parsed
// as text, same as every other resolution surface below.

// src/scripts/lint_documented_commands.ts → two dirs up is the repo root.
const _HERE = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(_HERE), '..', '..');

// ---------------------------------------------------------------------------
// Scan trees — every `*.md` (or `SKILL.md` / `command.md`) below is checked
// for documented package-command claims. Resolved relative to the scan
// `root` (which `--root` may override, for fixture-driven tests).
// ---------------------------------------------------------------------------

interface ScanTree {
    /** Directory, relative to `root`. */
    dir: string;
    /** Which filenames under `dir` (recursively) count as a scan target. */
    match: (basename: string) => boolean;
}

const DEFAULT_SCAN_TREES: readonly ScanTree[] = [
    { dir: 'src/skills', match: (n) => n === 'SKILL.md' },
    { dir: 'src/rules', match: (n) => n.endsWith('.md') },
    { dir: 'src/agent-src/commands', match: (n) => n.endsWith('.md') },
    { dir: 'src/domains', match: (n) => n === 'command.md' },
];

// Bash-like fence languages whose lines are scanned whole-line (commands live
// there, not just in inline backtick spans).
const BASH_FENCE_LANGS: ReadonlySet<string> = new Set(['bash', 'sh', 'shell', 'zsh']);

// Files that may legitimately quote a non-resolving example for illustration
// (documentation ABOUT this linter, or a deliberate "don't do this" example).
// Empty today — populate if a future doc needs it.
const SELF_DOCUMENTING_ALLOWLIST: ReadonlySet<string> = new Set([]);

const IGNORE_MARKER_RE = /<!--\s*lint-documented-commands:\s*ignore\s*-->/;
const HTML_COMMENT_RE = /<!--[\s\S]*?-->/g;

// ---------------------------------------------------------------------------
// Classification regexes — anchored to the START of a (already split, already
// trimmed) sub-command string. `&&` / `||` / `;` / `|` split one backtick span
// or fenced-bash line into its constituent sub-commands first (see
// `_splitSubcommands`), so `task a && task b` is checked as two claims.
// ---------------------------------------------------------------------------

const TOKEN_CHARS = 'a-z0-9:_-';

const AGENT_CONFIG_RE = new RegExp(
    `^(?:\\./agent-config|npx\\s+@event4u/agent-config|npx\\s+agent-config|agent-config)\\s+([a-z][${TOKEN_CHARS}]*)`,
);
const FIRST_TOKEN_RE = /^([a-zA-Z_][\w:-]*)/;

type Category = 'agent-config' | 'task' | 'npm-run' | 'bare';

function _isCuratedBareToken(token: string): boolean {
    if (token === 'code_graph' || token === 'code-graph') {
        return true;
    }
    return (
        /^memory:[a-z][a-z0-9-]*$/.test(token) ||
        /^council:[a-z][a-z0-9-]*$/.test(token) ||
        /^roadmap:[a-z][a-z0-9-]*$/.test(token)
    );
}

interface Claim {
    category: Category;
    token: string;
}

/** Split a candidate command string into its shell-separated sub-commands. */
function _splitSubcommands(text: string): string[] {
    return text
        .split(/(?:&&|\|\||;|\|)/)
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
}

/**
 * Classify one trimmed sub-command; `null` if it names no package command.
 *
 * DELIBERATELY NOT checked: `task <target>` and `npm run <script>`. Shipped
 * skills/commands overwhelmingly use those namespaces to describe the
 * CONSUMER project's own Taskfile / package.json (e.g. `npm run ios` in a
 * React-Native consumer, `npm run biome:fix` in a JS consumer, the
 * forbidden-CI-literal pattern lists in roadmap-ci-steps-policy) — resolving
 * them against THIS package's files produced a systematic false-positive
 * class on first run (12 of 19 findings, 2026-07-27). The defect class this
 * lint kills (a shipped doc naming a non-resolving PACKAGE command, the S0a
 * reachability bug) lives entirely in the `agent-config <verb>` and curated
 * bare-token namespaces, which ARE unambiguous package property.
 */
function _classify(subcmd: string): Claim | null {
    const m = AGENT_CONFIG_RE.exec(subcmd);
    if (m) {
        return { category: 'agent-config', token: m[1]! };
    }
    const first = FIRST_TOKEN_RE.exec(subcmd);
    if (first && _isCuratedBareToken(first[1]!)) {
        return { category: 'bare', token: first[1]! };
    }
    return null;
}

/** Extract every command-shaped claim from one candidate string (span/line). */
function _claimsIn(text: string): Claim[] {
    const out: Claim[] = [];
    for (const sub of _splitSubcommands(text)) {
        const claim = _classify(sub);
        if (claim) {
            out.push(claim);
        }
    }
    return out;
}

// ---------------------------------------------------------------------------
// Resolution sources — ALWAYS loaded from the real repo (REPO_ROOT), never
// from `--root`. `--root` only changes which docs are SCANNED (for
// fixture-driven tests); the registries a claim resolves against are the
// package's real, shipped ones.
// ---------------------------------------------------------------------------

export interface ResolutionSets {
    registryNames: ReadonlySet<string>;
    taskNames: ReadonlySet<string>;
    npmScripts: ReadonlySet<string>;
    mcpToolNames: ReadonlySet<string>;
    slashCommandNames: ReadonlySet<string>;
}

function _exists(p: string): boolean {
    try {
        fs.statSync(p);
        return true;
    } catch {
        return false;
    }
}

const REGISTRY_ENTRY_RE = /^\s*\{\s*name:\s*'([^']+)'/;

function _loadRegistryNames(): Set<string> {
    const names = new Set<string>();
    const p = path.join(REPO_ROOT, 'src', 'cli', 'registry.ts');
    if (!_exists(p)) {
        return names;
    }
    for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
        const m = REGISTRY_ENTRY_RE.exec(line);
        if (m) {
            names.add(m[1]!);
        }
    }
    return names;
}

function _loadTaskNames(repoRoot: string): Set<string> {
    const names = new Set<string>();
    const files = [path.join(repoRoot, 'Taskfile.yml')];
    const taskfilesDir = path.join(repoRoot, 'taskfiles');
    if (_exists(taskfilesDir)) {
        for (const f of fs.readdirSync(taskfilesDir).sort()) {
            if (f.endsWith('.yml') || f.endsWith('.yaml')) {
                files.push(path.join(taskfilesDir, f));
            }
        }
    }
    for (const f of files) {
        if (!_exists(f)) {
            continue;
        }
        let doc: unknown;
        try {
            doc = yamlLoad(fs.readFileSync(f, 'utf-8'));
        } catch {
            continue;
        }
        const tasks = (doc as { tasks?: unknown } | null)?.tasks;
        if (tasks && typeof tasks === 'object') {
            for (const k of Object.keys(tasks as Record<string, unknown>)) {
                names.add(k);
            }
        }
    }
    return names;
}

function _loadNpmScripts(repoRoot: string): Set<string> {
    const pkgPath = path.join(repoRoot, 'package.json');
    if (!_exists(pkgPath)) {
        return new Set();
    }
    try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8')) as {
            scripts?: Record<string, unknown>;
        };
        return new Set(Object.keys(pkg.scripts ?? {}));
    } catch {
        return new Set();
    }
}

function _loadMcpToolNames(repoRoot: string): Set<string> {
    const p = path.join(repoRoot, 'src', 'scripts', 'mcp_server', 'consumer_tool_catalog.json');
    if (!_exists(p)) {
        return new Set();
    }
    try {
        const doc = JSON.parse(fs.readFileSync(p, 'utf-8')) as {
            tools?: Array<{ name?: unknown }>;
        };
        const tools = Array.isArray(doc.tools) ? doc.tools : [];
        return new Set(
            tools.map((t) => t.name).filter((n): n is string => typeof n === 'string'),
        );
    } catch {
        return new Set();
    }
}

/** Parse a `---\n...\n---` YAML frontmatter block off the top of a file. */
function _parseFrontmatter(file: string): Record<string, unknown> | null {
    let text: string;
    try {
        text = fs.readFileSync(file, 'utf-8');
    } catch {
        return null;
    }
    const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text);
    if (!m) {
        return null;
    }
    try {
        const doc = yamlLoad(m[1]!);
        return doc && typeof doc === 'object' ? (doc as Record<string, unknown>) : null;
    } catch {
        return null;
    }
}

/**
 * Slash-command cluster names (`cluster:sub`, or bare `cluster` when there is
 * no `sub`) derived from every `src/domains/**\/command.md` frontmatter. These
 * are a valid resolution target for the curated bare `ns:verb` patterns
 * (`council:*`, `roadmap:*`) — a bare token can legitimately name a slash
 * command rather than a CLI registry entry (e.g. `council:debate` has no CLI
 * counterpart; it is reached only via `/council:debate`).
 */
function _loadSlashCommandNames(repoRoot: string): Set<string> {
    const names = new Set<string>();
    const domainsRoot = path.join(repoRoot, 'src', 'domains');
    if (!_exists(domainsRoot)) {
        return names;
    }
    const walk = (dir: string): void => {
        let entries: fs.Dirent[];
        try {
            entries = fs.readdirSync(dir, { withFileTypes: true });
        } catch {
            return;
        }
        for (const e of entries) {
            const full = path.join(dir, e.name);
            if (e.isDirectory()) {
                walk(full);
            } else if (e.isFile() && e.name === 'command.md') {
                const fm = _parseFrontmatter(full);
                const cluster = fm?.cluster;
                const sub = fm?.sub;
                if (typeof cluster === 'string' && typeof sub === 'string') {
                    names.add(`${cluster}:${sub}`);
                } else if (typeof cluster === 'string') {
                    names.add(cluster);
                }
            }
        }
    };
    walk(domainsRoot);
    return names;
}

export function loadResolutionSets(repoRoot: string = REPO_ROOT): ResolutionSets {
    return {
        registryNames: _loadRegistryNames(),
        taskNames: _loadTaskNames(repoRoot),
        npmScripts: _loadNpmScripts(repoRoot),
        mcpToolNames: _loadMcpToolNames(repoRoot),
        slashCommandNames: _loadSlashCommandNames(repoRoot),
    };
}

/** Normalize a bare token (`code-graph`, `memory:lookup`) to MCP snake_case. */
function _mcpNormalize(token: string): string {
    return token.replace(/[:-]/g, '_');
}

function _isResolved(claim: Claim, sets: ResolutionSets): boolean {
    switch (claim.category) {
        case 'agent-config':
            return sets.registryNames.has(claim.token);
        case 'task':
            return sets.taskNames.has(claim.token);
        case 'npm-run':
            return sets.npmScripts.has(claim.token);
        case 'bare':
            if (sets.registryNames.has(claim.token)) {
                return true;
            }
            if (sets.slashCommandNames.has(claim.token)) {
                return true;
            }
            return sets.mcpToolNames.has(_mcpNormalize(claim.token));
    }
}

function _hint(category: Category): string {
    switch (category) {
        case 'agent-config':
            return 'not found in src/cli/registry.ts REGISTRY';
        case 'task':
            return 'not found in Taskfile.yml / taskfiles/*.yml task names';
        case 'npm-run':
            return 'not found in package.json "scripts"';
        case 'bare':
            return 'not found in the CLI registry, a slash-command cluster, or the MCP tool catalog';
    }
}

// ---------------------------------------------------------------------------
// Scanning — walk the scan trees, extract candidate spans, classify, resolve.
// ---------------------------------------------------------------------------

export interface Violation {
    file: string;
    line: number;
    token: string;
    category: Category;
    hint: string;
}

/** POSIX relative path of `target` under `root`. */
function _relTo(target: string, root: string): string {
    return path.relative(root, target).split(path.sep).join('/');
}

function _walkTree(base: string, match: (basename: string) => boolean): string[] {
    const out: string[] = [];
    const walk = (dir: string): void => {
        let entries: fs.Dirent[];
        try {
            entries = fs.readdirSync(dir, { withFileTypes: true });
        } catch {
            return;
        }
        for (const e of entries) {
            const full = path.join(dir, e.name);
            if (e.isDirectory()) {
                walk(full);
            } else if (e.isFile() && match(e.name)) {
                out.push(full);
            }
        }
    };
    walk(base);
    return out;
}

function _collectTargets(root: string, scanTrees: readonly ScanTree[]): string[] {
    const targets: string[] = [];
    for (const tree of scanTrees) {
        const base = path.join(root, tree.dir);
        if (!_exists(base)) {
            continue;
        }
        targets.push(..._walkTree(base, tree.match));
    }
    return targets.sort();
}

/** Extract single-backtick inline code spans from a (non-fence) line. */
function _inlineSpans(line: string): string[] {
    const out: string[] = [];
    const re = /`([^`\n]+)`/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(line)) !== null) {
        out.push(m[1]!);
    }
    return out;
}

function _scanFile(p: string, root: string, sets: ResolutionSets): Violation[] {
    const rel = _relTo(p, root);
    if (SELF_DOCUMENTING_ALLOWLIST.has(rel)) {
        return [];
    }
    let text: string;
    try {
        text = fs.readFileSync(p, 'utf-8');
    } catch {
        return [];
    }
    const lines = text.split('\n');

    // Pass 1: find every line carrying the ignore marker (same-line suppression
    // resolves the finding on that line; the finding on the NEXT line is
    // resolved by checking the line above it below).
    const ignoreLines = new Set<number>();
    for (let idx = 0; idx < lines.length; idx++) {
        if (IGNORE_MARKER_RE.test(lines[idx]!)) {
            ignoreLines.add(idx + 1);
        }
    }

    const out: Violation[] = [];
    let inFence = false;
    let fenceLang = '';

    for (let idx = 0; idx < lines.length; idx++) {
        const n = idx + 1;
        const rawLine = lines[idx]!;
        const stripped = rawLine.replace(/^\s+/, '');

        if (stripped.startsWith('```')) {
            if (!inFence) {
                inFence = true;
                fenceLang = stripped.slice(3).trim().toLowerCase();
            } else {
                inFence = false;
                fenceLang = '';
            }
            continue;
        }

        const candidates: string[] = [];
        if (inFence) {
            if (BASH_FENCE_LANGS.has(fenceLang)) {
                const noComment = rawLine.replace(HTML_COMMENT_RE, '');
                const withoutPrompt = noComment.replace(/^\s*\$\s*/, '').trim();
                if (withoutPrompt.length > 0 && !withoutPrompt.startsWith('#')) {
                    candidates.push(withoutPrompt);
                }
            }
        } else {
            const noComment = rawLine.replace(HTML_COMMENT_RE, '');
            candidates.push(..._inlineSpans(noComment));
        }

        const suppressed = ignoreLines.has(n) || ignoreLines.has(n - 1);
        for (const candidate of candidates) {
            for (const claim of _claimsIn(candidate)) {
                if (_isResolved(claim, sets)) {
                    continue;
                }
                if (suppressed) {
                    continue;
                }
                out.push({
                    file: rel,
                    line: n,
                    token: claim.token,
                    category: claim.category,
                    hint: _hint(claim.category),
                });
            }
        }
    }
    return out;
}

export function scan(
    root: string = REPO_ROOT,
    scanTrees: readonly ScanTree[] = DEFAULT_SCAN_TREES,
): Violation[] {
    const sets = loadResolutionSets(REPO_ROOT);
    const out: Violation[] = [];
    for (const p of _collectTargets(root, scanTrees)) {
        out.push(..._scanFile(p, root, sets));
    }
    return out;
}

// ---------------------------------------------------------------------------
// Output + CLI
// ---------------------------------------------------------------------------

export function format_text(violations: Violation[]): string {
    if (violations.length === 0) {
        return '✅  Every documented package command resolves.';
    }
    const lines: string[] = [
        `❌  Found ${violations.length} unresolvable command reference(s):\n`,
    ];
    for (const v of violations) {
        lines.push(`  🔴 ${v.file}:${v.line}  →  \`${v.token}\` (${v.category}) — ${v.hint}`);
    }
    lines.push(
        '\nRegister the command (src/cli/registry.ts, a Taskfile task, a package.json ' +
            'script, or a src/domains/**/command.md cluster), fix the typo, or mark a ' +
            'deliberate example with <!-- lint-documented-commands: ignore -->.',
    );
    return lines.join('\n');
}

function _jsonDumpsAscii(obj: unknown): string {
    const raw = JSON.stringify(obj, null, 2);
    let out = '';
    for (const ch of raw) {
        const code = ch.codePointAt(0)!;
        if (code < 0x80) {
            out += ch;
        } else {
            for (let k = 0; k < ch.length; k++) {
                out += '\\u' + ch.charCodeAt(k).toString(16).padStart(4, '0');
            }
        }
    }
    return out;
}

interface ParsedArgs {
    format: 'text' | 'json';
    root: string;
    scanRoots: string[];
}

function _argparseError(message: string): never {
    process.stderr.write(`lint_documented_commands: error: ${message}\n`);
    process.exit(2);
}

function _parseArgs(argv: readonly string[]): ParsedArgs {
    let format: 'text' | 'json' = 'text';
    let root = REPO_ROOT;
    const scanRoots: string[] = [];
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i]!;
        if (arg === '--format') {
            const v = argv[++i];
            if (v === undefined) {
                _argparseError('argument --format: expected one argument');
            }
            if (v !== 'text' && v !== 'json') {
                _argparseError(
                    `argument --format: invalid choice: '${v}' (choose from 'text', 'json')`,
                );
            }
            format = v;
        } else if (arg.startsWith('--format=')) {
            const v = arg.slice('--format='.length);
            if (v !== 'text' && v !== 'json') {
                _argparseError(
                    `argument --format: invalid choice: '${v}' (choose from 'text', 'json')`,
                );
            }
            format = v;
        } else if (arg === '--root') {
            const v = argv[++i];
            if (v === undefined) {
                _argparseError('argument --root: expected one argument');
            }
            root = v;
        } else if (arg.startsWith('--root=')) {
            root = arg.slice('--root='.length);
        } else if (arg === '--scan-root') {
            const v = argv[++i];
            if (v === undefined) {
                _argparseError('argument --scan-root: expected one argument');
            }
            scanRoots.push(v);
        } else if (arg.startsWith('--scan-root=')) {
            scanRoots.push(arg.slice('--scan-root='.length));
        } else if (arg === '-h' || arg === '--help') {
            process.stdout.write(
                'usage: lint_documented_commands [-h] [--format {text,json}] [--root ROOT] ' +
                    '[--scan-root DIR ...]\n',
            );
            process.exit(0);
        } else {
            _argparseError(`unrecognized arguments: ${arg}`);
        }
    }
    return { format, root, scanRoots };
}

function main(): number {
    const args = _parseArgs(process.argv.slice(2));
    const scanTrees: ScanTree[] = args.scanRoots.length
        ? args.scanRoots.map((dir) => ({ dir, match: (n: string) => n.endsWith('.md') }))
        : [...DEFAULT_SCAN_TREES];
    let violations: Violation[];
    try {
        violations = scan(args.root, scanTrees);
    } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        process.stderr.write(`Internal error: ${msg}\n`);
        return 3;
    }
    if (args.format === 'json') {
        process.stdout.write(_jsonDumpsAscii(violations) + '\n');
    } else {
        process.stdout.write(format_text(violations) + '\n');
    }
    return violations.length ? 1 : 0;
}

function _isCliEntry(): boolean {
    if (process.argv[1] === undefined) {
        return false;
    }
    const argvUrl = pathToFileURL(path.resolve(process.argv[1])).href;
    if (import.meta.url === argvUrl) {
        return true;
    }
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
    REPO_ROOT,
    DEFAULT_SCAN_TREES,
    SELF_DOCUMENTING_ALLOWLIST,
    main,
};
