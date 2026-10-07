#!/usr/bin/env tsx
/**
 * WARN-ONLY GitHub Actions workflow security linter.
 *
 * Ported from the retired Python `src/scripts/lint_workflow_security.py` (ADR-200,
 * Python→TypeScript migration). The CLI contract is pinned —
 * argparse flags (`--strict` / `--quiet` / `--json PATH`, `-h`/`--help`
 * exit 0, unknown arg → exit 2), the scan order (`sorted(glob("*.yml"))`
 * then `sorted(glob("*.yaml"))`), byte-identical finding lines, the
 * `json.dumps(..., indent=2)` (ensure_ascii) `--json` write, the allowlist
 * cap (exit 2 over 20 entries), the stdout/stderr split, and exit codes
 * (0 advisory / 1 strict+HIGH). snake_case kept; PyYAML `on:`→boolean-True
 * key quirk replicated. Historical quirks are preserved deliberately — tests and downstream consumers pin the exact behaviour.
 *
 * Severity model (council-locked 2026-06-13):
 *   HIGH  — pull_request_target / workflow_run + checkout of untrusted ref;
 *            permissions: write-all;
 *            npm install / npm ci without --ignore-scripts in a
 *            pull_request_target workflow.
 *   MEDIUM — actions pinned by mutable tag instead of full SHA;
 *            an actions/checkout step that keeps its credential.
 *
 * The MEDIUM tier's original wording read "third-party actions … (first-party
 * actions/* are skipped)". Corrected 2026-08-22: the first-party exemption is
 * GONE (see the removal note below), so the parenthetical documented an
 * exemption that no longer exists — a false claim in a tracked artefact, which
 * is the defect class the change that removed it was written to repair. The
 * TIERS are untouched; only the description of what MEDIUM covers now matches
 * the code. Re-tiering the locked model is a separate decision, recorded as
 * unresolved in agents/evidence/analysis/workflow-security-net-degraded-decision.md.
 * The CI INVOCATION is decided there too: since 2026-10-07 consistency.yml runs
 * this gate under `--strict` (AI council, 2/2), so a HIGH fails a pull request;
 * the tiers are unchanged.
 *
 * Script-injection detection (regex-based) is intentionally deferred — it
 * requires an AST-aware pass to avoid false positives on quoted / escaped
 * expressions.
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import YAML from 'yaml';

import { runGateCli, runSelfTest } from './_lib/gate_self_test.js';
import { DeadScopeError, reportScanned } from './_lib/scan_scope.js';
import { py_json_dumps_indent2 } from './_lib/security_lint.js';

const _HERE = fileURLToPath(import.meta.url);

const REPO_ROOT = path.resolve(path.dirname(_HERE), '..', '..');
// Mutable bindings so tests can sandbox the scan target (mirrors the pytest
// monkeypatch.setattr seam used by sibling lint twins).
//
// `--self-test` needs the same sandbox from a CHILD process, which cannot reach
// the in-process seam, so the two paths are also readable from the environment.
// Deliberately env and not argv: the CLI surface is pinned (argparse flags,
// byte-identical usage lines, unknown arg → exit 2), and a scan root is not
// something a caller should be able to redirect by typing a flag.
let WORKFLOWS_DIR = process.env['LINT_WORKFLOW_SECURITY_DIR'] ?? path.join(REPO_ROOT, '.github', 'workflows');
let ALLOWLIST_PATH =
    process.env['LINT_WORKFLOW_SECURITY_ALLOWLIST'] ??
    path.join(path.dirname(_HERE), 'lint_workflow_security_allowlist.json');
const ALLOWLIST_CAP = 20;

function _setWorkflowsDirForTest(p: string): void {
    WORKFLOWS_DIR = p;
}
function _setAllowlistPathForTest(p: string): void {
    ALLOWLIST_PATH = p;
}

// Triggers that expose the repository token to untrusted pull-request context
const DANGEROUS_TRIGGERS: ReadonlySet<string> = new Set(['pull_request_target', 'workflow_run']);

// REMOVED 2026-08-22 (road-to-ci-supply-chain-integrity 1.4). This was
// `FIRST_PARTY_OWNERS = {'actions', 'github'}` and it exempted first-party
// owners from the mutable-tag rule. The premise — "mutable tags on these are
// acceptable" — is the one a supply-chain rule cannot hold: a first-party tag
// is still a mutable pointer, and `actions/checkout@v7` moving under the repo
// is the same class of event as any other owner's tag moving.
//
// What it cost, measured before removal: 100 of the 112 unpinned references in
// this tree were first-party, so the gate saw 12 of 112 defects and reported
// green on the rest. An exemption sized like that is not an exemption, it is
// the rule being off.
//
// The removal ships in the SAME change as the 112 pins, and in that order:
// pin first, then lift, so the transition is red-then-green inside one
// reviewable diff. Reverting the pins locally must make this gate exit
// non-zero — that is the assertion that the gate can still see the defect,
// which a green-only check cannot make.

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
            // `actions/checkout` leaves the repository token in the runner's git
            // config for the rest of the job unless told not to. Measured before
            // this rule existed: 0 of 50 checkouts in this tree set the flag, so
            // every job carried a usable credential it did not need.
            //
            // `true` is a legitimate answer — two jobs here push — so the rule
            // asks for the key to be PRESENT, not for a particular value. An
            // explicit `true` is a reviewable decision; a missing key is an
            // ambient one, and only the second is a finding.
            if (uses.slice(0, uses.indexOf('@')).toLowerCase() === 'actions/checkout') {
                const withObj = _asObject(stepObj['with'] as JsonValue);
                const hasKey =
                    withObj !== null &&
                    Object.prototype.hasOwnProperty.call(withObj, 'persist-credentials');
                if (!hasKey) {
                    findings.push({
                        severity: 'MEDIUM',
                        rule: 'persist-credentials',
                        detail:
                            'actions/checkout without an explicit persist-credentials — ' +
                            'the repository token stays in the runner git config for the rest of the job',
                        location: `job:${job_name}/step:${i + 1}`,
                    });
                }
            }
            const at = uses.indexOf('@');
            const pin = uses.slice(at + 1);
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

/**
 * Prove, on demand, that the gate's rejections still fire.
 *
 * The CI invocation is warn-only, so the exit code `runSelfTest` reads cannot be
 * moved by a finding there. The cases below therefore drive the two exits the
 * gate really has — 2 for a dead scan scope or an over-cap allowlist, 1 for a
 * HIGH under `--strict` — and pin the warn-only tier itself from the other side:
 * a MEDIUM under `--strict` must still PASS, which is the direction a future
 * re-tiering would silently break.
 */
function selfTest(): number {
    const plant = (name: string, files: Record<string, string>): string => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), `lws-selftest-${name}-`));
        for (const [rel, body] of Object.entries(files)) {
            fs.writeFileSync(path.join(dir, rel), body, 'utf-8');
        }
        return dir;
    };
    const allowlistFile = (entries: unknown[]): string => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lws-selftest-al-'));
        const p = path.join(dir, 'allowlist.json');
        fs.writeFileSync(p, JSON.stringify({ findings: entries }), 'utf-8');
        return p;
    };
    const run = (wfDir: string, args: readonly string[], allowlist?: string): number => {
        const prevDir = process.env['LINT_WORKFLOW_SECURITY_DIR'];
        const prevAl = process.env['LINT_WORKFLOW_SECURITY_ALLOWLIST'];
        process.env['LINT_WORKFLOW_SECURITY_DIR'] = wfDir;
        if (allowlist !== undefined) {
            process.env['LINT_WORKFLOW_SECURITY_ALLOWLIST'] = allowlist;
        }
        try {
            return runGateCli(
                REPO_ROOT,
                path.join('src', 'scripts', 'lint_workflow_security.ts'),
                args,
                REPO_ROOT,
            );
        } finally {
            if (prevDir === undefined) {
                delete process.env['LINT_WORKFLOW_SECURITY_DIR'];
            } else {
                process.env['LINT_WORKFLOW_SECURITY_DIR'] = prevDir;
            }
            if (prevAl === undefined) {
                delete process.env['LINT_WORKFLOW_SECURITY_ALLOWLIST'];
            } else {
                process.env['LINT_WORKFLOW_SECURITY_ALLOWLIST'] = prevAl;
            }
        }
    };

    const HIGH_WF = [
        'on:',
        '  pull_request_target:',
        'jobs:',
        '  build:',
        '    steps:',
        '      - uses: actions/checkout@0000000000000000000000000000000000000000',
        '        with:',
        '          persist-credentials: false',
        '          ref: ${{ github.event.pull_request.head.sha }}',
        '',
    ].join('\n');
    // Unpinned third-party action — MEDIUM, and MEDIUM alone.
    const MEDIUM_WF = [
        'on:',
        '  push:',
        'jobs:',
        '  build:',
        '    steps:',
        '      - uses: somevendor/action@v1',
        '',
    ].join('\n');
    const CLEAN_WF = [
        'on:',
        '  push:',
        'jobs:',
        '  build:',
        '    steps:',
        '      - uses: actions/checkout@0000000000000000000000000000000000000000',
        '        with:',
        '          persist-credentials: false',
        '      - run: npm ci --ignore-scripts',
        '',
    ].join('\n');

    return runSelfTest({
        gate: 'lint_workflow_security',
        minCases: 5,
        minRejectCases: 3,
        cases: [
            {
                name: 'an empty workflows directory is refused, not certified "0 HIGH, 0 MEDIUM"',
                expect: 'reject',
                run: () => run(plant('empty', {}), []),
            },
            {
                name: 'a pull_request_target checkout of the untrusted ref fails under --strict',
                expect: 'reject',
                run: () => run(plant('high', { 'bad.yml': HIGH_WF }), ['--strict']),
            },
            {
                name: 'an over-cap allowlist fails rather than suppressing silently',
                expect: 'reject',
                run: () =>
                    run(
                        plant('cap', { 'ok.yml': CLEAN_WF }),
                        [],
                        allowlistFile(
                            Array.from({ length: ALLOWLIST_CAP + 1 }, (_, n) => ({
                                workflow: `w${String(n)}.yml`,
                                rule: 'unpinned-action',
                            })),
                        ),
                    ),
            },
            {
                name: 'a MEDIUM under --strict still PASSES — the tier split is real, not decorative',
                expect: 'accept',
                run: () => run(plant('medium', { 'med.yml': MEDIUM_WF }), ['--strict']),
            },
            {
                name: 'a clean workflow passes under --strict',
                expect: 'accept',
                run: () => run(plant('clean', { 'ok.yml': CLEAN_WF }), ['--strict']),
            },
        ],
    });
}

export function main(argv?: string[]): number {
    const rawArgv = argv ?? process.argv.slice(2);
    if (rawArgv.includes('--self-test')) {
        if (process.env['GATE_SELF_TEST_CHILD'] === '1') {
            process.stderr.write('lint_workflow_security: --self-test does not recurse\n');
            return 2;
        }
        return selfTest();
    }
    const parsed = _parseArgs(rawArgv);
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

    // Replaces the former `!_isDir(WORKFLOWS_DIR)` → exit 0: a missing dir and
    // an existing-but-empty one are the same blindness, and reporting
    // "0 HIGH, 0 MEDIUM" over zero workflows is the vacuous pass.
    const yml = _sortedGlob('.yml');
    const yaml = _sortedGlob('.yaml');
    try {
        // `reportScanned`, not `assertScanned`: the gate now carries a floor in
        // src/config/gate-coverage.yml, and the guard there reads the
        // machine-readable `scanned:` line. Asserting without publishing leaves
        // the gate invisible to the coverage guard — the half-adoption
        // `_lib/scan_scope.reportScanned` was written to close. The line goes to
        // stdout unconditionally, `--quiet` included, because CI passes
        // `--quiet` and a count only visible without it is not a count.
        reportScanned({
            gate: 'lint_workflow_security',
            scanned: yml.length + yaml.length,
            units: 'workflow file(s)',
            roots: [WORKFLOWS_DIR],
        });
    } catch (e) {
        if (e instanceof DeadScopeError) {
            // 2 (the usage / could-not-run code) over 1, which means
            // "a HIGH finding blocked under --strict".
            process.stderr.write(`❌  ${e.message}\n`);
            return 2;
        }
        throw e;
    }

    const all_findings: Finding[] = [];
    for (const wf_path of yml) {
        all_findings.push(...scan_workflow(wf_path, allowlist));
    }
    for (const wf_path of yaml) {
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
                args.strict
                    ? '  (--strict — HIGH findings fail this run; MEDIUM stays advisory)\n'
                    : '  (warn-only — run with --strict to make HIGH findings block CI)\n',
            );
        } else {
            process.stdout.write('  no non-allowlisted findings\n');
        }
    }

    if (args.strict && high.length) {
        if (args.quiet) {
            // --quiet suppresses the report; a failing run still names its cause.
            process.stderr.write(
                `workflow-security: ${high.length} HIGH under --strict — rerun without --quiet for the findings\n`,
            );
        }
        return 1;
    }
    return 0;
}

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
    process.exitCode = main();
}

export {
    REPO_ROOT,
    WORKFLOWS_DIR,
    ALLOWLIST_PATH,
    ALLOWLIST_CAP,
    DANGEROUS_TRIGGERS,
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
