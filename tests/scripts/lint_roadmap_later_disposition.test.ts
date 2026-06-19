// Tests for src/scripts/lint_roadmap_later_disposition.ts (py2ts — ADR-200).
//
// Two layers:
//  1. Unit tests over the exported `check()` + helpers on a sandboxed
//     ROADMAP_ROOT (via _setRoadmapRootForTest), covering Rule A (status:later
//     outside later/) and Rule B (later/ roadmap without a resume condition),
//     plus the exclude-name / exclude-prefix filter and the frontmatter/status
//     parsers.
//  2. Golden parity: python3 lint_roadmap_later_disposition.py vs tsx, both
//     pointed at the SAME tmp ROADMAP_ROOT, asserting byte-identical
//     stdout/stderr + exit across clean / Rule-A / Rule-B / both, human +
//     --json output, and the argparse usage/error paths. Skipped without
//     python3.
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
    _frontmatter,
    _is_roadmap,
    _status,
    check,
    _setRoadmapRootForTest,
} from '../../src/scripts/lint_roadmap_later_disposition.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const PY_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'lint_roadmap_later_disposition.py');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'lint_roadmap_later_disposition.ts');
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

const FM_LATER = '---\nstatus: later\n---\n';
const FM_READY = '---\nstatus: ready\n---\n';

// --- Unit -------------------------------------------------------------------

describe('lint_roadmap_later_disposition — helpers', () => {
    it('_frontmatter / _status parse the YAML block', () => {
        expect(_frontmatter(FM_LATER)).toBe('status: later');
        expect(_status(FM_LATER)).toBe('later');
        expect(_status('no frontmatter here')).toBe(null);
        expect(_status('---\nstatus: READY\n---\nbody')).toBe('ready'); // .lower()
    });

    it('_is_roadmap excludes the known non-roadmap names + prefixes', () => {
        expect(_is_roadmap('/x/template.md')).toBe(false);
        expect(_is_roadmap('/x/README.md')).toBe(false);
        expect(_is_roadmap('/x/open-questions-2.md')).toBe(false);
        expect(_is_roadmap('/x/road-to-thing.md')).toBe(true);
    });
});

describe('lint_roadmap_later_disposition — check()', () => {
    let tmp: string;
    beforeEach(() => {
        tmp = fs.mkdtempSync(path.join(REPO_ROOT, 'lrl-'));
    });
    afterEach(() => {
        fs.rmSync(tmp, { recursive: true, force: true });
        _setRoadmapRootForTest(path.join(REPO_ROOT, 'agents', 'roadmaps'));
    });

    it('clean tree → no violations', () => {
        fs.writeFileSync(path.join(tmp, 'road-to-a.md'), FM_READY + 'work', 'utf-8');
        fs.mkdirSync(path.join(tmp, 'later'));
        fs.writeFileSync(path.join(tmp, 'later', 'road-to-b.md'), FM_LATER + 'parked', 'utf-8');
        _setRoadmapRootForTest(tmp);
        expect(check(tmp)).toEqual([]);
    });

    it('Rule A: status:later in active tree → violation', () => {
        fs.writeFileSync(path.join(tmp, 'road-to-a.md'), FM_LATER + 'work', 'utf-8');
        _setRoadmapRootForTest(tmp);
        const v = check(tmp);
        expect(v.length).toBe(1);
        expect(v[0]!.reason).toContain('must be parked in `later/`');
    });

    it('Rule B: later/ roadmap without resume condition → violation', () => {
        fs.mkdirSync(path.join(tmp, 'later'));
        fs.writeFileSync(path.join(tmp, 'later', 'road-to-b.md'), FM_READY + 'open work', 'utf-8');
        _setRoadmapRootForTest(tmp);
        const v = check(tmp);
        expect(v.length).toBe(1);
        expect(v[0]!.reason).toContain('no resume');
    });

    it('Rule B satisfied by a "Blocked until" body line', () => {
        fs.mkdirSync(path.join(tmp, 'later'));
        fs.writeFileSync(
            path.join(tmp, 'later', 'road-to-b.md'),
            FM_READY + 'Blocked until the API lands.',
            'utf-8',
        );
        _setRoadmapRootForTest(tmp);
        expect(check(tmp)).toEqual([]);
    });
});

// --- Golden parity (python3 vs tsx) ----------------------------------------

const py3 = hasPython3();

const PY_WRAPPER = [
    'import importlib.util, os, sys, pathlib, json',
    'spec = importlib.util.spec_from_file_location("lrl", os.environ["LRL_PY"])',
    'm = importlib.util.module_from_spec(spec)',
    // Register in sys.modules BEFORE exec: the module declares an
    // `@dataclass` under `from __future__ import annotations`, and Python 3.9's
    // dataclasses._is_type resolves the (string) field annotations against
    // sys.modules[cls.__module__] — an importlib-loaded module not registered
    // there crashes with AttributeError. This is a harness concern, not a twin
    // behaviour difference.
    'sys.modules[spec.name] = m',
    'spec.loader.exec_module(m)',
    'm.ROADMAP_ROOT = pathlib.Path(os.environ["LRL_ROOT"])',
    'm.LATER_DIR = m.ROADMAP_ROOT / "later"',
    'sys.exit(m.main(json.loads(os.environ["LRL_ARGV"])))',
    '',
].join('\n');

const TS_WRAPPER = [
    'import(process.env.LRL_TS).then((m) => {',
    '    m._setRoadmapRootForTest(process.env.LRL_ROOT);',
    '    process.exitCode = m.main(JSON.parse(process.env.LRL_ARGV));',
    '});',
    '',
].join('\n');

describe.skipIf(!py3)('lint_roadmap_later_disposition — golden parity (python3 vs tsx)', () => {
    let tmp: string;
    let root: string;
    let pyWrap: string;
    let tsWrap: string;
    beforeEach(() => {
        tmp = fs.mkdtempSync(path.join(REPO_ROOT, 'lrl-parity-'));
        root = path.join(tmp, 'roadmaps');
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
            LRL_PY: PY_SCRIPT,
            LRL_TS: pathToFileURL(TS_SCRIPT).href,
            LRL_ROOT: root,
            LRL_ARGV: JSON.stringify(argv),
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

    function clean(): void {
        fs.writeFileSync(path.join(root, 'road-to-a.md'), FM_READY + 'work', 'utf-8');
        fs.mkdirSync(path.join(root, 'later'));
        fs.writeFileSync(path.join(root, 'later', 'road-to-b.md'), FM_LATER + 'parked', 'utf-8');
    }

    it('clean tree byte-identical (human + --json)', () => {
        clean();
        expectMatch([]);
        expectMatch(['--json']);
    });

    it('Rule A violation byte-identical (human + --json)', () => {
        fs.writeFileSync(path.join(root, 'road-to-a.md'), FM_LATER + 'work', 'utf-8');
        expectMatch([]);
        expectMatch(['--json']);
    });

    it('Rule B violation byte-identical (human + --json)', () => {
        fs.mkdirSync(path.join(root, 'later'));
        fs.writeFileSync(path.join(root, 'later', 'road-to-b.md'), FM_READY + 'open', 'utf-8');
        expectMatch([]);
        expectMatch(['--json']);
    });

    it('both rules + a clean roadmap, sorted, byte-identical', () => {
        fs.writeFileSync(path.join(root, 'road-to-zeta.md'), FM_LATER + 'misplaced', 'utf-8');
        fs.writeFileSync(path.join(root, 'road-to-alpha.md'), FM_READY + 'fine', 'utf-8');
        fs.mkdirSync(path.join(root, 'later'));
        fs.writeFileSync(path.join(root, 'later', 'road-to-y.md'), FM_READY + 'no resume', 'utf-8');
        // README excluded; resume-condition variant satisfied.
        fs.writeFileSync(path.join(root, 'README.md'), 'status: later\n', 'utf-8');
        fs.writeFileSync(path.join(root, 'later', 'road-to-x.md'), FM_READY + 'Trigger: ship', 'utf-8');
        expectMatch([]);
        expectMatch(['--json']);
    });

    it('unknown arg → exit 2 identically (direct invocation — prog name)', () => {
        const py = spawnSync('python3', [PY_SCRIPT, '--bogus'], { encoding: 'utf8' });
        const ts = spawnSync(TSX_BIN, [TS_SCRIPT, '--bogus'], { encoding: 'utf8' });
        expect(ts.stdout).toBe(py.stdout);
        expect(ts.stderr).toBe(py.stderr);
        expect(ts.status).toBe(py.status);
    });
});
