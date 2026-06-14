/**
 * Toolchain resolution — pick the right test/quality runner per stack.
 *
 * TypeScript twin of `work_engine/stack/runner.py` (ADR-094 py2ts). Leaf
 * module — stdlib only, NO intra-`work_engine` imports — so the public API
 * names stay snake_case to mirror the Python module 1:1 (per ADR-094: Python
 * style is part of the contract).
 *
 * Sibling of {@link "./detect"} (which labels the *frontend* stack). This
 * module answers a different question: *given a project root, which test
 * runner and quality tools does this stack actually use, and what is the
 * exact command to invoke them?* It is the engine behind 6.1.0 Step 6 — the
 * toolchain resolver that lets one set of commands (`/tests execute`,
 * `/tests create`, `/quality-fix`, `/review-changes`, `/work`) adapt to
 * phpunit / pest / vitest / jest / playwright / pytest / go / cargo instead
 * of exploding into per-stack command variants.
 *
 * Detection is filesystem-cheap and **never crashes**: a malformed manifest,
 * a missing file, or an unknown stack degrades to a LOW-confidence empty
 * result rather than raising — a wrong toolchain label is recoverable (the
 * agent can ask), a crash mid-run is not. This mirrors the recoverable-error
 * contract in {@link "./detect"}.
 *
 * Three opt-in flags shape the *selected* command set (the monorepo guard):
 *
 * - `include_e2e` — by default e2e suites (playwright / cypress) are
 *   excluded; fast unit tests run first. Pass to add them.
 * - `include_slow` — by default a script tagged `test:slow` /
 *   `test:integration` is excluded. Pass to add it.
 * - `php_only` — keep only the PHP ecosystem (the `--php` narrowing the
 *   roadmap calls for; "only genuine PHP-space commands stay PHP-locked").
 *
 * The full per-stack inventory is always returned (`runners`); the
 * `selected` tuple is what a command should actually run after applying
 * the flags + the fast-by-default monorepo guard.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * Every test-runner label the resolver can emit.
 *
 * Single source of truth so the state schema, fixtures, and tests validate
 * against one set without re-deriving it. Mirrors Python's `frozenset`.
 */
export const KNOWN_RUNNERS: ReadonlySet<string> = new Set([
    'pest',
    'phpunit',
    'vitest',
    'jest',
    'playwright',
    'cypress',
    'pytest',
    'go-test',
    'cargo-test',
]);

// Speed buckets. `fast` runs by default; `slow` needs `include_slow`;
// `e2e` needs `include_e2e`. The monorepo guard reads this.
export const SPEED_FAST = 'fast';
export const SPEED_SLOW = 'slow';
export const SPEED_E2E = 'e2e';

// Confidence tiers — declarative, mirrors the non-interactive-contract
// tiers (HIGH = deterministic dependency/marker; MEDIUM = heuristic;
// LOW = nothing matched).
export const HIGH = 'HIGH';
export const MEDIUM = 'MEDIUM';
export const LOW = 'LOW';

const _MANIFESTS = [
    'composer.json',
    'package.json',
    'pyproject.toml',
    'go.mod',
    'Cargo.toml',
    'Makefile',
    'Taskfile.yml',
    'Taskfile.yaml',
];

/** A heterogeneous JSON object, mirroring a Python `dict[str, object]`. */
type Manifest = { [key: string]: unknown };

/** Role → wrapper-command map, mirroring Python's `dict[str, str]`. */
type Wrappers = { [role: string]: string };

/**
 * One detected test runner for one ecosystem.
 *
 * `command` is the exact invocation to run the suite (a task-runner
 * wrapper like `make test` when one exists, otherwise the direct tool).
 * `speed` is one of {@link SPEED_FAST} / {@link SPEED_SLOW} /
 * {@link SPEED_E2E}; the monorepo guard filters on it. `basis` names the
 * concrete signal that matched (dependency, binary, marker file) so the
 * routing decision is auditable, exactly like the non-interactive-contract's
 * `basis` column.
 *
 * Mirrors the Python `@dataclass(frozen=True)` with positional construction
 * and the documented field defaults.
 */
export class RunnerResult {
    readonly ecosystem: string;
    readonly runner: string;
    readonly command: string;
    readonly speed: string;
    readonly confidence: string;
    readonly basis: string;

    constructor(
        ecosystem: string,
        runner: string,
        command: string,
        speed: string = SPEED_FAST,
        confidence: string = HIGH,
        basis = '',
    ) {
        this.ecosystem = ecosystem;
        this.runner = runner;
        this.command = command;
        this.speed = speed;
        this.confidence = confidence;
        this.basis = basis;
    }
}

/**
 * Outcome of one toolchain-resolution pass over a project root.
 *
 * `runners` is the full inventory (every ecosystem detected, every speed
 * bucket). `selected` is what a command should actually run after the flags
 * + fast-by-default guard. `quality` is the ordered list of quality/lint
 * commands per detected ecosystem. `confidence` is the overall tier (HIGH
 * when ≥1 runner matched deterministically and no cross-ecosystem conflict;
 * LOW when nothing matched). `mtime` is the latest manifest mtime, used for
 * cache invalidation just like {@link "./detect".StackResult}.
 */
export class ToolchainResult {
    readonly ecosystems: readonly string[];
    readonly runners: readonly RunnerResult[];
    readonly selected: readonly RunnerResult[];
    readonly quality: readonly string[];
    readonly confidence: string;
    readonly mtime: number;

    constructor(args: {
        ecosystems: readonly string[];
        runners: readonly RunnerResult[];
        selected: readonly RunnerResult[];
        quality: readonly string[];
        confidence: string;
        mtime: number;
    }) {
        this.ecosystems = args.ecosystems;
        this.runners = args.runners;
        this.selected = args.selected;
        this.quality = args.quality;
        this.confidence = args.confidence;
        this.mtime = args.mtime;
    }

    /**
     * Serialise to the auto-generated project-config shape.
     *
     * Written to `agents/runtime/state/toolchain.json` by
     * {@link write_config} so the per-stack commands are captured once and
     * re-read cheaply (keyed on `mtime`) instead of re-detected every turn.
     */
    to_config(): Record<string, unknown> {
        return {
            ecosystems: [...this.ecosystems],
            confidence: this.confidence,
            // `mtime` is a Python float; wrap so `write_config`'s serialiser
            // renders an integral value as `N.0` (Python float repr).
            mtime: pyFloat(this.mtime),
            runners: this.runners.map((r) => ({
                ecosystem: r.ecosystem,
                runner: r.runner,
                command: r.command,
                speed: r.speed,
                confidence: r.confidence,
                basis: r.basis,
            })),
            selected: this.selected.map((r) => r.command),
            quality: [...this.quality],
        };
    }
}

/**
 * Inspect `project_root` and resolve its test/quality toolchain.
 *
 * @param project_root
 *   Directory carrying the manifests (`composer.json` / `package.json` /
 *   `pyproject.toml` / `go.mod` / `Cargo.toml`). The resolver does not walk
 *   upwards — the caller picks the scope, matching `detect.detect_stack`.
 * @param opts.include_slow @param opts.include_e2e
 *   Monorepo guard. Off by default → `selected` carries only fast unit
 *   suites. Turn on to add the slow / e2e buckets.
 * @param opts.php_only
 *   The `--php` narrowing — keep only the PHP ecosystem in `selected` (the
 *   full inventory is still returned in `runners`).
 * @returns
 *   A {@link ToolchainResult}. Never raises. No manifest / unknown stack →
 *   an empty result with `confidence == LOW` so the caller can fall back to
 *   asking.
 */
export function resolve_toolchain(
    project_root: string,
    opts: { include_slow?: boolean; include_e2e?: boolean; php_only?: boolean } = {},
): ToolchainResult {
    const include_slow = opts.include_slow ?? false;
    const include_e2e = opts.include_e2e ?? false;
    const php_only = opts.php_only ?? false;

    const runners: RunnerResult[] = [];
    const quality: string[] = [];

    const composer = _read_json(path.join(project_root, 'composer.json'));
    const pkg = _read_json(path.join(project_root, 'package.json'));
    const has_composer = _is_file(path.join(project_root, 'composer.json'));
    const has_package = _is_file(path.join(project_root, 'package.json'));
    const pyproject_text = _read_text(path.join(project_root, 'pyproject.toml'));
    const has_python =
        Boolean(pyproject_text) ||
        _is_file(path.join(project_root, 'requirements.txt')) ||
        _is_file(path.join(project_root, 'setup.cfg')) ||
        _is_file(path.join(project_root, 'pytest.ini'));
    const has_go = _is_file(path.join(project_root, 'go.mod'));
    const has_cargo = _is_file(path.join(project_root, 'Cargo.toml'));

    const wrappers = _task_runner_wrappers(project_root, pkg);

    if (has_composer) {
        runners.push(..._php_runners(project_root, composer, wrappers));
        quality.push(..._php_quality(project_root, composer, wrappers));
    }
    if (has_package) {
        runners.push(..._js_runners(pkg, wrappers));
        quality.push(..._js_quality(pkg, wrappers));
    }
    if (has_python) {
        runners.push(..._python_runners(pyproject_text));
        quality.push(..._python_quality(pyproject_text));
    }
    if (has_go) {
        runners.push(
            new RunnerResult('go', 'go-test', 'go test ./...', SPEED_FAST, HIGH, 'go.mod present'),
        );
        quality.push('go vet ./...');
    }
    if (has_cargo) {
        runners.push(
            new RunnerResult('rust', 'cargo-test', 'cargo test', SPEED_FAST, HIGH, 'Cargo.toml present'),
        );
        quality.push('cargo clippy');
    }

    const ecosystems = _dictFromKeys(runners.map((r) => r.ecosystem));
    const selected = _apply_guard(runners, { include_slow, include_e2e, php_only });
    const confidence = _overall_confidence(runners);

    return new ToolchainResult({
        ecosystems,
        runners: [...runners],
        selected: [...selected],
        quality: _dictFromKeys(quality),
        confidence,
        mtime: latest_manifest_mtime(project_root),
    });
}

/**
 * Persist `result` to `agents/runtime/state/toolchain.json`.
 *
 * The auto-generated per-stack config the roadmap calls for. Best-effort:
 * returns the path written; never raises on a read-only or missing parent
 * (the resolver is a routing aid, not a hard dependency).
 */
export function write_config(project_root: string, result: ToolchainResult): string {
    const target = path.join(project_root, 'agents', 'runtime', 'state', 'toolchain.json');
    try {
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(
            target,
            jsonDumps(result.to_config(), { indent: 2, sort_keys: true }) + '\n',
            { encoding: 'utf-8' },
        );
    } catch {
        // Mirrors Python's `except OSError: pass` — best-effort write.
    }
    return target;
}

/**
 * Latest mtime across every manifest the resolver consults.
 *
 * Cache-invalidation hook: when the persisted value no longer matches the
 * live value the cached toolchain is stale and resolution re-runs. `0.0`
 * when no manifest exists (greenfield) — a stable sentinel, not a
 * missing-file error.
 */
export function latest_manifest_mtime(project_root: string): number {
    const mtimes: number[] = [];
    for (const name of _MANIFESTS) {
        const p = path.join(project_root, name);
        if (_is_file(p)) {
            mtimes.push(_stat_mtime(p));
        }
    }
    return mtimes.length > 0 ? Math.max(...mtimes) : 0.0;
}

// --------------------------------------------------------------------------
// Ecosystem resolvers
// --------------------------------------------------------------------------

function _php_runners(root: string, composer: Manifest, wrappers: Wrappers): RunnerResult[] {
    const deps = _all_dependencies(composer, 'require', 'require-dev');
    if ('pestphp/pest' in deps || _is_file(path.join(root, 'vendor', 'bin', 'pest'))) {
        const cmd = wrappers['php-test'] || 'vendor/bin/pest';
        const basis =
            'pestphp/pest' in deps
                ? 'pestphp/pest in composer require'
                : 'vendor/bin/pest present';
        return [new RunnerResult('php', 'pest', cmd, SPEED_FAST, HIGH, basis)];
    }
    if (_is_file(path.join(root, 'artisan'))) {
        const cmd = wrappers['php-test'] || 'php artisan test';
        return [new RunnerResult('php', 'phpunit', cmd, SPEED_FAST, HIGH, 'artisan present (Laravel)')];
    }
    if ('phpunit/phpunit' in deps || _is_file(path.join(root, 'vendor', 'bin', 'phpunit'))) {
        const cmd = wrappers['php-test'] || 'vendor/bin/phpunit';
        return [new RunnerResult('php', 'phpunit', cmd, SPEED_FAST, HIGH, 'phpunit/phpunit detected')];
    }
    // composer.json with no test dependency — phpunit is the safe PHP default.
    const cmd = wrappers['php-test'] || 'vendor/bin/phpunit';
    return [
        new RunnerResult(
            'php',
            'phpunit',
            cmd,
            SPEED_FAST,
            MEDIUM,
            'composer.json present, no explicit runner',
        ),
    ];
}

function _js_runners(pkg: Manifest, wrappers: Wrappers): RunnerResult[] {
    const deps = _all_dependencies(
        pkg,
        'dependencies',
        'devDependencies',
        'peerDependencies',
        'optionalDependencies',
    );
    const scripts: Manifest = _isDict(pkg.scripts) ? pkg.scripts : {};
    const pm_test = wrappers['js-test'];
    const out: RunnerResult[] = [];

    // Fast unit runner — vitest beats jest when both present (vitest is the
    // modern default), but only one fast runner is selected.
    if ('vitest' in deps) {
        const cmd =
            pm_test && _script_uses(scripts, 'test', 'vitest') ? pm_test : 'npx vitest run';
        out.push(new RunnerResult('js', 'vitest', cmd, SPEED_FAST, HIGH, 'vitest in package deps'));
    } else if ('jest' in deps) {
        const cmd = pm_test && _script_uses(scripts, 'test', 'jest') ? pm_test : 'npx jest';
        out.push(new RunnerResult('js', 'jest', cmd, SPEED_FAST, HIGH, 'jest in package deps'));
    } else if (pm_test) {
        out.push(
            new RunnerResult(
                'js',
                'jest',
                pm_test,
                SPEED_FAST,
                MEDIUM,
                'package.json test script, runner unclear',
            ),
        );
    }

    // e2e runner — separate bucket, excluded unless --include-e2e.
    if ('@playwright/test' in deps || 'playwright' in deps) {
        const cmd = _script_command(scripts, ['test:e2e', 'e2e', 'playwright']) || 'npx playwright test';
        out.push(
            new RunnerResult('js', 'playwright', cmd, SPEED_E2E, HIGH, '@playwright/test in package deps'),
        );
    } else if ('cypress' in deps) {
        const cmd = _script_command(scripts, ['test:e2e', 'e2e', 'cypress']) || 'npx cypress run';
        out.push(new RunnerResult('js', 'cypress', cmd, SPEED_E2E, HIGH, 'cypress in package deps'));
    }

    // slow bucket — an explicit slow/integration script.
    const slow_cmd = _script_command(scripts, ['test:slow', 'test:integration']);
    if (slow_cmd) {
        out.push(
            new RunnerResult(
                'js',
                'vitest' in deps ? 'vitest' : 'jest',
                slow_cmd,
                SPEED_SLOW,
                MEDIUM,
                'test:slow/integration script',
            ),
        );
    }
    return out;
}

function _python_runners(pyproject_text: string): RunnerResult[] {
    if (pyproject_text.includes('pytest') || pyproject_text === '') {
        const conf = pyproject_text.includes('pytest') ? HIGH : MEDIUM;
        const basis = pyproject_text.includes('pytest')
            ? 'pytest in pyproject'
            : 'python project, no explicit runner';
        return [new RunnerResult('python', 'pytest', 'pytest', SPEED_FAST, conf, basis)];
    }
    return [
        new RunnerResult('python', 'pytest', 'pytest', SPEED_FAST, MEDIUM, 'python project, no explicit runner'),
    ];
}

function _php_quality(root: string, composer: Manifest, _wrappers: Wrappers): string[] {
    const deps = _all_dependencies(composer, 'require', 'require-dev');
    const out: string[] = [];
    if ('phpstan/phpstan' in deps || _is_file(path.join(root, 'vendor', 'bin', 'phpstan'))) {
        out.push('vendor/bin/phpstan analyse');
    }
    if ('laravel/pint' in deps || _is_file(path.join(root, 'vendor', 'bin', 'pint'))) {
        out.push('vendor/bin/pint');
    }
    return out;
}

function _js_quality(pkg: Manifest, _wrappers: Wrappers): string[] {
    const deps = _all_dependencies(
        pkg,
        'dependencies',
        'devDependencies',
        'peerDependencies',
        'optionalDependencies',
    );
    const out: string[] = [];
    if ('typescript' in deps) {
        out.push('npx tsc --noEmit');
    }
    if ('eslint' in deps) {
        out.push('npx eslint .');
    }
    return out;
}

function _python_quality(pyproject_text: string): string[] {
    const out: string[] = [];
    if (pyproject_text.includes('ruff')) {
        out.push('ruff check');
    }
    if (pyproject_text.includes('mypy')) {
        out.push('mypy .');
    }
    return out;
}

// --------------------------------------------------------------------------
// Task-runner wrappers (Makefile / Taskfile / package scripts)
// --------------------------------------------------------------------------

/**
 * Map logical roles to a wrapper command when one exists.
 *
 * Wrappers win over direct tool invocation (they handle container access,
 * env, parallelism) — the architecture rule's "Build / Task Runner
 * Detection". Returns role → command; absent roles fall through to the
 * direct tool.
 */
function _task_runner_wrappers(root: string, pkg: Manifest): Wrappers {
    const out: Wrappers = {};
    const makefile = _read_text(path.join(root, 'Makefile'));
    const taskfile =
        _read_text(path.join(root, 'Taskfile.yml')) || _read_text(path.join(root, 'Taskfile.yaml'));
    if (makefile && _reSearch(/^test\s*:/m, makefile)) {
        out['php-test'] = 'make test';
    } else if (taskfile && _reSearch(/^\s*test\s*:/m, taskfile)) {
        out['php-test'] = 'task test';
    }
    const scripts: Manifest = _isDict(pkg.scripts) ? pkg.scripts : {};
    if (_isDict(scripts) && 'test' in scripts) {
        out['js-test'] = `${_package_manager(root)} test`;
    }
    return out;
}

function _package_manager(root: string): string {
    if (_is_file(path.join(root, 'pnpm-lock.yaml'))) {
        return 'pnpm';
    }
    if (_is_file(path.join(root, 'yarn.lock'))) {
        return 'yarn';
    }
    return 'npm';
}

// --------------------------------------------------------------------------
// Monorepo guard + confidence
// --------------------------------------------------------------------------

function _apply_guard(
    runners: RunnerResult[],
    opts: { include_slow: boolean; include_e2e: boolean; php_only: boolean },
): RunnerResult[] {
    const out: RunnerResult[] = [];
    for (const r of runners) {
        if (opts.php_only && r.ecosystem !== 'php') {
            continue;
        }
        if (r.speed === SPEED_E2E && !opts.include_e2e) {
            continue;
        }
        if (r.speed === SPEED_SLOW && !opts.include_slow) {
            continue;
        }
        out.push(r);
    }
    return out;
}

function _overall_confidence(runners: RunnerResult[]): string {
    if (runners.length === 0) {
        return LOW;
    }
    if (runners.some((r) => r.confidence === HIGH)) {
        return HIGH;
    }
    return MEDIUM;
}

// --------------------------------------------------------------------------
// Shared readers (mirror detect.py's recoverable-error contract)
// --------------------------------------------------------------------------

function _read_json(p: string): Manifest {
    if (!_is_file(p)) {
        return {};
    }
    let payload: unknown;
    try {
        payload = JSON.parse(fs.readFileSync(p, { encoding: 'utf-8' }));
    } catch {
        return {};
    }
    return _isDict(payload) ? payload : {};
}

function _read_text(p: string): string {
    if (!_is_file(p)) {
        return '';
    }
    try {
        return fs.readFileSync(p, { encoding: 'utf-8' });
    } catch {
        return '';
    }
}

function _all_dependencies(manifest: Manifest, ...keys: string[]): Manifest {
    const merged: Manifest = {};
    for (const key of keys) {
        const section = manifest[key];
        if (_isDict(section)) {
            Object.assign(merged, section);
        }
    }
    return merged;
}

function _script_uses(scripts: Manifest, name: string, tool: string): boolean {
    const value = scripts[name];
    return typeof value === 'string' && value.includes(tool);
}

function _script_command(scripts: Manifest, names: string[]): string {
    for (const name of names) {
        if (typeof scripts[name] === 'string') {
            return `npm run ${name}`;
        }
    }
    return '';
}

// --------------------------------------------------------------------------
// stdlib parity helpers
// --------------------------------------------------------------------------

/** Python `Path.is_file()` — true only for a regular file (follows symlinks). */
function _is_file(p: string): boolean {
    try {
        return fs.statSync(p).isFile();
    } catch {
        return false;
    }
}

/**
 * Python `Path.stat().st_mtime` in POSIX seconds — see the matching note in
 * `detect.ts`. Only `to_config` / `write_config` serialize this value, and
 * the parity tests treat the serialized `mtime` as non-deterministic.
 */
function _stat_mtime(p: string): number {
    const st = fs.statSync(p, { bigint: true });
    return Number(st.mtimeNs) / 1e9;
}

/** Python `isinstance(x, dict)` — a plain (non-array, non-null) object. */
function _isDict(v: unknown): v is Manifest {
    return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/**
 * Python `re.search(pattern, text)` truthiness. The patterns used here carry
 * the multiline flag (`(?m)` in the source → `/m` here), so `^`/`$` match at
 * line boundaries exactly like CPython's `re`.
 */
function _reSearch(pattern: RegExp, text: string): boolean {
    return pattern.test(text);
}

/**
 * Python `tuple(dict.fromkeys(seq))` — dedupe preserving first-seen insertion
 * order. `dict.fromkeys` keeps the first occurrence's position; a JS `Set`
 * built by iteration does the same, so `[...new Set(seq)]` is faithful.
 */
function _dictFromKeys(seq: string[]): string[] {
    return [...new Set(seq)];
}

// --------------------------------------------------------------------------
// JSON serialisation — byte-parity with `json.dumps(..., indent=2,
// sort_keys=True)` for `write_config`.
// --------------------------------------------------------------------------

/**
 * Mirror Python `json.dumps(obj, indent=2, sort_keys=True)` byte-for-byte.
 *
 * Two CPython behaviours that `JSON.stringify` does NOT reproduce on its own
 * and are reproduced here:
 *
 * - `sort_keys=True` — object keys emitted in code-point ascending order.
 *   `JSON.stringify` preserves insertion order; we pre-sort recursively.
 * - integer-valued floats render as `N.0` (e.g. `1767222000.0`). JSON has no
 *   float/int tag, so a JS `number` that is integral renders without `.0`.
 *   In this module the only float is `mtime`; the parity tests normalize it
 *   (its exact byte-repr is not reproducible across CPython/V8), but the
 *   serialiser still applies the `N.0` rule via a tagged float wrapper so the
 *   *shape* matches. `mtime` is the sole value passed through that wrapper.
 *
 * 2-space indent, `": "` key separator, `","` item separator with the
 * indent-driven newline, `{}` / `[]` for empties, non-ASCII verbatim
 * (`ensure_ascii` defaults to `True` in CPython, but `to_config` carries no
 * non-ASCII, so the distinction never surfaces).
 */
function jsonDumps(obj: unknown, opts: { indent: number; sort_keys: boolean }): string {
    return _encode(obj, opts, 0);
}

const _INDENT_UNIT = ' ';

function _encode(value: unknown, opts: { indent: number; sort_keys: boolean }, depth: number): string {
    if (value === null) {
        return 'null';
    }
    if (typeof value === 'boolean') {
        return value ? 'true' : 'false';
    }
    if (typeof value === 'number') {
        return _encodeNumber(value, false);
    }
    if (value instanceof _PyFloat) {
        return _encodeNumber(value.value, true);
    }
    if (typeof value === 'string') {
        return JSON.stringify(value);
    }
    if (Array.isArray(value)) {
        if (value.length === 0) {
            return '[]';
        }
        const inner = _INDENT_UNIT.repeat(opts.indent * (depth + 1));
        const items = value.map((v) => inner + _encode(v, opts, depth + 1));
        const close = _INDENT_UNIT.repeat(opts.indent * depth);
        return '[\n' + items.join(',\n') + '\n' + close + ']';
    }
    if (_isDict(value)) {
        let keys = Object.keys(value);
        if (keys.length === 0) {
            return '{}';
        }
        if (opts.sort_keys) {
            keys = keys.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
        }
        const inner = _INDENT_UNIT.repeat(opts.indent * (depth + 1));
        const items = keys.map(
            (k) => inner + JSON.stringify(k) + ': ' + _encode(value[k], opts, depth + 1),
        );
        const close = _INDENT_UNIT.repeat(opts.indent * depth);
        return '{\n' + items.join(',\n') + '\n' + close + '}';
    }
    // Unreachable for `to_config` output; mirror `json.dumps` raising on an
    // unserialisable type would require a TypeError — return the JS default.
    return JSON.stringify(value);
}

/**
 * Render a number like CPython's `float.__repr__` / `int.__repr__` inside
 * `json.dumps`. When `isFloat` is set and the value is integral, append
 * `.0` (Python's float repr). Non-integral floats use JS's shortest
 * round-trip repr — which matches CPython's `repr(float)` for the values
 * that arise here. (The `mtime` field is normalized by the parity tests, so
 * any residual last-digit divergence on exotic sub-second timestamps is not
 * load-bearing.)
 */
function _encodeNumber(n: number, isFloat: boolean): string {
    if (isFloat && Number.isInteger(n)) {
        return `${n}.0`;
    }
    return String(n);
}

/** Tag wrapper marking a JS number that must serialise with Python float repr. */
class _PyFloat {
    readonly value: number;
    constructor(value: number) {
        this.value = value;
    }
}

/**
 * Wrap a numeric value so {@link jsonDumps} renders it as a Python float
 * (integer-valued → `N.0`). Exported for the parity tests / callers that
 * round-trip a `ToolchainResult` through `to_config`.
 */
export function pyFloat(value: number): _PyFloat {
    return new _PyFloat(value);
}
