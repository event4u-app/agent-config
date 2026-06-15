// Tests for src/scripts/lint_workflow_security.ts (py2ts — workflow linter).
//
// Two layers:
//  1. Unit tests over the exported helpers (_triggers, scan_workflow,
//     is_allowlisted, load_allowlist) via the _set*ForTest seams on tmp fixtures.
//  2. Golden-parity: python3 lint_workflow_security.py vs tsx
//     lint_workflow_security.ts, both pointed at the SAME tmp fixture dir
//     (Python via an importlib wrapper that monkeypatches WORKFLOWS_DIR /
//     ALLOWLIST_PATH; TS via the _set*ForTest seam), asserting byte-identical
//     stdout/stderr + exit and a byte-identical --json artifact. Parity skipped
//     without python3.
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
    _setAllowlistPathForTest,
    _setWorkflowsDirForTest,
    _triggers,
    is_allowlisted,
    scan_workflow,
} from '../../src/scripts/lint_workflow_security.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const PY_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'lint_workflow_security.py');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'lint_workflow_security.ts');
const TSX_BIN = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);

function hasPython3(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}

const DANGEROUS_WF = [
    'on:',
    '  pull_request_target:',
    'permissions: write-all',
    'jobs:',
    '  build:',
    '    permissions: write-all',
    '    steps:',
    '      - uses: actions/checkout@v4',
    '        with:',
    '          ref: ${{ github.event.pull_request.head.sha }}',
    '      - uses: somevendor/action@v1',
    '      - run: npm ci',
    '',
].join('\n');

const CLEAN_WF = [
    'on:',
    '  push:',
    'permissions:',
    '  contents: read',
    'jobs:',
    '  build:',
    '    steps:',
    '      - uses: actions/checkout@0000000000000000000000000000000000000000',
    '      - run: npm ci --ignore-scripts',
    '',
].join('\n');

// --- Unit: _triggers --------------------------------------------------------

describe('lint_workflow_security — _triggers', () => {
    it('handles string, list, dict, null', () => {
        expect([..._triggers('push')]).toEqual(['push']);
        expect([..._triggers(['push', 'pull_request'])].sort()).toEqual(['pull_request', 'push']);
        expect([..._triggers({ pull_request_target: null })]).toEqual(['pull_request_target']);
        expect([..._triggers(null)]).toEqual([]);
        expect([..._triggers(undefined)]).toEqual([]);
    });
});

// --- Unit: scan_workflow on tmp fixtures ------------------------------------

describe('lint_workflow_security — scan_workflow', () => {
    let tmp: string;
    beforeEach(() => {
        tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lws-'));
    });
    afterEach(() => {
        fs.rmSync(tmp, { recursive: true, force: true });
    });

    it('flags the dangerous workflow with HIGH + MEDIUM findings', () => {
        const wf = path.join(tmp, 'bad.yml');
        fs.writeFileSync(wf, DANGEROUS_WF, 'utf-8');
        const findings = scan_workflow(wf, []);
        const rules = findings.map((f) => f['rule']);
        expect(rules).toContain('dangerous-trigger-untrusted-ref');
        expect(rules).toContain('permissions-write-all');
        expect(rules).toContain('npm-install-without-ignore-scripts');
        expect(rules).toContain('mutable-action-tag');
    });

    it('clean workflow yields no findings', () => {
        const wf = path.join(tmp, 'ok.yml');
        fs.writeFileSync(wf, CLEAN_WF, 'utf-8');
        expect(scan_workflow(wf, [])).toEqual([]);
    });

    it('parse error → HIGH parse-error finding', () => {
        const wf = path.join(tmp, 'broken.yml');
        fs.writeFileSync(wf, 'foo: [unterminated\n', 'utf-8');
        const findings = scan_workflow(wf, []);
        expect(findings[0]!['rule']).toBe('parse-error');
        expect(findings[0]!['severity']).toBe('HIGH');
    });

    it('marks allowlisted findings', () => {
        const wf = path.join(tmp, 'bad.yml');
        fs.writeFileSync(wf, DANGEROUS_WF, 'utf-8');
        const al = [{ workflow: 'bad.yml', rule: 'permissions-write-all' }];
        const findings = scan_workflow(wf, al);
        const perm = findings.find((f) => f['rule'] === 'permissions-write-all');
        expect(perm!['allowlisted']).toBe(true);
    });
});

// --- Unit: is_allowlisted ---------------------------------------------------

describe('lint_workflow_security — is_allowlisted', () => {
    it('matches workflow + rule', () => {
        const al = [{ workflow: 'x.yml', rule: 'permissions-write-all' }];
        expect(is_allowlisted(al, 'x.yml', 'permissions-write-all')).toBe(true);
        expect(is_allowlisted(al, 'x.yml', 'other')).toBe(false);
        expect(is_allowlisted(al, 'y.yml', 'permissions-write-all')).toBe(false);
    });
});

// --- Golden parity (python3 vs tsx) -----------------------------------------

const py3 = hasPython3();

// Wrappers are written to disk (not passed via -c / -e) so prog-name and the
// "cjs top-level await" limitation do not interfere. Each imports the module
// by path, monkeypatches the scan dir + allowlist from env, then calls main().
const PY_WRAPPER = [
    'import importlib.util, os, sys, pathlib, json',
    'spec = importlib.util.spec_from_file_location("lws", os.environ["LWS_PY"])',
    'm = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)',
    'm.WORKFLOWS_DIR = pathlib.Path(os.environ["LWS_WF_DIR"])',
    'm.ALLOWLIST_PATH = pathlib.Path(os.environ["LWS_ALLOWLIST"])',
    'sys.exit(m.main(json.loads(os.environ["LWS_ARGV"])))',
    '',
].join('\n');

const TS_WRAPPER = [
    'import(process.env.LWS_TS).then((m) => {',
    '    m._setWorkflowsDirForTest(process.env.LWS_WF_DIR);',
    '    m._setAllowlistPathForTest(process.env.LWS_ALLOWLIST);',
    '    process.exitCode = m.main(JSON.parse(process.env.LWS_ARGV));',
    '});',
    '',
].join('\n');

describe.skipIf(!py3)('lint_workflow_security — golden parity (python3 vs tsx)', () => {
    let tmp: string;
    let pyWrap: string;
    let tsWrap: string;
    beforeEach(() => {
        tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lws-parity-'));
        pyWrap = path.join(tmp, 'wrap.py');
        tsWrap = path.join(tmp, 'wrap.mjs');
        fs.writeFileSync(pyWrap, PY_WRAPPER, 'utf-8');
        fs.writeFileSync(tsWrap, TS_WRAPPER, 'utf-8');
    });
    afterEach(() => {
        fs.rmSync(tmp, { recursive: true, force: true });
    });

    function envFor(wfDir: string, argv: string[], allowlist = path.join(tmp, 'no-allowlist.json')) {
        return {
            ...process.env,
            LWS_PY: PY_SCRIPT,
            LWS_TS: pathToFileURL(TS_SCRIPT).href,
            LWS_WF_DIR: wfDir,
            LWS_ALLOWLIST: allowlist,
            LWS_ARGV: JSON.stringify(argv),
        };
    }

    function run(argv: string[], wfDir: string, allowlist?: string) {
        const env = envFor(wfDir, argv, allowlist);
        const py = spawnSync('python3', [pyWrap], { env, encoding: 'utf8' });
        const ts = spawnSync(TSX_BIN, [tsWrap], { env, encoding: 'utf8' });
        return { py, ts };
    }

    function expectMatch(argv: string[], wfDir: string, allowlist?: string) {
        const { py, ts } = run(argv, wfDir, allowlist);
        const label = JSON.stringify(argv);
        expect(ts.stdout, label).toBe(py.stdout);
        expect(ts.stderr, label).toBe(py.stderr);
        expect(ts.status, label).toBe(py.status);
    }

    it('dangerous workflow: default run byte-identical', () => {
        const wfDir = path.join(tmp, 'wf-d');
        fs.mkdirSync(wfDir);
        fs.writeFileSync(path.join(wfDir, 'bad.yml'), DANGEROUS_WF, 'utf-8');
        expectMatch([], wfDir);
    });

    it('dangerous workflow: --strict exits 1 identically', () => {
        const wfDir = path.join(tmp, 'wf-s');
        fs.mkdirSync(wfDir);
        fs.writeFileSync(path.join(wfDir, 'bad.yml'), DANGEROUS_WF, 'utf-8');
        expectMatch(['--strict'], wfDir);
    });

    it('clean workflow: no findings, exit 0', () => {
        const wfDir = path.join(tmp, 'wf-c');
        fs.mkdirSync(wfDir);
        fs.writeFileSync(path.join(wfDir, 'ok.yml'), CLEAN_WF, 'utf-8');
        expectMatch(['--strict'], wfDir);
    });

    it('--quiet suppresses per-finding output identically', () => {
        const wfDir = path.join(tmp, 'wf-q');
        fs.mkdirSync(wfDir);
        fs.writeFileSync(path.join(wfDir, 'bad.yml'), DANGEROUS_WF, 'utf-8');
        expectMatch(['--quiet'], wfDir);
    });

    it('missing workflows dir: exit 0 identically', () => {
        expectMatch([], path.join(tmp, 'does-not-exist'));
    });

    it('.yml then .yaml ordering identical', () => {
        const wfDir = path.join(tmp, 'wf-order');
        fs.mkdirSync(wfDir);
        fs.writeFileSync(path.join(wfDir, 'b.yaml'), DANGEROUS_WF, 'utf-8');
        fs.writeFileSync(path.join(wfDir, 'a.yml'), CLEAN_WF, 'utf-8');
        expectMatch([], wfDir);
    });

    it('allowlist over the cap exits 2 identically', () => {
        const wfDir = path.join(tmp, 'wf-cap');
        fs.mkdirSync(wfDir);
        fs.writeFileSync(path.join(wfDir, 'bad.yml'), DANGEROUS_WF, 'utf-8');
        const allow = path.join(tmp, 'big-allowlist.json');
        const entries = Array.from({ length: 21 }, (_, i) => ({ workflow: `w${i}.yml`, rule: 'r' }));
        fs.writeFileSync(allow, JSON.stringify({ findings: entries }), 'utf-8');
        expectMatch([], wfDir, allow);
    });

    it('--json artifact byte-identical', () => {
        const wfDir = path.join(tmp, 'wf-json');
        fs.mkdirSync(wfDir);
        fs.writeFileSync(path.join(wfDir, 'bad.yml'), DANGEROUS_WF, 'utf-8');
        const pyJson = path.join(tmp, 'py.json');
        const tsJson = path.join(tmp, 'ts.json');
        run(['--json', pyJson, '--quiet'], wfDir).py;
        // Re-run TS separately to write its own artifact (the run() helper runs
        // both with the same argv, so the second arg differs per engine here).
        const env = envFor(wfDir, ['--json', pyJson, '--quiet']);
        spawnSync('python3', ['-c', PY_WRAPPER], { env, encoding: 'utf8' });
        const tsEnv = envFor(wfDir, ['--json', tsJson, '--quiet']);
        spawnSync(TSX_BIN, ['-e', TS_WRAPPER], { env: tsEnv, encoding: 'utf8' });
        expect(fs.readFileSync(tsJson, 'utf-8')).toBe(fs.readFileSync(pyJson, 'utf-8'));
    });

    it('unknown arg exits 2 identically (direct invocation — prog name)', () => {
        // Run the scripts directly (not via the monkeypatch wrapper) so the
        // argparse prog name in the usage banner is `lint_workflow_security.py`.
        const py = spawnSync('python3', [PY_SCRIPT, '--bogus'], { encoding: 'utf8' });
        const ts = spawnSync(TSX_BIN, [TS_SCRIPT, '--bogus'], { encoding: 'utf8' });
        expect(ts.stdout).toBe(py.stdout);
        expect(ts.stderr).toBe(py.stderr);
        expect(ts.status).toBe(py.status);
    });
});
