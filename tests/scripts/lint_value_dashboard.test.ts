// Tests for src/scripts/lint_value_dashboard.ts (py2ts Phase 4 / Wave 4b — VERIFY).
//
// No pytest suite exists. Coverage: constants + check_required_sections /
// check_canonical_rung_set unit checks (byte-identical violation strings), and
// a golden-parity layer (python3 vs tsx on the REAL REPO across default +
// --quiet) asserting byte-identical stdout/stderr/exit. Skipped without python3.
// CI invocation is `lint_value_dashboard --quiet`.
import { spawnSync } from 'node:child_process';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import * as mod from '../../src/scripts/lint_value_dashboard.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'lint_value_dashboard.ts');
const PY_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'lint_value_dashboard.py');
const TSX_BIN = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);

function hasPython3(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}

describe('lint_value_dashboard — constants + checks', () => {
    it('CANONICAL_RUNG_IDS holds the six canonical rungs in order', () => {
        expect([...mod.CANONICAL_RUNG_IDS]).toEqual([
            'baseline',
            'load',
            'thin',
            'condense',
            'rtk',
            'terse',
        ]);
    });

    it('check_required_sections flags every missing section', () => {
        const out = mod.check_required_sections('');
        // REQUIRED_SECTIONS = 6 entries.
        expect(out.length).toBe(mod.REQUIRED_SECTIONS.length);
        expect(out[0]).toBe("missing required section: '# Value Dashboard'");
    });

    it('check_required_sections passes when all sections present', () => {
        const text = mod.REQUIRED_SECTIONS.join('\n');
        expect(mod.check_required_sections(text)).toEqual([]);
    });

    it('check_canonical_rung_set flags a wrong rung set', () => {
        const out = mod.check_canonical_rung_set({ cost_ladder: [{ id: 'baseline' }] });
        expect(out.length).toBe(1);
        expect(out[0]).toContain('cost_ladder rung ids must be');
    });
});

const py3 = hasPython3();

describe.skipIf(!py3)('lint_value_dashboard — golden parity (python3 vs tsx)', () => {
    const runPy = (args: readonly string[]) =>
        spawnSync('python3', [PY_SCRIPT, ...args], { cwd: REPO_ROOT, encoding: 'utf8' });
    const runTs = (args: readonly string[]) =>
        spawnSync(TSX_BIN, [TS_SCRIPT, ...args], { cwd: REPO_ROOT, encoding: 'utf8' });

    for (const args of [[], ['--quiet']]) {
        it(`matches \`${args.join(' ') || '(default)'}\` byte-for-byte`, () => {
            const py = runPy(args);
            const ts = runTs(args);
            expect(ts.stdout).toBe(py.stdout);
            expect(ts.stderr).toBe(py.stderr);
            expect(ts.status).toBe(py.status);
        });
    }
});
