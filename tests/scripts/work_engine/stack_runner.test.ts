// Intent tests for the py2ts work_engine `stack/runner` twin (ADR-094 / ADR-200).
//
// Was a python3-vs-tsx byte-parity rig; the python side is dropped — this now
// exercises the `.ts` module's own contract in-process. `runner.ts` is a leaf
// module (stdlib-only, no intra-`work_engine` imports) so the resolver can be
// driven directly via the imported `resolve_toolchain` / `write_config` without
// spawning anything.
//
// Each block builds a fake project tree (composer.json / package.json /
// pyproject.toml / go.mod / Cargo.toml / Makefile / Taskfile.yml) in a tmp dir
// and asserts the observable output. Two views:
//
//  - `resolve_toolchain` → its `to_config()` dict, serialised compactly with the
//    non-deterministic `mtime` float NORMALISED to the sentinel string
//    `"<mtime>"` (its exact byte-repr is filesystem-derived, not part of the
//    contract); everything else IS deterministic and asserted directly.
//  - `write_config` → the on-disk file bytes (incl. `sort_keys=True` + the
//    trailing `\n`), again with `mtime` normalised — exercises the
//    indent-2 / sort-keys serialiser directly.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
    BEHAVIOR_UNKNOWN,
    HIGH,
    KNOWN_BEHAVIOR_RUNNERS,
    KNOWN_RUNNERS,
    LOW,
    MEDIUM,
    RunnerResult,
    SPEED_E2E,
    SPEED_FAST,
    SPEED_SLOW,
    PACKAGE_MANAGER_BRANCHES,
    ToolchainResult,
    _behavior_scopes,
    _pnpm_packages,
    _resolve_package_manager,
    latest_manifest_mtime,
    resolve_behavior_runners,
    resolve_toolchain,
    write_config,
} from '../../../src/agent-src/templates/scripts/work_engine/stack/runner.js';

interface Flags {
    include_slow?: boolean;
    include_e2e?: boolean;
    php_only?: boolean;
}

/**
 * `resolve_toolchain(root, flags).to_config()` → compact JSON with `mtime`
 * normalised to the sentinel so the float repr never enters the comparison.
 */
function config(root: string, flags: Flags = {}): string {
    const res = resolve_toolchain(root, flags);
    const cfg = res.to_config() as Record<string, unknown>;
    cfg.mtime = '<mtime>';
    return JSON.stringify(cfg);
}

/** `write_config` → on-disk bytes, `mtime` normalised, incl. trailing `\n`. */
function writeConfigText(root: string): string {
    const res = resolve_toolchain(root);
    const target = write_config(root, res);
    const text = fs.readFileSync(target, { encoding: 'utf-8' });
    return text.replace(/"mtime": [0-9.]+/, '"mtime": "<mtime>"');
}

let tmp: string;

beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'p2t-runner-'));
});

afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
});

function write(rel: string, body: string): void {
    const p = path.join(tmp, rel);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, body, 'utf8');
}

describe('stack/runner — module constants parity', () => {
    it('speed + confidence constants match Python', () => {
        expect(SPEED_FAST).toBe('fast');
        expect(SPEED_SLOW).toBe('slow');
        expect(SPEED_E2E).toBe('e2e');
        expect(HIGH).toBe('HIGH');
        expect(MEDIUM).toBe('MEDIUM');
        expect(LOW).toBe('LOW');
    });

    it('KNOWN_RUNNERS carries the nine original labels plus the three natives', () => {
        // The nine were the Python parity set. `rspec` / `junit` /
        // `dotnet-test` were added because a repository carrying one of them
        // was indistinguishable from one carrying no runner at all. What makes
        // the set a source of truth rather than a claim is the membership test
        // below, which binds it to what the resolver actually emits.
        expect([...KNOWN_RUNNERS].sort()).toEqual(
            [
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
            ].sort(),
        );
    });

    it('KNOWN_BEHAVIOR_RUNNERS is a SEPARATE set and carries the refusal label', () => {
        // Separate, not merged: `selected` is what a command actually invokes,
        // and a behaviour suite the repository happens to own is not something
        // `/tests execute` may start running because a label appeared.
        expect([...KNOWN_BEHAVIOR_RUNNERS].sort()).toEqual(
            [
                'behat',
                'cucumber-js',
                'cucumber-ruby',
                'cucumber-jvm',
                'behave',
                'pytest-bdd',
                'reqnroll',
                'specflow',
                'unknown',
            ].sort(),
        );
        expect(BEHAVIOR_UNKNOWN).toBe('unknown');
        for (const label of KNOWN_BEHAVIOR_RUNNERS) {
            expect(KNOWN_RUNNERS.has(label)).toBe(false);
        }
    });

    it('RunnerResult applies the documented defaults', () => {
        const r = new RunnerResult('php', 'pest', 'vendor/bin/pest');
        expect(r.speed).toBe(SPEED_FAST);
        expect(r.confidence).toBe(HIGH);
        expect(r.basis).toBe('');
    });

    it('ToolchainResult.to_config has the expected key shape', () => {
        const res = new ToolchainResult({
            ecosystems: [],
            runners: [],
            selected: [],
            quality: [],
            confidence: LOW,
            mtime: 0.0,
        });
        const cfg = res.to_config();
        expect(Object.keys(cfg).sort()).toEqual(
            [
                'confidence',
                'ecosystems',
                'mtime',
                'quality',
                'runners',
                'selected',
                'behavior_runners',
            ].sort(),
        );
        expect(cfg.confidence).toBe(LOW);
        // Additive, and empty by default: a result constructed without the
        // axis still serialises the key, so a reader never has to branch on
        // whether the field exists.
        expect(cfg.behavior_runners).toEqual([]);
    });
});

describe('stack/runner — toolchain resolution', () => {
    // ── empty / no-match ─────────────────────────────────────────────────
    it('greenfield: no manifest → LOW confidence, empty inventory', () => {
        const cfg = JSON.parse(config(tmp)) as Record<string, unknown>;
        expect(cfg.confidence).toBe('LOW');
        expect(cfg.runners).toEqual([]);
        expect(cfg.selected).toEqual([]);
    });

    // ── PHP branches ─────────────────────────────────────────────────────
    it('php: pest in composer require', () => {
        write('composer.json', JSON.stringify({ require: { 'pestphp/pest': '^2' } }));
        const cfg = JSON.parse(config(tmp)) as Record<string, unknown>;
        expect((cfg.runners as { runner: string }[])[0]!.runner).toBe('pest');
    });

    it('php: vendor/bin/pest binary (no dep) wins over phpunit', () => {
        write('composer.json', JSON.stringify({ require: {} }));
        write('vendor/bin/pest', '#!/usr/bin/env php\n');
        // Exercises the binary-detection branch; assertion is the snapshot-free
        // structural shape below.
        const cfg = JSON.parse(config(tmp)) as Record<string, unknown>;
        expect((cfg.runners as { runner: string }[])[0]!.runner).toBe('pest');
    });

    it('php: artisan present → phpunit via php artisan test', () => {
        write('composer.json', JSON.stringify({ require: {} }));
        write('artisan', '#!/usr/bin/env php\n');
        const cfg = JSON.parse(config(tmp)) as Record<string, unknown>;
        expect((cfg.runners as { command: string }[])[0]!.command).toBe('php artisan test');
    });

    it('php: phpunit/phpunit dependency', () => {
        write('composer.json', JSON.stringify({ 'require-dev': { 'phpunit/phpunit': '^11' } }));
        const cfg = JSON.parse(config(tmp)) as Record<string, unknown>;
        expect((cfg.runners as { runner: string }[])[0]!.runner).toBe('phpunit');
    });

    it('php: composer.json with no runner → MEDIUM phpunit default', () => {
        write('composer.json', JSON.stringify({ require: { 'monolog/monolog': '^3' } }));
        const cfg = JSON.parse(config(tmp)) as Record<string, unknown>;
        expect(cfg.confidence).toBe('MEDIUM');
        expect((cfg.runners as { confidence: string }[])[0]!.confidence).toBe('MEDIUM');
    });

    it('php quality: phpstan + pint detected', () => {
        write(
            'composer.json',
            JSON.stringify({ 'require-dev': { 'phpstan/phpstan': '^1', 'laravel/pint': '^1' } }),
        );
        const cfg = JSON.parse(config(tmp)) as Record<string, unknown>;
        expect(cfg.quality).toEqual(['vendor/bin/phpstan analyse', 'vendor/bin/pint']);
    });

    it('php: Makefile test wrapper wins over the direct tool', () => {
        write('composer.json', JSON.stringify({ require: { 'pestphp/pest': '^2' } }));
        write('Makefile', 'test:\n\t./vendor/bin/pest\n');
        const cfg = JSON.parse(config(tmp)) as Record<string, unknown>;
        expect((cfg.runners as { command: string }[])[0]!.command).toBe('make test');
    });

    it('php: Taskfile test wrapper (no Makefile)', () => {
        write('composer.json', JSON.stringify({ require: { 'pestphp/pest': '^2' } }));
        write('Taskfile.yml', "version: '3'\ntasks:\n  test:\n    cmds:\n      - vendor/bin/pest\n");
        const cfg = JSON.parse(config(tmp)) as Record<string, unknown>;
        expect((cfg.runners as { command: string }[])[0]!.command).toBe('task test');
    });

    // ── JS branches ──────────────────────────────────────────────────────
    it('js: vitest beats jest when both present', () => {
        write('package.json', JSON.stringify({ devDependencies: { vitest: '^1', jest: '^29' } }));
        const cfg = JSON.parse(config(tmp)) as Record<string, unknown>;
        expect((cfg.runners as { runner: string }[])[0]!.runner).toBe('vitest');
        expect((cfg.runners as { command: string }[])[0]!.command).toBe('npx vitest run');
    });

    it('js: vitest with a matching test script + pm wrapper', () => {
        write(
            'package.json',
            JSON.stringify({ devDependencies: { vitest: '^1' }, scripts: { test: 'vitest run' } }),
        );
        const cfg = JSON.parse(config(tmp)) as Record<string, unknown>;
        expect((cfg.runners as { command: string }[])[0]!.command).toBe('npm test');
    });

    it('js: jest only', () => {
        write('package.json', JSON.stringify({ devDependencies: { jest: '^29' } }));
        const cfg = JSON.parse(config(tmp)) as Record<string, unknown>;
        expect((cfg.runners as { runner: string }[])[0]!.runner).toBe('jest');
    });

    it('js: test script with unclear runner → MEDIUM jest', () => {
        write('package.json', JSON.stringify({ scripts: { test: 'node ./run-tests.js' } }));
        const cfg = JSON.parse(config(tmp)) as Record<string, unknown>;
        expect((cfg.runners as { confidence: string }[])[0]!.confidence).toBe('MEDIUM');
    });

    it('js: playwright e2e excluded from selected by default', () => {
        write(
            'package.json',
            JSON.stringify({ devDependencies: { vitest: '^1', '@playwright/test': '^1' } }),
        );
        const cfg = JSON.parse(config(tmp)) as Record<string, unknown>;
        // Inventory has both; selected (default guard) drops the e2e command.
        expect((cfg.runners as unknown[]).length).toBe(2);
        expect((cfg.selected as string[])).toEqual(['npx vitest run']);
    });

    it('js: --include-e2e adds playwright to selected', () => {
        write(
            'package.json',
            JSON.stringify({ devDependencies: { vitest: '^1', '@playwright/test': '^1' } }),
        );
        const cfg = JSON.parse(config(tmp, { include_e2e: true })) as Record<string, unknown>;
        expect((cfg.selected as string[]).length).toBe(2);
    });

    it('js: cypress e2e + test:e2e script command', () => {
        write(
            'package.json',
            JSON.stringify({ devDependencies: { cypress: '^13' }, scripts: { 'test:e2e': 'cypress run' } }),
        );
        const cfg = JSON.parse(config(tmp, { include_e2e: true })) as Record<string, unknown>;
        const e2e = (cfg.runners as { runner: string; command: string }[]).find((r) => r.runner === 'cypress');
        expect(e2e?.command).toBe('npm run test:e2e');
    });

    it('js: slow bucket excluded by default, added with --include-slow', () => {
        write(
            'package.json',
            JSON.stringify({ devDependencies: { vitest: '^1' }, scripts: { 'test:slow': 'vitest run slow' } }),
        );
        const def = JSON.parse(config(tmp)) as Record<string, unknown>;
        expect((def.selected as string[]).length).toBe(1);
        const slow = JSON.parse(config(tmp, { include_slow: true })) as Record<string, unknown>;
        expect((slow.selected as string[]).length).toBe(2);
    });

    it('js quality: typescript + eslint', () => {
        write('package.json', JSON.stringify({ devDependencies: { typescript: '^5', eslint: '^9' } }));
        const cfg = JSON.parse(config(tmp)) as Record<string, unknown>;
        expect(cfg.quality).toEqual(['npx tsc --noEmit', 'npx eslint .']);
    });

    it('js: pnpm package manager wrapper', () => {
        write(
            'package.json',
            JSON.stringify({ devDependencies: { vitest: '^1' }, scripts: { test: 'vitest run' } }),
        );
        write('pnpm-lock.yaml', 'lockfileVersion: 9\n');
        const cfg = JSON.parse(config(tmp)) as Record<string, unknown>;
        expect((cfg.runners as { command: string }[])[0]!.command).toBe('pnpm test');
    });

    // ── Python branches ──────────────────────────────────────────────────
    it('python: pyproject mentions pytest → HIGH', () => {
        write('pyproject.toml', '[tool.pytest.ini_options]\naddopts = "-q"\n');
        const cfg = JSON.parse(config(tmp)) as Record<string, unknown>;
        expect((cfg.runners as { runner: string; confidence: string }[])[0]).toMatchObject({
            runner: 'pytest',
            confidence: 'HIGH',
        });
    });

    it('python: requirements.txt only → MEDIUM pytest', () => {
        write('requirements.txt', 'requests\n');
        const cfg = JSON.parse(config(tmp)) as Record<string, unknown>;
        expect((cfg.runners as { confidence: string }[])[0]!.confidence).toBe('MEDIUM');
    });

    it('python quality: ruff + mypy from pyproject text', () => {
        write('pyproject.toml', '[tool.ruff]\n[tool.mypy]\n[tool.pytest.ini_options]\n');
        const cfg = JSON.parse(config(tmp)) as Record<string, unknown>;
        expect(cfg.quality).toEqual(['ruff check', 'mypy .']);
    });

    // ── Go / Rust ────────────────────────────────────────────────────────
    it('go: go.mod present', () => {
        write('go.mod', 'module example.com/x\n\ngo 1.22\n');
        const cfg = JSON.parse(config(tmp)) as Record<string, unknown>;
        expect((cfg.runners as { runner: string }[])[0]!.runner).toBe('go-test');
        expect(cfg.quality).toEqual(['go vet ./...']);
    });

    it('rust: Cargo.toml present', () => {
        write('Cargo.toml', '[package]\nname = "x"\n');
        const cfg = JSON.parse(config(tmp)) as Record<string, unknown>;
        expect((cfg.runners as { runner: string }[])[0]!.runner).toBe('cargo-test');
        expect(cfg.quality).toEqual(['cargo clippy']);
    });

    // ── Monorepo: multi-ecosystem + guards ───────────────────────────────
    it('monorepo: php + js + python + go inventory and ecosystem order', () => {
        write('composer.json', JSON.stringify({ require: { 'pestphp/pest': '^2' } }));
        write('package.json', JSON.stringify({ devDependencies: { vitest: '^1' } }));
        write('pyproject.toml', '[tool.pytest.ini_options]\n');
        write('go.mod', 'module x\n');
        const cfg = JSON.parse(config(tmp)) as Record<string, unknown>;
        expect(cfg.ecosystems).toEqual(['php', 'js', 'python', 'go']);
    });

    it('monorepo: --php narrows selected to PHP only', () => {
        write('composer.json', JSON.stringify({ require: { 'pestphp/pest': '^2' } }));
        write('package.json', JSON.stringify({ devDependencies: { vitest: '^1' } }));
        const cfg = JSON.parse(config(tmp, { php_only: true })) as Record<string, unknown>;
        // Full inventory keeps both; selected is PHP-only.
        expect((cfg.runners as unknown[]).length).toBe(2);
        expect((cfg.selected as string[])).toEqual(['vendor/bin/pest']);
    });

    // ── write_config byte shape ──────────────────────────────────────────
    it('write_config: on-disk file (sort_keys + trailing \\n)', () => {
        write('composer.json', JSON.stringify({ require: { 'pestphp/pest': '^2' } }));
        write('package.json', JSON.stringify({ devDependencies: { vitest: '^1', eslint: '^9' } }));
        const text = writeConfigText(tmp);
        // The file ends with a newline and sorts keys.
        expect(text.endsWith('\n')).toBe(true);
        expect(text.indexOf('"confidence"')).toBeLessThan(text.indexOf('"ecosystems"'));
    });
});

/**
 * `road-to-internal-estate-fit` Phase 3. The package-manager cascade is
 * specified in `src/skills/monorepo-workspace/SKILL.md` § 1 ("Package manager —
 * from the declaration, then the lockfile"), and that prose was already correct
 * while the code implemented three of its five branches and silently broke the
 * two-lockfile tie it says to report.
 *
 * The skill section named above is the SOURCE of this branch list. These tests
 * do not parse it — a test that read the prose would be over-engineering — but
 * a test that fails when the code's branch count drops below the documented one
 * is exactly the pin that was missing.
 */
describe('package-manager cascade — monorepo-workspace SKILL.md § 1', () => {
    it('declares all five documented branches', () => {
        expect([...PACKAGE_MANAGER_BRANCHES].sort()).toEqual(
            ['bun', 'npm', 'packageManager', 'pnpm', 'yarn'].sort(),
        );
        expect(PACKAGE_MANAGER_BRANCHES.length).toBe(5);
    });

    it('packageManager declaration wins over any lockfile', () => {
        write('package.json', JSON.stringify({ packageManager: 'yarn@4.1.0' }));
        write('pnpm-lock.yaml', 'lockfileVersion: 9\n');
        const res = _resolve_package_manager(tmp, { packageManager: 'yarn@4.1.0' });
        expect(res.manager).toBe('yarn');
        expect(res.via).toBe('packageManager');
        expect(res.finding).toBe('');
    });

    it.each([
        ['pnpm-lock.yaml', 'lockfileVersion: 9\n', 'pnpm'],
        ['yarn.lock', '# yarn lockfile v1\n', 'yarn'],
        ['bun.lock', '{}\n', 'bun'],
        ['bun.lockb', 'binary\n', 'bun'],
        ['package-lock.json', '{"lockfileVersion":3}\n', 'npm'],
    ])('%s resolves to %s', (file, body, expected) => {
        write(file, body as string);
        const res = _resolve_package_manager(tmp, {});
        expect(res.manager).toBe(expected);
        expect(res.finding).toBe('');
    });

    it('two DIFFERENT lockfiles is a finding, not a tie-break', () => {
        write('pnpm-lock.yaml', 'lockfileVersion: 9\n');
        write('yarn.lock', '# yarn lockfile v1\n');
        const res = _resolve_package_manager(tmp, {});
        // The defect this replaces returned 'pnpm' here — the first branch it
        // happened to test — which is a guess presented as an answer.
        expect(res.manager).toBeNull();
        expect(res.via).toBe('ambiguous');
        expect(res.finding).toContain('pnpm-lock.yaml');
        expect(res.finding).toContain('yarn.lock');
    });

    it('bun.lock and bun.lockb together are ONE manager, not an ambiguity', () => {
        write('bun.lock', '{}\n');
        write('bun.lockb', 'binary\n');
        const res = _resolve_package_manager(tmp, {});
        expect(res.manager).toBe('bun');
        expect(res.finding).toBe('');
    });

    it('no lockfile and no declaration falls back to npm', () => {
        const res = _resolve_package_manager(tmp, {});
        expect(res.manager).toBe('npm');
        expect(res.via).toBe('npm');
    });

    it('the derived script command names the resolved manager, not npm', () => {
        write('pnpm-lock.yaml', 'lockfileVersion: 9\n');
        write(
            'package.json',
            JSON.stringify({
                devDependencies: { '@playwright/test': '^1' },
                scripts: { 'test:e2e': 'playwright test' },
            }),
        );
        const cfg = resolve_toolchain(tmp).to_config();
        const commands = (cfg.runners as { command: string }[]).map((r) => r.command);
        // The defect: every derived command read `npm run …` whatever the
        // lockfile said, and the work engine hands these to an agent verbatim.
        expect(commands.some((c) => c.startsWith('pnpm run test:e2e'))).toBe(true);
        expect(commands.some((c) => c.startsWith('npm run '))).toBe(false);
    });
});

/**
 * Each label gets BOTH a presence and an absence fixture, because a presence
 * assertion alone cannot tell a working detector from one that emits the
 * label unconditionally. The absence fixture is what makes the presence half
 * mean something.
 */
describe('stack/runner — rspec, junit, dotnet-test', () => {
    /** Every runner label in the inventory for this root. */
    function labels(root: string): string[] {
        return resolve_toolchain(root).runners.map((r) => r.runner);
    }

    it('rspec PRESENT: rspec in the Gemfile', () => {
        write('Gemfile', "source 'https://rubygems.org'\ngem 'rspec', '~> 3.13'\n");
        const found = resolve_toolchain(tmp).runners.find((r) => r.runner === 'rspec');
        expect(found).toBeDefined();
        expect(found?.ecosystem).toBe('ruby');
        expect(found?.command).toBe('bundle exec rspec');
        expect(found?.confidence).toBe(HIGH);
        expect(found?.basis).toBe('rspec in Gemfile');
    });

    it('rspec PRESENT: .rspec marker with no Gemfile mention', () => {
        write('Gemfile', "source 'https://rubygems.org'\ngem 'rails'\n");
        write('.rspec', '--require spec_helper\n');
        const found = resolve_toolchain(tmp).runners.find((r) => r.runner === 'rspec');
        expect(found?.basis).toBe('.rspec present');
    });

    it('rspec ABSENT: a Gemfile with no rspec signal emits NO rspec row', () => {
        // Ruby ships minitest in the stdlib, so a MEDIUM `rspec` default here
        // would be a guess wearing a confidence label. The PHP/Python branches
        // DO default; this one deliberately does not.
        write('Gemfile', "source 'https://rubygems.org'\ngem 'rails'\ngem 'minitest'\n");
        expect(labels(tmp)).not.toContain('rspec');
    });

    it('rspec ABSENT: no Gemfile at all', () => {
        write('package.json', JSON.stringify({ devDependencies: { vitest: '^1' } }));
        expect(labels(tmp)).not.toContain('rspec');
    });

    it('junit PRESENT: junit named in a Maven pom', () => {
        write(
            'pom.xml',
            '<project><dependencies><dependency><artifactId>junit-jupiter</artifactId></dependency></dependencies></project>',
        );
        const found = resolve_toolchain(tmp).runners.find((r) => r.runner === 'junit');
        expect(found?.ecosystem).toBe('jvm');
        expect(found?.command).toBe('mvn test');
        expect(found?.confidence).toBe(HIGH);
    });

    it('junit PRESENT: the Maven wrapper wins over the ambient mvn', () => {
        write('pom.xml', '<project><artifactId>junit</artifactId></project>');
        write('mvnw', '#!/bin/sh\n');
        const found = resolve_toolchain(tmp).runners.find((r) => r.runner === 'junit');
        expect(found?.command).toBe('./mvnw test');
    });

    it('junit PRESENT: a Gradle build with no junit string is the MEDIUM default', () => {
        write('build.gradle', "plugins { id 'java' }\n");
        const found = resolve_toolchain(tmp).runners.find((r) => r.runner === 'junit');
        expect(found?.confidence).toBe(MEDIUM);
        expect(found?.command).toBe('gradle test');
        expect(found?.basis).toBe('gradle build file present, no explicit runner');
    });

    it('junit PRESENT: the Gradle wrapper wins when gradlew exists', () => {
        write('build.gradle.kts', 'plugins { java }\n');
        write('gradlew', '#!/bin/sh\n');
        const found = resolve_toolchain(tmp).runners.find((r) => r.runner === 'junit');
        expect(found?.command).toBe('./gradlew test');
    });

    it('junit PRESENT: an EMPTY build.gradle is still a Gradle project', () => {
        // A multi-project root routinely has an empty root build file; reading
        // for non-empty content made it look like "no Gradle here".
        write('build.gradle', '');
        expect(resolve_toolchain(tmp).runners.map((r) => r.runner)).toContain('junit');
    });

    it('junit PRESENT: settings.gradle alone declares a Gradle project', () => {
        write('settings.gradle', "rootProject.name = 'x'\ninclude 'app'\n");
        const found = resolve_toolchain(tmp).runners.find((r) => r.runner === 'junit');
        expect(found?.confidence).toBe(MEDIUM);
    });

    it('junit ABSENT: no pom and no gradle build', () => {
        write('composer.json', JSON.stringify({ require: { 'pestphp/pest': '^2' } }));
        expect(labels(tmp)).not.toContain('junit');
    });

    it('dotnet-test PRESENT: a csproj naming a test stack is HIGH', () => {
        write('Api.Tests.csproj', '<Project><PackageReference Include="Microsoft.NET.Test.Sdk" /></Project>');
        const found = resolve_toolchain(tmp).runners.find((r) => r.runner === 'dotnet-test');
        expect(found?.ecosystem).toBe('dotnet');
        expect(found?.command).toBe('dotnet test');
        expect(found?.confidence).toBe(HIGH);
    });

    it('a MEDIUM dotnet row still reaches `selected` — confidence is a signal, not a filter', () => {
        // The assertion the earlier fixture was missing. `_apply_guard` reads
        // `speed` and `php_only` and has never read `confidence`, for any
        // ecosystem, so the downgrade narrows the REPOSITORY verdict and not
        // the command list. Pinned so the comment cannot drift back into
        // claiming a `selected` effect it does not have.
        write('Api.csproj', '<Project Sdk="Microsoft.NET.Sdk" />');
        const res = resolve_toolchain(tmp);
        expect(res.confidence).toBe(MEDIUM);
        expect(res.selected.map((r) => r.command)).toContain('dotnet test');
    });

    it('dotnet-test PRESENT: a bare project file with NO test stack is MEDIUM', () => {
        // `_overall_confidence` is "some HIGH wins", so HIGH here used to raise
        // a whole repository and push `dotnet test` into `selected` — a command
        // that fails on a solution carrying no test project. The PHP branch
        // awards HIGH only for a NAMED runner; a bare project file is the
        // analogue of the bare manifest.
        write('Api.csproj', '<Project Sdk="Microsoft.NET.Sdk" />');
        const found = resolve_toolchain(tmp).runners.find((r) => r.runner === 'dotnet-test');
        expect(found?.confidence).toBe(MEDIUM);
        expect(found?.basis).toBe('Api.csproj present, no test stack named');
    });

    it('a marker with NO project anywhere emits NO row — nothing to run', () => {
        // REPLACES 'global.json alone is MEDIUM, not HIGH', which pinned the
        // behavior R11 finding 1 showed to be wrong. A MEDIUM row still enters
        // `selected` (`_apply_guard` never reads `confidence`), so the old
        // assertion was pinning `dotnet test` into the list `/tests execute`
        // runs for a repository where it fails MSB1003. A marker is an SDK
        // pin, not a runnable target.
        write('global.json', '{"sdk":{"version":"8.0.100"}}');
        expect(labels(tmp)).not.toContain('dotnet-test');
    });

    it('a marker plus a project only BELOW the root emits no row', () => {
        // REPLACES two fixtures that pinned this layout into `selected`.
        // R13 finding 1: `dotnet test` is NOT recursive — with no project or
        // solution in the working directory it fails MSB1003 whatever sits
        // below — so a row here is a command the repository cannot run. R11
        // finding 9 asked for HIGH on exactly this layout; its premise was
        // wrong, and the contract table that promised it is corrected rather
        // than the code bent to match.
        write('global.json', '{"sdk":{"version":"8.0.100"}}');
        write('src/App/App.csproj', '<Project Sdk="Microsoft.NET.Sdk" />');
        expect(labels(tmp)).not.toContain('dotnet-test');
    });

    it('a test stack only BELOW the root is still no row, not HIGH', () => {
        write('Directory.Build.props', '<Project />');
        write('src/App.Tests/App.Tests.csproj', '<Project><PackageReference Include="xunit" /></Project>');
        expect(labels(tmp)).not.toContain('dotnet-test');
    });

    it('dotnet-test: the conventional sln + src/<Name>/<Name>.csproj layout is seen', () => {
        write('App.sln', 'Microsoft Visual Studio Solution File\n');
        write('src/App.Tests/App.Tests.csproj', '<Project><PackageReference Include="xunit" /></Project>');
        const found = resolve_toolchain(tmp).runners.find((r) => r.runner === 'dotnet-test');
        expect(found?.confidence).toBe(HIGH);
    });

    it('rspec without a Gemfile drops the `bundle exec` prefix', () => {
        // R13 finding 2. `bundle exec` aborts with "Could not locate Gemfile",
        // and the marker signals exist precisely for projects that have none,
        // so the emitted command could not run for the case the signal is for.
        write('.rspec', '--require spec_helper\n');
        const found = resolve_toolchain(tmp).runners.find((r) => r.runner === 'rspec');
        expect(found?.command).toBe('rspec');
        expect(found?.basis).toBe('.rspec present');
    });

    it('rspec WITH a Gemfile keeps it', () => {
        write('Gemfile', "gem 'rspec'\n");
        const found = resolve_toolchain(tmp).runners.find((r) => r.runner === 'rspec');
        expect(found?.command).toBe('bundle exec rspec');
    });

    it('dotnet-test ABSENT: no project file and no .NET marker', () => {
        write('go.mod', 'module example.com/x\n');
        expect(labels(tmp)).not.toContain('dotnet-test');
    });

    it('a polyglot root reports every ecosystem it carries', () => {
        write('Gemfile', "gem 'rspec'\n");
        write('pom.xml', '<project><artifactId>junit</artifactId></project>');
        write('Svc.csproj', '<Project Sdk="Microsoft.NET.Sdk" />');
        const cfg = resolve_toolchain(tmp).to_config() as Record<string, unknown>;
        expect(cfg.ecosystems).toEqual(expect.arrayContaining(['ruby', 'jvm', 'dotnet']));
        expect(cfg.confidence).toBe('HIGH');
    });

    it('--php still narrows `selected` to PHP once the new ecosystems exist', () => {
        write('composer.json', JSON.stringify({ require: { 'pestphp/pest': '^2' } }));
        write('Gemfile', "gem 'rspec'\n");
        const res = resolve_toolchain(tmp, { php_only: true });
        expect(res.selected.map((r) => r.runner)).toEqual(['pest']);
        // The inventory is unchanged by the flag — only selection narrows.
        expect(res.runners.map((r) => r.runner)).toContain('rspec');
    });
});

describe('stack/runner — behaviour-runner axis', () => {
    it('one behaviour runner at the root is one scoped row', () => {
        write('composer.json', JSON.stringify({ 'require-dev': { 'behat/behat': '^3' } }));
        const rows = resolve_behavior_runners(tmp);
        expect(rows).toHaveLength(1);
        expect(rows[0]?.runner).toBe('behat');
        expect(rows[0]?.ecosystem).toBe('php');
        expect(rows[0]?.command).toBe('vendor/bin/behat');
        expect(rows[0]?.scope_root).toBe('.');
        expect(rows[0]?.conflict).toEqual([]);
    });

    it('a repository with no behaviour runner returns NO rows', () => {
        write('package.json', JSON.stringify({ devDependencies: { vitest: '^1' } }));
        expect(resolve_behavior_runners(tmp)).toEqual([]);
    });

    it('MONOREPO: one package with a behaviour runner and one without returns two scoped rows, not one', () => {
        // The reason the axis is a list. A repository-wide scalar would have
        // to answer "does this repo have one?" with a single yes, erasing
        // which package actually owns it.
        write('package.json', JSON.stringify({ workspaces: ['packages/*'] }));
        write(
            'packages/web/package.json',
            JSON.stringify({ devDependencies: { '@cucumber/cucumber': '^10' } }),
        );
        write('packages/api/package.json', JSON.stringify({ devDependencies: { vitest: '^1' } }));
        write(
            'packages/legacy/composer.json',
            JSON.stringify({ 'require-dev': { 'behat/behat': '^3' } }),
        );
        const rows = resolve_behavior_runners(tmp);
        expect(rows.length).toBeGreaterThan(1);
        const byScope = new Map(rows.map((r) => [r.scope_root, r.runner]));
        expect(byScope.get('packages/web')).toBe('cucumber-js');
        expect(byScope.get('packages/legacy')).toBe('behat');
        // The package that owns no behaviour runner contributes no row at all.
        expect(byScope.has('packages/api')).toBe(false);
    });

    it('MONOREPO via pnpm-workspace.yaml is read the same way', () => {
        write('pnpm-workspace.yaml', "packages:\n  - 'apps/*'\n");
        write(
            'apps/shop/package.json',
            JSON.stringify({ devDependencies: { '@cucumber/cucumber': '^10' } }),
        );
        expect(resolve_behavior_runners(tmp).map((r) => r.scope_root)).toContain('apps/shop');
    });

    it('POLYGLOT is not a conflict: behat and cucumber-js in one root are TWO rows', () => {
        // A PHP application with a JS frontend is the commonest repository
        // shape there is. Reporting it as `unknown` threw away both answers
        // the axis exists to give, and contradicted the module's own polyglot
        // semantics (one runner PER ECOSYSTEM).
        write('composer.json', JSON.stringify({ 'require-dev': { 'behat/behat': '^3' } }));
        write('package.json', JSON.stringify({ devDependencies: { '@cucumber/cucumber': '^10' } }));
        const rows = resolve_behavior_runners(tmp);
        expect(rows.map((r) => r.runner).sort()).toEqual(['behat', 'cucumber-js']);
        for (const r of rows) {
            expect(r.conflict).toEqual([]);
            expect(r.confidence).toBe(HIGH);
            expect(r.scope_root).toBe('.');
        }
        // No composite ecosystem token: each row names a declared ecosystem.
        expect(rows.map((r) => r.ecosystem).sort()).toEqual(['js', 'php']);
    });

    it('CONFLICT: two runners of the SAME ecosystem refuse and name both', () => {
        // Mutual exclusivity is what the refusal is for, and only two runners
        // inside one ecosystem are mutually exclusive.
        write('requirements.txt', 'behave\npytest-bdd\n');
        const rows = resolve_behavior_runners(tmp);
        expect(rows).toHaveLength(1);
        const row = rows[0];
        expect(row?.runner).toBe(BEHAVIOR_UNKNOWN);
        expect(row?.ecosystem).toBe('python');
        expect(row?.confidence).toBe(LOW);
        expect(row?.command).toBe('');
        // Both names travel with the refusal — the point of refusing rather
        // than picking is that the owner can see what they have to settle.
        expect(row?.conflict).toEqual(['behave', 'pytest-bdd']);
        expect(row?.basis).toContain('behave');
        expect(row?.basis).toContain('pytest-bdd');
    });

    it('CONFLICT is per scope AND per ecosystem', () => {
        write('package.json', JSON.stringify({ workspaces: ['pkg/*'] }));
        write('pkg/mixed/requirements.txt', 'behave\npytest-bdd\n');
        write('pkg/mixed/composer.json', JSON.stringify({ 'require-dev': { 'behat/behat': '^3' } }));
        write('pkg/clean/Gemfile', "gem 'cucumber'\n");
        const rows = resolve_behavior_runners(tmp);
        const mixed = rows.filter((r) => r.scope_root === 'pkg/mixed');
        // The conflicted python ecosystem refuses; the php one in the SAME
        // package still answers.
        expect(mixed.find((r) => r.ecosystem === 'python')?.runner).toBe(BEHAVIOR_UNKNOWN);
        expect(mixed.find((r) => r.ecosystem === 'php')?.runner).toBe('behat');
        const clean = rows.find((r) => r.scope_root === 'pkg/clean');
        expect(clean?.runner).toBe('cucumber-ruby');
        expect(clean?.confidence).toBe(HIGH);
    });

    it('two behat signals collapse inside the branch, so one scope yields one row', () => {
        // Named for what it exercises. The behat branch emits at most one row
        // whichever signal matched, so this never reaches the dedupe guard in
        // `resolve_behavior_runners` — that guard is defensive and unreachable
        // as the detector stands, and no test here claims otherwise.
        write('composer.json', JSON.stringify({ 'require-dev': { 'behat/behat': '^3' } }));
        write('behat.yml', 'default:\n  suites: {}\n');
        const rows = resolve_behavior_runners(tmp);
        expect(rows).toHaveLength(1);
        expect(rows[0]?.runner).toBe('behat');
        expect(rows[0]?.conflict).toEqual([]);
    });

    it('detects the python behaviour runner too', () => {
        write('pyproject.toml', '[tool.poetry.dependencies]\nbehave = "^1.2"\n');
        expect(resolve_behavior_runners(tmp).map((r) => r.runner)).toEqual(['behave']);
    });

    it('reqnroll and specflow together REFUSE, they do not resolve by precedence', () => {
        // This asserted `['reqnroll']` and that was the defect. Reqnroll is
        // SpecFlow's successor, so a mid-migration project naming both looks
        // like a precedence question — but the detector reads the CONCATENATED
        // text of every project in the scope, so it cannot tell that case from
        // two sibling projects on different runners. Picking the newer label
        // was a guess dressed as a rule, in the one ecosystem that reads
        // across projects. Refusing names both and lets the owner settle it.
        write(
            'Tests.csproj',
            '<Project><PackageReference Include="Reqnroll" /><PackageReference Include="SpecFlow" /></Project>',
        );
        const rows = resolve_behavior_runners(tmp);
        expect(rows).toHaveLength(1);
        expect(rows[0]?.runner).toBe(BEHAVIOR_UNKNOWN);
        expect(rows[0]?.conflict).toEqual(['reqnroll', 'specflow']);
    });

    it('the axis rides on to_config and never reaches `selected`', () => {
        write(
            'composer.json',
            JSON.stringify({
                require: { 'pestphp/pest': '^2' },
                'require-dev': { 'behat/behat': '^3' },
            }),
        );
        const res = resolve_toolchain(tmp);
        const cfg = res.to_config() as Record<string, unknown>;
        expect((cfg.behavior_runners as { runner: string }[])[0]?.runner).toBe('behat');
        // Asserted rather than only stated: a behaviour runner the repository
        // owns is REPORTED, never scheduled to run.
        expect(cfg.selected).toEqual(['vendor/bin/pest']);
        expect(res.runners.map((r) => r.runner)).not.toContain('behat');
    });

    it('no detection row carries an install or adoption instruction', () => {
        write('package.json', JSON.stringify({ workspaces: ['packages/*'] }));
        write(
            'packages/web/package.json',
            JSON.stringify({ devDependencies: { '@cucumber/cucumber': '^10' } }),
        );
        write(
            'packages/api/composer.json',
            JSON.stringify({ 'require-dev': { 'behat/behat': '^3' } }),
        );
        const emitted = resolve_behavior_runners(tmp)
            .flatMap((r) => [r.command, r.basis, r.runner])
            .join(' ')
            .toLowerCase();
        for (const forbidden of [
            'composer require',
            'npm i ',
            'npm install',
            'pip install',
            'gem install',
            'recommend',
            'should install',
        ]) {
            expect(emitted).not.toContain(forbidden);
        }
    });

    it('_behavior_scopes always includes the root and skips unexpandable globs', () => {
        write(
            'package.json',
            JSON.stringify({ workspaces: ['packages/*', 'tools/one', 'a/*/deep', '!ignored'] }),
        );
        write('packages/x/package.json', '{}');
        write('tools/one/package.json', '{}');
        const scopes = _behavior_scopes(tmp);
        expect(scopes[0]).toBe('.');
        expect(scopes).toContain('packages/x');
        expect(scopes).toContain('tools/one');
        // A mid-path glob is skipped rather than half-expanded: a reported
        // scope that does not exist is worse than one fewer scope.
        expect(scopes.some((s) => s.includes('*'))).toBe(false);
        expect(scopes).not.toContain('!ignored');
    });

    it('a declared-but-absent literal workspace entry is NOT a scope', () => {
        write('package.json', JSON.stringify({ workspaces: ['tools/present', 'tools/absent'] }));
        write('tools/present/package.json', '{}');
        const scopes = _behavior_scopes(tmp);
        expect(scopes).toContain('tools/present');
        expect(scopes).not.toContain('tools/absent');
    });

    it('rspec-rails and cucumber-rails are declarations', () => {
        write('Gemfile', "gem 'rspec-rails'\ngem 'cucumber-rails'\n");
        expect(resolve_toolchain(tmp).runners.map((r) => r.runner)).toContain('rspec');
        expect(resolve_behavior_runners(tmp).map((r) => r.runner)).toEqual(['cucumber-ruby']);
    });

    it('a gem merely ENDING in the name is not a declaration', () => {
        write('Gemfile', "gem 'my-cucumber'\ngem 'not-rspec'\n");
        expect(resolve_behavior_runners(tmp)).toEqual([]);
        expect(resolve_toolchain(tmp).runners.map((r) => r.runner)).not.toContain('rspec');
    });

    it('an unreadable scope degrades to fewer rows, never a throw', () => {
        write('package.json', JSON.stringify({ workspaces: ['nope/*'] }));
        expect(() => resolve_behavior_runners(tmp)).not.toThrow();
        expect(resolve_behavior_runners(tmp)).toEqual([]);
    });

    it('a pnpm sibling sequence is NOT a workspace scope', () => {
        // `onlyBuiltDependencies` and friends are ordinary sequences in a real
        // pnpm-workspace.yaml. A reader that matched every `- item` line took
        // `esbuild` for a package directory; with a top-level directory of
        // that name it produced a `behavior_runners` row whose `scope_root`
        // was not a workspace package at all.
        write(
            'pnpm-workspace.yaml',
            "packages:\n  - 'apps/*'\nonlyBuiltDependencies:\n  - esbuild\npatchedDependencies:\n  - leftpad\n",
        );
        write('apps/shop/package.json', JSON.stringify({ devDependencies: { '@cucumber/cucumber': '^10' } }));
        write('esbuild/composer.json', JSON.stringify({ 'require-dev': { 'behat/behat': '^3' } }));
        const scopes = _behavior_scopes(tmp);
        expect(scopes).toContain('apps/shop');
        expect(scopes).not.toContain('esbuild');
        expect(scopes).not.toContain('leftpad');
        expect(resolve_behavior_runners(tmp).map((r) => r.scope_root)).toEqual(['apps/shop']);
    });

    it('_pnpm_packages reads only the packages key', () => {
        const text =
            '# comment\n' +
            "packages:\n  - 'a/*'\n  - b\n" +
            'onlyBuiltDependencies:\n  - esbuild\n' +
            "packages:\n  - 'c'\n";
        expect(_pnpm_packages(text)).toEqual(['a/*', 'b', 'c']);
    });

    it('a commented-out pytest-bdd does not fabricate a FALSE refusal', () => {
        // The sharpest consequence of an unanchored match on this axis: a real
        // `behave` declaration plus a dead mention of its neighbour produced
        // two python rows, which the per-ecosystem grouping then collapsed
        // into `unknown`. A false positive here does not add noise — it
        // DELETES the one correct answer the axis had.
        write('requirements.txt', 'behave\n# pytest-bdd (dropped 2024)\n');
        const rows = resolve_behavior_runners(tmp);
        expect(rows).toHaveLength(1);
        expect(rows[0]?.runner).toBe('behave');
        expect(rows[0]?.conflict).toEqual([]);
    });

    it('behave needs a DECLARATION, not the English verb in prose', () => {
        write('pyproject.toml', '[project]\ndescription = "documents how widgets behave under load"\n');
        expect(resolve_behavior_runners(tmp)).toEqual([]);
    });

    it('behave is detected in both declaration shapes', () => {
        write('pyproject.toml', '[tool.poetry.group.dev.dependencies]\nbehave = "^1.2"\n');
        expect(resolve_behavior_runners(tmp).map((r) => r.runner)).toEqual(['behave']);
    });

    it('behave is detected from a requirements.txt line', () => {
        write('requirements.txt', 'behave==1.2.6\n');
        expect(resolve_behavior_runners(tmp).map((r) => r.runner)).toEqual(['behave']);
    });

    it('a pyproject with no trailing newline cannot fuse a token into requirements.txt', () => {
        // Concatenated bare, these two produce `...pytest-bddbehave...` and a
        // token present in neither file.
        write('pyproject.toml', '[project]\nname = "x"');
        write('requirements.txt', 'behave\n');
        const runners = resolve_behavior_runners(tmp).map((r) => r.runner);
        expect(runners).toEqual(['behave']);
    });

    it('cucumber-ruby is found through gems.rb, not only Gemfile', () => {
        write('gems.rb', "source 'https://rubygems.org'\ngem 'cucumber'\n");
        expect(resolve_behavior_runners(tmp).map((r) => r.runner)).toEqual(['cucumber-ruby']);
    });

    it('a gems.rb basis names gems.rb, not a Gemfile that does not exist', () => {
        write('gems.rb', "gem 'cucumber'\n");
        expect(resolve_behavior_runners(tmp)[0]?.basis).toBe('cucumber in gems.rb');
    });

    it('a commented-out gem is not a declaration', () => {
        write('Gemfile', "source 'x'\n# gem 'cucumber'  # removed last year\n");
        expect(resolve_behavior_runners(tmp)).toEqual([]);
    });

    it('reqnroll is found in the conventional sln + src layout', () => {
        write('App.sln', 'Microsoft Visual Studio Solution File\n');
        write('src/App.Specs/App.Specs.csproj', '<Project><PackageReference Include="Reqnroll" /></Project>');
        expect(resolve_behavior_runners(tmp).map((r) => r.runner)).toEqual(['reqnroll']);
    });

    it('a .slnx solution descends exactly like a .sln', () => {
        write('App.slnx', '<Solution />');
        write('src/App.Specs/App.Specs.csproj', '<Project><PackageReference Include="Reqnroll" /></Project>');
        expect(resolve_behavior_runners(tmp).map((r) => r.runner)).toEqual(['reqnroll']);
    });

    it('CONFLICT: reqnroll and specflow across one solution refuse, never pick', () => {
        // `_dotnet_project_text` reads across the whole solution tree, so this
        // is a conflict between two projects, not a mid-migration file.
        write('App.sln', 'Microsoft Visual Studio Solution File\n');
        write('src/A/A.csproj', '<Project><PackageReference Include="Reqnroll" /></Project>');
        write('src/B/B.csproj', '<Project><PackageReference Include="SpecFlow" /></Project>');
        const rows = resolve_behavior_runners(tmp);
        expect(rows).toHaveLength(1);
        expect(rows[0]?.runner).toBe(BEHAVIOR_UNKNOWN);
        expect(rows[0]?.ecosystem).toBe('dotnet');
        expect(rows[0]?.conflict).toEqual(['reqnroll', 'specflow']);
    });

    it('with NO solution at the root, a workspace package stays its own scope', () => {
        // The descent is gated on a solution file. Without one, a `.csproj`
        // inside a package no longer leaks into the root scope — which would
        // both duplicate the row and let two packages with different .NET
        // behaviour runners collapse into a silent pick.
        write('package.json', JSON.stringify({ workspaces: ['pkg/*'] }));
        write('pkg/a/A.csproj', '<Project><PackageReference Include="Reqnroll" /></Project>');
        write('pkg/b/B.csproj', '<Project><PackageReference Include="SpecFlow" /></Project>');
        const rows = resolve_behavior_runners(tmp);
        expect(rows.map((r) => r.scope_root).sort()).toEqual(['pkg/a', 'pkg/b']);
        expect(rows.find((r) => r.scope_root === 'pkg/a')?.runner).toBe('reqnroll');
        expect(rows.find((r) => r.scope_root === 'pkg/b')?.runner).toBe('specflow');
    });

    it('_pnpm_packages reads a zero-indent sequence, a flow sequence and a trailing comment', () => {
        expect(_pnpm_packages("packages:\n- 'a/*'\n- b\n")).toEqual(['a/*', 'b']);
        expect(_pnpm_packages("packages: ['a/*', \"b\"]\n")).toEqual(['a/*', 'b']);
        expect(_pnpm_packages("packages:\n  - 'a/*' # frontend\n")).toEqual(['a/*']);
        // The parent-key discipline still holds for every shape.
        expect(_pnpm_packages("packages: ['a/*']\nonlyBuiltDependencies:\n  - esbuild\n")).toEqual(['a/*']);
    });

    it('a SOLUTION naming a SpecFlow project emits no specflow row', () => {
        // R10 finding 1. `.sln` is in `_DOTNET_PROJECT_EXTS`, so its body used
        // to be concatenated into the "project text" the package regexes read.
        // A solution lists project NAMES and `.` is a word boundary, so
        // `MyApp.SpecFlow.Tests` matched `/\\bSpecFlow\\b/i` and emitted a HIGH
        // row whose basis claimed a project file that references nothing.
        write('App.sln', 'Project("{X}") = "MyApp.SpecFlow.Tests", "src/T/T.csproj", "{Y}"\n');
        write('src/T/T.csproj', '<Project Sdk="Microsoft.NET.Sdk" />');
        expect(resolve_behavior_runners(tmp).map((r) => r.runner)).not.toContain('specflow');
    });

    it('a SOLUTION naming two behavior frameworks does not force a false refusal', () => {
        // The expensive half of the same defect: two dotnet names in one scope
        // make the per-ecosystem grouping REFUSE, so a mid-migration solution
        // naming a legacy SpecFlow project beside a Reqnroll one destroyed the
        // true answer. The project file is the only thing that may speak.
        write(
            'App.sln',
            'Project = "Legacy.SpecFlow.Tests"\nProject = "New.Reqnroll.Tests"\n',
        );
        write('src/T/T.csproj', '<Project><PackageReference Include="Reqnroll" /></Project>');
        const dotnet = resolve_behavior_runners(tmp).filter((r) => r.ecosystem === 'dotnet');
        expect(dotnet.map((r) => r.runner)).toEqual(['reqnroll']);
        expect(dotnet[0]?.conflict).toEqual([]);
    });

    it('a SOLUTION naming a test stack does not raise dotnet-test to HIGH', () => {
        // Same read, native axis: `_DOTNET_TEST_STACK` matched the solution's
        // project names too, so `MyApp.NUnit.Tests` graduated a repository to
        // HIGH on a file that declares no package at all.
        write('App.sln', 'Project("{X}") = "MyApp.NUnit.Tests", "src/T/T.csproj", "{Y}"\n');
        write('src/T/T.csproj', '<Project Sdk="Microsoft.NET.Sdk" />');
        const found = resolve_toolchain(tmp).runners.find((r) => r.runner === 'dotnet-test');
        expect(found?.confidence).toBe(MEDIUM);
    });

    it('cucumber-ruby without a Gemfile drops the `bundle exec` prefix', () => {
        // R14 finding 1: the IDENTICAL defect round 13 fixed in `_ruby_runners`,
        // 226 lines away on the behavior axis, which that round's sibling sweep
        // never ran. `bundle exec` aborts with no Gemfile, and `env.rb` is the
        // signal for scopes that have none.
        write('features/support/env.rb', "require 'cucumber'\n");
        const found = resolve_behavior_runners(tmp).find((r) => r.runner === 'cucumber-ruby');
        expect(found?.command).toBe('cucumber');
        expect(found?.basis).toBe('features/support/env.rb present');
    });

    it('cucumber-ruby WITH a Gemfile keeps it', () => {
        write('Gemfile', "gem 'cucumber'\n");
        const found = resolve_behavior_runners(tmp).find((r) => r.runner === 'cucumber-ruby');
        expect(found?.command).toBe('bundle exec cucumber');
    });

    it('behat from a config alone does not promise a vendor binary', () => {
        // `vendor/bin/behat` exists only after a composer install; a scope with
        // a behat config and no composer manifest has no vendor directory.
        write('behat.yml', 'default: {}\n');
        const found = resolve_behavior_runners(tmp).find((r) => r.runner === 'behat');
        expect(found?.command).toBe('behat');
        expect(found?.basis).toBe('behat.yml present');
    });

    it('behat declared in the composer manifest keeps the vendor path', () => {
        write('composer.json', JSON.stringify({ 'require-dev': { 'behat/behat': '^3' } }));
        const found = resolve_behavior_runners(tmp).find((r) => r.runner === 'behat');
        expect(found?.command).toBe('vendor/bin/behat');
    });

    it('a cucumber config alone is a cucumber-js row', () => {
        // R14 finding 2: every marker-ONLY basis branch this change added was
        // unreachable from the suite. Per-LABEL coverage was met and per-SIGNAL
        // coverage was not, which is exactly where finding 1 was hiding.
        write('cucumber.json', '{}');
        const found = resolve_behavior_runners(tmp).find((r) => r.runner === 'cucumber-js');
        expect(found?.basis).toBe('cucumber.json present');
    });

    it('behave survives a trailing pip comment', () => {
        // R14 finding 6: `#` was missing from the terminator set, so a
        // `behave  # bdd` line — valid pip syntax — was dropped.
        write('requirements.txt', 'behave  # bdd\n');
        expect(resolve_behavior_runners(tmp).map((r) => r.runner)).toContain('behave');
    });

    it('an EMPTY Gemfile still keeps the `bundle exec` prefix', () => {
        // R15 finding 4: the guard keyed on manifest CONTENT, so a 0-byte or
        // unreadable Gemfile dropped the prefix — the inverse of the
        // presence-not-content fix this same change made for Gradle.
        // `bundle exec` works off the file existing, not off it parsing.
        write('Gemfile', '');
        write('.rspec', '--require spec_helper\n');
        const found = resolve_toolchain(tmp).runners.find((r) => r.runner === 'rspec');
        expect(found?.command).toBe('bundle exec rspec');
    });

    it('a cucumber CONFIG alone does not promise `npx`', () => {
        // R17 finding 2: `npx` FETCHES when the package is absent, so emitting
        // it where nothing declares cucumber would let a detection-only axis
        // install. The behat and ruby rows already degrade for this case; this
        // one did not, and the no-adoption test matches fixed `npm i` /
        // `npm install` substrings, so it structurally could not see `npx`.
        write('cucumber.json', '{}');
        const found = resolve_behavior_runners(tmp).find((r) => r.runner === 'cucumber-js');
        expect(found?.command).toBe('cucumber-js');
    });

    it('a DECLARED cucumber dependency keeps `npx`', () => {
        write('package.json', JSON.stringify({ devDependencies: { '@cucumber/cucumber': '^10' } }));
        const found = resolve_behavior_runners(tmp).find((r) => r.runner === 'cucumber-js');
        expect(found?.command).toBe('npx cucumber-js');
    });

    it('an excluded glob PARENT yields no scopes', () => {
        // R16 finding 1: the exclusion ran on the glob CHILD and not on the
        // pattern, so `node_modules/*` still admitted what the literal form
        // refuses — the same half-guard R15 finding 3 fixed, mirrored. The
        // predicate now runs once, on the whole pattern, before either branch.
        write('package.json', JSON.stringify({ workspaces: ['node_modules/*', 'pkg/*'] }));
        write('node_modules/dep/package.json', '{}');
        write('pkg/real/.gitkeep', '');
        expect(_behavior_scopes(tmp)).toEqual(['.', 'pkg/real']);
    });

    it('a LITERAL workspace entry is excluded like a glob child', () => {
        // R15 finding 3: the exclusion ran on the glob branch only, so a
        // literal `node_modules/x` entry became a scope the glob form refuses.
        write(
            'package.json',
            JSON.stringify({ workspaces: ['node_modules/x', '.hidden', 'pkg/real'] }),
        );
        for (const d of ['node_modules/x', '.hidden', 'pkg/real']) {
            write(`${d}/.gitkeep`, '');
        }
        expect(_behavior_scopes(tmp)).toEqual(['.', 'pkg/real']);
    });

    it('a CRLF pnpm-workspace.yaml is read, not silently dropped', () => {
        // R13 finding 5: `.` never matches `\r`, so splitting on `\n` alone
        // left a trailing `\r` that made the key regex match NOTHING — the
        // whole workspace collapsed to the root scope with no error.
        expect(_pnpm_packages("packages:\r\n  - 'pkg/*'\r\n")).toEqual(['pkg/*']);
    });

    it('a PEER dependency on cucumber is not ownership of a suite', () => {
        // R12 finding 8. A cucumber formatter, preset or step-definition
        // helper declares `@cucumber/cucumber` as a PEER — a statement about
        // its consumer, not about itself. The behavior axis merged peer and
        // optional ranges like the native axis does, so every such package was
        // reported at HIGH as owning a cucumber suite. On an axis whose stated
        // doctrine is that detection may not guess, that is the guess.
        write(
            'package.json',
            JSON.stringify({
                name: 'cucumber-pretty-formatter',
                peerDependencies: { '@cucumber/cucumber': '^10' },
                optionalDependencies: { cucumber: '^7' },
            }),
        );
        expect(resolve_behavior_runners(tmp).map((r) => r.runner)).not.toContain('cucumber-js');
    });

    it('a DEV dependency on cucumber still is', () => {
        write('package.json', JSON.stringify({ devDependencies: { '@cucumber/cucumber': '^10' } }));
        const found = resolve_behavior_runners(tmp).find((r) => r.runner === 'cucumber-js');
        expect(found?.confidence).toBe(HIGH);
        expect(found?.basis).toBe('@cucumber/cucumber in package deps');
    });

    it('a glob scope skips node_modules and dot-directories', () => {
        // R10 finding 5. The glob expander admitted every child directory while
        // the sibling .NET walk skipped these, so a `pkg/*` workspace reported
        // `pkg/node_modules` as a scope and paid a full probe for it.
        write('package.json', JSON.stringify({ workspaces: ['pkg/*'] }));
        write('pkg/real/composer.json', JSON.stringify({ 'require-dev': { 'behat/behat': '^3' } }));
        write('pkg/node_modules/dep/package.json', '{}');
        write('pkg/.turbo/x.json', '{}');
        expect(_behavior_scopes(tmp)).toEqual(['.', 'pkg/real']);
    });

    it('scope order is sorted, so the serialized row order is stable', () => {
        write('package.json', JSON.stringify({ workspaces: ['pkg/*'] }));
        for (const name of ['zeta', 'alpha', 'mid']) {
            write(`pkg/${name}/composer.json`, JSON.stringify({ 'require-dev': { 'behat/behat': '^3' } }));
        }
        expect(resolve_behavior_runners(tmp).map((r) => r.scope_root)).toEqual([
            'pkg/alpha',
            'pkg/mid',
            'pkg/zeta',
        ]);
    });
});

/**
 * The membership binding. Without it `KNOWN_RUNNERS` and
 * `KNOWN_BEHAVIOR_RUNNERS` are two set-equality assertions about themselves:
 * nothing in the resolver reads either set, so a label emitted with a typo
 * (`dotnet_test`, `cucumber_js`) or a detector branch added later would pass
 * the whole suite while the declared source of truth silently stopped
 * describing the emitter.
 */
describe('stack/runner — every emitted label is a declared label', () => {
    /** One fixture per detector branch this module can take. */
    const FIXTURES: ReadonlyArray<readonly [string, ReadonlyArray<readonly [string, string]>]> = [
        ['php-pest', [['composer.json', JSON.stringify({ require: { 'pestphp/pest': '^2' } })]]],
        ['php-phpunit', [['composer.json', JSON.stringify({ 'require-dev': { 'phpunit/phpunit': '^11' } })]]],
        ['js-vitest', [['package.json', JSON.stringify({ devDependencies: { vitest: '^1' } })]]],
        ['js-jest', [['package.json', JSON.stringify({ devDependencies: { jest: '^29' } })]]],
        [
            'js-e2e',
            [['package.json', JSON.stringify({ devDependencies: { '@playwright/test': '^1', cypress: '^13' } })]],
        ],
        ['python', [['pyproject.toml', '[tool.pytest.ini_options]\n']]],
        ['go', [['go.mod', 'module example.com/x\n']]],
        ['rust', [['Cargo.toml', '[package]\nname = "x"\n']]],
        ['ruby', [['Gemfile', "gem 'rspec'\ngem 'cucumber'\n"]]],
        ['jvm', [['pom.xml', '<project><artifactId>junit</artifactId><dependency>io.cucumber</dependency></project>']]],
        ['dotnet', [['App.csproj', '<Project><PackageReference Include="Reqnroll" /></Project>']]],
        ['dotnet-specflow', [['App.csproj', '<Project><PackageReference Include="SpecFlow" /></Project>']]],
        ['php-behat', [['composer.json', JSON.stringify({ 'require-dev': { 'behat/behat': '^3' } })]]],
        ['js-cucumber', [['package.json', JSON.stringify({ devDependencies: { '@cucumber/cucumber': '^10' } })]]],
        ['py-behave', [['requirements.txt', 'behave\n']]],
        ['py-bdd', [['requirements.txt', 'pytest-bdd\n']]],
    ];

    it('no fixture emits a native label outside KNOWN_RUNNERS', () => {
        const seen = new Set<string>();
        for (const [, files] of FIXTURES) {
            fs.rmSync(tmp, { recursive: true, force: true });
            fs.mkdirSync(tmp, { recursive: true });
            for (const [rel, body] of files) write(rel, body);
            for (const r of resolve_toolchain(tmp, { include_e2e: true, include_slow: true }).runners) {
                seen.add(r.runner);
                expect(KNOWN_RUNNERS.has(r.runner)).toBe(true);
            }
        }
        // The fixtures must actually reach the three added labels, or this
        // test would pass over a corpus that never exercises them.
        expect(seen).toContain('rspec');
        expect(seen).toContain('junit');
        expect(seen).toContain('dotnet-test');
    });

    it('no fixture emits a behaviour label outside KNOWN_BEHAVIOR_RUNNERS', () => {
        const seen = new Set<string>();
        for (const [, files] of FIXTURES) {
            fs.rmSync(tmp, { recursive: true, force: true });
            fs.mkdirSync(tmp, { recursive: true });
            for (const [rel, body] of files) write(rel, body);
            for (const r of resolve_behavior_runners(tmp)) {
                seen.add(r.runner);
                expect(KNOWN_BEHAVIOR_RUNNERS.has(r.runner)).toBe(true);
            }
        }
        for (const label of ['behat', 'cucumber-js', 'cucumber-ruby', 'cucumber-jvm', 'behave', 'pytest-bdd', 'reqnroll', 'specflow']) {
            expect(seen).toContain(label);
        }
    });
});

describe('stack/runner — latest_manifest_mtime', () => {
    // R10 finding 2: this function changed signature AND semantics (root-only
    // -> every scope, `_MANIFESTS` -> `_MANIFESTS + _BEHAVIOR_MARKERS`) with
    // no fixture, and both snapshot helpers normalise its value away — so a
    // regression back to a root-only key passed the whole suite. It is the one
    // change in the branch that governs cache correctness.

    it('no manifest anywhere is the 0 sentinel, not an error', () => {
        expect(latest_manifest_mtime(tmp)).toBe(0.0);
    });

    it('a root manifest is seen', () => {
        write('composer.json', '{}');
        expect(latest_manifest_mtime(tmp)).toBeGreaterThan(0);
    });

    it('a manifest in a workspace PACKAGE moves the key — the whole point', () => {
        // The stated motivation, asserted instead of believed: a root-only key
        // cannot see Behat arriving in a package, so the cache would be stale
        // forever in the common case.
        write('package.json', JSON.stringify({ workspaces: ['pkg/*'] }));
        write('pkg/a/.gitkeep', '');
        const before = latest_manifest_mtime(tmp);
        write('pkg/a/composer.json', JSON.stringify({ 'require-dev': { 'behat/behat': '^3' } }));
        expect(latest_manifest_mtime(tmp)).toBeGreaterThan(before);
    });

    it('a BEHAVIOR marker moves the key, not only a native manifest', () => {
        // The second half of the widening: `behat.yml` is a behavior marker
        // with no native manifest beside it, and it selects a behat row.
        write('behat.yml', 'default: {}\n');
        expect(latest_manifest_mtime(tmp)).toBeGreaterThan(0);
    });

    it('an explicit `scopes` argument bounds what is stat-ed', () => {
        // The caller-supplied path: passing scopes skips `_behavior_scopes`,
        // and a scope not named is not read — which is what makes the
        // expensive probe avoidable for a caller that already has them.
        write('package.json', JSON.stringify({ workspaces: ['pkg/*'] }));
        write('pkg/a/composer.json', '{}');
        write('pkg/empty/.gitkeep', '');
        // Named scope with no manifest reads nothing, however many exist
        // elsewhere in the tree — the bound is the argument, not the tree.
        expect(latest_manifest_mtime(tmp, ['pkg/empty'])).toBe(0.0);
        expect(latest_manifest_mtime(tmp, ['pkg/a'])).toBeGreaterThan(0);
        // And the default walk does see `pkg/a`, which that scope list did not.
        expect(latest_manifest_mtime(tmp)).toBeGreaterThan(0);
    });
});
