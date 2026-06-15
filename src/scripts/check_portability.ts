#!/usr/bin/env tsx
/**
 * Portability checker for agent-config packages.
 *
 * TypeScript twin of `src/scripts/check_portability.py` (ADR-200). Mirrors the
 * Python CLI contract EXACTLY — same flags (`--format`, `--root`), same exit
 * codes (0 clean, 1 violations, 3 internal error), same stdout/stderr split,
 * same finding text, same scan scope and file-walk order. No behaviour
 * changes; latent bugs are replicated and flagged as divergence candidates.
 *
 * Scans dist/agent-src/ and .agent-src.uncondensed/ for project-specific
 * references that violate package portability (the package must work in ANY
 * project).
 *
 * Allowed: references to packages/libraries (laravel, pest, phpstan, etc.)
 * Forbidden: references to specific projects, repos, domains, teams, customers
 */

import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

type Severity = 'error' | 'warning';

interface Violation {
    file: string;
    line: number;
    match: string;
    pattern_name: string;
    severity: Severity;
    context: string; // the full line for review
}

// ── Auto-detected project identifiers ────────────────────────────────────
// Instead of hardcoding project names, we auto-detect them from:
// 1. Git remote URL (org name, repo name)
// 2. composer.json / package.json (package name)
// 3. Directory name (workspace root)
// This makes the checker portable across ANY project.

/** Escape a string for use as a literal inside a RegExp (mirrors `re.escape`). */
function _reEscape(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Mirror `pathlib.PurePath(p).name` WITHOUT resolving `p`.
 *
 * `Path('.').name == ''`, `Path('foo').name == 'foo'`, `Path('/a/b').name ==
 * 'b'`, `Path('a/b/').name == 'b'`. Trailing slashes are ignored; `'.'` / ''
 * have no final component.
 */
function _pyPathName(p: string): string {
    // Drop trailing separators (pathlib normalises them away for `.name`).
    let s = p.replace(/\/+$/, '');
    if (s === '' || s === '.') {
        return '';
    }
    const idx = s.lastIndexOf('/');
    const last = idx === -1 ? s : s.slice(idx + 1);
    // A bare '..' has no name in pathlib; '.' segments are normalised.
    if (last === '.' || last === '..') {
        return '';
    }
    return last;
}

/**
 * Mirror `pathlib.PurePath(p).parent` as a string, WITHOUT resolving.
 *
 * `Path('.').parent == Path('.')` (→ '.'), `Path('foo').parent == Path('.')`,
 * `Path('a/b').parent == Path('a')`, `Path('/a/b').parent == Path('/a')`.
 */
function _pyPathParent(p: string): string {
    const s = p.replace(/\/+$/, '');
    if (s === '' || s === '.') {
        return '.';
    }
    const idx = s.lastIndexOf('/');
    if (idx === -1) {
        return '.';
    }
    if (idx === 0) {
        return '/'; // parent of "/x" is "/"
    }
    return s.slice(0, idx);
}

function _isFile(p: string): boolean {
    try {
        return fs.statSync(p).isFile();
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

/** Auto-detect project-specific identifiers from the project context. */
function _detect_project_identifiers(root: string): Set<string> {
    const identifiers = new Set<string>();

    // 1. Git remote URL
    try {
        const stdout = execFileSync('git', ['remote', 'get-url', 'origin'], {
            cwd: root,
            encoding: 'utf-8',
            timeout: 5000,
            stdio: ['ignore', 'pipe', 'ignore'],
        });
        const url = stdout.trim();
        // Extract from SSH: git@github.com:org/repo.git
        // Extract from HTTPS: https://github.com/org/repo.git
        const parts = url.replace(/\.git/g, '').split(/[:/]/);
        // Last 2 parts are typically org and repo
        for (let part of parts.slice(-2)) {
            part = part.trim();
            if (
                part &&
                !['git', 'github.com', 'gitlab.com', 'bitbucket.org', 'com'].includes(part)
            ) {
                identifiers.add(part);
                // Also add sub-parts split by hyphen (e.g., "event4u-app" → "event4u")
                for (const sub of part.split('-')) {
                    if (sub.length >= 3) {
                        identifiers.add(sub);
                    }
                }
            }
        }
    } catch {
        // FileNotFoundError (git missing) / TimeoutExpired / non-zero exit → skip.
    }

    // 2. composer.json
    const composer = path.join(root, 'composer.json');
    if (_exists(composer)) {
        try {
            const data = JSON.parse(fs.readFileSync(composer, 'utf-8')) as Record<string, unknown>;
            const name = typeof data.name === 'string' ? data.name : '';
            if (name.includes('/')) {
                const idx = name.indexOf('/');
                const vendor = name.slice(0, idx);
                const pkg = name.slice(idx + 1);
                identifiers.add(vendor);
                identifiers.add(pkg);
                for (const sub of pkg.split('-')) {
                    if (sub.length >= 3) {
                        identifiers.add(sub);
                    }
                }
            }
        } catch {
            // JSONDecodeError / ValueError → skip.
        }
    }

    // 3. package.json
    const pkgjson = path.join(root, 'package.json');
    if (_exists(pkgjson)) {
        try {
            const data = JSON.parse(fs.readFileSync(pkgjson, 'utf-8')) as Record<string, unknown>;
            const name = (typeof data.name === 'string' ? data.name : '').replace(/^@+/, '');
            if (name.includes('/')) {
                const idx = name.indexOf('/');
                const scope = name.slice(0, idx);
                const pkg = name.slice(idx + 1);
                identifiers.add(scope);
                identifiers.add(pkg);
            } else if (name) {
                identifiers.add(name);
            }
        } catch {
            // JSONDecodeError / ValueError → skip.
        }
    }

    // 4. Directory name (parent directories of dist/agent-src/)
    const augmentDir = path.join(root, 'dist/agent-src');
    if (_exists(augmentDir)) {
        // The Python original uses the UNRESOLVED `root` (a `pathlib.Path`):
        // `root.name` and `root.parent.name`. For the default `--root .` that
        // yields empty strings (Path('.').name == '' and Path('.').parent.name
        // == ''), so neither identifier is added. Replicate that exactly — do
        // NOT resolve `root` here (resolving would leak the worktree/cwd dir
        // name and over-detect).
        const dirName = _pyPathName(root);
        if (dirName.length >= 3) {
            identifiers.add(dirName);
        }
        // Also check parent (often the org/group directory)
        const parentName = _pyPathName(_pyPathParent(root));
        if (
            parentName.length >= 3 &&
            !['projects', 'src', 'code', 'repos', 'home', 'Users'].includes(parentName)
        ) {
            identifiers.add(parentName);
        }
    }

    // Filter out generic terms that would cause false positives
    const generic = new Set([
        'app', 'api', 'web', 'src', 'lib', 'pkg', 'core', 'main', 'test',
        'config', 'agent', 'tools', 'packages', 'server', 'client', 'common',
    ]);
    for (const g of generic) {
        identifiers.delete(g);
    }

    return identifiers;
}

interface PatternSpec {
    pattern: RegExp;
    name: string;
    severity: Severity;
}

/** Build regex patterns from auto-detected project identifiers. */
function _build_patterns(root: string): { patterns: PatternSpec[]; detected: string[] } {
    const identifiers = _detect_project_identifiers(root);
    const patterns: PatternSpec[] = [];
    const detected: string[] = [...identifiers].sort();

    // Iterate in sorted order for deterministic output. The Python original
    // iterates over a `set` whose order is unspecified; on the real repo
    // `scan_all` finds zero violations so order is moot, but a controlled tree
    // with multiple identifiers could surface a per-line ordering difference.
    // DIVERGENCE CANDIDATE: Python set-iteration order vs. sorted here.
    for (const ident of detected) {
        const escaped = _reEscape(ident);
        // Word boundary match (case-insensitive)
        patterns.push({ pattern: new RegExp(`\\b${escaped}\\b`, 'gi'), name: 'project-name', severity: 'error' });
        // As prefix with separator (db names, container names, env vars)
        patterns.push({ pattern: new RegExp(`\\b${escaped}[-_]\\w+`, 'gi'), name: 'project-derivative', severity: 'warning' });
        // Domain patterns (name.tld)
        patterns.push({ pattern: new RegExp(`\\b${escaped}\\.\\w{2,6}\\b`, 'gi'), name: 'project-domain', severity: 'error' });
        // GitHub org/user patterns
        patterns.push({ pattern: new RegExp(`@${escaped}\\b`, 'gi'), name: 'project-org', severity: 'error' });
    }

    return { patterns, detected };
}

// ── Allowed patterns (NOT violations even if they match above) ──────────
// Generic Laravel/framework patterns that are NOT project-specific
const ALLOWLIST: string[] = [
    String.raw`\.agent-settings\.yml`, // config file reference (YAML)
    String.raw`\.agent-settings\b`, // legacy reference (key=value, migration window)
    'agents/overrides/', // override system
    'app/Modules/', // generic Laravel module pattern
    String.raw`\`App\\`, // namespace pattern explanation
    'app/Http/Controllers/', // generic Laravel path pattern
    'app/Repositories/', // generic pattern in skills/guidelines
    String.raw`\.module-template`, // module template
    'ModuleServiceProvider', // generic module concept
    'app/Services/MyService', // example placeholder
    String.raw`app/Models/\{`, // template placeholder like {Model}
    String.raw`app/Services/\{`, // template placeholder like {Service}
    'agent-config', // refers to the package concept, not a specific project
    'shared.*package', // "shared package" concept
    'package repository', // "package repository" concept
    'src/scripts/mcp_server/', // MCP server module path (road-to-mcp-server.md Phase 1)
    String.raw`scripts\.mcp_server`, // MCP server Python module entrypoint
];

// Directories to scan (only package files, not project-specific agents/)
const SCAN_DIRS = ['dist/agent-src', '.agent-src.uncondensed'];

// Additional root-level files shipped by the package that must also stay
// portable. These are read by agents working on the package itself and —
// for AGENTS.md and copilot-instructions.md — serve as meta docs about
// the package. They must never leak consumer-project identifiers.
const SCAN_ROOT_FILES = ['AGENTS.md', '.github/copilot-instructions.md'];

// Optional blocklist of identifiers from past/adjacent projects that must
// never appear anywhere in the shared package, even when the auto-detector
// would not flag them (e.g. because the repo was renamed or split). The
// list is loaded from the environment variable AGENT_CONFIG_BLOCKLIST
// (comma-separated) so the package itself ships without hardcoding any
// consumer-specific names. Maintainers of a fork with legacy debt can set
// the variable in their CI to catch regressions.
function _load_forbidden_identifiers(): string[] {
    const raw = process.env.AGENT_CONFIG_BLOCKLIST ?? '';
    return raw
        .split(',')
        .map((part) => part.trim())
        .filter((part) => part !== '');
}

const FORBIDDEN_IDENTIFIERS: string[] = _load_forbidden_identifiers();

/** Build patterns from auto-detected project identifiers. */
function _compile_patterns(root: string): { patterns: PatternSpec[]; detected: string[] } {
    return _build_patterns(root);
}

/**
 * Build regex patterns for hardcoded FORBIDDEN_IDENTIFIERS.
 *
 * These apply to every scanned file regardless of auto-detection. They
 * catch leakage from renamed or adjacent projects.
 */
function _compile_forbidden_patterns(): PatternSpec[] {
    const patterns: PatternSpec[] = [];
    for (const ident of FORBIDDEN_IDENTIFIERS) {
        const escaped = _reEscape(ident);
        patterns.push({ pattern: new RegExp(`\\b${escaped}\\b`, 'gi'), name: 'forbidden-identifier', severity: 'error' });
    }
    return patterns;
}

function _compile_allowlist(): RegExp[] {
    return ALLOWLIST.map((p) => new RegExp(p));
}

/** Return every non-overlapping match of `pattern` in `line` (mirrors `finditer`). */
function _finditer(pattern: RegExp, line: string): RegExpExecArray[] {
    const out: RegExpExecArray[] = [];
    // Patterns are constructed with the global flag; reset lastIndex per call.
    pattern.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = pattern.exec(line)) !== null) {
        out.push(m);
        // Guard against zero-width matches looping forever (mirrors `re` which
        // advances past empty matches). None of our patterns are zero-width.
        if (m.index === pattern.lastIndex) {
            pattern.lastIndex += 1;
        }
    }
    return out;
}

function check_file(filepath: string, patterns: PatternSpec[], allowlist: RegExp[]): Violation[] {
    const violations: Violation[] = [];
    let lines: string[];
    try {
        lines = _splitlines(fs.readFileSync(filepath, 'utf-8'));
    } catch {
        return violations;
    }

    let inCodeBlock = false;
    for (let i = 1; i <= lines.length; i++) {
        const line = lines[i - 1] as string;
        const stripped = line.trim();

        // Skip YAML frontmatter
        if (i <= 10 && stripped === '---') {
            continue;
        }

        // Track code blocks
        if (stripped.startsWith('```')) {
            inCodeBlock = !inCodeBlock;
            continue;
        }
        if (inCodeBlock) {
            continue;
        }

        // Check allowlist first
        if (allowlist.some((a) => _search(a, line))) {
            continue;
        }

        for (const { pattern, name, severity } of patterns) {
            for (const m of _finditer(pattern, line)) {
                violations.push({
                    file: filepath,
                    line: i,
                    match: m[0],
                    pattern_name: name,
                    severity,
                    context: stripped,
                });
            }
        }
    }

    return violations;
}

// ── Identity-framing detector ───────────────────────────────────────────
// The package's public identity surface (README, AGENTS, copilot-instructions)
// must read stack-neutral. Laravel is the deepest reference stack today, never
// the headline. This detector flags banned phrases that elevate any single
// stack to identity status. Source-of-truth list lives in the
// road-to-1-15-followups.md roadmap (P0 #1, F1.5).
const _IDENTITY_FRAMING_PATTERNS: Array<{ pattern: RegExp; name: string }> = [
    { pattern: /\bLaravel-first\b/i, name: 'identity-laravel-first' },
    { pattern: /\bfor\s+PHP\s*\/\s*Laravel\s+teams?\b/i, name: 'identity-for-php-laravel-teams' },
    { pattern: /\bfor\s+Laravel\s+teams?\b/i, name: 'identity-for-laravel-teams' },
    { pattern: /\bprimary\s+audience\s*[:=]\s*Laravel\b/i, name: 'identity-primary-audience-laravel' },
    { pattern: /\bbuilt\s+for\s+Laravel\b/i, name: 'identity-built-for-laravel' },
    { pattern: /\bLaravel\s*=\s*primary\b/i, name: 'identity-laravel-equals-primary' },
    { pattern: /\*\*Reference\s+implementation:\s*Laravel\.?\*\*/i, name: 'identity-reference-implementation-laravel' },
];

// Files whose identity framing must stay stack-neutral. Relative to repo root.
const IDENTITY_SCAN_FILES = ['README.md', 'AGENTS.md', '.github/copilot-instructions.md'];

/**
 * Flag banned identity-framing phrases in README / AGENTS / copilot-instructions.
 *
 * The package presents itself as a universal governance system; any phrase
 * that pins identity to a single stack (Laravel-first, built for Laravel,
 * Reference implementation: Laravel as a bolded headline) is a regression.
 */
function check_identity_framing(filepath: string): Violation[] {
    const violations: Violation[] = [];
    let lines: string[];
    try {
        lines = _splitlines(fs.readFileSync(filepath, 'utf-8'));
    } catch {
        return violations;
    }

    for (let i = 1; i <= lines.length; i++) {
        const line = lines[i - 1] as string;
        for (const { pattern, name } of _IDENTITY_FRAMING_PATTERNS) {
            const m = _search(pattern, line);
            if (m) {
                violations.push({
                    file: filepath,
                    line: i,
                    match: m[0],
                    pattern_name: name,
                    severity: 'error',
                    context: line.trim(),
                });
            }
        }
    }
    return violations;
}

// ── Task-command detector ───────────────────────────────────────────────
// Artefact files shipped in the package must not reference `task <name>`
// invocations (per augment-portability rule). Consumer projects may not
// have Taskfile installed; agents must use direct script paths instead.
const ARTIFACT_SUBDIRS = ['skills', 'rules', 'commands', 'guidelines', 'personas', 'contexts'];

// Inline code: `task foo` or `task foo-bar` or `task foo:bar`
const _TASK_INLINE_RE = /`task\s+([a-z][a-z0-9:_-]*)`/g;
// Code-fence line: "task foo …" (optional leading whitespace)
const _TASK_FENCE_RE = /^\s*task\s+([a-z][a-z0-9:_-]*)\b/;

// Files that legitimately document the forbidden pattern — they define
// the rule itself. Any path containing one of these suffixes is skipped
// by the task-invocation detector (but still scanned for layer 1 + 2).
const _TASK_DETECTOR_SKIP = [
    'rules/augment-portability.md',
    'contexts/communication/rules-auto/augment-portability-mechanics.md',
    'rules/package-ci-checks.md',
    'contexts/communication/rules-auto/package-ci-checks-mechanics.md',
    'contexts/contracts/agents-md-anatomy.md',
    // roadmap-ci-steps-policy defines the gate by listing the forbidden
    // CI-shaped literals; its mechanics doc and the execution loop +
    // authoring skill enumerate the same literals to detect them.
    'rules/roadmap-ci-steps-policy.md',
    'contexts/execution/roadmap-process-loop.md',
    'skills/roadmap-writing/SKILL.md',
];

/** Flag `task <cmd>` invocations in inline code or code fence lines. */
function check_task_invocations(filepath: string): Violation[] {
    const violations: Violation[] = [];
    let lines: string[];
    try {
        lines = _splitlines(fs.readFileSync(filepath, 'utf-8'));
    } catch {
        return violations;
    }

    let inCodeBlock = false;
    for (let i = 1; i <= lines.length; i++) {
        const line = lines[i - 1] as string;
        const stripped = line.trim();
        if (stripped.startsWith('```')) {
            inCodeBlock = !inCodeBlock;
            continue;
        }
        if (inCodeBlock) {
            const m = _search(_TASK_FENCE_RE, line);
            if (m) {
                violations.push({
                    file: filepath,
                    line: i,
                    match: m[0].trim(),
                    pattern_name: 'task-invocation',
                    severity: 'error',
                    context: stripped,
                });
            }
        } else {
            for (const m of _finditer(_TASK_INLINE_RE, line)) {
                violations.push({
                    file: filepath,
                    line: i,
                    match: m[0],
                    pattern_name: 'task-invocation',
                    severity: 'error',
                    context: stripped,
                });
            }
        }
    }

    return violations;
}

// ── Direct script-invocation detector ───────────────────────────────────
// Artefacts shipped to consumers must use the `./agent-config` CLI for
// commands it already covers. Direct `python3 scripts/…` / `bash scripts/…`
// invocations only work inside the package repo, not in a consumer project
// where the scripts live under node_modules/ or vendor/.
//
// Each entry: (regex, suggested replacement). Patterns match inside inline
// backticks OR anywhere on a code-fence line.
const _CLI_INVOCATION_MAP: Array<{ pattern: RegExp; replacement: string }> = [
    { pattern: /python3\s+scripts\/mcp_render\.py\s+--check\b/, replacement: './agent-config mcp:check' },
    { pattern: /python3\s+scripts\/mcp_render\.py\b/, replacement: './agent-config mcp:render' },
    {
        pattern: /python3\s+\.(?:agent-src|augment)\/scripts\/update_roadmap_progress\.py\s+--check\b/,
        replacement: './agent-config roadmap:progress-check',
    },
    {
        pattern: /python3\s+\.(?:agent-src|augment)\/scripts\/update_roadmap_progress\.py\b/,
        replacement: './agent-config roadmap:progress',
    },
    { pattern: /bash\s+scripts\/first-run\.sh\b/, replacement: './agent-config first-run' },
    { pattern: /(?:PYTHONPATH=\S+\s+)?python3\s+-m\s+work_engine\b/, replacement: './agent-config implement-ticket' },
    { pattern: /(?:PYTHONPATH=\S+\s+)?python3\s+-m\s+implement_ticket\b/, replacement: './agent-config implement-ticket' },
    { pattern: /python3\s+scripts\/memory_lookup\.py\b/, replacement: './agent-config memory:lookup' },
    { pattern: /python3\s+scripts\/memory_signal\.py\b/, replacement: './agent-config memory:signal' },
    { pattern: /python3\s+scripts\/memory_hash\.py\b/, replacement: './agent-config memory:hash' },
    { pattern: /python3\s+scripts\/check_memory_proposal\.py\b/, replacement: './agent-config memory:check-proposal' },
    { pattern: /python3\s+scripts\/check_memory\.py\b/, replacement: './agent-config memory:check' },
    { pattern: /python3\s+scripts\/check_proposal\.py\b/, replacement: './agent-config proposal:check' },
    { pattern: /python3\s+scripts\/refine_ticket_detect\.py\b/, replacement: './agent-config refine-ticket:detect' },
];

// Paths that legitimately document the raw invocations (e.g. the CLI's
// own help, the portability rule that defines the mapping).
const _CLI_DETECTOR_SKIP = [
    'rules/augment-portability.md',
    'contexts/communication/rules-auto/augment-portability-mechanics.md',
];

/** Flag direct script invocations that should go through `./agent-config`. */
function check_cli_invocations(filepath: string): Violation[] {
    const violations: Violation[] = [];
    let lines: string[];
    try {
        lines = _splitlines(fs.readFileSync(filepath, 'utf-8'));
    } catch {
        return violations;
    }

    let inCodeBlock = false;
    for (let i = 1; i <= lines.length; i++) {
        const line = lines[i - 1] as string;
        const stripped = line.trim();
        if (stripped.startsWith('```')) {
            inCodeBlock = !inCodeBlock;
            continue;
        }

        // In prose lines, only check content inside inline `...` spans to
        // avoid false positives in running text. In code fences, check the
        // whole line.
        let segments: string[];
        if (inCodeBlock) {
            segments = [line];
        } else {
            segments = _findall_inline_code(line);
        }

        for (const seg of segments) {
            for (const { pattern, replacement } of _CLI_INVOCATION_MAP) {
                const m = _search(pattern, seg);
                if (m) {
                    violations.push({
                        file: filepath,
                        line: i,
                        match: m[0],
                        pattern_name: `cli-bypass → use \`${replacement}\``,
                        severity: 'error',
                        context: stripped,
                    });
                    break; // one hit per segment is enough
                }
            }
        }
    }

    return violations;
}

function scan_all(root: string): { violations: Violation[]; detected: string[] } {
    const { patterns, detected } = _compile_patterns(root);
    const forbidden = _compile_forbidden_patterns();
    const allowlist = _compile_allowlist();
    const violations: Violation[] = [];

    // Layer 1 + 2: full package content
    for (const scanDir of SCAN_DIRS) {
        const d = path.join(root, scanDir);
        if (!_exists(d)) {
            continue;
        }
        for (const f of _rglobMdSorted(d)) {
            violations.push(...check_file(f, [...patterns, ...forbidden], allowlist));
        }
    }

    // Layer 2 only: root files (auto-detected identifiers are expected here)
    for (const rel of SCAN_ROOT_FILES) {
        const f = path.join(root, rel);
        if (_isFile(f)) {
            violations.push(...check_file(f, forbidden, allowlist));
        }
    }

    // Layer 3 + 4: artefact-subdir-only scans (task invocations, CLI bypass)
    for (const scanDir of SCAN_DIRS) {
        const base = path.join(root, scanDir);
        if (!_exists(base)) {
            continue;
        }
        for (const sub of ARTIFACT_SUBDIRS) {
            const d = path.join(base, sub);
            if (!_exists(d)) {
                continue;
            }
            for (const f of _rglobMdSorted(d)) {
                const pathStr = f;
                if (!_TASK_DETECTOR_SKIP.some((skip) => pathStr.endsWith(skip))) {
                    violations.push(...check_task_invocations(f));
                }
                if (!_CLI_DETECTOR_SKIP.some((skip) => pathStr.endsWith(skip))) {
                    violations.push(...check_cli_invocations(f));
                }
            }
        }
    }

    // Layer 5: identity-framing scan on the public identity surface
    for (const rel of IDENTITY_SCAN_FILES) {
        const f = path.join(root, rel);
        if (_isFile(f)) {
            violations.push(...check_identity_framing(f));
        }
    }

    return { violations, detected };
}

function format_text(violations: Violation[], detected: string[]): string {
    const header = detected.length > 0 ? `Auto-detected identifiers: ${detected.join(', ')}\n` : '';
    if (violations.length === 0) {
        return `${header}✅  No portability violations found.`;
    }
    const lines: string[] = [`${header}❌  Found ${violations.length} portability violation(s):\n`];
    for (const v of violations) {
        const icon = v.severity === 'error' ? '🔴' : '🟡';
        lines.push(`  ${icon} ${v.file}:${v.line} — [${v.pattern_name}] \`${v.match}\``);
        lines.push(`      ${v.context}`);
    }
    return lines.join('\n');
}

// ── Helpers reproducing Python str / re semantics ─────────────────────────

/**
 * Mirror Python's `str.splitlines()` on the subset of separators that occur
 * in source files: a trailing newline does NOT produce a final empty element
 * (unlike JS `String.split('\n')`).
 */
function _splitlines(text: string): string[] {
    if (text === '') {
        return [];
    }
    // Normalise CRLF / CR to LF, then split; drop a single trailing empty
    // segment produced by a terminating newline (Python semantics).
    const normalised = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const parts = normalised.split('\n');
    if (parts.length > 0 && parts[parts.length - 1] === '') {
        parts.pop();
    }
    return parts;
}

/** Mirror `re.Pattern.search` — first match or null. Resets global lastIndex. */
function _search(pattern: RegExp, s: string): RegExpExecArray | null {
    if (pattern.global) {
        pattern.lastIndex = 0;
    }
    return pattern.exec(s);
}

/** Mirror `re.findall(r"\`([^\`]+)\`", line)` — inline backtick span contents. */
function _findall_inline_code(line: string): string[] {
    const re = /`([^`]+)`/g;
    const out: string[] = [];
    let m: RegExpExecArray | null;
    while ((m = re.exec(line)) !== null) {
        out.push(m[1] as string);
    }
    return out;
}

/**
 * Mirror `sorted(d.rglob("*.md"))` — every `.md` descendant, sorted by full
 * path string (the key Python uses on POSIX hosts).
 */
function _rglobMdSorted(root: string): string[] {
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
            if (ent.isDirectory() || (ent.isSymbolicLink() && _isDirStat(full))) {
                walk(full);
            }
        }
    };
    walk(root);
    out.sort();
    return out;
}

function _isDirStat(p: string): boolean {
    try {
        return fs.statSync(p).isDirectory();
    } catch {
        return false;
    }
}

// ── CLI ────────────────────────────────────────────────────────────────

interface ParsedArgs {
    format: 'text' | 'json';
    root: string;
}

/**
 * Mirror the argparse contract: `--format {text,json}` (default text) and
 * `--root <path>` (default `.`). On an unknown flag / bad choice / missing
 * value, argparse prints usage to stderr and exits 2. This twin reproduces
 * the exit code; the usage text differs (flagged as a divergence candidate).
 */
function parseArgs(argv: readonly string[]): ParsedArgs {
    let format: 'text' | 'json' = 'text';
    let root = '.';
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i] as string;
        if (arg === '--format' || arg.startsWith('--format=')) {
            let value: string | undefined;
            if (arg.includes('=')) {
                value = arg.slice('--format='.length);
            } else {
                value = argv[++i];
            }
            if (value !== 'text' && value !== 'json') {
                process.stderr.write(
                    `usage: check_portability [-h] [--format {text,json}] [--root ROOT]\n`,
                );
                process.exit(2);
            }
            format = value;
        } else if (arg === '--root' || arg.startsWith('--root=')) {
            let value: string | undefined;
            if (arg.includes('=')) {
                value = arg.slice('--root='.length);
            } else {
                value = argv[++i];
            }
            if (value === undefined) {
                process.stderr.write(
                    `usage: check_portability [-h] [--format {text,json}] [--root ROOT]\n`,
                );
                process.exit(2);
            }
            root = value;
        } else {
            process.stderr.write(
                `usage: check_portability [-h] [--format {text,json}] [--root ROOT]\n`,
            );
            process.exit(2);
        }
    }
    return { format, root };
}

function main(): number {
    const args = parseArgs(process.argv.slice(2));

    let result: { violations: Violation[]; detected: string[] };
    try {
        result = scan_all(args.root);
    } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        process.stderr.write(`Internal error: ${message}\n`);
        return 3;
    }

    const { violations, detected } = result;
    if (args.format === 'json') {
        const payload = { detected, violations };
        process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
    } else {
        process.stdout.write(`${format_text(violations, detected)}\n`);
    }

    return violations.length > 0 ? 1 : 0;
}

// Run the CLI only when executed directly, not when imported by tests.
const isCliEntry =
    process.argv[1] !== undefined &&
    import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isCliEntry) {
    process.exit(main());
}

export {
    type Violation,
    type Severity,
    _detect_project_identifiers,
    _build_patterns,
    _load_forbidden_identifiers,
    check_file,
    check_identity_framing,
    check_task_invocations,
    check_cli_invocations,
    scan_all,
    format_text,
    main,
    parseArgs,
};
