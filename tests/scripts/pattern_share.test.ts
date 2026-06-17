// Tests for src/scripts/pattern_share.ts (py2ts, ADR-200).
//
// No pytest suite exists, so this is a focused differential suite: the pure
// helpers (`_redact`, `_validate_frontmatter`) against the REAL redactor, plus
// a golden-parity layer that runs python3 vs tsx on tmp fixtures — identical
// stdout/stderr/exit for export (stdout + --out dir), import (success, refused,
// missing-frontmatter, exists/--force), and the argparse surface (subcommand
// errors, unrecognized args, missing positional). Dest paths in stdout are
// absolute, so they are normalized inline before comparison. The import-success
// case writes into src/patterns/ — snapshot + restore leaves zero drift.
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import * as ps from '../../src/scripts/pattern_share.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'pattern_share.ts');
const PY_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'pattern_share.py');
const PATTERNS_DIR = path.join(REPO_ROOT, 'src', 'patterns');
const TSX_BIN =
    process.env['TSX_BIN'] ??
    path.join(
        REPO_ROOT,
        'node_modules',
        '.bin',
        process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
    );

function hasPython3(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}

const CLEAN =
    '---\napplies_to: php\nreliability: high\nlast_verified: 2026-01-01\n---\nJust prose, no leak.\n';
const EMAIL =
    '---\napplies_to: php\nreliability: high\nlast_verified: 2026-01-01\n---\nContact alice@example.com for details.\n';
const BAD_FM = '---\nfoo: bar\n---\nMissing required keys.\n';
const NO_FM = 'No frontmatter at all.\n';

describe('pattern_share — helpers (real redactor)', () => {
    it('_redact passes clean prose (code excerpts exempt)', () => {
        const [ok, summary] = ps._redact(CLEAN);
        expect(ok).toBe(true);
        expect(summary).toBe('redaction: clean (code excerpts exempt — patterns are recipes)');
    });

    it('_redact refuses an email (privacy class kept)', () => {
        const [ok, summary] = ps._redact(EMAIL);
        expect(ok).toBe(false);
        expect(summary.startsWith('redaction REFUSED — ')).toBe(true);
        expect(summary).toContain('email');
    });

    it('_validate_frontmatter flags a missing block and missing keys', () => {
        expect(ps._validate_frontmatter(NO_FM)).toEqual(['no frontmatter block']);
        expect(ps._validate_frontmatter(BAD_FM)).toEqual([
            'applies_to',
            'reliability',
            'last_verified',
        ]);
        expect(ps._validate_frontmatter(CLEAN)).toEqual([]);
    });
});

describe.runIf(hasPython3())('pattern_share — golden parity (python3 vs tsx)', () => {
    let tmp: string;

    function fixture(name: string, body: string): string {
        const p = path.join(tmp, name);
        fs.writeFileSync(p, body, 'utf-8');
        return p;
    }

    /** Run both engines with the same argv; assert identical exit/stdout/stderr. */
    function bothEqual(args: string[], normalize: (s: string) => string = (s) => s): void {
        const py = spawnSync('python3', [PY_SCRIPT, ...args], { encoding: 'utf8', cwd: REPO_ROOT });
        const ts = spawnSync(TSX_BIN, [TS_SCRIPT, ...args], { encoding: 'utf8', cwd: REPO_ROOT });
        expect(ts.status).toBe(py.status);
        expect(normalize(ts.stdout)).toBe(normalize(py.stdout));
        expect(normalize(ts.stderr)).toBe(normalize(py.stderr));
    }

    beforeEach(() => {
        tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pattern-share-'));
    });

    afterEach(() => {
        fs.rmSync(tmp, { recursive: true, force: true });
    });

    it('export clean → stdout passthrough (identical)', () => {
        const p = fixture('clean.md', CLEAN);
        bothEqual(['export', p]);
    });

    it('export email → refused, identical stderr + exit 1', () => {
        const p = fixture('email.md', EMAIL);
        const py = spawnSync('python3', [PY_SCRIPT, 'export', p], { encoding: 'utf8', cwd: REPO_ROOT });
        const ts = spawnSync(TSX_BIN, [TS_SCRIPT, 'export', p], { encoding: 'utf8', cwd: REPO_ROOT });
        expect(py.status).toBe(1);
        expect(ts.status).toBe(py.status);
        expect(ts.stdout).toBe(py.stdout);
        expect(ts.stderr).toBe(py.stderr);
    });

    it('export --out → byte-identical written file + dir-normalized stdout', () => {
        const p = fixture('clean.md', CLEAN);
        const outPy = path.join(tmp, 'out-py');
        const outTs = path.join(tmp, 'out-ts');
        const py = spawnSync('python3', [PY_SCRIPT, 'export', p, '--out', outPy], {
            encoding: 'utf8',
            cwd: REPO_ROOT,
        });
        const ts = spawnSync(TSX_BIN, [TS_SCRIPT, 'export', p, '--out', outTs], {
            encoding: 'utf8',
            cwd: REPO_ROOT,
        });
        expect(py.status).toBe(0);
        expect(ts.status).toBe(0);
        expect(fs.readFileSync(path.join(outTs, 'clean.md'), 'utf-8')).toBe(
            fs.readFileSync(path.join(outPy, 'clean.md'), 'utf-8'),
        );
        const norm = (s: string): string => s.replace(outPy, 'DIR').replace(outTs, 'DIR');
        expect(norm(ts.stdout)).toBe(norm(py.stdout));
        expect(ts.stderr).toBe(py.stderr);
    });

    it('export not-a-file → exit 2, identical stderr', () => {
        bothEqual(['export', path.join(tmp, 'does-not-exist.md')]);
    });

    it('import email → refused, identical stderr + exit 1', () => {
        const p = fixture('email.md', EMAIL);
        bothEqual(['import', p]);
    });

    it('import missing-frontmatter-keys → refused, identical stderr', () => {
        const p = fixture('badfm.md', BAD_FM);
        bothEqual(['import', p]);
    });

    it('import no-frontmatter-block → refused, identical stderr', () => {
        const p = fixture('nofm.md', NO_FM);
        bothEqual(['import', p]);
    });

    it('import success → byte-identical dest + dir-normalized stdout (snapshot/restore src/patterns)', () => {
        // Unique fixture name so it cannot collide with a committed pattern.
        const name = `__ps_test_clean_${process.pid}.md`;
        const dest = path.join(PATTERNS_DIR, name);
        const existed = fs.existsSync(dest);
        const bak = existed ? fs.readFileSync(dest, 'utf-8') : null;
        const src = fixture(name, CLEAN);
        try {
            const py = spawnSync('python3', [PY_SCRIPT, 'import', src], {
                encoding: 'utf8',
                cwd: REPO_ROOT,
            });
            expect(py.status).toBe(0);
            const pyDest = fs.readFileSync(dest, 'utf-8');
            const pyStdout = py.stdout;

            fs.rmSync(dest, { force: true });

            const ts = spawnSync(TSX_BIN, [TS_SCRIPT, 'import', src], {
                encoding: 'utf8',
                cwd: REPO_ROOT,
            });
            expect(ts.status).toBe(0);
            expect(fs.readFileSync(dest, 'utf-8')).toBe(pyDest);
            expect(ts.stdout).toBe(pyStdout); // identical absolute dest path
            expect(ts.stderr).toBe(py.stderr);

            // exists-without-force → refused, exit 1, identical
            bothEqual(['import', src]);
        } finally {
            if (bak !== null) {
                fs.writeFileSync(dest, bak, 'utf-8');
            } else {
                fs.rmSync(dest, { force: true });
            }
        }
    });

    it('argparse: no subcommand → exit 2, identical top-level usage/error', () => {
        bothEqual([]);
    });

    it('argparse: bad subcommand → exit 2, identical top-level usage/error', () => {
        bothEqual(['bogus']);
    });

    it('argparse: export missing positional → exit 2, sub-level error', () => {
        bothEqual(['export']);
    });

    it('argparse: import missing positional → exit 2, sub-level error', () => {
        bothEqual(['import']);
    });

    it('argparse: unrecognized flag bubbles to top-level error', () => {
        const p = fixture('clean.md', CLEAN);
        bothEqual(['export', p, '--bogus']);
    });

    it('argparse: surplus positional bubbles to top-level error', () => {
        const p = fixture('clean.md', CLEAN);
        bothEqual(['export', p, 'extra.md']);
    });

    it('argparse: --out missing value → sub-level expected-one-argument error', () => {
        const p = fixture('clean.md', CLEAN);
        bothEqual(['export', p, '--out']);
    });
});
