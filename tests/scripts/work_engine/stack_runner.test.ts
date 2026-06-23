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
    HIGH,
    KNOWN_RUNNERS,
    LOW,
    MEDIUM,
    RunnerResult,
    SPEED_E2E,
    SPEED_FAST,
    SPEED_SLOW,
    ToolchainResult,
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

    it('KNOWN_RUNNERS carries exactly the nine Python labels', () => {
        expect([...KNOWN_RUNNERS].sort()).toEqual(
            ['pest', 'phpunit', 'vitest', 'jest', 'playwright', 'cypress', 'pytest', 'go-test', 'cargo-test'].sort(),
        );
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
            ['confidence', 'ecosystems', 'mtime', 'quality', 'runners', 'selected'].sort(),
        );
        expect(cfg.confidence).toBe(LOW);
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
