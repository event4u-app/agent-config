// Golden-parity rig for the py2ts work_engine `stack/detect` twin (ADR-094).
//
// `work_engine/stack/detect.py` is a leaf module with NO intra-`work_engine`
// imports — stdlib only. To exercise it from python3 without importing the
// whole `work_engine` package (whose `__init__` pulls in unported siblings),
// we load `detect.py` via a direct-file `importlib` loader, registering the
// module in `sys.modules` BEFORE `exec_module` so the dataclass field-type
// resolution (under `from __future__ import annotations`) finds the module.
// This is the same loader pattern the merged `state.test.ts` uses.
//
// Each block builds a fake project tree (composer.json / package.json /
// components.json) in a tmp dir, runs `detect_stack` on BOTH engines, and
// asserts byte-identical observable output. The serialised view is
// `{frontend, has_mtime}` rather than the raw `mtime` float: `mtime` is the
// filesystem `st_mtime`, whose exact float byte-repr is not reproducible
// across CPython and V8 for sub-second timestamps (see the note in
// `detect.ts::_stat_mtime`). We assert the deterministic detection label
// byte-for-byte, plus the `mtime == 0.0` / `mtime > 0.0` discriminator that
// the cache-invalidation contract actually depends on.
import { spawnSync, type SpawnSyncReturns } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
    DEFAULT_STACK,
    KNOWN_STACKS,
    StackResult,
    latest_manifest_mtime,
} from '../../../src/agent-src/templates/scripts/work_engine/stack/detect.js';

// tests/scripts/work_engine/stack_detect.test.ts → four levels up is repo root.
const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..', '..');

const DETECT_PY = path.join(
    REPO_ROOT,
    'src',
    'agent-src',
    'templates',
    'scripts',
    'work_engine',
    'stack',
    'detect.py',
);

const TSX_BIN = process.env.TSX_BIN ?? path.join('node_modules', '.bin', 'tsx');
const DETECT_TS = path.join(
    REPO_ROOT,
    'src',
    'agent-src',
    'templates',
    'scripts',
    'work_engine',
    'stack',
    'detect.ts',
);

function hasPython3(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}

/**
 * Run a python3 snippet with `detect.py` loaded as the module `detect`
 * (direct-file importlib loader; `sys.modules` registration handles the
 * `from __future__ import annotations` dataclass type resolution). `args`
 * become `sys.argv[1:]`.
 */
function runPyWithDetect(body: string, args: string[] = []): SpawnSyncReturns<string> {
    const loader = [
        'import sys, json, pathlib, importlib.util',
        `spec = importlib.util.spec_from_file_location("detect", ${JSON.stringify(DETECT_PY)})`,
        'detect = importlib.util.module_from_spec(spec)',
        'sys.modules["detect"] = detect',
        'spec.loader.exec_module(detect)',
    ].join('\n');
    const code = `${loader}\n${body}`;
    return spawnSync('python3', ['-c', code, ...args], { encoding: 'utf8' });
}

/** python3: `detect_stack(root)` → `{"frontend": ..., "has_mtime": bool}`. */
function pyDetect(root: string): string {
    // Compact separators (`","` / `":"`) so the Python view is byte-identical
    // to JS `JSON.stringify` — `detect` itself never serialises, so the
    // separator choice is the harness's, not part of the twin contract.
    const body = [
        'root = pathlib.Path(sys.argv[1])',
        'r = detect.detect_stack(root)',
        'sys.stdout.write(json.dumps({"frontend": r.frontend, "has_mtime": r.mtime > 0.0}, separators=(",", ":")))',
    ].join('\n');
    const r = runPyWithDetect(body, [root]);
    if (r.status !== 0) {
        throw new Error(`python3 detect failed: ${r.stderr || r.stdout}`);
    }
    return r.stdout;
}

/**
 * tsx: same observable view, exercised via the `.ts` module per ADR-094.
 * Root is passed via env (`tsx -e` shifts argv indices; env is unambiguous).
 */
function tsDetect(root: string): string {
    const code = [
        `import { detect_stack } from ${JSON.stringify(DETECT_TS)};`,
        'const root = process.env.P2T_ROOT as string;',
        'const r = detect_stack(root);',
        'process.stdout.write(JSON.stringify({ frontend: r.frontend, has_mtime: r.mtime > 0.0 }));',
    ].join('\n');
    const r = spawnSync(TSX_BIN, ['-e', code], {
        encoding: 'utf8',
        env: { ...process.env, P2T_ROOT: root },
    });
    if (r.status !== 0) {
        throw new Error(`tsx detect failed: ${r.stderr || r.stdout}`);
    }
    return r.stdout;
}

/** Assert python3 and tsx agree byte-for-byte on the observable view. */
function expectParity(root: string): string {
    const py = pyDetect(root);
    const ts = tsDetect(root);
    expect(ts).toBe(py);
    return py;
}

let tmp: string;

beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'p2t-detect-'));
});

afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
});

function write(rel: string, body: string): void {
    const p = path.join(tmp, rel);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, body, 'utf8');
}

describe('stack/detect — module constants parity', () => {
    it('DEFAULT_STACK matches the Python value', () => {
        expect(DEFAULT_STACK).toBe('plain');
    });

    it('KNOWN_STACKS carries exactly the four Python labels', () => {
        expect([...KNOWN_STACKS].sort()).toEqual(
            ['blade-livewire-flux', 'plain', 'react-shadcn', 'vue'].sort(),
        );
    });

    it('StackResult is a frozen-style value carrier', () => {
        const r = new StackResult({ frontend: 'plain', mtime: 0.0 });
        expect(r.frontend).toBe('plain');
        expect(r.mtime).toBe(0.0);
    });
});

const py3 = hasPython3();
const golden = py3 ? describe : describe.skip;

golden('stack/detect — golden parity (python3 vs tsx)', () => {
    it('blade-livewire-flux: composer has livewire + flux', () => {
        write('composer.json', JSON.stringify({ require: { 'livewire/livewire': '^3', 'livewire/flux': '^1' } }));
        expect(expectParity(tmp)).toBe('{"frontend":"blade-livewire-flux","has_mtime":true}');
    });

    it('blade-livewire-flux: flux in require-dev still counts', () => {
        write(
            'composer.json',
            JSON.stringify({ require: { 'livewire/livewire': '^3' }, 'require-dev': { 'livewire/flux': '^1' } }),
        );
        expect(expectParity(tmp)).toBe('{"frontend":"blade-livewire-flux","has_mtime":true}');
    });

    it('NOT blade-livewire-flux: livewire without flux falls through', () => {
        write('composer.json', JSON.stringify({ require: { 'livewire/livewire': '^3' } }));
        // No package.json → next branch fails too → plain.
        expect(expectParity(tmp)).toBe('{"frontend":"plain","has_mtime":true}');
    });

    it('react-shadcn: react + @radix-ui/* dependency', () => {
        write('package.json', JSON.stringify({ dependencies: { react: '^18', '@radix-ui/react-slot': '^1' } }));
        expect(expectParity(tmp)).toBe('{"frontend":"react-shadcn","has_mtime":true}');
    });

    it('react-shadcn: react + shadcn-ui package', () => {
        write('package.json', JSON.stringify({ dependencies: { react: '^18', 'shadcn-ui': '^0' } }));
        expect(expectParity(tmp)).toBe('{"frontend":"react-shadcn","has_mtime":true}');
    });

    it('react-shadcn: react + components.json marker file', () => {
        write('package.json', JSON.stringify({ dependencies: { react: '^18' } }));
        write('components.json', '{}');
        expect(expectParity(tmp)).toBe('{"frontend":"react-shadcn","has_mtime":true}');
    });

    it('NOT react-shadcn: components.json present but no react → plain', () => {
        write('package.json', JSON.stringify({ dependencies: { lodash: '^4' } }));
        write('components.json', '{}');
        expect(expectParity(tmp)).toBe('{"frontend":"plain","has_mtime":true}');
    });

    it('NOT react-shadcn: react alone (no radix/shadcn/components) → plain', () => {
        write('package.json', JSON.stringify({ dependencies: { react: '^18' } }));
        expect(expectParity(tmp)).toBe('{"frontend":"plain","has_mtime":true}');
    });

    it('vue: package lists vue, no react', () => {
        write('package.json', JSON.stringify({ dependencies: { vue: '^3' } }));
        expect(expectParity(tmp)).toBe('{"frontend":"vue","has_mtime":true}');
    });

    it('vue via devDependencies', () => {
        write('package.json', JSON.stringify({ devDependencies: { vue: '^2' } }));
        expect(expectParity(tmp)).toBe('{"frontend":"vue","has_mtime":true}');
    });

    it('precedence: blade wins over react when both manifests qualify', () => {
        write('composer.json', JSON.stringify({ require: { 'livewire/livewire': '^3', 'livewire/flux': '^1' } }));
        write('package.json', JSON.stringify({ dependencies: { react: '^18', '@radix-ui/x': '^1' } }));
        expect(expectParity(tmp)).toBe('{"frontend":"blade-livewire-flux","has_mtime":true}');
    });

    it('precedence: react-shadcn wins over vue when both react+radix and vue present', () => {
        write(
            'package.json',
            JSON.stringify({ dependencies: { react: '^18', '@radix-ui/x': '^1', vue: '^3' } }),
        );
        expect(expectParity(tmp)).toBe('{"frontend":"react-shadcn","has_mtime":true}');
    });

    it('greenfield: no manifests → plain, mtime 0.0', () => {
        expect(expectParity(tmp)).toBe('{"frontend":"plain","has_mtime":false}');
    });

    it('malformed composer.json degrades to {} (no crash) → plain', () => {
        write('composer.json', '{ this is not json');
        expect(expectParity(tmp)).toBe('{"frontend":"plain","has_mtime":true}');
    });

    it('non-dict JSON payload (a list) degrades to {} → plain', () => {
        write('package.json', '[1, 2, 3]');
        expect(expectParity(tmp)).toBe('{"frontend":"plain","has_mtime":true}');
    });

    it('non-dict dependency section (require is a string) is ignored', () => {
        write('composer.json', JSON.stringify({ require: 'not-a-dict' }));
        expect(expectParity(tmp)).toBe('{"frontend":"plain","has_mtime":true}');
    });

    it('latest_manifest_mtime: only composer/package count, not components.json', () => {
        // components.json carries no mtime weight; with only it present mtime
        // stays 0.0. Assert on both engines.
        write('components.json', '{}');
        const body = [
            'root = pathlib.Path(sys.argv[1])',
            'sys.stdout.write(json.dumps({"zero": detect.latest_manifest_mtime(root) == 0.0}))',
        ].join('\n');
        const r = runPyWithDetect(body, [tmp]);
        expect(r.status).toBe(0);
        // Python emits spaced JSON (`": "`); compare the parsed boolean rather
        // than byte-comparing against in-process JS `JSON.stringify` output.
        const py = JSON.parse(r.stdout) as { zero: boolean };
        const ts = latest_manifest_mtime(tmp) === 0.0;
        expect(ts).toBe(py.zero);
        expect(py.zero).toBe(true);
    });
});
