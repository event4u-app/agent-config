// Tests for src/scripts/generate_capabilities_index.ts (py2ts, ADR-200).
//
// No pytest suite exists, so this is a focused differential suite: the pure
// helpers + `build()` against the REAL repo, plus a golden-parity layer that
// runs python3 vs tsx on the real tree — byte-exact generated CAPABILITIES.yaml
// AND identical stdout/stderr/exit for `--check`, the success write, and the
// argparse-error path (skipped without python3). The `<N>ms` timing in the
// success/`--check` stdout is non-deterministic, so it is normalized inline
// before comparison. The writer leaves zero on-disk drift (snapshot + restore).
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

import * as gen from '../../src/scripts/generate_capabilities_index.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'generate_capabilities_index.ts');
const PY_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'generate_capabilities_index.py');
const OUT_PATH = path.join(REPO_ROOT, 'CAPABILITIES.yaml');
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

/** Replace the non-deterministic `(<N> KB, <M>ms)` timing in stdout. */
function normTiming(s: string): string {
    return s.replace(/\b\d+ms\b/g, 'Nms');
}

describe('generate_capabilities_index — helpers (real repo)', () => {
    it('_coverage_band maps counts to bands at the documented boundaries', () => {
        expect(gen._coverage_band(0)).toBe('none');
        expect(gen._coverage_band(1)).toBe('thin');
        expect(gen._coverage_band(2)).toBe('thin');
        expect(gen._coverage_band(3)).toBe('moderate');
        expect(gen._coverage_band(6)).toBe('moderate');
        expect(gen._coverage_band(7)).toBe('strong');
        expect(gen._coverage_band(99)).toBe('strong');
    });

    it('_scalar JSON-encodes strings (ensure_ascii=False parity)', () => {
        expect(gen._scalar('plain')).toBe('"plain"');
        expect(gen._scalar('has "quote"')).toBe('"has \\"quote\\""');
        expect(gen._scalar('')).toBe('""');
    });

    it('_flow_list renders [] for empty and a JSON-scalar list otherwise', () => {
        expect(gen._flow_list([])).toBe('[]');
        expect(gen._flow_list(['a'])).toBe('["a"]');
        expect(gen._flow_list(['a', 'b'])).toBe('["a", "b"]');
    });

    it('_load_packs returns only in-use packs (those carrying a domain)', () => {
        const packs = gen._load_packs();
        expect(packs.length).toBeGreaterThan(0);
        for (const p of packs) {
            expect(typeof p['domain']).toBe('string');
            expect((p['domain'] as string).length).toBeGreaterThan(0);
        }
    });

    it('_skill_packs / _command_packs map pack-id → sorted unique names', () => {
        const sk = gen._skill_packs();
        const cmd = gen._command_packs();
        // at least one pack is backed by skills and one by commands in the real tree.
        expect(Object.keys(sk).length).toBeGreaterThan(0);
        expect(Object.keys(cmd).length).toBeGreaterThan(0);
        for (const names of Object.values(sk)) {
            expect([...names]).toEqual([...names].sort());
            expect(new Set(names).size).toBe(names.length); // unique
        }
    });

    it('build emits the header, meta block, capability_areas, and gaps; trailing newline', () => {
        const out = gen.build();
        expect(out.startsWith('# CAPABILITIES.yaml — what agent-config already covers\n')).toBe(
            true,
        );
        expect(out).toContain('\nmeta:\n');
        expect(out).toContain('\ncapability_areas:\n');
        expect(out).toContain('\ngaps:\n');
        expect(out).toContain('  generated_by: src/scripts/generate_capabilities_index.py\n');
        expect(out.endsWith('\n')).toBe(true);
        expect(out.endsWith('\n\n')).toBe(false);
    });
});

describe.runIf(hasPython3())('generate_capabilities_index — golden parity (python3 vs tsx)', () => {
    let bak: string | null = null;

    afterEach(() => {
        if (bak !== null) {
            fs.writeFileSync(OUT_PATH, bak, 'utf-8');
        }
        bak = null;
    });

    it('build() body is byte-identical across engines', () => {
        const py = spawnSync(
            'python3',
            [
                '-c',
                "import sys; sys.path.insert(0, 'src/scripts'); " +
                    'import generate_capabilities_index as g; sys.stdout.write(g.build())',
            ],
            { encoding: 'utf8', cwd: REPO_ROOT },
        );
        expect(py.status).toBe(0);
        const ts = gen.build();
        expect(ts).toBe(py.stdout);
    });

    it('--check: identical stdout (timing-normalized) + stderr + exit code', () => {
        const py = spawnSync('python3', [PY_SCRIPT, '--check'], {
            encoding: 'utf8',
            cwd: REPO_ROOT,
        });
        const ts = spawnSync(TSX_BIN, [TS_SCRIPT, '--check'], { encoding: 'utf8', cwd: REPO_ROOT });
        expect(ts.status).toBe(py.status);
        expect(normTiming(ts.stdout)).toBe(normTiming(py.stdout));
        expect(ts.stderr).toBe(py.stderr);
    });

    it('--check on a stale file: exit 1 + identical stderr', () => {
        bak = fs.existsSync(OUT_PATH) ? fs.readFileSync(OUT_PATH, 'utf-8') : null;
        fs.writeFileSync(OUT_PATH, 'STALE\n', 'utf-8');

        const py = spawnSync('python3', [PY_SCRIPT, '--check'], {
            encoding: 'utf8',
            cwd: REPO_ROOT,
        });
        // restore between engines so both see the same stale precondition.
        fs.writeFileSync(OUT_PATH, 'STALE\n', 'utf-8');
        const ts = spawnSync(TSX_BIN, [TS_SCRIPT, '--check'], { encoding: 'utf8', cwd: REPO_ROOT });

        expect(py.status).toBe(1);
        expect(ts.status).toBe(py.status);
        expect(normTiming(ts.stdout)).toBe(normTiming(py.stdout));
        expect(ts.stderr).toBe(py.stderr);
    });

    it('argparse error (--bogus): exit 2, identical usage/error on stderr', () => {
        const py = spawnSync('python3', [PY_SCRIPT, '--bogus'], {
            encoding: 'utf8',
            cwd: REPO_ROOT,
        });
        const ts = spawnSync(TSX_BIN, [TS_SCRIPT, '--bogus'], { encoding: 'utf8', cwd: REPO_ROOT });
        expect(py.status).toBe(2);
        expect(ts.status).toBe(py.status);
        expect(ts.stdout).toBe(py.stdout);
        expect(ts.stderr).toBe(py.stderr);
    });

    it('write: byte-identical CAPABILITIES.yaml, zero drift after restore', () => {
        bak = fs.existsSync(OUT_PATH) ? fs.readFileSync(OUT_PATH, 'utf-8') : null;

        const py = spawnSync('python3', [PY_SCRIPT], { encoding: 'utf8', cwd: REPO_ROOT });
        expect(py.status).toBe(0);
        const pyOut = fs.readFileSync(OUT_PATH, 'utf-8');

        if (bak !== null) {
            fs.writeFileSync(OUT_PATH, bak, 'utf-8');
        }

        const ts = spawnSync(TSX_BIN, [TS_SCRIPT], { encoding: 'utf8', cwd: REPO_ROOT });
        expect(ts.status).toBe(0);
        const tsOut = fs.readFileSync(OUT_PATH, 'utf-8');

        expect(tsOut).toBe(pyOut);
        expect(normTiming(ts.stdout)).toBe(normTiming(py.stdout));
        expect(ts.stderr).toBe(py.stderr);
    });
});
