// Tests for src/scripts/lint_eval_freshness.ts (py2ts — ADR-200).
//
// Two layers:
//  1. Unit tests over the exported `check()` on a sandboxed SKILLS_DIR
//     (via _setSkillsDirForTest), covering every in-scope / out-of-scope /
//     missing / stale branch.
//  2. Golden parity: python3 lint_eval_freshness.py vs tsx
//     lint_eval_freshness.ts, both pointed at the SAME tmp SKILLS_DIR (Python
//     via an importlib wrapper that monkeypatches SKILLS_DIR; TS via the
//     _setSkillsDirForTest seam), asserting byte-identical stdout/stderr +
//     exit across clean / missing-last_eval / stale-sha / unreadable-manifest /
//     out-of-scope corpora, plus --quiet and the argparse usage/error paths.
//     Skipped without python3.
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { check, _setSkillsDirForTest } from '../../src/scripts/lint_eval_freshness.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const PY_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'lint_eval_freshness.py');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'lint_eval_freshness.ts');
const TSX_BIN =
    process.env.TSX_BIN ??
    path.join(
        REPO_ROOT,
        'node_modules',
        '.bin',
        process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
    );

function hasPython3(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}

// --- helpers to build a sandbox skills tree --------------------------------

interface SkillSpec {
    triggers?: boolean; // ships evals/triggers.json
    manifest?: unknown | 'invalid' | 'absent'; // data/manifest.json content
}

function mkSkills(root: string, skills: Record<string, SkillSpec>): void {
    for (const [name, spec] of Object.entries(skills)) {
        const dir = path.join(root, name);
        fs.mkdirSync(dir, { recursive: true });
        if (spec.triggers) {
            fs.mkdirSync(path.join(dir, 'evals'), { recursive: true });
            fs.writeFileSync(path.join(dir, 'evals', 'triggers.json'), '{}', 'utf-8');
        }
        if (spec.manifest === 'absent' || spec.manifest === undefined) {
            continue;
        }
        fs.mkdirSync(path.join(dir, 'data'), { recursive: true });
        const mp = path.join(dir, 'data', 'manifest.json');
        if (spec.manifest === 'invalid') {
            fs.writeFileSync(mp, '{ not json', 'utf-8');
        } else {
            fs.writeFileSync(mp, JSON.stringify(spec.manifest), 'utf-8');
        }
    }
}

// --- Unit: check() ----------------------------------------------------------

describe('lint_eval_freshness — check()', () => {
    let tmp: string;
    beforeEach(() => {
        tmp = fs.mkdtempSync(path.join(REPO_ROOT, 'lef-'));
    });
    afterEach(() => {
        fs.rmSync(tmp, { recursive: true, force: true });
        _setSkillsDirForTest(path.join(REPO_ROOT, 'src', 'skills'));
    });

    it('current last_eval → no error', () => {
        mkSkills(tmp, {
            alpha: {
                triggers: true,
                manifest: { upstream: { sha: 'abc', last_eval: { sha_at_eval: 'abc' } } },
            },
        });
        _setSkillsDirForTest(tmp);
        expect(check()).toEqual([]);
    });

    it('missing last_eval → one error', () => {
        mkSkills(tmp, {
            beta: { triggers: true, manifest: { upstream: { sha: 'abc' } } },
        });
        _setSkillsDirForTest(tmp);
        const errs = check();
        expect(errs.length).toBe(1);
        expect(errs[0]!.startsWith('beta: ships evals/triggers.json')).toBe(true);
    });

    it('stale sha_at_eval → one error citing both shas', () => {
        mkSkills(tmp, {
            gamma: {
                triggers: true,
                manifest: { upstream: { sha: 'newsha', last_eval: { sha_at_eval: 'oldsha' } } },
            },
        });
        _setSkillsDirForTest(tmp);
        const errs = check();
        expect(errs.length).toBe(1);
        expect(errs[0]).toContain("('oldsha')");
        expect(errs[0]).toContain("('newsha')");
    });

    it('no triggers.json → out of scope (skipped)', () => {
        mkSkills(tmp, {
            delta: { triggers: false, manifest: { upstream: { sha: 'abc' } } },
        });
        _setSkillsDirForTest(tmp);
        expect(check()).toEqual([]);
    });

    it('upstream: null / no sha → out of scope (skipped)', () => {
        mkSkills(tmp, {
            eps: { triggers: true, manifest: { upstream: null } },
            zeta: { triggers: true, manifest: { upstream: { sha: '' } } },
        });
        _setSkillsDirForTest(tmp);
        expect(check()).toEqual([]);
    });

    it('invalid JSON manifest → unreadable error', () => {
        mkSkills(tmp, { theta: { triggers: true, manifest: 'invalid' } });
        _setSkillsDirForTest(tmp);
        const errs = check();
        expect(errs).toEqual(['theta: manifest.json is unreadable / invalid JSON']);
    });

    it('missing SKILLS_DIR → empty', () => {
        _setSkillsDirForTest(path.join(tmp, 'nope'));
        expect(check()).toEqual([]);
    });
});

// --- Golden parity (python3 vs tsx) ----------------------------------------

const py3 = hasPython3();

const PY_WRAPPER = [
    'import importlib.util, os, sys, pathlib, json',
    'spec = importlib.util.spec_from_file_location("lef", os.environ["LEF_PY"])',
    'm = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)',
    'm.SKILLS_DIR = pathlib.Path(os.environ["LEF_ROOT"])',
    // lint_eval_freshness.main() takes no argv — it reads sys.argv via
    // argparse. Seed sys.argv so the parser sees the test's flags.
    'sys.argv = [m.__file__] + json.loads(os.environ["LEF_ARGV"])',
    'sys.exit(m.main())',
    '',
].join('\n');

const TS_WRAPPER = [
    'import(process.env.LEF_TS).then((m) => {',
    '    m._setSkillsDirForTest(process.env.LEF_ROOT);',
    '    process.exitCode = m.main(JSON.parse(process.env.LEF_ARGV));',
    '});',
    '',
].join('\n');

describe.skipIf(!py3)('lint_eval_freshness — golden parity (python3 vs tsx)', () => {
    let tmp: string;
    let root: string;
    let pyWrap: string;
    let tsWrap: string;
    beforeEach(() => {
        tmp = fs.mkdtempSync(path.join(REPO_ROOT, 'lef-parity-'));
        root = path.join(tmp, 'skills');
        fs.mkdirSync(root);
        pyWrap = path.join(tmp, 'wrap.py');
        tsWrap = path.join(tmp, 'wrap.mjs');
        fs.writeFileSync(pyWrap, PY_WRAPPER, 'utf-8');
        fs.writeFileSync(tsWrap, TS_WRAPPER, 'utf-8');
    });
    afterEach(() => {
        fs.rmSync(tmp, { recursive: true, force: true });
    });

    function env(argv: string[]) {
        return {
            ...process.env,
            LEF_PY: PY_SCRIPT,
            LEF_TS: pathToFileURL(TS_SCRIPT).href,
            LEF_ROOT: root,
            LEF_ARGV: JSON.stringify(argv),
        };
    }

    function expectMatch(argv: string[]): void {
        const e = env(argv);
        const py = spawnSync('python3', [pyWrap], { env: e, encoding: 'utf8' });
        const ts = spawnSync(TSX_BIN, [tsWrap], { env: e, encoding: 'utf8' });
        const label = JSON.stringify(argv);
        expect(ts.stdout, label).toBe(py.stdout);
        expect(ts.stderr, label).toBe(py.stderr);
        expect(ts.status, label).toBe(py.status);
    }

    it('clean tree byte-identical', () => {
        mkSkills(root, {
            ok: {
                triggers: true,
                manifest: { upstream: { sha: 'abc', last_eval: { sha_at_eval: 'abc' } } },
            },
        });
        expectMatch([]);
    });

    it('missing + stale + out-of-scope mix byte-identical', () => {
        mkSkills(root, {
            amiss: { triggers: true, manifest: { upstream: { sha: 'a1' } } },
            bstale: {
                triggers: true,
                manifest: { upstream: { sha: 'new', last_eval: { sha_at_eval: 'old' } } },
            },
            cscope: { triggers: false, manifest: { upstream: { sha: 'x' } } },
            dnull: { triggers: true, manifest: { upstream: null } },
        });
        expectMatch([]);
    });

    it('invalid manifest JSON byte-identical', () => {
        mkSkills(root, { broke: { triggers: true, manifest: 'invalid' } });
        expectMatch([]);
    });

    it('--quiet on a clean tree byte-identical', () => {
        mkSkills(root, {
            ok: {
                triggers: true,
                manifest: { upstream: { sha: 'abc', last_eval: { sha_at_eval: 'abc' } } },
            },
        });
        expectMatch(['--quiet']);
    });

    it('--quiet still emits errors to stderr identically', () => {
        mkSkills(root, { amiss: { triggers: true, manifest: { upstream: { sha: 'a1' } } } });
        expectMatch(['--quiet']);
    });

    it('unknown arg → exit 2 identically (direct invocation — prog name)', () => {
        const py = spawnSync('python3', [PY_SCRIPT, '--bogus'], { encoding: 'utf8' });
        const ts = spawnSync(TSX_BIN, [TS_SCRIPT, '--bogus'], { encoding: 'utf8' });
        expect(ts.stdout).toBe(py.stdout);
        expect(ts.stderr).toBe(py.stderr);
        expect(ts.status).toBe(py.status);
    });
});
