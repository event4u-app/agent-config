// Tests for src/scripts/analysis_freshness.ts (py2ts — ADR-200).
//
// Two layers:
//  1. Unit tests over the exported cmd_stamp / cmd_check on tmp files, asserting
//     header round-trip + the no-header / header-present check branches.
//  2. Golden parity: python3 analysis_freshness.py vs tsx, both pointed at the
//     SAME tmp ANALYSIS_DIR (Python via an importlib wrapper that monkeypatches
//     ANALYSIS_DIR; TS via _setAnalysisDirForTest), asserting byte-identical
//     stdout/stderr + exit across --check / --check-all / --stamp / --stamp-all
//     and every argparse error path (no-args required-group, mutex conflict,
//     missing value, unrecognized). Both processes shell out to the SAME real
//     git at the SAME REPO_ROOT, so the date/commit tokens are identical
//     between the two without normalization. Skipped without python3.
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { cmd_check, cmd_stamp, _setAnalysisDirForTest } from '../../src/scripts/analysis_freshness.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const PY_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'analysis_freshness.py');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'analysis_freshness.ts');
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

const HEADER_RE = /^<!-- analyzed: [\d-]+ \| commit: [0-9a-f]+ \| files: \d+ -->\n/;

// --- Unit -------------------------------------------------------------------

describe('analysis_freshness — cmd_stamp / cmd_check', () => {
    let tmp: string;
    beforeEach(() => {
        tmp = fs.mkdtempSync(path.join(REPO_ROOT, 'af-'));
    });
    afterEach(() => {
        fs.rmSync(tmp, { recursive: true, force: true });
        _setAnalysisDirForTest(path.join(REPO_ROOT, 'agents', 'evidence', 'analysis'));
    });

    it('cmd_stamp writes a freshness header and is idempotent on re-stamp', () => {
        const f = path.join(tmp, 'doc.md');
        fs.writeFileSync(f, '# Doc\n\nbody\n', 'utf-8');
        expect(cmd_stamp(f)).toBe(0);
        const first = fs.readFileSync(f, 'utf-8');
        expect(HEADER_RE.test(first)).toBe(true);
        expect(first.includes('# Doc')).toBe(true);
        // Re-stamp replaces (not duplicates) the header.
        expect(cmd_stamp(f)).toBe(0);
        const second = fs.readFileSync(f, 'utf-8');
        expect((second.match(/analyzed:/g) ?? []).length).toBe(1);
    });

    it('cmd_check on a headerless file returns 0 (warns to stdout)', () => {
        const f = path.join(tmp, 'doc.md');
        fs.writeFileSync(f, 'no header\n', 'utf-8');
        expect(cmd_check(f)).toBe(0);
    });

    it('cmd_check on a stamped file returns 0', () => {
        const f = path.join(tmp, 'doc.md');
        fs.writeFileSync(f, '# Doc\n', 'utf-8');
        cmd_stamp(f);
        expect(cmd_check(f)).toBe(0);
    });
});

// --- Golden parity (python3 vs tsx) ----------------------------------------

const py3 = hasPython3();

const PY_WRAPPER = [
    'import importlib.util, os, sys, pathlib, json',
    'spec = importlib.util.spec_from_file_location("af", os.environ["AF_PY"])',
    'm = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)',
    'm.ANALYSIS_DIR = pathlib.Path(os.environ["AF_DIR"])',
    'sys.exit(m.main(json.loads(os.environ["AF_ARGV"])))',
    '',
].join('\n');

const TS_WRAPPER = [
    'import(process.env.AF_TS).then((m) => {',
    '    m._setAnalysisDirForTest(process.env.AF_DIR);',
    '    process.exitCode = m.main(JSON.parse(process.env.AF_ARGV));',
    '});',
    '',
].join('\n');

describe.skipIf(!py3)('analysis_freshness — golden parity (python3 vs tsx)', () => {
    let tmp: string;
    let dir: string;
    let pyWrap: string;
    let tsWrap: string;
    beforeEach(() => {
        tmp = fs.mkdtempSync(path.join(REPO_ROOT, 'af-parity-'));
        dir = path.join(tmp, 'analysis');
        fs.mkdirSync(dir);
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
            AF_PY: PY_SCRIPT,
            AF_TS: pathToFileURL(TS_SCRIPT).href,
            AF_DIR: dir,
            AF_ARGV: JSON.stringify(argv),
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

    it('--check on a headerless file byte-identical', () => {
        const f = path.join(dir, 'doc.md');
        fs.writeFileSync(f, 'no header\n', 'utf-8');
        expectMatch(['--check', f]);
    });

    it('--check on a header file (real git probe) byte-identical', () => {
        // A header that cites a real repo path so the changed-file scope is the
        // same for both processes; the commit is a short SHA that exists.
        const head = spawnSync('git', ['-C', REPO_ROOT, 'rev-parse', '--short', 'HEAD'], {
            encoding: 'utf8',
        }).stdout.trim();
        const f = path.join(dir, 'doc.md');
        fs.writeFileSync(
            f,
            `<!-- analyzed: 2026-06-15 | commit: ${head} | files: 1 -->\n` +
                'References `src/scripts/analysis_freshness.py` here.\n',
            'utf-8',
        );
        expectMatch(['--check', f]);
    });

    it('--check-all over a sandbox dir byte-identical', () => {
        fs.writeFileSync(path.join(dir, 'a.md'), 'no header\n', 'utf-8');
        fs.writeFileSync(path.join(dir, 'b.md'), 'also none\n', 'utf-8');
        expectMatch(['--check-all']);
    });

    it('--stamp-all over a sandbox dir byte-identical (date/commit shared)', () => {
        fs.writeFileSync(path.join(dir, 'a.md'), '# A\n', 'utf-8');
        fs.writeFileSync(path.join(dir, 'b.md'), '# B\n', 'utf-8');
        expectMatch(['--stamp-all']);
    });

    it('no args → required-group error exit 2 identically', () => {
        const py = spawnSync('python3', [PY_SCRIPT], { encoding: 'utf8' });
        const ts = spawnSync(TSX_BIN, [TS_SCRIPT], { encoding: 'utf8' });
        expect(ts.stdout).toBe(py.stdout);
        expect(ts.stderr).toBe(py.stderr);
        expect(ts.status).toBe(py.status);
    });

    it('mutex conflict exit 2 identically (direct — prog name)', () => {
        const py = spawnSync('python3', [PY_SCRIPT, '--stamp-all', '--check', 'x'], {
            encoding: 'utf8',
        });
        const ts = spawnSync(TSX_BIN, [TS_SCRIPT, '--stamp-all', '--check', 'x'], {
            encoding: 'utf8',
        });
        expect(ts.stdout).toBe(py.stdout);
        expect(ts.stderr).toBe(py.stderr);
        expect(ts.status).toBe(py.status);
    });

    it('missing value exit 2 identically (direct — prog name)', () => {
        const py = spawnSync('python3', [PY_SCRIPT, '--stamp'], { encoding: 'utf8' });
        const ts = spawnSync(TSX_BIN, [TS_SCRIPT, '--stamp'], { encoding: 'utf8' });
        expect(ts.stdout).toBe(py.stdout);
        expect(ts.stderr).toBe(py.stderr);
        expect(ts.status).toBe(py.status);
    });

    it('unrecognized after a valid action exit 2 identically (direct — prog name)', () => {
        const py = spawnSync('python3', [PY_SCRIPT, '--check-all', '--bogus'], { encoding: 'utf8' });
        const ts = spawnSync(TSX_BIN, [TS_SCRIPT, '--check-all', '--bogus'], { encoding: 'utf8' });
        expect(ts.stdout).toBe(py.stdout);
        expect(ts.stderr).toBe(py.stderr);
        expect(ts.status).toBe(py.status);
    });
});
