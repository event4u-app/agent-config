#!/usr/bin/env tsx
/**
 * WARN-ONLY GitHub Actions workflow security linter.
 *
 * TypeScript twin of `src/scripts/lint_workflow_security.py` (ADR-200,
 * Python→TypeScript migration). The CLI contract is mirrored EXACTLY —
 * argparse flags (`--strict` / `--quiet` / `--json PATH`, `-h`/`--help`
 * exit 0, unknown arg → exit 2), the scan order (`sorted(glob("*.yml"))`
 * then `sorted(glob("*.yaml"))`), byte-identical finding lines, the
 * `json.dumps(..., indent=2)` (ensure_ascii) `--json` write, the allowlist
 * cap (exit 2 over 20 entries), the stdout/stderr split, and exit codes
 * (0 advisory / 1 strict+HIGH). snake_case kept; PyYAML `on:`→boolean-True
 * key quirk replicated. No behaviour changes — latent quirks replicated.
 *
 * Severity model (council-locked 2026-06-13):
 *   HIGH  — pull_request_target / workflow_run + checkout of untrusted ref;
 *            permissions: write-all;
 *            npm install / npm ci without --ignore-scripts in a
 *            pull_request_target workflow.
 *   MEDIUM — third-party actions pinned by mutable tag instead of full SHA
 *            (first-party actions/* are skipped).
 *
 * Script-injection detection (regex-based) is intentionally deferred — it
 * requires an AST-aware pass to avoid false positives on quoted / escaped
 * expressions.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import YAML from 'yaml';

import { py_json_dumps_indent2 } from './_lib/security_lint.js';

const _HERE = fileURLToPath(import.meta.url);

const REPO_ROOT = path.resolve(path.dirname(_HERE), '..', '..');
// Mutable bindings so tests can sandbox the scan target (mirrors the pytest
// monkeypatch.setattr seam used by sibling lint twins).
let WORKFLOWS_DIR = path.join(REPO_ROOT, '.github', 'workflows');
let ALLOWLIST_PATH = path.join(path.dirname(_HERE), 'lint_workflow_security_allowlist.json');
const ALLOWLIST_CAP = 20;

function _setWorkflowsDirForTest(p: string): void {
    WORKFLOWS_DIR = p;
}
function _setAllowlistPathForTest(p: string): void {
    ALLOWLIST_PATH = p;
}

// Triggers that expose the repository token to untrusted pull-request context
const DANGEROUS_TRIGGERS: ReadonlySet<string> = new Set(['pull_request_target', 'workflow_run']);

// First-party action owners — mutable tags on these are acceptable
const FIRST_PARTY_OWNERS: ReadonlySet<string> = new Set(['actions', 'github']);

type JsonValue = string | number | boolean | null | JsonValue[] | { [k: string]: JsonValue };
type JsonObject = { [k: string]: JsonValue };

// A finding is an ordered dict; JS object literals preserve insertion order,
// so building keys in the Python order keeps `--json` byte-identical.
interface Finding {
    [k: string]: JsonValue;
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

function _asObject(v: JsonValue | undefined): JsonObject | null {
    if (v !== null && v !== undefined && typeof v === 'object' && !Array.isArray(v)) {
        return v as JsonObject;
    }
    return null;
}

/**
 * `yaml.safe_load` equivalent: PyYAML-faithful (YAML 1.1, lenient dup keys).
 *
 * PyYAML's `safe_load` boolean resolver does NOT treat the single-letter forms
 * `y`/`Y`/`n`/`N` as booleans (only the `yes|no|true|false|on|off` family) — but
 * the `yaml` npm lib's 1.1 schema does. Override the core bool tag so bare
 * `y`/`n` stay strings, matching PyYAML exactly (a latent-fidelity requirement).
 */
const _PY_BOOL_RE =
    /^(?:yes|Yes|YES|no|No|NO|true|True|TRUE|false|False|FALSE|on|On|ON|off|Off|OFF)$/;
const _PY_BOOL_TAG = {
    tag: 'tag:yaml.org,2002:bool',
    test: _PY_BOOL_RE,
    resolve: (str: string): boolean => /^(?:y|t|on)/i.test(str),
    default: true,
};
function _safeLoad(text: string): JsonValue {
    const doc = YAML.parse(text, {
        version: '1.1',
        uniqueKeys: false,
        customTags: (tags: unknown[]) => [
            _PY_BOOL_TAG as unknown,
            ...(tags as Array<{ tag?: string; test?: unknown }>).filter(
                (t) => !(t.tag === 'tag:yaml.org,2002:bool' && t.test !== undefined),
            ),
        ],
    } as never) as JsonValue;
    return doc ?? null;
}

// ---------------------------------------------------------------------------
// Allowlist
// ---------------------------------------------------------------------------

/** Raised to mirror `raise SystemExit(2)` — carries the intended exit code. */
class _SystemExit extends Error {
    code: number;
    constructor(code: number) {
        super(`SystemExit(${code})`);
        this.code = code;
    }
}

function load_allowlist(): Finding[] {
    if (!_isFile(ALLOWLIST_PATH)) {
        return [];
    }
    const data = (_asObject(JSON.parse(fs.readFileSync(ALLOWLIST_PATH, 'utf-8')) as JsonValue) ??
        {}) as JsonObject;
    const rawEntries = data['findings'];
    const entries = Array.isArray(rawEntries) ? (rawEntries as Finding[]) : [];
    if (entries.length > ALLOWLIST_CAP) {
        process.stderr.write(
            `❌  lint_workflow_security: allowlist has ${entries.length} entries ` +
                `(> ${ALLOWLIST_CAP}).  Per the autonomous-execution allowlist-growth ` +
                `antipattern, this means the linter is wrong, not the content — ` +
                `tighten the heuristic or narrow scope instead of growing this list.\n`,
        );
        throw new _SystemExit(2);
    }
    return entries;
}

function is_allowlisted(allowlist: Finding[], workflow: string, rule: string): boolean {
    for (const entry of allowlist) {
        if (entry['workflow'] === workflow && entry['rule'] === rule) {
            return true;
        }
    }
    return false;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Return the set of trigger names from the `on:` block. */
function _triggers(on_block: JsonValue | undefined): Set<string> {
    if (on_block === null || on_block === undefined) {
        return new Set();
    }
    if (typeof on_block === 'string') {
        return new Set([on_block]);
    }
    if (Array.isArray(on_block)) {
        return new Set(on_block.map((x) => String(x)));
    }
    if (typeof on_block === 'object') {
        return new Set(Object.keys(on_block as JsonObject));
    }
    return new Set();
}

/**
 * Return True if any step checks out via github.event.pull_request.head.*
 * or github.event.workflow_run.* — the canonical pwn-request pattern.
 */
function _has_untrusted_ref_checkout(jobs: JsonObject): boolean {
    const untrusted_patterns = [
        'github.event.pull_request.head.',
        'github.event.workflow_run.',
    ];
    for (const job of Object.values(jobs)) {
        const jobObj = _asObject(job);
        if (jobObj === null) {
            continue;
        }
        const steps = Array.isArray(jobObj['steps']) ? (jobObj['steps'] as JsonValue[]) : [];
        for (const step of steps) {
            const stepObj = _asObject(step);
            if (stepObj === null) {
                continue;
            }
            const uses = typeof stepObj['uses'] === 'string' ? (stepObj['uses'] as string) : '';
            const with_block = _asObject(stepObj['with']) ?? {};
            if (uses.toLowerCase().includes('checkout')) {
                for (const val of Object.values(with_block)) {
                    const val_str = val !== null && val !== undefined ? _pyStr(val) : '';
                    if (untrusted_patterns.some((p) => val_str.includes(p))) {
                        return true;
                    }
                }
            }
            const run_text = typeof stepObj['run'] === 'string' ? (stepObj['run'] as string) : '';
            const env_block = _asObject(stepObj['env']) ?? {};
            const combined =
                run_text + Object.values(env_block).map((v) => _pyStr(v)).join(' ');
            if (untrusted_patterns.some((p) => combined.includes(p))) {
                return true;
            }
        }
    }
    return false;
}

/** Return True if any run step calls npm install/ci without --ignore-scripts. */
function _has_npm_without_ignore_scripts(jobs: JsonObject): boolean {
    for (const job of Object.values(jobs)) {
        const jobObj = _asObject(job);
        if (jobObj === null) {
            continue;
        }
        const steps = Array.isArray(jobObj['steps']) ? (jobObj['steps'] as JsonValue[]) : [];
        for (const step of steps) {
            const stepObj = _asObject(step);
            if (stepObj === null) {
                continue;
            }
            const run = typeof stepObj['run'] === 'string' ? (stepObj['run'] as string) : '';
            for (const line of _splitlines(run)) {
                const stripped = line.trim();
                if (
                    (stripped.includes('npm install') || stripped.includes('npm ci')) &&
                    !stripped.includes('--ignore-scripts')
                ) {
                    return true;
                }
            }
        }
    }
    return false;
}

/** Return per-step findings for third-party actions pinned by mutable tag. */
function _mutable_third_party_actions(doc: JsonObject, _workflow_name: string): Finding[] {
    const findings: Finding[] = [];
    const jobs = _asObject(doc['jobs']) ?? {};
    for (const [job_name, job] of Object.entries(jobs)) {
        const jobObj = _asObject(job);
        if (jobObj === null) {
            continue;
        }
        const steps = Array.isArray(jobObj['steps']) ? (jobObj['steps'] as JsonValue[]) : [];
        for (let i = 0; i < steps.length; i++) {
            const stepObj = _asObject(steps[i] as JsonValue);
            if (stepObj === null) {
                continue;
            }
            const uses = typeof stepObj['uses'] === 'string' ? (stepObj['uses'] as string) : '';
            if (!uses || !uses.includes('@')) {
                continue;
            }
            const at = uses.indexOf('@');
            const action_ref = uses.slice(0, at);
            const pin = uses.slice(at + 1);
            const owner = action_ref.includes('/') ? (action_ref.split('/')[0] as string) : action_ref;
            if (FIRST_PARTY_OWNERS.has(owner.toLowerCase())) {
                continue;
            }
            // A full SHA pin is 40 hex chars; anything else is mutable
            if (pin.length === 40 && [...pin.toLowerCase()].every((c) => '0123456789abcdef'.includes(c))) {
                continue;
            }
            const line_hint = `job:${job_name}/step:${i + 1}`;
            findings.push({
                severity: 'MEDIUM',
                rule: 'mutable-action-tag',
                detail: `${uses} — pin to a full commit SHA for supply-chain safety`,
                location: line_hint,
            });
        }
    }
    return findings;
}

// ---------------------------------------------------------------------------
// Per-workflow scan
// ---------------------------------------------------------------------------

function scan_workflow(filePath: string, allowlist: Finding[]): Finding[] {
    const findings: Finding[] = [];
    const workflow_name = path.basename(filePath);

    let doc: JsonObject;
    try {
        const raw = fs.readFileSync(filePath, 'utf-8');
        const loaded = _safeLoad(raw);
        doc = (_asObject(loaded) ?? {}) as JsonObject;
    } catch (exc) {
        findings.push({
            severity: 'HIGH',
            rule: 'parse-error',
            workflow: workflow_name,
            location: '—',
            detail: exc instanceof Error ? exc.message : String(exc),
            allowlisted: false,
        });
        return findings;
    }

    // YAML `on:` may parse as the boolean key True; mirror `doc.get("on") or doc.get(True)`.
    const on_block = _falsyOr(doc['on'], doc['true']);
    const triggers = _triggers(on_block);
    const jobs = _asObject(doc['jobs']) ?? {};

    // --- HIGH: dangerous trigger + untrusted ref checkout -------------------
    const dangerous = _setIntersection(triggers, DANGEROUS_TRIGGERS);
    if (dangerous.size > 0 && _has_untrusted_ref_checkout(jobs)) {
        const rule = 'dangerous-trigger-untrusted-ref';
        findings.push({
            severity: 'HIGH',
            rule,
            workflow: workflow_name,
            location: 'on:',
            detail:
                `trigger(s) ${_sortedListRepr(dangerous)} combined with checkout of an ` +
                'untrusted ref (github.event.pull_request.head.* or ' +
                'github.event.workflow_run.*) — classic pwn-request pattern',
            allowlisted: is_allowlisted(allowlist, workflow_name, rule),
        });
    }

    // --- HIGH: permissions: write-all ---------------------------------------
    const global_perms = doc['permissions'];
    if (global_perms === 'write-all') {
        const rule = 'permissions-write-all';
        findings.push({
            severity: 'HIGH',
            rule,
            workflow: workflow_name,
            location: 'permissions:',
            detail:
                'permissions: write-all grants the GITHUB_TOKEN every scope — ' +
                'restrict to the minimum required scopes',
            allowlisted: is_allowlisted(allowlist, workflow_name, rule),
        });
    }
    // also check job-level permissions
    for (const [job_name, job] of Object.entries(jobs)) {
        const jobObj = _asObject(job);
        if (jobObj === null) {
            continue;
        }
        if (jobObj['permissions'] === 'write-all') {
            const rule = 'permissions-write-all';
            findings.push({
                severity: 'HIGH',
                rule,
                workflow: workflow_name,
                location: `jobs.${job_name}.permissions`,
                detail:
                    'permissions: write-all grants the GITHUB_TOKEN every scope — ' +
                    'restrict to the minimum required scopes',
                allowlisted: is_allowlisted(allowlist, workflow_name, rule),
            });
        }
    }

    // --- HIGH: npm install/ci without --ignore-scripts in dangerous trigger --
    if (dangerous.size > 0 && _has_npm_without_ignore_scripts(jobs)) {
        const rule = 'npm-install-without-ignore-scripts';
        findings.push({
            severity: 'HIGH',
            rule,
            workflow: workflow_name,
            location: 'jobs',
            detail:
                `npm install / npm ci without --ignore-scripts in a ` +
                `${_sortedListRepr(dangerous)} workflow — postinstall scripts from ` +
                'untrusted PRs execute with repository write access',
            allowlisted: is_allowlisted(allowlist, workflow_name, rule),
        });
    }

    // --- MEDIUM: mutable third-party action tags ----------------------------
    for (const finding of _mutable_third_party_actions(doc, workflow_name)) {
        const rule = finding['rule'] as string;
        finding['workflow'] = workflow_name;
        finding['allowlisted'] = is_allowlisted(allowlist, workflow_name, rule);
        findings.push(finding);
    }

    return findings;
}

// ---------------------------------------------------------------------------
// Python-fidelity helpers
// ---------------------------------------------------------------------------

/** Python `a or b` truthiness for the `on:` lookup (None/empty → fall through). */
function _falsyOr(a: JsonValue | undefined, b: JsonValue | undefined): JsonValue | undefined {
    return _pyTruthy(a) ? a : b;
}

function _pyTruthy(v: JsonValue | undefined): boolean {
    if (v === null || v === undefined) return false;
    if (typeof v === 'boolean') return v;
    if (typeof v === 'number') return v !== 0;
    if (typeof v === 'string') return v.length > 0;
    if (Array.isArray(v)) return v.length > 0;
    if (typeof v === 'object') return Object.keys(v).length > 0;
    return true;
}

/** Python `str(value)` for scalar interpolation (str/with-block values). */
function _pyStr(v: JsonValue): string {
    if (v === null) return 'None';
    if (typeof v === 'boolean') return v ? 'True' : 'False';
    if (typeof v === 'number') return String(v);
    if (typeof v === 'string') return v;
    // dict/list str() is not exercised by the linter on these paths; best-effort.
    return String(v);
}

/** Python `str.splitlines()` (keepends=False) over the common terminators. */
function _splitlines(s: string): string[] {
    if (s === '') return [];
    // CPython boundary set: \n \r \r\n \v \f \x1c \x1d \x1e \x85 \u2028 \u2029.
    return s.split(/\r\n|[\n\r\v\f\x1c\x1d\x1e\x85\u2028\u2029]/);
}

/** Python `str(sorted(<set of str>))` — a list repr of the sorted strings. */
function _sortedListRepr(s: Set<string>): string {
    const sorted = [...s].sort();
    return `[${sorted.map((x) => _pyStrRepr(x)).join(', ')}]`;
}

/** Python `repr()` of a string (single-quote preference). */
function _pyStrRepr(s: string): string {
    if (s.includes("'") && !s.includes('"')) {
        return `"${s.replace(/\\/g, '\\\\')}"`;
    }
    return `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}

function _setIntersection(a: Set<string>, b: ReadonlySet<string>): Set<string> {
    const out = new Set<string>();
    for (const x of a) {
        if (b.has(x)) {
            out.add(x);
        }
    }
    return out;
}

// ---------------------------------------------------------------------------
// glob helpers
// ---------------------------------------------------------------------------

/** `sorted(WORKFLOWS_DIR.glob(ext))` — non-recursive, files only, sorted. */
function _sortedGlob(ext: string): string[] {
    let entries: string[];
    try {
        entries = fs.readdirSync(WORKFLOWS_DIR);
    } catch {
        return [];
    }
    const out = entries
        .filter((name) => name.endsWith(ext))
        .map((name) => path.join(WORKFLOWS_DIR, name))
        .filter((p) => _isFile(p));
    out.sort();
    return out;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

interface ParsedArgs {
    strict: boolean;
    quiet: boolean;
    json: string | null;
}

function _parseArgs(argv: string[]): { args?: ParsedArgs; exitCode?: number } {
    if (argv.includes('-h') || argv.includes('--help')) {
        process.stdout.write(_usage());
        return { exitCode: 0 };
    }
    let strict = false;
    let quiet = false;
    let json: string | null = null;
    let i = 0;
    while (i < argv.length) {
        const a = argv[i] as string;
        if (a === '--strict') {
            strict = true;
            i += 1;
            continue;
        }
        if (a === '--quiet') {
            quiet = true;
            i += 1;
            continue;
        }
        if (a === '--json') {
            json = (argv[i + 1] as string) ?? null;
            i += 2;
            continue;
        }
        if (a.startsWith('--json=')) {
            json = a.slice('--json='.length);
            i += 1;
            continue;
        }
        process.stderr.write(_usageError(a));
        return { exitCode: 2 };
    }
    return { args: { strict, quiet, json } };
}

function _usage(): string {
    return 'usage: lint_workflow_security.py [-h] [--strict] [--quiet] [--json PATH]\n';
}

function _usageError(arg: string): string {
    return (
        'usage: lint_workflow_security.py [-h] [--strict] [--quiet] [--json PATH]\n' +
        `lint_workflow_security.py: error: unrecognized arguments: ${arg}\n`
    );
}

export function main(argv?: string[]): number {
    const parsed = _parseArgs(argv ?? process.argv.slice(2));
    if (parsed.exitCode !== undefined) {
        return parsed.exitCode;
    }
    const args = parsed.args as ParsedArgs;

    let allowlist: Finding[];
    try {
        allowlist = load_allowlist();
    } catch (e) {
        if (e instanceof _SystemExit) {
            return e.code;
        }
        throw e;
    }

    if (!_isDir(WORKFLOWS_DIR)) {
        if (!args.quiet) {
            process.stderr.write(`No workflows directory found at ${WORKFLOWS_DIR}\n`);
        }
        return 0;
    }

    const all_findings: Finding[] = [];
    for (const wf_path of _sortedGlob('.yml')) {
        all_findings.push(...scan_workflow(wf_path, allowlist));
    }
    for (const wf_path of _sortedGlob('.yaml')) {
        all_findings.push(...scan_workflow(wf_path, allowlist));
    }

    if (args.json) {
        fs.writeFileSync(args.json, py_json_dumps_indent2(all_findings), 'utf-8');
    }

    const high = all_findings.filter((f) => f['severity'] === 'HIGH' && !_pyTruthy(f['allowlisted']));
    const medium = all_findings.filter((f) => f['severity'] === 'MEDIUM' && !_pyTruthy(f['allowlisted']));
    const allowlisted = all_findings.filter((f) => _pyTruthy(f['allowlisted']));

    if (!args.quiet) {
        for (const f of all_findings) {
            const tag = f['severity'] as string;
            const al = _pyTruthy(f['allowlisted']) ? ' [allowlisted]' : '';
            const loc = f['location'] !== undefined ? (f['location'] as JsonValue) : '—';
            process.stdout.write(
                `  [${tag}]${al} ${f['workflow']}:${_pyStr(loc as JsonValue)}  ${f['rule']} — ${f['detail']}\n`,
            );
        }

        process.stdout.write('\n');
        process.stdout.write(
            `workflow-security: ${high.length} HIGH, ${medium.length} MEDIUM, ` +
                `${allowlisted.length} allowlisted\n`,
        );
        if (high.length || medium.length) {
            process.stdout.write(
                '  (warn-only — run with --strict to make HIGH findings block CI)\n',
            );
        } else {
            process.stdout.write('  no non-allowlisted findings\n');
        }
    }

    if (args.strict && high.length) {
        return 1;
    }
    return 0;
}

const _isCliEntry =
    process.argv[1] !== undefined &&
    import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (_isCliEntry || process.argv[1] === _HERE) {
    process.exitCode = main();
}

export {
    REPO_ROOT,
    WORKFLOWS_DIR,
    ALLOWLIST_PATH,
    ALLOWLIST_CAP,
    DANGEROUS_TRIGGERS,
    FIRST_PARTY_OWNERS,
    _setWorkflowsDirForTest,
    _setAllowlistPathForTest,
    load_allowlist,
    is_allowlisted,
    _triggers,
    _has_untrusted_ref_checkout,
    _has_npm_without_ignore_scripts,
    _mutable_third_party_actions,
    scan_workflow,
    _safeLoad,
};
