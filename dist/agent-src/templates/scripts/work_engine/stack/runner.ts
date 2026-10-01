/**
 * Toolchain resolution — pick the right test/quality runner per stack.
 *
 * **The contract lives in `contexts/execution/toolchain-resolver.md`**: what
 * each axis answers, detection order, confidence tiers, the refusal doctrine,
 * the cache key and what resolution costs. This header carries only what a
 * reader OF THIS FILE needs and what the contract page cannot enforce.
 *
 * Originally the TypeScript twin of `work_engine/stack/runner.py` (ADR-200
 * py2ts). Leaf module — stdlib only, NO intra-`work_engine` imports — and the
 * public API names stay snake_case, because that style IS the contract. The
 * 1:1 parity claim no longer holds: the behavior-runner axis and the rspec /
 * junit / dotnet-test labels are TypeScript-only, and the parity test was
 * renamed rather than quietly widened. Sibling of {@link "./detect"}, which
 * labels the *frontend* stack.
 *
 * Detection **never crashes** — a malformed manifest, a missing file or an
 * unknown stack degrades to a LOW-confidence empty result, and EVERY
 * filesystem helper here is guarded, which is what makes that true.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * Every test-runner label the resolver can emit.
 *
 * Single source of truth: the fixtures validate against this set without
 * re-deriving it, and a membership test binds it to what the resolver emits —
 * without that binding it would assert set-equality with itself. Mirrors
 * Python's `frozenset`.
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
 * Every behavior-runner label the resolver can emit, plus the refusal.
 *
 * A **separate** set from {@link KNOWN_RUNNERS}: the two answer different
 * questions — *what runs the tests* versus *does this repository already own a
 * tool that reads a specification* — and merging them would put a suite nobody
 * asked to run into `selected`. {@link BEHAVIOR_UNKNOWN} is the refusal label.
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
    // `settings.gradle[.kts]` is a Gradle signal `_jvm_build` acts on, so it
    // must be in the key: a settings-only multi-project root emits a junit row
    // and would otherwise report the greenfield `mtime: 0` forever.
    'settings.gradle',
    'settings.gradle.kts',
    'global.json',
    'Directory.Build.props',
];

/**
 * .NET project / solution extensions, matched by a root listing.
 *
 * .NET is the one ecosystem whose marker has no fixed FILENAME (the project
 * file is `<whatever>.csproj`), so this is an extension list over the root.
 *
 * **Residual cache gap.** {@link latest_manifest_mtime} stats fixed NAMES, so
 * a signal it does not list is invisible to the key: a project-only .NET
 * scope, `features/support/env.rb`, `spec/spec_helper.rb`, `setup.cfg`,
 * `pytest.ini` and the `mvnw` / `gradlew` wrappers. Known, not closed.
 */
const _DOTNET_PROJECT_EXTS = ['.sln', '.slnx', '.csproj', '.fsproj', '.vbproj'];

/** The packages that make a .NET project a TEST project, for the HIGH tier. */
const _DOTNET_TEST_STACK = /Microsoft\.NET\.Test\.Sdk|xunit|nunit|mstest/i;

/**
 * How deep `_dotnet_project_text` looks. The conventional layout keeps the
 * solution at the root and projects at `src/<Name>/<Name>.csproj`, which a
 * root-only scan misses entirely. Depth 2 reaches it; a flat root still costs
 * one listing, since the walk descends only when the scope holds no project.
 */
const _DOTNET_SCAN_DEPTH = 2;

/** Ceiling on project files read per scope, once the descent is entered at all. */
const _DOTNET_MAX_PROJECTS = 50;

/** Solution extensions — named once, so the descent and its hit test agree. */
const _DOTNET_SOLUTION_EXTS = ['.sln', '.slnx'];

/** Does this scope hold a solution file? The precondition for descending. */
function _has_dotnet_solution(dir: string): boolean {
    try {
        // `withFileTypes`: an extension list over bare NAMES counts a
        // DIRECTORY called `x.sln` as a target. The walk already filters.
        return fs
            .readdirSync(dir, { withFileTypes: true })
            .some((e) => e.isFile() && _DOTNET_SOLUTION_EXTS.includes(path.extname(e.name).toLowerCase()));
    } catch {
        return false;
    }
}

/**
 * Fixed-name files the BEHAVIOR axis reads that `_MANIFESTS` does not cover.
 *
 * **The split is historical and no rule separates them.** `_MANIFESTS` was
 * once "what selects an ecosystem", but selection happens through individual
 * `_is_file` / `_read_text` calls, and `.rspec` is a native signal in THIS
 * list. Both are read in one place — so **a new fixed name goes in either;
 * what matters is ONE.** What escapes: {@link _DOTNET_PROJECT_EXTS}.
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
 * `command` is the exact invocation (a wrapper like `make test` when one
 * exists, else the direct tool) and is ROOT-relative. `speed` is
 * {@link SPEED_FAST} / {@link SPEED_SLOW} / {@link SPEED_E2E}; `basis` names
 * the signal that matched.
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
 * One behavior runner found in one scope — DETECTION ONLY.
 *
 * **`command` is relative to `scope_root`, not the project root** — built from
 * files inside the scope (`vendor/bin/behat`, `./gradlew test`), so a consumer
 * runs it WITH `scope_root` as the working directory. The native axis is
 * root-relative; this one is the exception.
 *
 * {@link RunnerResult}'s fields plus `scope_root`, because the axis is
 * **per-scope, not a repository-wide scalar**: one answer would erase which
 * package owns which runner, and would break the tie the refusal exists to
 * refuse. `scope_root` is POSIX-relative, `'.'` for the root; `conflict` is
 * non-empty only on a refusal row. **It never instructs adoption.**
 */
export class BehaviorRunnerResult {
    constructor(
        readonly ecosystem: string,
        readonly runner: string,
        readonly command: string,
        readonly scope_root: string,
        readonly confidence: string = HIGH,
        readonly basis = '',
        readonly conflict: readonly string[] = [],
    ) {}
}

/**
 * Outcome of one toolchain-resolution pass over a project root.
 *
 * `runners` is the full inventory; `selected` what a command runs after the
 * flags + guard; `quality` the ordered lint commands per ecosystem;
 * `confidence` the overall tier, about the RUNNER and never about `quality`
 * (ruby, jvm and dotnet contribute a runner and no quality commands, so an
 * empty `quality` means none was RESOLVED, not that none is needed — contract
 * page § 3); `mtime` the cache key, as in {@link "./detect".StackResult}.
 */
export class ToolchainResult {
    readonly ecosystems: readonly string[];
    readonly runners: readonly RunnerResult[];
    readonly selected: readonly RunnerResult[];
    readonly quality: readonly string[];
    readonly confidence: string;
    readonly mtime: number;
    /**
     * Per-scope behavior inventory — detection only, deliberately NOT merged
     * into `runners` nor reachable from `selected`, so nothing is ever run
     * BECAUSE this axis detected it.
     *
     * That is a claim about reachability, not about execution, and the two
     * came apart in review: for four of the eight labels the behavior command
     * is byte-identical to a native command already in `selected` —
     * `pytest-bdd`/`pytest`, `cucumber-jvm`/`jvm.command`, and both
     * `reqnroll` and `specflow`/`dotnet test`. Those native rows are
     * SPEED_FAST, so the suite does run by default; it runs as the native
     * runner's work, which this axis neither caused nor can prevent. Stating
     * it as "reported, never run" overreached in exactly the half a reader
     * would act on.
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
 * @param project_root Manifest directory; no upward walk, the caller picks
 *   the scope, matching `detect.detect_stack`.
 * @param opts.include_slow @param opts.include_e2e Monorepo guard, off by
 *   default: `selected` carries only fast unit suites.
 * @param opts.php_only The `--php` narrowing — PHP only in `selected`; the
 *   full inventory stays in `runners`.
 * @returns A {@link ToolchainResult}. Never raises; no manifest or unknown
 *   stack → empty at LOW confidence, so the caller can ask.
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
        // Computed ONCE and threaded into both consumers: workspace discovery
        // reads a manifest and lists per glob parent, and both the cache probe
        // and the behavior axis need the same list.
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
    // Every scope, not only the root: `behavior_runners` is cached per scope,
    // so a root-only key cannot see Behat arriving in a package — stale forever
    // in the common case, and widening only invalidates more often. Cost as a
    // SHAPE, since the arithmetic was published wrong once: both name lists
    // stat-ed per scope, bounded by _MAX_BEHAVIOR_SCOPES, plus
    // `_behavior_scopes` when `scopes` is omitted.
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
 * Ruby — `rspec` ONLY on an explicit signal, never a default: Ruby ships
 * minitest in the stdlib, so a Gemfile with no rspec signal is probably
 * minitest, and a MEDIUM `rspec` would be a guess wearing a label.
 */
/**
 * The Ruby dependency declaration, under either name Bundler accepts —
 * reading only `Gemfile` made a `gems.rb` project invisible to both branches.
 */
interface Gemfile {
    text: string;
    file: string;
    /** The FILE exists — `bundle exec` keys on this, never on the text parsing. */
    present: boolean;
}

function _ruby_gemfile_text(dir: string): Gemfile {
    let present = false;
    for (const name of ['Gemfile', 'gems.rb']) {
        const full = path.join(dir, name);
        // Same presence-not-content split the Gradle branch makes.
        present = present || _is_file(full);
        const text = _read_text(full);
        if (text !== '') {
            // The NAME travels with the text: the basis is serialised and
            // names the file that matched, so a `gems.rb` project is not told
            // its signal came from a `Gemfile` it does not have.
            return { text, file: name, present: true };
        }
    }
    return { text: '', file: '', present };
}

/** `gem 'rspec'` / `gem "cucumber"` — a DECLARATION, not the word anywhere. */
function _gem_declared(text: string, gem: string): boolean {
    // Same discipline as `_PY_BEHAVE`: a bare `\brspec\b` fires on a
    // commented-out gem, a changelog line, or any name containing the word. A
    // hyphenated SUFFIX is allowed (`rspec-rails`, `cucumber-rails`) but a
    // suffix ONLY, so `cucumber` matches no gem merely ending in it.
    return new RegExp(`^[ \\t]*gem[ \\t]+["']${gem}(-[A-Za-z0-9_-]+)?["']`, 'm').test(text);
}

function _ruby_runners(root: string, gemfile: Gemfile): RunnerResult[] {
    const dot_rspec = _is_file(path.join(root, '.rspec'));
    const spec_helper = _is_file(path.join(root, 'spec', 'spec_helper.rb'));
    const in_gemfile = _gem_declared(gemfile.text, 'rspec');
    // No `Gemfile` precondition: each of the three signals stands on its own,
    // as the contract table says. Gating on the Gemfile made the two marker
    // bases unreachable in the projects that have only markers.
    if (!in_gemfile && !dot_rspec && !spec_helper) {
        return [];
    }
    const basis = in_gemfile
        ? `rspec in ${gemfile.file}`
        : dot_rspec
          ? '.rspec present'
          : 'spec/spec_helper.rb present';
    // `bundle exec` ABORTS without a Gemfile, and the marker signals exist
    // precisely for projects that have none — so the prefix keys on the file
    // that makes it work, not on the signal that found the suite.
    const cmd = gemfile.present ? 'bundle exec rspec' : 'rspec';
    return [new RunnerResult('ruby', 'rspec', cmd, SPEED_FAST, HIGH, basis)];
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
 * Wrapper-first, like `_task_runner_wrappers`: `./gradlew` / `./mvnw` pin the
 * build-tool version, so the ambient `gradle` / `mvn` can fail on one the
 * project never used.
 */
function _jvm_build(root: string): JvmBuild | null {
    const pom = _read_text(path.join(root, 'pom.xml'));
    if (pom !== '') {
        const wrapper = _is_file(path.join(root, 'mvnw'));
        return { tool: 'maven', text: pom, command: wrapper ? './mvnw test' : 'mvn test' };
    }
    // PRESENCE, not content: a Gradle multi-project root routinely has an
    // empty `build.gradle`, or none with `settings.gradle[.kts]` declaring
    // the modules, and both looked like "no Gradle here". Maven above still
    // gates on content — recorded in the roadmap residue.
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
 * Mirrors the PHP gradation, awarding HIGH only for a NAMED runner: HIGH
 * needs a PROJECT file naming a TEST stack (`Microsoft.NET.Test.Sdk`, xunit,
 * nunit, mstest); a bare project or solution is MEDIUM, the analogue of the
 * bare manifest. That stops a bare non-test project raising the WHOLE
 * repository to HIGH, but does NOT keep the row out of `selected` —
 * `_apply_guard` has never read `confidence` — which is why a marker with no
 * project anywhere emits no row.
 */
function _dotnet_basis(root: string): { basis: string; confidence: string } | null {
    let names: string[];
    try {
        // SORTED: the basis names the matched file and is serialised, so an
        // unsorted listing churns a stable config on rename. FILES only — a
        // directory named `x.csproj` is no target, and this row reaches
        // `selected`.
        names = fs
            .readdirSync(root, { withFileTypes: true })
            .filter((e) => e.isFile())
            .map((e) => e.name)
            .sort();
    } catch {
        names = [];
    }
    // A ROOT TARGET, not a target anywhere. `dotnet test` is NOT recursive:
    // with no project or solution in the working directory it fails MSB1003,
    // whatever sits below. So the row is gated on this listing, and a scope
    // whose only .NET evidence is an SDK pin gets NO row — confidence does not
    // gate `selected`, so a row here would be a command that cannot run.
    const target = names.find((n) => _DOTNET_PROJECT_EXTS.includes(path.extname(n).toLowerCase()));
    if (target === undefined) {
        return null;
    }
    // The DESCENT still matters for the tier: a root `.sln` is a valid target
    // whose own body names no package, so the projects it references decide
    // HIGH vs MEDIUM.
    return _DOTNET_TEST_STACK.test(_dotnet_project_text(root))
        ? { basis: 'test stack named in a .NET project file', confidence: HIGH }
        : { basis: `${target} present, no test stack named`, confidence: MEDIUM };
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

// --- Behavior-runner axis — per scope, list-shaped, detection only -------

/**
 * Resolve every behavior runner this repository carries, one row per scope.
 *
 * Scopes are the root plus each declared workspace package: one row cannot
 * represent the ordinary monorepo, a behavior runner in one package and plain
 * unit tests in another. Two runners of ONE ecosystem in one scope refuse,
 * naming both, never a pick. Never raises — an unreadable manifest yields
 * fewer rows.
 */
export function resolve_behavior_runners(
    project_root: string,
    scopes?: readonly string[],
): BehaviorRunnerResult[] {
    const out: BehaviorRunnerResult[] = [];
    for (const scope of scopes ?? _behavior_scopes(project_root)) {
        const dir = scope === '.' ? project_root : path.join(project_root, scope);
        // Grouped by ECOSYSTEM: two ecosystems' behavior runners are a
        // polyglot repository, not a conflict — a PHP app with a JS frontend
        // is the commonest shape there is, and `unknown` throws both answers
        // away. Only two runners in ONE ecosystem are mutually exclusive.
        const rows = _behavior_runners_in_scope(dir, scope);
        for (const ecosystem of _dictFromKeys(rows.map((r) => r.ecosystem))) {
            const found = rows.filter((r) => r.ecosystem === ecosystem);
            const names = [...new Set(found.map((r) => r.runner))].sort();
            if (names.length <= 1) {
                // One answer per ecosystem, however many signals produced it.
                // The `>1 row, 1 name` case is unreachable today; without it a
                // future branch emitting a label twice refuses it against itself.
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
                    `two ${ecosystem} behavior runners in one scope ` +
                        `(${names.join(', ')}) — refusing to choose, as the frontend ` +
                        'detector refuses between mutually exclusive workspaces',
                    names,
                ),
            );
        }
    }
    return out;
}

/** Behavior runners inside ONE scope directory, before conflict handling. */
function _behavior_runners_in_scope(dir: string, scope: string): BehaviorRunnerResult[] {
    const out: BehaviorRunnerResult[] = [];
    const at = (n: string): string => path.join(dir, n);
    const row = (ecosystem: string, runner: string, command: string, basis: string): void => {
        out.push(new BehaviorRunnerResult(ecosystem, runner, command, scope, HIGH, basis));
    };

    const php_deps = _all_dependencies(_read_json(at('composer.json')), 'require', 'require-dev');
    const behat_config = ['behat.yml', 'behat.yaml', 'behat.yml.dist', 'behat.dist.yml'].find((n) =>
        _is_file(at(n)),
    );
    if ('behat/behat' in php_deps || behat_config !== undefined) {
        // "in the composer manifest", NOT "in composer require": the literal
        // reads as an install instruction to a grep, and this axis may never be
        // mistaken for one. And `vendor/bin/behat` exists only after a composer
        // install, so a config-only scope gets the bare binary.
        const declared = 'behat/behat' in php_deps;
        const basis = declared
            ? 'behat/behat in the composer manifest'
            : `${behat_config} present`;
        row('php', 'behat', declared ? 'vendor/bin/behat' : 'behat', basis);
    }

    // OWN dependencies only, unlike the native axis: a peer or optional
    // declaration says a CONSUMER must supply cucumber — which is exactly how a
    // formatter or preset declares it. On an axis whose doctrine is no guessing,
    // reading one as ownership is the guess.
    const js_deps = _all_dependencies(
        _read_json(at('package.json')),
        'dependencies',
        'devDependencies',
    );
    const cucumber_config = ['cucumber.js', 'cucumber.cjs', 'cucumber.mjs', 'cucumber.json'].find(
        (n) => _is_file(at(n)),
    );
    if ('@cucumber/cucumber' in js_deps || 'cucumber' in js_deps || cucumber_config !== undefined) {
        const dep = '@cucumber/cucumber' in js_deps ? '@cucumber/cucumber' : 'cucumber';
        // `npx` FETCHES when the package is absent, so on the config-only
        // path it would let a detection-only axis install. Degrades like the
        // behat and ruby rows.
        const declared = dep in js_deps;
        const basis = declared ? `${dep} in package deps` : `${cucumber_config} present`;
        row('js', 'cucumber-js', declared ? 'npx cucumber-js' : 'cucumber-js', basis);
    }

    // Joined with a newline, like `_dotnet_project_text`: concatenated bare, a
    // `pyproject.toml` with no trailing newline fuses its last token to the
    // first of `requirements.txt`, making a token present in neither.
    const py_text = [_read_text(at('pyproject.toml')), _read_text(at('requirements.txt'))].join('\n');
    if (_PY_BEHAVE.test(py_text)) {
        row('python', 'behave', 'behave', 'behave declared as a python dependency');
    }
    // Anchored like `_PY_BEHAVE`, for a sharper reason than symmetry: an
    // unanchored match on a commented-out `# pytest-bdd` beside a real
    // `behave` declaration made TWO python rows, which the grouping turned
    // into a FALSE refusal. A false positive here deletes a true row.
    if (_PY_BDD.test(py_text)) {
        row('python', 'pytest-bdd', 'pytest', 'pytest-bdd declared as a python dependency');
    }

    const gemfile = _ruby_gemfile_text(dir);
    const cucumber_gem = _gem_declared(gemfile.text, 'cucumber');
    if (cucumber_gem || _is_file(path.join(dir, 'features', 'support', 'env.rb'))) {
        // `bundle exec` ABORTS without a Gemfile and `env.rb` is the signal
        // for scopes that have none — same guard as `_ruby_runners`.
        const basis = cucumber_gem
            ? `cucumber in ${gemfile.file}`
            : 'features/support/env.rb present';
        const cmd = gemfile.present ? 'bundle exec cucumber' : 'cucumber';
        row('ruby', 'cucumber-ruby', cmd, basis);
    }

    // NOTE: `jvm.text` is the ROOT build files only, so a Gradle multi-project
    // root whose modules declare cucumber is missed — recorded in the roadmap
    // residue rather than fixed, because reading the included modules is new
    // detection work rather than a correction.
    const jvm = _jvm_build(dir);
    if (jvm !== null && /io\.cucumber|cucumber-java|cucumber-junit/i.test(jvm.text)) {
        row('jvm', 'cucumber-jvm', jvm.command, `cucumber in the ${jvm.tool} build file`);
    }

    // Two rows, not an `else if`. The chain was a silent pick: this reads the
    // CONCATENATED text of every project, so a Reqnroll project beside a
    // SpecFlow one collapsed into one HIGH row — the guess the refusal exists
    // to prevent. Two rows let the grouping refuse, as it does for python.
    const dotnet_text = _dotnet_project_text(dir);
    if (/\bReqnroll\b/i.test(dotnet_text)) {
        row('dotnet', 'reqnroll', 'dotnet test', 'Reqnroll in a project file');
    }
    if (/\bSpecFlow\b/i.test(dotnet_text)) {
        row('dotnet', 'specflow', 'dotnet test', 'SpecFlow in a project file');
    }

    return out;
}

/**
 * Concatenated text of the .NET project files belonging to this scope.
 *
 * Scans the scope and, holding no project file of its own, descends to
 * {@link _DOTNET_SCAN_DEPTH}: the `root/src/<Name>/<Name>.csproj` layout,
 * where the root carries only a `.sln` and a `.sln` names no package. Sorted
 * at every level, so deterministic. Depth is bounded, and files READ are
 * bounded — directories LISTED are not, and the max-projects exits fire only
 * once a project was found.
 */
function _dotnet_project_text(dir: string): string {
    const texts: string[] = [];
    // Gated on a solution. The gate suppresses the DESCENT only: this
    // directory is listed here and again by the walk, in every scope of every
    // repository. NOT pruned at scope boundaries either, so a root solution
    // plus package scopes can still double-attribute — both residue.
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
            if (!e.isFile() || !_DOTNET_PROJECT_EXTS.includes(path.extname(e.name).toLowerCase())) {
                continue;
            }
            // A SOLUTION's body is project NAMES, never packages — neither
            // read as project text nor a reason to stop descending. Read,
            // `MyApp.SpecFlow.Tests` emits a HIGH `specflow` row no project
            // supports, and a legacy SpecFlow name beside a Reqnroll one makes
            // two dotnet rows the grouping REFUSES — a false positive deleting
            // a true row. Presence is still a descent signal.
            if (_DOTNET_SOLUTION_EXTS.includes(path.extname(e.name).toLowerCase())) {
                continue;
            }
            if (texts.length >= _DOTNET_MAX_PROJECTS) {
                return;
            }
            texts.push(_read_text(path.join(at, e.name)));
            hit = true;
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

/** Hard ceiling on scopes scanned — a pathological glob cannot stall a turn. */
const _MAX_BEHAVIOR_SCOPES = 200;

/**
 * `behave` DECLARED AS A DEPENDENCY, never merely mentioned.
 *
 * `behave` is an ordinary English verb, unlike every sibling token here, so a
 * bare `\bbehave\b` fires HIGH on a description or changelog line. Anchored to
 * a line-start declaration, terminated by a version specifier, a separator or
 * a `#` comment. Misses the SINGLE-LINE array form only — the multi-line
 * array and the poetry inline table both match — a missed row either way,
 * which is the cheap direction here.
 */
const _PY_BEHAVE = /^[ \t]*["']?behave["']?[ \t]*(?:$|[=<>~!,;[#])/m;

/** `pytest-bdd` declared as a dependency — same anchoring, same reason. */
const _PY_BDD = /^[ \t]*["']?pytest-bdd["']?[ \t]*(?:$|[=<>~!,;[#])/m;

/**
 * The `packages:` sequence of a `pnpm-workspace.yaml`, and ONLY that key.
 *
 * Matching every `- item` line is wrong in a way that reads as working: a
 * real workspace file carries sibling sequences (`onlyBuiltDependencies`,
 * `patchedDependencies`), so `- esbuild` under one became the scope
 * `esbuild`. A line-state reader, not a YAML parse, because this module is
 * leaf by contract: track whether the current top-level key is `packages`
 * and accept items only while it is; any column-0 key ends the section.
 *
 * KNOWN GAP: a MULTI-LINE flow sequence (`packages: [` then item lines) is
 * dropped whole — the single-line flow branch consumes the opener. Residue.
 */
export function _pnpm_packages(text: string): string[] {
    const out: string[] = [];
    let inPackages = false;
    const push = (raw: string): void => {
        // A trailing `# comment` is legal YAML; strip before unquoting.
        const v = raw.replace(/\s+#.*$/, '').trim().replace(/^['"]|['"]$/g, '').trim();
        if (v !== '') out.push(v);
    };
    // `\r?\n`, not `\n`: `.` never matches `\r`, so on a CRLF file the key
    // regex below matched NOTHING and the whole workspace silently collapsed
    // to the root scope — the same silent-drop class as the flow gap above.
    for (const line of text.split(/\r?\n/)) {
        if (line.trim() === '' || /^\s*#/.test(line)) {
            continue;
        }
        const key = /^([A-Za-z0-9_-]+)\s*:(.*)$/.exec(line);
        if (key) {
            inPackages = key[1] === 'packages';
            // A FLOW sequence on the key line is the same declaration
            // inline; consuming the line discarded the whole workspace.
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
        // `^\s*-`, not `^\s+-`: a zero-indent block sequence is valid YAML.
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
 * A LOCAL re-read, not an import of the frontend detector: this module is
 * leaf by contract. Only the two forms that declare package locations are
 * read; a `turbo.json` / `nx.json` root sits beside one in practice.
 */
/** A segment no workspace package lives in — `node_modules`, dot-dirs. */
function _excluded_scope(name: string): boolean {
    return name.split('/').some((seg) => seg.startsWith('.') || seg === 'node_modules');
}

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
        // Checked DURING expansion, not sliced off the result, which bounds
        // only after the listing is paid. Non-resolvers still cost a syscall.
        if (scopes.length >= _MAX_BEHAVIOR_SCOPES) {
            break;
        }
        const g = raw.replace(/^\.\//, '').replace(/\/+$/, '');
        if (g === '' || g.startsWith('!') || g.startsWith('/') || g.includes('..')) {
            continue;
        }
        // One predicate over the WHOLE pattern, before the fork: checking only
        // the glob child let `node_modules/*` admit what the literal refuses.
        if (_excluded_scope(g)) {
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
            // SORTED: scope order becomes serialised row order.
            children.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
            for (const c of children) {
                if (scopes.length >= _MAX_BEHAVIOR_SCOPES) {
                    break;
                }
                if (c.isDirectory() && !_excluded_scope(c.name)) {
                    scopes.push(`${parent}/${c.name}`);
                }
            }
        } else if (!g.includes('*')) {
            // Existence-checked; the exclusion already ran above the fork.
            try {
                // `lstatSync`, matching the glob branch's `Dirent.isDirectory()`:
                // `statSync` follows a symlink, so one package was a scope when
                // declared literally and skipped when matched by a glob.
                if (fs.lstatSync(path.join(project_root, g)).isDirectory()) {
                    scopes.push(g);
                }
            } catch {
                /* declared but absent — not a scope */
            }
        }
        // A deeper or mid-path glob (`a/*/b`, `**`) is skipped, not
        // half-expanded: a scope that does not exist is worse than one fewer.
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
 * Two behaviors the previous three-branch version lacked, both from the skill
 * rather than invented here: `packageManager` in the root `package.json` is
 * the DECLARATION and wins when present, because Corepack enforces it and a
 * lockfile is only an inference; and **two lockfiles is a finding, not a tie
 * to break** — the old code returned `pnpm` for a repository carrying both
 * `pnpm-lock.yaml` and `yarn.lock`, a guess presented as an answer.
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
    // GUARDED, like every sibling helper. `latest_manifest_mtime` stats after
    // a SEPARATE `_is_file`, so a file deleted between the two threw out of
    // `resolve_toolchain` and broke its never-raises contract. A missing file
    // contributes no mtime, exactly as one that was never there.
    try {
        return Number(fs.statSync(p, { bigint: true }).mtimeNs) / 1e9;
    } catch {
        return 0;
    }
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
 * Two CPython behaviors `JSON.stringify` does NOT reproduce, done here:
 * `sort_keys=True` (code-point key order — pre-sorted recursively) and
 * integer-valued floats rendering `N.0`, which JSON cannot tag. The only
 * float is `mtime`; the parity tests normalize its value (not reproducible
 * across CPython/V8) while the tagged wrapper keeps the *shape*. Also:
 * 2-space indent, `": "` / `","` separators, `{}` / `[]` for empties.
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
