#!/usr/bin/env tsx
/**
 * README quality linter for agent-config repositories.
 *
 * TypeScript twin of `src/scripts/readme_linter.py` (ADR-092 — Python→TS
 * migration, Phase 8 / Wave 8b). The CLI contract is mirrored EXACTLY —
 * the positional `readme` arg, the `--root` / `--format` / `--strict`
 * flags, exit codes (0 pass · 1 warnings · 2 errors / strict-warnings ·
 * 3 README-not-found / internal error), the stdout/stderr split, and
 * byte-identical messages AND byte-identical JSON output
 * (`json.dumps(indent=2)` — insertion-order keys, 2-space indent,
 * `(", ", ": ")` separators, ensure_ascii=True).
 *
 * Detects weak, misleading, or incomplete READMEs by cross-checking
 * against actual repository files (Taskfile.yml, package.json, etc.).
 *
 * No behaviour changes — latent Python quirks replicated.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

type Severity = 'error' | 'warning' | 'info';
type RepoType = 'package' | 'app' | 'cli' | 'internal' | 'unknown';
type Status = 'pass' | 'pass_with_warnings' | 'fail';

// --- Patterns ---
// Python re.MULTILINE → JS 'm'. Python `.` (no DOTALL) excludes newline by
// default, matching JS default. `^# .+` matches a line that begins with "# ".

const H1_PATTERN = /^# .+/m;
const H2_PATTERN = /^## (.+?)[ \t]*$/gm;
// re.MULTILINE in Python: `$` matches before a newline AND end-of-string.
// `\s*$` in Python multiline matches trailing whitespace up to the newline;
// here we use `[ \t]*$` plus the 'm' flag (JS `$` matches before \n with 'm').
const CODE_BLOCK_PATTERN = /```[\s\S]*?```/gm;
const INLINE_COMMAND_PATTERN = /`((?:task|npm run|make)\s+[\w:_-]+(?:\s+[\w:_-]+)?)`/g;

// Built-in commands that are always valid (not custom scripts)
const BUILTIN_COMMANDS = new Set<string>([
    'composer install', 'composer update', 'composer require', 'composer remove',
    'npm install', 'npm uninstall', 'npm init', 'npm test', 'npm start',
    'yarn add', 'yarn remove', 'yarn install',
    'pnpm add', 'pnpm remove', 'pnpm install',
    'php artisan', 'cargo build', 'cargo test', 'go build', 'go test',
    'git clone', 'git submodule',
]);
// Referenced to mirror the module-level constant in the Python original
// (it is defined but unused there); keeps the symbol "live" for the linter.
void BUILTIN_COMMANDS;

const INSTALL_HEADINGS = new Set<string>([
    'installation', 'install', 'setup', 'getting started', 'quickstart',
    'how to install', 'installing',
]);
const USAGE_HEADINGS = new Set<string>([
    'usage', 'quickstart', 'quick start', 'getting started',
    'how to use', 'how it works', 'basic usage', 'examples',
    'minimal example', 'minimal usage',
]);
const COMPAT_HEADINGS = new Set<string>([
    'requirements', 'compatibility', 'prerequisites', 'supported versions',
    'system requirements', 'dependencies',
]);
const DEV_HEADINGS = new Set<string>([
    'development', 'contributing', 'testing', 'dev', 'local development',
    'developer guide', 'running tests', 'development setup',
]);
const ARCHITECTURE_HEADINGS = new Set<string>([
    'architecture', 'internals', 'design', 'how it works internally',
    'technical details', 'implementation',
]);

const GENERIC_BOILERPLATE: RegExp[] = [
    /\bmodern and scalable\b/gi,
    /\bpowerful and flexible\b/gi,
    /\bsimple and intuitive\b/gi,
    /\bblazing fast\b/gi,
    /\bnext[- ]gen(?:eration)?\b/gi,
    /\bworld[- ]class\b/gi,
    /\bcutting[- ]edge\b/gi,
    /\bseamless(?:ly)? integrat/gi,
    /\brobust and reliable\b/gi,
    /\blightweight yet powerful\b/gi,
];

const OVERLOADED_LINE_THRESHOLD = 750;
const WEAK_QUICKSTART_LINE_GAP = 80;

// --- Data classes ---

export interface Issue {
    severity: Severity;
    code: string;
    message: string;
}

export interface ReadmeLintResult {
    file: string;
    repo_type: RepoType;
    status: Status;
    issues: Issue[];
    line_count: number;
}

export interface RepoContext {
    repo_type: RepoType;
    has_composer: boolean;
    has_package_json: boolean;
    has_taskfile: boolean;
    has_makefile: boolean;
    has_dockerfile: boolean;
    has_tests: boolean;
    has_ci: boolean;
    taskfile_tasks: string[];
    npm_scripts: string[];
    composer_scripts: string[];
    make_targets: string[];
}

export function newRepoContext(): RepoContext {
    return {
        repo_type: 'unknown',
        has_composer: false,
        has_package_json: false,
        has_taskfile: false,
        has_makefile: false,
        has_dockerfile: false,
        has_tests: false,
        has_ci: false,
        taskfile_tasks: [],
        npm_scripts: [],
        composer_scripts: [],
        make_targets: [],
    };
}

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

/** Mirror `re.findall` for a global regex with one capture group → group 1. */
function _findallGroup1(re: RegExp, text: string): string[] {
    const out: string[] = [];
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
        out.push(m[1] as string);
        if (m.index === re.lastIndex) {
            re.lastIndex += 1;
        }
    }
    return out;
}

/** Mirror `re.findall` for a global regex with no capture group → full matches. */
function _findallFull(re: RegExp, text: string): string[] {
    const out: string[] = [];
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
        out.push(m[0]);
        if (m.index === re.lastIndex) {
            re.lastIndex += 1;
        }
    }
    return out;
}

// --- Repo detection ---

export function detect_repo_context(root: string): RepoContext {
    const ctx = newRepoContext();
    ctx.has_composer = _exists(path.join(root, 'composer.json'));
    ctx.has_package_json = _exists(path.join(root, 'package.json'));
    ctx.has_taskfile = _exists(path.join(root, 'Taskfile.yml')) || _exists(path.join(root, 'Taskfile.yaml'));
    ctx.has_makefile = _exists(path.join(root, 'Makefile'));
    ctx.has_dockerfile = _exists(path.join(root, 'Dockerfile')) || _exists(path.join(root, 'docker-compose.yml'));
    ctx.has_tests = _isDir(path.join(root, 'tests')) || _isDir(path.join(root, 'test'));
    ctx.has_ci = _isDir(path.join(root, '.github', 'workflows'));

    ctx.taskfile_tasks = _extract_taskfile_tasks(root);
    ctx.npm_scripts = _extract_npm_scripts(root);
    ctx.composer_scripts = _extract_composer_scripts(root);
    ctx.make_targets = _extract_make_targets(root);

    ctx.repo_type = _detect_repo_type(root, ctx);
    return ctx;
}

function _readJson(p: string): Record<string, unknown> | null {
    try {
        return JSON.parse(fs.readFileSync(p, 'utf-8')) as Record<string, unknown>;
    } catch {
        return null;
    }
}

function _detect_repo_type(root: string, ctx: RepoContext): RepoType {
    if (ctx.has_composer) {
        const data = _readJson(path.join(root, 'composer.json'));
        if (data !== null) {
            const pkg_type = typeof data.type === 'string' ? data.type : '';
            if (pkg_type === 'library' || pkg_type === 'composer-plugin' || pkg_type === 'symfony-bundle') {
                return 'package';
            }
            if (!_exists(path.join(root, 'artisan')) && !_exists(path.join(root, 'public', 'index.php'))) {
                return 'package';
            }
        }
    }

    if (ctx.has_package_json) {
        const data = _readJson(path.join(root, 'package.json'));
        if (data !== null) {
            if (data.main || data.exports || data.module) {
                return 'package';
            }
        }
    }

    const bin_dir = path.join(root, 'bin');
    if (_isDir(bin_dir)) {
        let hasEntries = false;
        try {
            hasEntries = fs.readdirSync(bin_dir).length > 0;
        } catch {
            hasEntries = false;
        }
        if (hasEntries) {
            return 'cli';
        }
    }

    if (_exists(path.join(root, 'artisan')) || _exists(path.join(root, 'public', 'index.php'))) {
        return 'app';
    }
    if (ctx.has_dockerfile && _isDir(path.join(root, 'src'))) {
        return 'app';
    }

    const augment_dir = path.join(root, '.augment');
    const agents_dir = path.join(root, 'agents');
    if (_isDir(augment_dir) || _isDir(agents_dir)) {
        return 'internal';
    }

    return 'unknown';
}

function _extract_taskfile_tasks(root: string): string[] {
    const tasks: string[] = [];
    const pattern = /^\s{2}([\w:-]+):/gm;
    for (const name of ['Taskfile.yml', 'Taskfile.yaml']) {
        const p = path.join(root, name);
        if (_exists(p)) {
            try {
                tasks.push(..._findallGroup1(pattern, fs.readFileSync(p, 'utf-8')));
            } catch {
                /* OSError → pass */
            }
            break;
        }
    }
    const taskfilesDir = path.join(root, 'taskfiles');
    if (_isDir(taskfilesDir)) {
        let names: string[] = [];
        try {
            names = fs.readdirSync(taskfilesDir).filter((n) => n.endsWith('.yml'));
        } catch {
            names = [];
        }
        names.sort();
        for (const name of names) {
            try {
                tasks.push(..._findallGroup1(pattern, fs.readFileSync(path.join(taskfilesDir, name), 'utf-8')));
            } catch {
                /* OSError → pass */
            }
        }
    }
    return tasks;
}

function _extract_npm_scripts(root: string): string[] {
    const p = path.join(root, 'package.json');
    if (_exists(p)) {
        const data = _readJson(p);
        if (data !== null) {
            const scripts = data.scripts;
            if (scripts && typeof scripts === 'object') {
                return Object.keys(scripts as Record<string, unknown>);
            }
            return [];
        }
    }
    return [];
}

function _extract_composer_scripts(root: string): string[] {
    const p = path.join(root, 'composer.json');
    if (_exists(p)) {
        const data = _readJson(p);
        if (data !== null) {
            const scripts = data.scripts;
            if (scripts && typeof scripts === 'object') {
                return Object.keys(scripts as Record<string, unknown>);
            }
            return [];
        }
    }
    return [];
}

function _extract_make_targets(root: string): string[] {
    const p = path.join(root, 'Makefile');
    if (_exists(p)) {
        try {
            const text = fs.readFileSync(p, 'utf-8');
            return _findallGroup1(/^([\w_-]+)\s*:/gm, text);
        } catch {
            /* OSError → pass */
        }
    }
    return [];
}

// --- Core checks ---

export function lint_readme(readme_path: string, repo_root: string): ReadmeLintResult {
    const issues: Issue[] = [];
    const text = fs.readFileSync(readme_path, 'utf-8');
    const lines = _splitlines(text);
    const line_count = lines.length;
    const ctx = detect_repo_context(repo_root);

    const headings = _findallGroup1(H2_PATTERN, text).map((h) => h.trim());
    const headings_lower = new Set(headings.map((h) => h.toLowerCase()));

    // 1. Missing title
    if (!H1_PATTERN.test(text)) {
        issues.push({ severity: 'error', code: 'readme_missing_title', message: 'No H1 heading found' });
    }

    // 2. Missing summary
    _check_summary(text, issues);

    // 3. Missing installation
    _check_installation(headings_lower, ctx, issues);

    // 4. Missing usage example
    _check_usage_example(text, headings_lower, ctx, issues);

    // 5. Weak quickstart
    _check_quickstart_distance(text, headings, issues);

    // 6. Missing compatibility (packages)
    _check_compatibility(headings_lower, ctx, issues);

    // 7. Generic boilerplate
    _check_boilerplate(text, issues);

    // 8. Missing dev workflow
    _check_dev_workflow(headings_lower, ctx, issues);

    // 9. Command mismatches
    _check_command_mismatches(text, ctx, issues);

    // 10. Bad section order
    _check_section_order(headings, issues);

    // 11. Overloaded README
    _check_overloaded(line_count, issues);

    const has_errors = issues.some((i) => i.severity === 'error');
    const has_warnings = issues.some((i) => i.severity === 'warning');
    let status: Status;
    if (has_errors) {
        status = 'fail';
    } else if (has_warnings) {
        status = 'pass_with_warnings';
    } else {
        status = 'pass';
    }

    return {
        file: readme_path,
        repo_type: ctx.repo_type,
        status,
        issues,
        line_count,
    };
}

/** Mirror Python `str.splitlines()` — Unicode line-boundary aware. */
function _splitlines(text: string): string[] {
    if (text === "") {
        return [];
    }
    // Python str.splitlines boundary set: \n \r \r\n \v \f \x1c \x1d
    // \x1e \x85 \u2028 \u2029. No trailing empty element at EOS.
    // eslint-disable-next-line no-control-regex
    const BOUNDARY = /\r\n|[\n\r\v\f\x1c\x1d\x1e\x85\u2028\u2029]/g;
    const out: string[] = [];
    let last = 0;
    BOUNDARY.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = BOUNDARY.exec(text)) !== null) {
        out.push(text.slice(last, m.index));
        last = m.index + m[0].length;
    }
    if (last < text.length) {
        out.push(text.slice(last));
    }
    return out;
}

// --- Individual checks ---

function _check_summary(text: string, issues: Issue[]): void {
    H1_PATTERN.lastIndex = 0;
    const h1 = H1_PATTERN.exec(text);
    if (!h1) {
        return;
    }
    const end = h1.index + h1[0].length;
    const after_title = text.slice(end, end + 300);
    const after_stripped = after_title.trim();
    if (!after_stripped || after_stripped.startsWith('## ') || after_stripped.startsWith('```')) {
        issues.push({ severity: 'warning', code: 'readme_missing_summary', message: 'No summary paragraph after title' });
    }
}

function _intersects(a: Set<string>, b: Set<string>): boolean {
    for (const x of a) {
        if (b.has(x)) {
            return true;
        }
    }
    return false;
}

function _check_installation(headings_lower: Set<string>, ctx: RepoContext, issues: Issue[]): void {
    if (ctx.repo_type === 'unknown') {
        return;
    }
    if (!_intersects(headings_lower, INSTALL_HEADINGS)) {
        const severity: Severity =
            ctx.repo_type === 'package' || ctx.repo_type === 'app' || ctx.repo_type === 'cli' ? 'error' : 'warning';
        issues.push({
            severity,
            code: 'readme_missing_installation',
            message: `No installation/setup section found (${ctx.repo_type} repo)`,
        });
    }
}

function _check_usage_example(text: string, headings_lower: Set<string>, ctx: RepoContext, issues: Issue[]): void {
    if (ctx.repo_type === 'unknown') {
        return;
    }
    const has_usage_heading = _intersects(headings_lower, USAGE_HEADINGS);
    const code_blocks = _findallFull(CODE_BLOCK_PATTERN, text);
    if (code_blocks.length === 0) {
        issues.push({
            severity: ctx.repo_type === 'package' ? 'error' : 'warning',
            code: 'readme_missing_usage_example',
            message: 'No code blocks found — likely missing usage examples',
        });
    } else if (!has_usage_heading && (ctx.repo_type === 'package' || ctx.repo_type === 'cli')) {
        issues.push({
            severity: 'warning',
            code: 'readme_missing_usage_example',
            message: 'No usage/quickstart section heading found',
        });
    }
}

function _check_quickstart_distance(text: string, headings: string[], issues: Issue[]): void {
    void headings;
    let install_line: number | null = null;
    let first_code_line: number | null = null;
    const lines = _splitlines(text);
    for (let i = 0; i < lines.length; i += 1) {
        const line = lines[i] as string;
        if (install_line === null) {
            const m = /^## (.+)/.exec(line);
            if (m && INSTALL_HEADINGS.has((m[1] as string).trim().toLowerCase())) {
                install_line = i;
            }
        }
        if (first_code_line === null && line.startsWith('```')) {
            first_code_line = i;
        }
    }

    if (install_line !== null && first_code_line !== null) {
        const gap = first_code_line - install_line;
        if (gap > WEAK_QUICKSTART_LINE_GAP) {
            issues.push({
                severity: 'warning',
                code: 'readme_weak_quickstart',
                message: `First code block is ${gap} lines after install heading`,
            });
        }
    }
}

function _check_compatibility(headings_lower: Set<string>, ctx: RepoContext, issues: Issue[]): void {
    if (ctx.repo_type !== 'package') {
        return;
    }
    if (!_intersects(headings_lower, COMPAT_HEADINGS)) {
        issues.push({
            severity: 'warning',
            code: 'readme_missing_compatibility',
            message: 'Package repo has no requirements/compatibility section',
        });
    }
}

function _check_boilerplate(text: string, issues: Issue[]): void {
    const matches: string[] = [];
    for (const pattern of GENERIC_BOILERPLATE) {
        matches.push(..._findallFull(pattern, text));
    }
    if (matches.length > 0) {
        const examples = matches.slice(0, 3).map((m) => `"${m}"`).join(', ');
        issues.push({
            severity: 'warning',
            code: 'readme_generic_boilerplate',
            message: `Generic boilerplate detected: ${examples}`,
        });
    }
}

function _check_dev_workflow(headings_lower: Set<string>, ctx: RepoContext, issues: Issue[]): void {
    if (!(ctx.has_tests || ctx.has_ci)) {
        return;
    }
    if (!_intersects(headings_lower, DEV_HEADINGS)) {
        issues.push({
            severity: 'warning',
            code: 'readme_missing_dev_workflow',
            message: 'Repo has tests/CI but README has no development/testing section',
        });
    }
}

function _check_command_mismatches(text: string, ctx: RepoContext, issues: Issue[]): void {
    const documented_commands = _findallGroup1(INLINE_COMMAND_PATTERN, text);
    if (documented_commands.length === 0) {
        return;
    }

    const known_commands = new Set<string>();
    for (const task of ctx.taskfile_tasks) {
        known_commands.add(`task ${task}`);
    }
    for (const script of ctx.npm_scripts) {
        known_commands.add(`npm ${script}`);
        known_commands.add(`npm run ${script}`);
    }
    for (const script of ctx.composer_scripts) {
        known_commands.add(`composer ${script}`);
    }
    for (const target of ctx.make_targets) {
        known_commands.add(`make ${target}`);
    }

    if (known_commands.size === 0) {
        return;
    }

    const mismatches: string[] = [];
    for (const cmd of documented_commands) {
        const cmd_clean = cmd.trim();
        let matched = false;
        for (const known of known_commands) {
            if (cmd_clean.startsWith(known) || known.startsWith(cmd_clean)) {
                matched = true;
                break;
            }
        }
        if (!matched) {
            mismatches.push(cmd_clean);
        }
    }

    if (mismatches.length > 0) {
        const examples = mismatches.slice(0, 5).map((m) => `\`${m}\``).join(', ');
        issues.push({
            severity: 'warning',
            code: 'readme_command_mismatch',
            message: `Commands in README not found in repo: ${examples}`,
        });
    }
}

function _check_section_order(headings: string[], issues: Issue[]): void {
    let install_idx: number | null = null;
    let arch_idx: number | null = null;
    const installOrUsage = new Set<string>([...INSTALL_HEADINGS, ...USAGE_HEADINGS]);
    for (let i = 0; i < headings.length; i += 1) {
        const h_lower = (headings[i] as string).toLowerCase();
        if (install_idx === null && installOrUsage.has(h_lower)) {
            install_idx = i;
        }
        if (arch_idx === null && ARCHITECTURE_HEADINGS.has(h_lower)) {
            arch_idx = i;
        }
    }

    if (arch_idx !== null && install_idx !== null && arch_idx < install_idx) {
        issues.push({
            severity: 'warning',
            code: 'readme_bad_section_order',
            message: 'Architecture/internals section appears before installation/usage',
        });
    }
}

function _check_overloaded(line_count: number, issues: Issue[]): void {
    if (line_count > OVERLOADED_LINE_THRESHOLD) {
        issues.push({
            severity: 'warning',
            code: 'readme_overloaded',
            message:
                `README has ${line_count} lines (threshold: ${OVERLOADED_LINE_THRESHOLD}).` +
                ' Consider moving deep content to /docs',
        });
    }
}

// --- json.dumps(indent=2) replica (insertion-order keys, ensure_ascii) -------

function _jsonDumpsIndent2(obj: unknown): string {
    const pad = '  ';
    function enc(value: unknown, depth: number): string {
        if (value === null || value === undefined) {
            return 'null';
        }
        if (typeof value === 'boolean') {
            return value ? 'true' : 'false';
        }
        if (typeof value === 'number') {
            return String(value);
        }
        if (typeof value === 'string') {
            return encStr(value);
        }
        if (Array.isArray(value)) {
            if (value.length === 0) {
                return '[]';
            }
            const inner = value.map((v) => pad.repeat(depth + 1) + enc(v, depth + 1));
            return '[\n' + inner.join(',\n') + '\n' + pad.repeat(depth) + ']';
        }
        const o = value as Record<string, unknown>;
        const keys = Object.keys(o);
        if (keys.length === 0) {
            return '{}';
        }
        const inner = keys.map((k) => pad.repeat(depth + 1) + encStr(k) + ': ' + enc(o[k], depth + 1));
        return '{\n' + inner.join(',\n') + '\n' + pad.repeat(depth) + '}';
    }
    function encStr(s: string): string {
        let out = '"';
        for (const ch of s) {
            const cp = ch.codePointAt(0) as number;
            if (ch === '"') out += '\\"';
            else if (ch === '\\') out += '\\\\';
            else if (ch === '\n') out += '\\n';
            else if (ch === '\r') out += '\\r';
            else if (ch === '\t') out += '\\t';
            else if (ch === '\b') out += '\\b';
            else if (ch === '\f') out += '\\f';
            else if (cp < 0x20) out += '\\u' + cp.toString(16).padStart(4, '0');
            else if (cp < 0x7f) out += ch;
            else if (cp > 0xffff) {
                const v = cp - 0x10000;
                const hi = 0xd800 + (v >> 10);
                const lo = 0xdc00 + (v & 0x3ff);
                out += '\\u' + hi.toString(16).padStart(4, '0');
                out += '\\u' + lo.toString(16).padStart(4, '0');
            } else {
                out += '\\u' + cp.toString(16).padStart(4, '0');
            }
        }
        return out + '"';
    }
    return enc(obj, 0);
}

// --- Output formatting ---

export function format_text(result: ReadmeLintResult): string {
    const status_icon: Record<string, string> = { pass: '✅', pass_with_warnings: '⚠️', fail: '❌' };
    const lines: string[] = [
        `${status_icon[result.status] ?? '?'} ${result.file} ` + `(type: ${result.repo_type}, ${result.line_count} lines)`,
    ];

    if (result.issues.length === 0) {
        lines.push('  No issues found.');
        return lines.join('\n');
    }

    const severity_icon: Record<string, string> = { error: '❌', warning: '⚠️', info: 'ℹ️' };
    for (const issue of result.issues) {
        const icon = severity_icon[issue.severity] ?? '?';
        lines.push(`  ${icon} [${issue.code}] ${issue.message}`);
    }

    return lines.join('\n');
}

export function format_json(result: ReadmeLintResult): string {
    const data = {
        file: result.file,
        repo_type: result.repo_type,
        status: result.status,
        line_count: result.line_count,
        issues: result.issues.map((i) => ({ severity: i.severity, code: i.code, message: i.message })),
        summary: {
            error: result.issues.filter((i) => i.severity === 'error').length,
            warning: result.issues.filter((i) => i.severity === 'warning').length,
            info: result.issues.filter((i) => i.severity === 'info').length,
        },
    };
    return _jsonDumpsIndent2(data);
}

export function format_markdown(result: ReadmeLintResult): string {
    const lines: string[] = [`## 📝 README Lint: ${result.file}`, ''];
    lines.push(`**Repo type:** ${result.repo_type} · **Lines:** ${result.line_count}`);
    lines.push('');

    if (result.issues.length === 0) {
        lines.push('✅ No issues found.');
        return lines.join('\n');
    }

    const errors = result.issues.filter((i) => i.severity === 'error');
    const warnings = result.issues.filter((i) => i.severity === 'warning');
    const infos = result.issues.filter((i) => i.severity === 'info');

    lines.push(`| Errors | Warnings | Info |`);
    lines.push(`|---|---|---|`);
    lines.push(`| ${errors.length} | ${warnings.length} | ${infos.length} |`);
    lines.push('');

    if (errors.length > 0) {
        lines.push('### ❌ Errors');
        lines.push('');
        for (const i of errors) {
            lines.push(`- \`${i.code}\`: ${i.message}`);
        }
        lines.push('');
    }

    if (warnings.length > 0) {
        lines.push('### ⚠️ Warnings');
        lines.push('');
        for (const i of warnings) {
            lines.push(`- \`${i.code}\`: ${i.message}`);
        }
        lines.push('');
    }

    if (infos.length > 0) {
        lines.push('### ℹ️ Info');
        lines.push('');
        for (const i of infos) {
            lines.push(`- \`${i.code}\`: ${i.message}`);
        }
    }

    return lines.join('\n');
}

// --- CLI ---

interface ParsedArgs {
    readme: string;
    root: string;
    format: string;
    strict: boolean;
}

const _FORMAT_CHOICES = ['text', 'json', 'markdown'];

function _argError(msg: string): never {
    process.stderr.write(
        'usage: readme_linter [-h] [--root ROOT] [--format {text,json,markdown}] [--strict] [readme]\n',
    );
    process.stderr.write(`readme_linter: error: ${msg}\n`);
    process.exit(2);
}

function parse_args(argv: string[]): ParsedArgs {
    const out: ParsedArgs = { readme: 'README.md', root: '.', format: 'text', strict: false };
    let readmeSet = false;
    for (let i = 0; i < argv.length; i += 1) {
        const a = argv[i] as string;
        const value = (flag: string): string => {
            const eq = a.indexOf('=');
            if (eq !== -1 && a.startsWith('--')) {
                return a.slice(eq + 1);
            }
            const next = argv[i + 1];
            if (next === undefined) {
                _argError(`argument ${flag}: expected one argument`);
            }
            i += 1;
            return next;
        };
        if (a === '-h' || a === '--help') {
            process.stdout.write(
                'usage: readme_linter [-h] [--root ROOT] [--format {text,json,markdown}] [--strict] [readme]\n',
            );
            process.exit(0);
        } else if (a === '--strict') {
            out.strict = true;
        } else if (a === '--root' || a.startsWith('--root=')) {
            out.root = value('--root');
        } else if (a === '--format' || a.startsWith('--format=')) {
            const v = value('--format');
            if (!_FORMAT_CHOICES.includes(v)) {
                _argError(`argument --format: invalid choice: '${v}' (choose from 'text', 'json', 'markdown')`);
            }
            out.format = v;
        } else if (a.startsWith('-') && a !== '-') {
            _argError(`unrecognized arguments: ${a}`);
        } else if (!readmeSet) {
            out.readme = a;
            readmeSet = true;
        } else {
            _argError(`unrecognized arguments: ${a}`);
        }
    }
    return out;
}

export function main(argv: string[] | null = null): number {
    const args = parse_args(argv ?? process.argv.slice(2));

    const readme_path = args.readme;
    const repo_root = args.root;

    if (!_exists(readme_path)) {
        process.stderr.write(`❌ README not found: ${readme_path}\n`);
        return 3;
    }

    let result: ReadmeLintResult;
    try {
        result = lint_readme(readme_path, repo_root);
    } catch (e) {
        process.stderr.write(`❌ Internal error: ${(e as Error).message}\n`);
        return 3;
    }

    if (args.format === 'json') {
        process.stdout.write(format_json(result) + '\n');
    } else if (args.format === 'markdown') {
        process.stdout.write(format_markdown(result) + '\n');
    } else {
        process.stdout.write(format_text(result) + '\n');
    }

    if (result.status === 'fail') {
        return 2;
    }
    if (result.status === 'pass_with_warnings' && args.strict) {
        return 2;
    }
    if (result.status === 'pass_with_warnings') {
        return 1;
    }
    return 0;
}

// Helper that mirrors `lint_readme` taking Path objects; not part of Python API.
void _isFile;

const _HERE = fileURLToPath(import.meta.url);
const _isCliEntry =
    process.argv[1] !== undefined && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (_isCliEntry || process.argv[1] === _HERE) {
    process.exitCode = main();
}
