/**
 * Toolchain resolution — pick the right test/quality runner per stack.
 *
 * TypeScript twin of `work_engine/stack/runner.py` (ADR-200 py2ts). Leaf
 * module — stdlib only, NO intra-`work_engine` imports — so the public API
 * names stay snake_case to mirror the Python module 1:1 (per ADR-200: Python
 * style is part of the contract).
 *
 * Sibling of {@link "./detect"} (which labels the *frontend* stack). This
 * module answers a different question: *given a project root, which test
 * runner and quality tools does this stack actually use, and what is the
 * exact command to invoke them?* It is the engine behind 6.1.0 Step 6 — the
 * toolchain resolver that lets one set of commands (`/tests execute`,
 * `/tests create`, `/fix quality`, `/review changes`, `/work`) adapt to
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
 * Single source of truth: the fixtures and tests validate against this set
 * without re-deriving it, and a membership test binds it to what the resolver
 * actually emits — without that binding it would be a set-equality assertion
 * about itself. This comment used to claim a "state schema" validated against
 * it too; `agents/runtime/state/toolchain.json` has no schema and no reader
 * outside this module, so that half was never true. Mirrors Python's
 * `frozenset`.
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
    'rspec',
    'junit',
    'dotnet-test',
]);

/**
 * Every behaviour-runner label the resolver can emit, plus the refusal.
 *
 * A **separate** set from {@link KNOWN_RUNNERS} rather than more entries in
 * it, because the two answer different questions. A native runner answers
 * *what runs this repository's tests*; a behaviour runner answers *does this
 * repository already own a tool that reads a specification*. Merging them
 * would make `selected` — which a command actually invokes — include a suite
 * nobody asked to run.
 *
 * {@link BEHAVIOR_UNKNOWN} is the refusal label, not a runner: it is emitted
 * when one scope carries two behaviour runners, mirroring the frontend
 * detector's refusal between two mutually exclusive workspaces (`unknown`
 * plus both names). A guess is not an answer, and a scope that genuinely
 * carries two is a finding its owner has to settle.
 */
export const BEHAVIOR_UNKNOWN = 'unknown';

export const KNOWN_BEHAVIOR_RUNNERS: ReadonlySet<string> = new Set([
    'behat',
    'cucumber-js',
    'cucumber-ruby',
    'cucumber-jvm',
    'behave',
    'pytest-bdd',
    'reqnroll',
    'specflow',
    BEHAVIOR_UNKNOWN,
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
    'Gemfile',
    'pom.xml',
    'build.gradle',
    'build.gradle.kts',
    'global.json',
    'Directory.Build.props',
];

/**
 * .NET project / solution extensions, matched by a root listing.
 *
 * .NET is the one ecosystem here whose marker has no fixed FILENAME — the
 * project file is `<whatever>.csproj`. That is why it is an extension list
 * scanned over the root rather than a `_MANIFESTS` entry.
 *
 * **Residual cache gap.** {@link latest_manifest_mtime} stats fixed NAMES, so
 * a signal whose filename it does not list stays invisible to the cache key:
 * a project-file-only .NET scope (`*.csproj` with no `global.json` /
 * `Directory.Build.props`), `features/support/env.rb`, `spec/spec_helper.rb`,
 * and the `mvnw` / `gradlew` wrappers — which change the emitted JVM command
 * without changing any manifest. Closing these would need the key to glob or
 * to track nested paths, a cost decision rather than an oversight, so it is
 * written down instead of discovered from a stale cache.
 *
 * An earlier version of this note said "three signals and only these three".
 * It named a `*.gemspec`, which nothing in this module reads, and omitted two
 * that are real. An exhaustiveness claim is worth more than a list only when
 * it is true, so this one no longer claims to be closed.
 */
const _DOTNET_PROJECT_EXTS = ['.sln', '.slnx', '.csproj', '.fsproj', '.vbproj'];

/** The packages that make a .NET project a TEST project, for the HIGH tier. */
const _DOTNET_TEST_STACK = /Microsoft\.NET\.Test\.Sdk|xunit|nunit|mstest/i;

/**
 * How deep below a scope `_dotnet_project_text` looks for project files.
 *
 * The conventional .NET layout keeps the solution at the root and each
 * project at `src/<Name>/<Name>.csproj`, so a root-only scan finds the `.sln`
 * — which carries no `PackageReference` — and misses every project. Depth 2
 * reaches that layout; the flat single-project root still costs one listing,
 * because the walk only descends when the scope itself holds no project file.
 */
const _DOTNET_SCAN_DEPTH = 2;

/** Ceiling on project files read per scope, once the descent is entered at all. */
const _DOTNET_MAX_PROJECTS = 50;

/** Does this scope hold a solution file? The precondition for descending. */
function _has_dotnet_solution(dir: string): boolean {
    try {
        return fs
            .readdirSync(dir)
            .some((n) => ['.sln', '.slnx'].includes(path.extname(n).toLowerCase()));
    } catch {
        return false;
    }
}

/**
 * Fixed-name files the BEHAVIOUR axis reads that `_MANIFESTS` does not cover.
 *
 * Two lists rather than one because they are SOURCED differently, not because
 * they are consulted differently: `_MANIFESTS` is the set whose presence
 * selects an ecosystem, and this is the set the behaviour detector reads. The
 * one place both are used — {@link latest_manifest_mtime} — concatenates them
 * and stats every name in every scope, so an earlier version of this note
 * claiming they are "consulted at different scopes" described a distinction
 * the code does not make. See the cache-coverage note on
 * {@link _DOTNET_PROJECT_EXTS} for what still escapes the key.
 */
const _BEHAVIOR_MARKERS = [
    'pnpm-workspace.yaml',
    'requirements.txt',
    'gems.rb',
    '.rspec',
    'behat.yml',
    'behat.yaml',
    'behat.yml.dist',
    'behat.dist.yml',
    'cucumber.js',
    'cucumber.cjs',
    'cucumber.mjs',
    'cucumber.json',
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
 * One behaviour runner found in one scope — DETECTION ONLY.
 *
 * Mirrors {@link RunnerResult}'s fields and adds `scope_root`, because the
 * axis is **list-shaped and per-scope rather than a repository-wide scalar**.
 * The reason is the same one that makes the native inventory a list: a
 * monorepo can carry a behaviour runner in one package and plain unit tests
 * in another, and a single repository-wide answer erases which package owns
 * which. A scalar would also have to break the tie on a conflict, and the
 * refusal below exists precisely so no tie is broken.
 *
 * `scope_root` is POSIX-relative to the project root, with `'.'` for the root
 * itself — the same shape the frontend detector reports.
 *
 * `conflict` is non-empty only on a refusal row (`runner` ===
 * {@link BEHAVIOR_UNKNOWN}) and names every behaviour runner the scope
 * carried, sorted.
 *
 * **What this record never carries: an instruction to adopt anything.** There
 * is no install command, no "recommended" field and no ranking. Detection
 * answers what a repository HAS; choosing a behaviour runner is an
 * owner-gated question this resolver has no standing to answer.
 */
export class BehaviorRunnerResult {
    readonly ecosystem: string;
    readonly runner: string;
    readonly command: string;
    readonly scope_root: string;
    readonly confidence: string;
    readonly basis: string;
    readonly conflict: readonly string[];

    constructor(
        ecosystem: string,
        runner: string,
        command: string,
        scope_root: string,
        confidence: string = HIGH,
        basis = '',
        conflict: readonly string[] = [],
    ) {
        this.ecosystem = ecosystem;
        this.runner = runner;
        this.command = command;
        this.scope_root = scope_root;
        this.confidence = confidence;
        this.basis = basis;
        this.conflict = conflict;
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
    /**
     * Per-scope behaviour-runner inventory — detection only, and deliberately
     * NOT merged into `runners` or reachable from `selected`. A command runs
     * `selected`; a behaviour suite this repository happens to own is not
     * something `/tests execute` may start running because a field appeared.
     */
    readonly behavior_runners: readonly BehaviorRunnerResult[];

    constructor(args: {
        ecosystems: readonly string[];
        runners: readonly RunnerResult[];
        selected: readonly RunnerResult[];
        quality: readonly string[];
        confidence: string;
        mtime: number;
        behavior_runners?: readonly BehaviorRunnerResult[];
    }) {
        this.ecosystems = args.ecosystems;
        this.runners = args.runners;
        this.selected = args.selected;
        this.quality = args.quality;
        this.confidence = args.confidence;
        this.mtime = args.mtime;
        this.behavior_runners = args.behavior_runners ?? [];
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
            behavior_runners: this.behavior_runners.map((r) => ({
                ecosystem: r.ecosystem,
                runner: r.runner,
                command: r.command,
                scope_root: r.scope_root,
                confidence: r.confidence,
                basis: r.basis,
                conflict: [...r.conflict],
            })),
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
    const gemfile_text = _ruby_gemfile_text(project_root);
    const jvm = _jvm_build(project_root);
    const dotnet_basis = _dotnet_basis(project_root);

    const wrappers = _task_runner_wrappers(project_root, pkg);

    if (has_composer) {
        runners.push(..._php_runners(project_root, composer, wrappers));
        quality.push(..._php_quality(project_root, composer, wrappers));
    }
    if (has_package) {
        runners.push(..._js_runners(pkg, wrappers, _package_manager(project_root, pkg)));
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
    runners.push(..._ruby_runners(project_root, gemfile_text));
    if (jvm !== null) {
        runners.push(..._jvm_runners(jvm));
    }
    if (dotnet_basis !== null) {
        runners.push(..._dotnet_runners(dotnet_basis));
    }

    const ecosystems = _dictFromKeys(runners.map((r) => r.ecosystem));
    const selected = _apply_guard(runners, { include_slow, include_e2e, php_only });
    const confidence = _overall_confidence(runners);
    const scopes = _behavior_scopes(project_root);

    return new ToolchainResult({
        ecosystems,
        runners: [...runners],
        selected: [...selected],
        quality: _dictFromKeys(quality),
        confidence,
        // Computed ONCE and threaded into both consumers. Workspace discovery
        // reads a manifest and does a `readdirSync` per glob parent, and both
        // the cache probe and the behaviour axis need the same list — deriving
        // it twice doubled that for no new information.
        mtime: latest_manifest_mtime(project_root, scopes),
        behavior_runners: resolve_behavior_runners(project_root, scopes),
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
export function latest_manifest_mtime(
    project_root: string,
    scopes?: readonly string[],
): number {
    const mtimes: number[] = [];
    const names = [..._MANIFESTS, ..._BEHAVIOR_MARKERS];
    // Every scope, not only the root: `behavior_runners` is part of the cached
    // result, and it is derived from per-scope manifests. A key that stats the
    // root alone cannot see Behat arriving in `packages/legacy`, so a persisted
    // `toolchain.json` would keep reporting the old (usually empty) behaviour
    // inventory until some unrelated ROOT manifest happened to be touched —
    // stale forever in the common case. Widening a cache key is always safe in
    // the direction that matters: it can only invalidate more often.
    for (const scope of scopes ?? _behavior_scopes(project_root)) {
        const dir = scope === '.' ? project_root : path.join(project_root, scope);
        for (const name of names) {
            const p = path.join(dir, name);
            if (_is_file(p)) {
                mtimes.push(_stat_mtime(p));
            }
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

function _js_runners(pkg: Manifest, wrappers: Wrappers, manager: string): RunnerResult[] {
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
        const cmd = _script_command(scripts, ['test:e2e', 'e2e', 'playwright'], manager) || 'npx playwright test';
        out.push(
            new RunnerResult('js', 'playwright', cmd, SPEED_E2E, HIGH, '@playwright/test in package deps'),
        );
    } else if ('cypress' in deps) {
        const cmd = _script_command(scripts, ['test:e2e', 'e2e', 'cypress'], manager) || 'npx cypress run';
        out.push(new RunnerResult('js', 'cypress', cmd, SPEED_E2E, HIGH, 'cypress in package deps'));
    }

    // slow bucket — an explicit slow/integration script.
    const slow_cmd = _script_command(scripts, ['test:slow', 'test:integration'], manager);
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

/**
 * Ruby — `rspec` ONLY on an explicit signal, never as a default.
 *
 * The PHP and Python branches above emit a MEDIUM default (phpunit / pytest)
 * when a manifest exists with no named runner, and the same move would be
 * WRONG here: Ruby ships minitest in the standard library, so a Gemfile
 * carrying no rspec signal is most likely a minitest project, and emitting
 * `rspec` would be a guess wearing a MEDIUM label. No signal → no row, which
 * is also what makes the absence fixture meaningful.
 */
/**
 * The Ruby dependency declaration, under either name Bundler accepts.
 *
 * `gems.rb` is Bundler's supported alternative to `Gemfile`; reading only the
 * latter made a `gems.rb` project invisible to both the rspec and the
 * cucumber-ruby branch.
 */
function _ruby_gemfile_text(dir: string): { text: string; file: string } {
    for (const name of ['Gemfile', 'gems.rb']) {
        const text = _read_text(path.join(dir, name));
        if (text !== '') {
            // The NAME travels with the text. The basis string is serialised
            // into `toolchain.json` and names the file that matched, so a
            // `gems.rb` project must not be told its signal came from a
            // `Gemfile` that does not exist in it.
            return { text, file: name };
        }
    }
    return { text: '', file: '' };
}

/** `gem 'rspec'` / `gem "cucumber"` — a DECLARATION, not the word anywhere. */
function _gem_declared(text: string, gem: string): boolean {
    // Same discipline as `_PY_BEHAVE`, and for the same reason: a bare
    // `\brspec\b` over the whole manifest fires on a commented-out
    // `# gem 'cucumber'`, on a changelog line, and on any gem whose name
    // merely contains the word.
    //
    // The name may carry a hyphenated SUFFIX — `rspec-rails`, `cucumber-rails`
    // are the ordinary Rails spellings, and anchoring the closing quote
    // straight after the bare name rejected both, leaving detection to the
    // marker files alone while the contract table promised the Gemfile branch.
    // A suffix only; `cucumber` must not match a gem merely ending in it.
    return new RegExp(`^[ \\t]*gem[ \\t]+["']${gem}(-[A-Za-z0-9_-]+)?["']`, 'm').test(text);
}

function _ruby_runners(root: string, gemfile: { text: string; file: string }): RunnerResult[] {
    const dot_rspec = _is_file(path.join(root, '.rspec'));
    const spec_helper = _is_file(path.join(root, 'spec', 'spec_helper.rb'));
    const in_gemfile = _gem_declared(gemfile.text, 'rspec');
    // No `Gemfile` precondition. An earlier version returned here whenever the
    // Gemfile was absent, which made the two marker bases below unreachable in
    // exactly the projects that have only markers: a Bundler project using
    // `gems.rb`, or a gemspec-only gem shipping `.rspec` and
    // `spec/spec_helper.rb`. Each of the three signals stands on its own, which
    // is also what the contract table says.
    if (!in_gemfile && !dot_rspec && !spec_helper) {
        return [];
    }
    const basis = in_gemfile
        ? `rspec in ${gemfile.file}`
        : dot_rspec
          ? '.rspec present'
          : 'spec/spec_helper.rb present';
    return [new RunnerResult('ruby', 'rspec', 'bundle exec rspec', SPEED_FAST, HIGH, basis)];
}

/** Which JVM build system answered, its text, and the command prefix to use. */
interface JvmBuild {
    tool: 'maven' | 'gradle';
    text: string;
    command: string;
}

/**
 * Locate the JVM build file and pick the invocation.
 *
 * Wrapper-first, for the same reason `_task_runner_wrappers` prefers
 * `make test`: `./gradlew` / `./mvnw` pin the build-tool version the
 * repository was written against, so invoking the ambient `gradle` or `mvn`
 * can fail on a version the project never used.
 */
function _jvm_build(root: string): JvmBuild | null {
    const pom = _read_text(path.join(root, 'pom.xml'));
    if (pom !== '') {
        const wrapper = _is_file(path.join(root, 'mvnw'));
        return { tool: 'maven', text: pom, command: wrapper ? './mvnw test' : 'mvn test' };
    }
    // PRESENCE, not content. A Gradle multi-project root routinely has an
    // empty `build.gradle` — or none at all, with `settings.gradle[.kts]`
    // declaring the modules — and reading for a non-empty string made both
    // shapes look like "no Gradle here", against a contract table promising a
    // MEDIUM `junit` default whenever a Gradle build file is present.
    const gradleFile = ['build.gradle', 'build.gradle.kts', 'settings.gradle', 'settings.gradle.kts'].find(
        (n) => _is_file(path.join(root, n)),
    );
    if (gradleFile !== undefined) {
        const wrapper = _is_file(path.join(root, 'gradlew'));
        return {
            tool: 'gradle',
            text:
                _read_text(path.join(root, 'build.gradle')) +
                '\n' +
                _read_text(path.join(root, 'build.gradle.kts')),
            command: wrapper ? './gradlew test' : 'gradle test',
        };
    }
    return null;
}

function _jvm_runners(build: JvmBuild): RunnerResult[] {
    const named = /\bjunit\b/i.test(build.text);
    const conf = named ? HIGH : MEDIUM;
    const basis = named
        ? `junit in the ${build.tool} build file`
        : `${build.tool} build file present, no explicit runner`;
    return [new RunnerResult('jvm', 'junit', build.command, SPEED_FAST, conf, basis)];
}

/**
 * .NET — the basis string, or `null` when nothing marks a .NET project.
 *
 * The gradation really does mirror the PHP branch, which awards HIGH only for
 * a NAMED runner and MEDIUM for a bare `composer.json`. So HIGH here needs a
 * project that names a TEST stack (`Microsoft.NET.Test.Sdk`, xunit, nunit,
 * mstest), and a bare project or solution file is MEDIUM — it is the analogue
 * of the bare manifest, not of the named runner.
 *
 * This is not cosmetic. `_overall_confidence` is "some HIGH wins", so a bare
 * non-test project file used to raise a whole repository to HIGH and push
 * `dotnet test` into `selected` — a command that fails on a solution carrying
 * no test project. The Ruby branch in this same module refuses exactly this
 * class of guess.
 */
function _dotnet_basis(root: string): { basis: string; confidence: string } | null {
    let names: string[];
    try {
        // SORTED: the basis string names the file that matched, and it is
        // serialised into `toolchain.json`. An unsorted `readdirSync` makes
        // that string depend on directory-entry order, which differs between
        // filesystems and changes after a rename — so a config meant to be
        // stable would churn for reasons unrelated to the repository.
        names = fs.readdirSync(root).sort();
    } catch {
        names = [];
    }
    const project = names.find((n) => _DOTNET_PROJECT_EXTS.includes(path.extname(n).toLowerCase()));
    if (project !== undefined) {
        const named = _DOTNET_TEST_STACK.test(_dotnet_project_text(root));
        return named
            ? { basis: `test stack named in a .NET project file`, confidence: HIGH }
            : { basis: `${project} present, no test stack named`, confidence: MEDIUM };
    }
    for (const marker of ['global.json', 'Directory.Build.props']) {
        if (_is_file(path.join(root, marker))) {
            return { basis: `${marker} present, no project file at the root`, confidence: MEDIUM };
        }
    }
    return null;
}

function _dotnet_runners(found: { basis: string; confidence: string }): RunnerResult[] {
    return [
        new RunnerResult(
            'dotnet',
            'dotnet-test',
            'dotnet test',
            SPEED_FAST,
            found.confidence,
            found.basis,
        ),
    ];
}

// --------------------------------------------------------------------------
// Behaviour-runner axis — per scope, list-shaped, detection only
// --------------------------------------------------------------------------

/**
 * Resolve every behaviour runner this repository carries, one row per scope.
 *
 * Scopes are the project root plus each declared workspace package, because
 * the single-row alternative cannot represent the ordinary monorepo shape:
 * a behaviour runner in one package and plain unit tests in another. Two
 * behaviour runners inside ONE scope produce a refusal row naming both,
 * never a pick.
 *
 * Never raises; an unreadable manifest or an exotic workspace declaration
 * yields fewer rows rather than an error, matching the module's
 * recoverable-error contract.
 */
export function resolve_behavior_runners(
    project_root: string,
    scopes?: readonly string[],
): BehaviorRunnerResult[] {
    const out: BehaviorRunnerResult[] = [];
    for (const scope of scopes ?? _behavior_scopes(project_root)) {
        const dir = scope === '.' ? project_root : path.join(project_root, scope);
        // Grouped by ECOSYSTEM, because a scope carrying two ecosystems'
        // behaviour runners is a polyglot repository, not a conflict. A PHP
        // application with a JS frontend — one `composer.json`, one
        // `package.json`, behat and cucumber-js — is the commonest shape there
        // is, and reporting it as `unknown` throws away both answers the axis
        // exists to give. It also contradicted this module's own polyglot
        // semantics, which select one runner PER ECOSYSTEM. Mutual exclusivity
        // is what the refusal is for, and only two runners inside ONE ecosystem
        // are mutually exclusive.
        const rows = _behavior_runners_in_scope(dir, scope);
        for (const ecosystem of _dictFromKeys(rows.map((r) => r.ecosystem))) {
            const found = rows.filter((r) => r.ecosystem === ecosystem);
            const names = [...new Set(found.map((r) => r.runner))].sort();
            if (names.length <= 1) {
                // One answer for this ecosystem, however many signals produced
                // it. The `> 1 row, 1 name` case is defensive and unreachable
                // as the detector stands — every branch pushes at most one row
                // per label — but a future branch able to emit a label twice
                // would otherwise refuse a runner against itself.
                out.push(found[0] as BehaviorRunnerResult);
                continue;
            }
            out.push(
                new BehaviorRunnerResult(
                    ecosystem,
                    BEHAVIOR_UNKNOWN,
                    '',
                    scope,
                    LOW,
                    `two ${ecosystem} behaviour runners in one scope ` +
                        `(${names.join(', ')}) — refusing to choose between them, exactly ` +
                        'as the frontend detector refuses between two mutually exclusive ' +
                        'workspaces',
                    names,
                ),
            );
        }
    }
    return out;
}

/** Behaviour runners inside ONE scope directory, before conflict handling. */
function _behavior_runners_in_scope(dir: string, scope: string): BehaviorRunnerResult[] {
    const out: BehaviorRunnerResult[] = [];

    const composer = _read_json(path.join(dir, 'composer.json'));
    const php_deps = _all_dependencies(composer, 'require', 'require-dev');
    const behat_config = ['behat.yml', 'behat.yaml', 'behat.yml.dist', 'behat.dist.yml'].find((n) =>
        _is_file(path.join(dir, n)),
    );
    if ('behat/behat' in php_deps || behat_config !== undefined) {
        out.push(
            new BehaviorRunnerResult(
                'php',
                'behat',
                'vendor/bin/behat',
                scope,
                HIGH,
                // "in the composer manifest", NOT "in composer require": the
                // sibling native-axis strings name the manifest SECTION, and
                // the literal `composer require` reads as an install
                // instruction to a grep that cannot tell the two apart. The
                // axis may never be mistaken for an adoption recommendation,
                // so its own strings avoid the phrase outright.
                'behat/behat' in php_deps
                    ? 'behat/behat in the composer manifest'
                    : `${behat_config ?? ''} present`,
            ),
        );
    }

    const pkg = _read_json(path.join(dir, 'package.json'));
    const js_deps = _all_dependencies(
        pkg,
        'dependencies',
        'devDependencies',
        'peerDependencies',
        'optionalDependencies',
    );
    const cucumber_config = ['cucumber.js', 'cucumber.cjs', 'cucumber.mjs', 'cucumber.json'].find(
        (n) => _is_file(path.join(dir, n)),
    );
    if ('@cucumber/cucumber' in js_deps || 'cucumber' in js_deps || cucumber_config !== undefined) {
        const dep = '@cucumber/cucumber' in js_deps ? '@cucumber/cucumber' : 'cucumber';
        out.push(
            new BehaviorRunnerResult(
                'js',
                'cucumber-js',
                'npx cucumber-js',
                scope,
                HIGH,
                dep in js_deps ? `${dep} in package deps` : `${cucumber_config ?? ''} present`,
            ),
        );
    }

    // Joined with a newline, like `_dotnet_project_text`. Concatenated bare,
    // a `pyproject.toml` with no trailing newline fuses its last token to the
    // first token of `requirements.txt`, and the regexes below then match
    // against a token present in neither file.
    const py_text = [
        _read_text(path.join(dir, 'pyproject.toml')),
        _read_text(path.join(dir, 'requirements.txt')),
    ].join('\n');
    if (_PY_BEHAVE.test(py_text)) {
        out.push(
            new BehaviorRunnerResult('python', 'behave', 'behave', scope, HIGH, 'behave declared as a python dependency'),
        );
    }
    if (/\bpytest-bdd\b/.test(py_text)) {
        out.push(
            new BehaviorRunnerResult(
                'python',
                'pytest-bdd',
                'pytest',
                scope,
                HIGH,
                'pytest-bdd in the python manifest',
            ),
        );
    }

    const gemfile = _ruby_gemfile_text(dir);
    const cucumber_gem = _gem_declared(gemfile.text, 'cucumber');
    if (cucumber_gem || _is_file(path.join(dir, 'features', 'support', 'env.rb'))) {
        out.push(
            new BehaviorRunnerResult(
                'ruby',
                'cucumber-ruby',
                'bundle exec cucumber',
                scope,
                HIGH,
                cucumber_gem
                    ? `cucumber in ${gemfile.file}`
                    : 'features/support/env.rb present',
            ),
        );
    }

    const jvm = _jvm_build(dir);
    if (jvm !== null && /io\.cucumber|cucumber-java|cucumber-junit/i.test(jvm.text)) {
        out.push(
            new BehaviorRunnerResult(
                'jvm',
                'cucumber-jvm',
                jvm.command,
                scope,
                HIGH,
                `cucumber in the ${jvm.tool} build file`,
            ),
        );
    }

    const dotnet_text = _dotnet_project_text(dir);
    if (/\bReqnroll\b/i.test(dotnet_text)) {
        out.push(
            new BehaviorRunnerResult('dotnet', 'reqnroll', 'dotnet test', scope, HIGH, 'Reqnroll in a project file'),
        );
    } else if (/\bSpecFlow\b/i.test(dotnet_text)) {
        out.push(
            new BehaviorRunnerResult('dotnet', 'specflow', 'dotnet test', scope, HIGH, 'SpecFlow in a project file'),
        );
    }

    return out;
}

/**
 * Concatenated text of the .NET project files belonging to this scope.
 *
 * Scans the scope directory and, when it holds no project file of its own,
 * descends to {@link _DOTNET_SCAN_DEPTH} — the `root/src/<Name>/<Name>.csproj`
 * layout, where the root carries only a `.sln` and a `.sln` has no
 * `PackageReference`. Without the descent `reqnroll` and `specflow` were
 * undetectable outside a flat single-project root, i.e. two of the eight
 * declared behaviour labels could effectively never be emitted.
 *
 * Sorted at every level and capped at {@link _DOTNET_MAX_PROJECTS} files, so
 * the result is deterministic and a deep tree cannot stall a turn.
 */
function _dotnet_project_text(dir: string): string {
    const texts: string[] = [];
    // The descent is entered ONLY for a scope carrying a solution file — the
    // layout that motivates it. Two defects close at once. Cost: a repository
    // with no `.sln` never walks, so a wide monorepo does not pay a directory
    // walk per scope for an ecosystem it does not use; `_DOTNET_MAX_PROJECTS`
    // counts files READ and therefore bounded nothing when there were none.
    // Ownership: a `*.csproj` inside a workspace package can now only reach the
    // root scope when the ROOT itself holds the solution that owns it, which is
    // the one case where attributing it there is correct.
    const solution = _has_dotnet_solution(dir);
    const walk = (at: string, depth: number): void => {
        if (texts.length >= _DOTNET_MAX_PROJECTS) {
            return;
        }
        let entries: fs.Dirent[];
        try {
            entries = fs.readdirSync(at, { withFileTypes: true });
        } catch {
            return;
        }
        entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
        let hit = false;
        for (const e of entries) {
            if (e.isFile() && _DOTNET_PROJECT_EXTS.includes(path.extname(e.name).toLowerCase())) {
                if (texts.length >= _DOTNET_MAX_PROJECTS) {
                    return;
                }
                texts.push(_read_text(path.join(at, e.name)));
                // A `.sln` names no packages, so finding one is not a reason to
                // stop descending; a real project file is.
                hit = hit || path.extname(e.name).toLowerCase() !== '.sln';
            }
        }
        if (hit || !solution || depth >= _DOTNET_SCAN_DEPTH) {
            return;
        }
        for (const e of entries) {
            if (e.isDirectory() && !e.name.startsWith('.') && e.name !== 'node_modules') {
                walk(path.join(at, e.name), depth + 1);
            }
        }
    };
    walk(dir, 0);
    return texts.join('\n');
}

/** Hard ceiling on scopes scanned, so a pathological workspace glob cannot stall a turn. */
const _MAX_BEHAVIOR_SCOPES = 200;

/**
 * `behave` DECLARED AS A DEPENDENCY, never merely mentioned.
 *
 * Every sibling signal in this detector is an unmistakable token —
 * `behat/behat`, `@cucumber/cucumber`, `pytest-bdd`, `io.cucumber`,
 * `Reqnroll`. `behave` is an ordinary English verb, so a bare `\bbehave\b`
 * over the whole manifest fires HIGH on a description line, a comment or a
 * changelog string. This anchors it to the two shapes a declaration actually
 * takes: a `requirements.txt` line (`behave`, `behave==1.2.6`) and a
 * pyproject/TOML assignment (`behave = "^1.2"`, `"behave",`), each at the
 * start of its own line.
 */
const _PY_BEHAVE = /^[ \t]*["']?behave["']?[ \t]*(?:$|[=<>~!,;[])/m;

/**
 * The `packages:` sequence of a `pnpm-workspace.yaml`, and ONLY that key.
 *
 * The first version matched every `- item` line in the file, which is wrong in
 * a way that reads as working: a real workspace file routinely carries sibling
 * sequences — `onlyBuiltDependencies`, `neverBuiltDependencies`,
 * `ignoredBuiltDependencies`, `patchedDependencies` — so `- esbuild` under
 * `onlyBuiltDependencies` became the workspace scope `esbuild`. Usually that
 * only burns reads and scope budget, but a repository with a top-level
 * directory of that name gets a `behavior_runners` row whose `scope_root` is
 * not a workspace package at all.
 *
 * A line-state reader rather than a YAML parse, because this module is leaf by
 * contract and may not take a dependency: track whether the current top-level
 * key is `packages`, and accept sequence items only while it is. Any
 * column-0 key ends the section, which is what makes a sibling sequence
 * invisible instead of merely unlikely.
 */
export function _pnpm_packages(text: string): string[] {
    const out: string[] = [];
    let inPackages = false;
    const push = (raw: string): void => {
        // A trailing `# frontend` comment is legal YAML and was rejected by an
        // end-anchored pattern; strip it before unquoting.
        const v = raw.replace(/\s+#.*$/, '').trim().replace(/^['"]|['"]$/g, '').trim();
        if (v !== '') {
            out.push(v);
        }
    };
    for (const line of text.split('\n')) {
        if (line.trim() === '' || /^\s*#/.test(line)) {
            continue;
        }
        const key = /^([A-Za-z0-9_-]+)\s*:(.*)$/.exec(line);
        if (key) {
            inPackages = key[1] === 'packages';
            // A FLOW sequence on the key line (`packages: ['apps/*']`) is the
            // same declaration written inline. The key branch used to consume
            // the line and discard it, so the whole workspace vanished.
            const rest = (key[2] ?? '').trim();
            if (inPackages && rest.startsWith('[')) {
                for (const part of rest.replace(/^\[|\]$/g, '').split(',')) {
                    push(part);
                }
                inPackages = false;
            }
            continue;
        }
        if (!inPackages) {
            continue;
        }
        // `^\s*-`, not `^\s+-`: a ZERO-INDENT block sequence under its key is
        // valid YAML and the indent-requiring anchor silently dropped it.
        const item = /^\s*-\s*(.+?)\s*$/.exec(line);
        if (item && item[1] !== undefined) {
            push(item[1]);
        }
    }
    return out;
}

/**
 * The scopes to scan: the root, plus each declared workspace package.
 *
 * Deliberately a LOCAL re-read of the workspace declarations rather than an
 * import of the frontend detector: this module's contract is leaf — stdlib
 * only, no intra-`work_engine` imports — and breaking that to share a parser
 * would couple the toolchain resolver to the stack labeller for one list of
 * directory names.
 *
 * Only the two forms that actually declare package locations are read
 * (`package.json#workspaces` and `pnpm-workspace.yaml#packages`); a
 * `turbo.json` / `nx.json` / `lerna.json` root is covered by whichever of
 * those two it sits beside, which is how those tools are configured in
 * practice.
 */
export function _behavior_scopes(project_root: string): string[] {
    const globs: string[] = [];
    const pkg = _read_json(path.join(project_root, 'package.json'));
    const ws = pkg['workspaces'];
    if (Array.isArray(ws)) {
        globs.push(...ws.filter((g): g is string => typeof g === 'string'));
    } else if (_isDict(ws) && Array.isArray(ws['packages'])) {
        globs.push(...(ws['packages'] as unknown[]).filter((g): g is string => typeof g === 'string'));
    }
    globs.push(..._pnpm_packages(_read_text(path.join(project_root, 'pnpm-workspace.yaml'))));

    const scopes = ['.'];
    for (const raw of globs) {
        // The cap is checked DURING expansion, not sliced off the result. A
        // `.slice()` at the end bounds the output while the `readdirSync` work
        // it is documented to bound has already been paid — which is not the
        // stall protection the constant claims to give.
        if (scopes.length >= _MAX_BEHAVIOR_SCOPES) {
            break;
        }
        const g = raw.replace(/^\.\//, '').replace(/\/+$/, '');
        if (g === '' || g.startsWith('!') || g.startsWith('/') || g.includes('..')) {
            continue;
        }
        if (g.endsWith('/*')) {
            const parent = g.slice(0, -2);
            let children: fs.Dirent[];
            try {
                children = fs.readdirSync(path.join(project_root, parent), { withFileTypes: true });
            } catch {
                continue;
            }
            // SORTED, for the reason `_dotnet_basis` sorts: scope order
            // becomes `behavior_runners` row order, which is serialised.
            children.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
            for (const c of children) {
                if (scopes.length >= _MAX_BEHAVIOR_SCOPES) {
                    break;
                }
                if (c.isDirectory()) {
                    scopes.push(`${parent}/${c.name}`);
                }
            }
        } else if (!g.includes('*')) {
            // Existence-checked, for the same reason the mid-path glob below
            // is skipped: reporting a scope that does not exist is worse than
            // reporting one fewer. A phantom scope also costs every per-scope
            // probe — stats in the cache key, a listing in the .NET branch.
            try {
                if (fs.statSync(path.join(project_root, g)).isDirectory()) {
                    scopes.push(g);
                }
            } catch {
                /* declared but absent — not a scope */
            }
        }
        // A deeper or mid-path glob (`a/*/b`, `**`) is skipped rather than
        // half-expanded: reporting a scope that does not exist would be worse
        // than reporting one fewer, and the two common declarations above are
        // what real workspace roots use.
    }
    return _dictFromKeys(scopes);
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
        out['js-test'] = `${_package_manager(root, pkg)} test`;
    }
    return out;
}

/**
 * Lockfile → manager, in the order `monorepo-workspace/SKILL.md` § 1 states.
 * Kept as data rather than a chain of ifs so `PACKAGE_MANAGER_BRANCHES` below
 * can assert the count against the documented one.
 */
const LOCKFILE_MANAGERS: ReadonlyArray<readonly [string, string]> = [
    ['pnpm-lock.yaml', 'pnpm'],
    ['yarn.lock', 'yarn'],
    ['bun.lock', 'bun'],
    ['bun.lockb', 'bun'],
    ['package-lock.json', 'npm'],
];

/**
 * The five branches `monorepo-workspace/SKILL.md` § 1 specifies, named so a
 * test can assert none went missing. The skill is the contract and it was
 * already correct; this list exists because the code implemented three of the
 * five and nothing noticed.
 */
export const PACKAGE_MANAGER_BRANCHES: readonly string[] = [
    'packageManager',
    'pnpm',
    'yarn',
    'bun',
    'npm',
] as const;

export interface PackageManagerResolution {
    /** The resolved manager, or `null` when the cascade deliberately refuses. */
    manager: string | null;
    /** Which branch answered — one of `PACKAGE_MANAGER_BRANCHES`, or `'ambiguous'`. */
    via: string;
    /** Non-empty when the cascade refuses: the reported finding. */
    finding: string;
}

/**
 * Resolve the package manager per `monorepo-workspace/SKILL.md` § 1.
 *
 * Two behaviours the previous three-branch version did not have, and both are
 * in the skill rather than invented here:
 *
 *  - `packageManager` in the root `package.json` is the DECLARATION and wins
 *    when present, because it is what Corepack enforces. A lockfile is an
 *    inference; a declaration is not.
 *  - **Two lockfiles is a finding, not a tie to break.** The old code returned
 *    `pnpm` for a repository carrying both `pnpm-lock.yaml` and `yarn.lock`,
 *    silently picking the first branch it tested. That is a guess presented as
 *    an answer, and the skill says to report both and stop.
 */
export function _resolve_package_manager(
    root: string,
    pkg?: Manifest,
): PackageManagerResolution {
    const declared = pkg === undefined ? undefined : pkg['packageManager'];
    if (typeof declared === 'string' && declared.trim() !== '') {
        // `pnpm@9.1.0` → `pnpm`. Corepack's own format.
        const name = declared.trim().split('@')[0] as string;
        if (name !== '') {
            return { manager: name, via: 'packageManager', finding: '' };
        }
    }
    const present = LOCKFILE_MANAGERS.filter(([file]) => _is_file(path.join(root, file)));
    const distinct = [...new Set(present.map(([, mgr]) => mgr))];
    if (distinct.length > 1) {
        return {
            manager: null,
            via: 'ambiguous',
            finding:
                `two package-manager lockfiles present (${present.map(([f]) => f).join(', ')}) ` +
                'and no `packageManager` declaration — report both and stop, per ' +
                'monorepo-workspace SKILL.md § 1',
        };
    }
    if (distinct.length === 1) {
        const mgr = distinct[0] as string;
        return { manager: mgr, via: mgr, finding: '' };
    }
    return { manager: 'npm', via: 'npm', finding: '' };
}

/**
 * The resolved manager as a bare string for command construction. Falls back to
 * `npm` on the ambiguous case so a caller building a command string still gets
 * one — the FINDING is what carries the ambiguity, and a caller that needs it
 * calls `_resolve_package_manager` directly.
 */
function _package_manager(root: string, pkg?: Manifest): string {
    return _resolve_package_manager(root, pkg).manager ?? 'npm';
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

/**
 * Build a `<manager> run <script>` command for the first matching script name.
 *
 * `manager` used to be hardcoded `npm`. Every command the work engine hands an
 * agent for verification inherited that, so a pnpm or yarn repository was told
 * to run a command its lockfile contradicts.
 */
function _script_command(scripts: Manifest, names: string[], manager: string): string {
    for (const name of names) {
        if (typeof scripts[name] === 'string') {
            return `${manager} run ${name}`;
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
