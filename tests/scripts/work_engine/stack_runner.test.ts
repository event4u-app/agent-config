// Golden-parity rig for the py2ts work_engine `stack/runner` twin (ADR-094).
//
// `work_engine/stack/runner.py` is a leaf module with NO intra-`work_engine`
// imports — stdlib only. We load it from python3 via the same direct-file
// `importlib` loader the merged `state.test.ts` / `stack_detect.test.ts` use,
// registering the module in `sys.modules` BEFORE `exec_module` so dataclass
// field-type resolution (under `from __future__ import annotations`) resolves.
//
// Each block builds a fake project tree (composer.json / package.json /
// pyproject.toml / go.mod / Cargo.toml / Makefile / Taskfile.yml) in a tmp dir
// and asserts byte-identical observable output from python3 and tsx. Two views:
//
//  - `resolve_toolchain` → its `to_config()` dict, serialised compactly
//    (`separators=(",", ":")` on the Python side, `JSON.stringify` on the JS
//    side) with the non-deterministic `mtime` float NORMALISED to the sentinel
//    string `"<mtime>"` on BOTH engines. `mtime` is the filesystem `st_mtime`,
//    whose exact float byte-repr is not reproducible across CPython/V8 for
//    sub-second timestamps (see `runner.ts::_stat_mtime`); everything else in
//    the config IS deterministic and compared byte-for-byte.
//  - `write_config` → the on-disk file bytes (incl. `sort_keys=True` + the
//    trailing `\n`), again with `mtime` normalised. This exercises the
//    `json.dumps(..., indent=2, sort_keys=True)` serialiser directly.
import { spawnSync, type SpawnSyncReturns } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
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
} from '../../../src/agent-src/templates/scripts/work_engine/stack/runner.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..', '..');

const WE = ['src', 'agent-src', 'templates', 'scripts', 'work_engine', 'stack'];
const RUNNER_PY = path.join(REPO_ROOT, ...WE, 'runner.py');
const RUNNER_TS = path.join(REPO_ROOT, ...WE, 'runner.ts');
const TSX_BIN = process.env.TSX_BIN ?? path.join('node_modules', '.bin', 'tsx');

function hasPython3(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}

interface Flags {
    include_slow?: boolean;
    include_e2e?: boolean;
    php_only?: boolean;
}

/**
 * python3: `resolve_toolchain(root, **flags).to_config()` → compact JSON with
 * `mtime` normalised to the sentinel so the float repr never enters the
 * comparison. The direct-file importlib loader registers the module first.
 */
function pyConfig(root: string, flags: Flags): string {
    const loader = [
        'import sys, json, pathlib, importlib.util',
        `spec = importlib.util.spec_from_file_location("runner", ${JSON.stringify(RUNNER_PY)})`,
        'runner = importlib.util.module_from_spec(spec)',
        'sys.modules["runner"] = runner',
        'spec.loader.exec_module(runner)',
    ].join('\n');
    const body = [
        'root = pathlib.Path(sys.argv[1])',
        'flags = json.loads(sys.argv[2])',
        'res = runner.resolve_toolchain(root, **flags)',
        'cfg = res.to_config()',
        'cfg["mtime"] = "<mtime>"',
        'sys.stdout.write(json.dumps(cfg, separators=(",", ":")))',
    ].join('\n');
    const r = spawnSync('python3', ['-c', `${loader}\n${body}`, root, JSON.stringify(flags)], {
        encoding: 'utf8',
    });
    if (r.status !== 0) {
        throw new Error(`python3 config failed: ${r.stderr || r.stdout}`);
    }
    return r.stdout;
}

/** tsx: same observable view via the `.ts` module. Root + flags passed via env. */
function tsConfig(root: string, flags: Flags): string {
    const code = [
        `import { resolve_toolchain } from ${JSON.stringify(RUNNER_TS)};`,
        'const root = process.env.P2T_ROOT as string;',
        'const flags = JSON.parse(process.env.P2T_FLAGS as string);',
        'const res = resolve_toolchain(root, flags);',
        'const cfg = res.to_config() as Record<string, unknown>;',
        'cfg.mtime = "<mtime>";',
        'process.stdout.write(JSON.stringify(cfg));',
    ].join('\n');
    const r = spawnSync(TSX_BIN, ['-e', code], {
        encoding: 'utf8',
        env: { ...process.env, P2T_ROOT: root, P2T_FLAGS: JSON.stringify(flags) },
    });
    if (r.status !== 0) {
        throw new Error(`tsx config failed: ${r.stderr || r.stdout}`);
    }
    return r.stdout;
}

/** python3: `write_config` → on-disk bytes, `mtime` normalised, incl. \n. */
function pyWriteConfig(root: string): string {
    const loader = [
        'import sys, json, re, pathlib, importlib.util',
        `spec = importlib.util.spec_from_file_location("runner", ${JSON.stringify(RUNNER_PY)})`,
        'runner = importlib.util.module_from_spec(spec)',
        'sys.modules["runner"] = runner',
        'spec.loader.exec_module(runner)',
    ].join('\n');
    const body = [
        'root = pathlib.Path(sys.argv[1])',
        'res = runner.resolve_toolchain(root)',
        'target = runner.write_config(root, res)',
        'text = pathlib.Path(target).read_text(encoding="utf-8")',
        // Normalise the single `"mtime": <float>,` line to a sentinel.
        'text = re.sub(r\'"mtime": [0-9.]+\', \'"mtime": "<mtime>"\', text)',
        'sys.stdout.write(text)',
    ].join('\n');
    const r = spawnSync('python3', ['-c', `${loader}\n${body}`, root], { encoding: 'utf8' });
    if (r.status !== 0) {
        throw new Error(`python3 write_config failed: ${r.stderr || r.stdout}`);
    }
    return r.stdout;
}

/** tsx: `write_config` → on-disk bytes, `mtime` normalised, incl. \n. */
function tsWriteConfig(root: string): string {
    const code = [
        `import { resolve_toolchain, write_config } from ${JSON.stringify(RUNNER_TS)};`,
        'import * as fs from "node:fs";',
        'const root = process.env.P2T_ROOT as string;',
        'const res = resolve_toolchain(root);',
        'const target = write_config(root, res);',
        'let text = fs.readFileSync(target, { encoding: "utf-8" });',
        'text = text.replace(/"mtime": [0-9.]+/, \'"mtime": "<mtime>"\');',
        'process.stdout.write(text);',
    ].join('\n');
    const r = spawnSync(TSX_BIN, ['-e', code], {
        encoding: 'utf8',
        env: { ...process.env, P2T_ROOT: root },
    });
    if (r.status !== 0) {
        throw new Error(`tsx write_config failed: ${r.stderr || r.stdout}`);
    }
    return r.stdout;
}

function expectConfigParity(root: string, flags: Flags = {}): string {
    const py = pyConfig(root, flags);
    const ts = tsConfig(root, flags);
    expect(ts).toBe(py);
    return py;
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

const py3 = hasPython3();
const golden = py3 ? describe : describe.skip;

golden('stack/runner — golden parity (python3 vs tsx)', () => {
    // ── empty / no-match ─────────────────────────────────────────────────
    it('greenfield: no manifest → LOW confidence, empty inventory', () => {
        const cfg = JSON.parse(expectConfigParity(tmp)) as Record<string, unknown>;
        expect(cfg.confidence).toBe('LOW');
        expect(cfg.runners).toEqual([]);
        expect(cfg.selected).toEqual([]);
    });

    // ── PHP branches ─────────────────────────────────────────────────────
    it('php: pest in composer require', () => {
        write('composer.json', JSON.stringify({ require: { 'pestphp/pest': '^2' } }));
        const cfg = JSON.parse(expectConfigParity(tmp)) as Record<string, unknown>;
        expect((cfg.runners as { runner: string }[])[0]!.runner).toBe('pest');
    });

    it('php: vendor/bin/pest binary (no dep) wins over phpunit', () => {
        write('composer.json', JSON.stringify({ require: {} }));
        write('vendor/bin/pest', '#!/usr/bin/env php\n');
        expectConfigParity(tmp);
    });

    it('php: artisan present → phpunit via php artisan test', () => {
        write('composer.json', JSON.stringify({ require: {} }));
        write('artisan', '#!/usr/bin/env php\n');
        const cfg = JSON.parse(expectConfigParity(tmp)) as Record<string, unknown>;
        expect((cfg.runners as { command: string }[])[0]!.command).toBe('php artisan test');
    });

    it('php: phpunit/phpunit dependency', () => {
        write('composer.json', JSON.stringify({ 'require-dev': { 'phpunit/phpunit': '^11' } }));
        expectConfigParity(tmp);
    });

    it('php: composer.json with no runner → MEDIUM phpunit default', () => {
        write('composer.json', JSON.stringify({ require: { 'monolog/monolog': '^3' } }));
        const cfg = JSON.parse(expectConfigParity(tmp)) as Record<string, unknown>;
        expect(cfg.confidence).toBe('MEDIUM');
        expect((cfg.runners as { confidence: string }[])[0]!.confidence).toBe('MEDIUM');
    });

    it('php quality: phpstan + pint detected', () => {
        write(
            'composer.json',
            JSON.stringify({ 'require-dev': { 'phpstan/phpstan': '^1', 'laravel/pint': '^1' } }),
        );
        const cfg = JSON.parse(expectConfigParity(tmp)) as Record<string, unknown>;
        expect(cfg.quality).toEqual(['vendor/bin/phpstan analyse', 'vendor/bin/pint']);
    });

    it('php: Makefile test wrapper wins over the direct tool', () => {
        write('composer.json', JSON.stringify({ require: { 'pestphp/pest': '^2' } }));
        write('Makefile', 'test:\n\t./vendor/bin/pest\n');
        const cfg = JSON.parse(expectConfigParity(tmp)) as Record<string, unknown>;
        expect((cfg.runners as { command: string }[])[0]!.command).toBe('make test');
    });

    it('php: Taskfile test wrapper (no Makefile)', () => {
        write('composer.json', JSON.stringify({ require: { 'pestphp/pest': '^2' } }));
        write('Taskfile.yml', "version: '3'\ntasks:\n  test:\n    cmds:\n      - vendor/bin/pest\n");
        const cfg = JSON.parse(expectConfigParity(tmp)) as Record<string, unknown>;
        expect((cfg.runners as { command: string }[])[0]!.command).toBe('task test');
    });

    // ── JS branches ──────────────────────────────────────────────────────
    it('js: vitest beats jest when both present', () => {
        write('package.json', JSON.stringify({ devDependencies: { vitest: '^1', jest: '^29' } }));
        const cfg = JSON.parse(expectConfigParity(tmp)) as Record<string, unknown>;
        expect((cfg.runners as { runner: string }[])[0]!.runner).toBe('vitest');
        expect((cfg.runners as { command: string }[])[0]!.command).toBe('npx vitest run');
    });

    it('js: vitest with a matching test script + pm wrapper', () => {
        write(
            'package.json',
            JSON.stringify({ devDependencies: { vitest: '^1' }, scripts: { test: 'vitest run' } }),
        );
        const cfg = JSON.parse(expectConfigParity(tmp)) as Record<string, unknown>;
        expect((cfg.runners as { command: string }[])[0]!.command).toBe('npm test');
    });

    it('js: jest only', () => {
        write('package.json', JSON.stringify({ devDependencies: { jest: '^29' } }));
        const cfg = JSON.parse(expectConfigParity(tmp)) as Record<string, unknown>;
        expect((cfg.runners as { runner: string }[])[0]!.runner).toBe('jest');
    });

    it('js: test script with unclear runner → MEDIUM jest', () => {
        write('package.json', JSON.stringify({ scripts: { test: 'node ./run-tests.js' } }));
        const cfg = JSON.parse(expectConfigParity(tmp)) as Record<string, unknown>;
        expect((cfg.runners as { confidence: string }[])[0]!.confidence).toBe('MEDIUM');
    });

    it('js: playwright e2e excluded from selected by default', () => {
        write(
            'package.json',
            JSON.stringify({ devDependencies: { vitest: '^1', '@playwright/test': '^1' } }),
        );
        const cfg = JSON.parse(expectConfigParity(tmp)) as Record<string, unknown>;
        // Inventory has both; selected (default guard) drops the e2e command.
        expect((cfg.runners as unknown[]).length).toBe(2);
        expect((cfg.selected as string[])).toEqual(['npx vitest run']);
    });

    it('js: --include-e2e adds playwright to selected', () => {
        write(
            'package.json',
            JSON.stringify({ devDependencies: { vitest: '^1', '@playwright/test': '^1' } }),
        );
        const cfg = JSON.parse(expectConfigParity(tmp, { include_e2e: true })) as Record<string, unknown>;
        expect((cfg.selected as string[]).length).toBe(2);
    });

    it('js: cypress e2e + test:e2e script command', () => {
        write(
            'package.json',
            JSON.stringify({ devDependencies: { cypress: '^13' }, scripts: { 'test:e2e': 'cypress run' } }),
        );
        const cfg = JSON.parse(expectConfigParity(tmp, { include_e2e: true })) as Record<string, unknown>;
        const e2e = (cfg.runners as { runner: string; command: string }[]).find((r) => r.runner === 'cypress');
        expect(e2e?.command).toBe('npm run test:e2e');
    });

    it('js: slow bucket excluded by default, added with --include-slow', () => {
        write(
            'package.json',
            JSON.stringify({ devDependencies: { vitest: '^1' }, scripts: { 'test:slow': 'vitest run slow' } }),
        );
        const def = JSON.parse(expectConfigParity(tmp)) as Record<string, unknown>;
        expect((def.selected as string[]).length).toBe(1);
        const slow = JSON.parse(expectConfigParity(tmp, { include_slow: true })) as Record<string, unknown>;
        expect((slow.selected as string[]).length).toBe(2);
    });

    it('js quality: typescript + eslint', () => {
        write('package.json', JSON.stringify({ devDependencies: { typescript: '^5', eslint: '^9' } }));
        const cfg = JSON.parse(expectConfigParity(tmp)) as Record<string, unknown>;
        expect(cfg.quality).toEqual(['npx tsc --noEmit', 'npx eslint .']);
    });

    it('js: pnpm package manager wrapper', () => {
        write(
            'package.json',
            JSON.stringify({ devDependencies: { vitest: '^1' }, scripts: { test: 'vitest run' } }),
        );
        write('pnpm-lock.yaml', 'lockfileVersion: 9\n');
        const cfg = JSON.parse(expectConfigParity(tmp)) as Record<string, unknown>;
        expect((cfg.runners as { command: string }[])[0]!.command).toBe('pnpm test');
    });

    // ── Python branches ──────────────────────────────────────────────────
    it('python: pyproject mentions pytest → HIGH', () => {
        write('pyproject.toml', '[tool.pytest.ini_options]\naddopts = "-q"\n');
        const cfg = JSON.parse(expectConfigParity(tmp)) as Record<string, unknown>;
        expect((cfg.runners as { runner: string; confidence: string }[])[0]).toMatchObject({
            runner: 'pytest',
            confidence: 'HIGH',
        });
    });

    it('python: requirements.txt only → MEDIUM pytest', () => {
        write('requirements.txt', 'requests\n');
        const cfg = JSON.parse(expectConfigParity(tmp)) as Record<string, unknown>;
        expect((cfg.runners as { confidence: string }[])[0]!.confidence).toBe('MEDIUM');
    });

    it('python quality: ruff + mypy from pyproject text', () => {
        write('pyproject.toml', '[tool.ruff]\n[tool.mypy]\n[tool.pytest.ini_options]\n');
        const cfg = JSON.parse(expectConfigParity(tmp)) as Record<string, unknown>;
        expect(cfg.quality).toEqual(['ruff check', 'mypy .']);
    });

    // ── Go / Rust ────────────────────────────────────────────────────────
    it('go: go.mod present', () => {
        write('go.mod', 'module example.com/x\n\ngo 1.22\n');
        const cfg = JSON.parse(expectConfigParity(tmp)) as Record<string, unknown>;
        expect((cfg.runners as { runner: string }[])[0]!.runner).toBe('go-test');
        expect(cfg.quality).toEqual(['go vet ./...']);
    });

    it('rust: Cargo.toml present', () => {
        write('Cargo.toml', '[package]\nname = "x"\n');
        const cfg = JSON.parse(expectConfigParity(tmp)) as Record<string, unknown>;
        expect((cfg.runners as { runner: string }[])[0]!.runner).toBe('cargo-test');
        expect(cfg.quality).toEqual(['cargo clippy']);
    });

    // ── Monorepo: multi-ecosystem + guards ───────────────────────────────
    it('monorepo: php + js + python + go inventory and ecosystem order', () => {
        write('composer.json', JSON.stringify({ require: { 'pestphp/pest': '^2' } }));
        write('package.json', JSON.stringify({ devDependencies: { vitest: '^1' } }));
        write('pyproject.toml', '[tool.pytest.ini_options]\n');
        write('go.mod', 'module x\n');
        const cfg = JSON.parse(expectConfigParity(tmp)) as Record<string, unknown>;
        expect(cfg.ecosystems).toEqual(['php', 'js', 'python', 'go']);
    });

    it('monorepo: --php narrows selected to PHP only', () => {
        write('composer.json', JSON.stringify({ require: { 'pestphp/pest': '^2' } }));
        write('package.json', JSON.stringify({ devDependencies: { vitest: '^1' } }));
        const cfg = JSON.parse(expectConfigParity(tmp, { php_only: true })) as Record<string, unknown>;
        // Full inventory keeps both; selected is PHP-only.
        expect((cfg.runners as unknown[]).length).toBe(2);
        expect((cfg.selected as string[])).toEqual(['vendor/bin/pest']);
    });

    // ── write_config byte-parity ─────────────────────────────────────────
    it('write_config: byte-identical on-disk file (sort_keys + trailing \\n)', () => {
        write('composer.json', JSON.stringify({ require: { 'pestphp/pest': '^2' } }));
        write('package.json', JSON.stringify({ devDependencies: { vitest: '^1', eslint: '^9' } }));
        const py = pyWriteConfig(tmp);
        // Fresh tmp for the TS write so the two don't race on the same target,
        // but identical inputs → identical config. Re-create the same tree.
        const tmp2 = fs.mkdtempSync(path.join(os.tmpdir(), 'p2t-runner-w-'));
        try {
            fs.writeFileSync(path.join(tmp2, 'composer.json'), JSON.stringify({ require: { 'pestphp/pest': '^2' } }));
            fs.writeFileSync(
                path.join(tmp2, 'package.json'),
                JSON.stringify({ devDependencies: { vitest: '^1', eslint: '^9' } }),
            );
            const ts = (function () {
                const saved = process.env.P2T_ROOT;
                process.env.P2T_ROOT = tmp2;
                const out = tsWriteConfig(tmp2);
                process.env.P2T_ROOT = saved;
                return out;
            })();
            expect(ts).toBe(py);
            // Sanity: the file ends with a newline and sorts keys.
            expect(py.endsWith('\n')).toBe(true);
            expect(py.indexOf('"confidence"')).toBeLessThan(py.indexOf('"ecosystems"'));
        } finally {
            fs.rmSync(tmp2, { recursive: true, force: true });
        }
    });
});
