// Tests for src/scripts/audit_user_type_axis.ts (py2ts Phase 8 / Wave 8a).
//
// No pytest suite exists, so this is a focused differential suite over the
// report renderer (_render_report orphan / unused / coverage-matrix shaping)
// plus a golden-parity layer that runs python3 vs tsx on the REAL repo for
// both the default and --quiet surfaces, comparing stdout, exit code, AND the
// byte-exact written report via a snapshot+restore harness (skipped without
// python3). The writer must leave zero on-disk drift.
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

import * as uta from '../../src/scripts/audit_user_type_axis.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'audit_user_type_axis.ts');
const PY_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'audit_user_type_axis.py');
const REPORT_PATH = path.join(REPO_ROOT, 'agents', 'reports', 'user-type-axis-audit.md');
const TSX_BIN = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);

function hasPython3(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}

describe('audit_user_type_axis — _render_report', () => {
    it('renders the coverage matrix with a sorted union of declared + used values', () => {
        const declared = new Set(['founder', 'dev']);
        const byValue = new Map<string, string[]>([
            ['dev', ['.agent-src.uncondensed/skills/a/SKILL.md']],
            ['ghost', ['.agent-src.uncondensed/skills/b/SKILL.md']], // orphan
        ]);
        const orphans = new Set(['ghost']);
        const unused = new Set(['founder']);
        const out = uta._render_report(declared, byValue, orphans, unused);
        expect(out).toContain('- Declared user-types (`user-types/*.yml`): **2**');
        expect(out).toContain('- Orphans (FATAL): **1**');
        expect(out).toContain('- Unused configs (WARN): **1**');
        // sorted union: dev, founder, ghost
        const devIdx = out.indexOf('| `dev` |');
        const founderIdx = out.indexOf('| `founder` |');
        const ghostIdx = out.indexOf('| `ghost` |');
        expect(devIdx).toBeGreaterThan(-1);
        expect(devIdx).toBeLessThan(founderIdx);
        expect(founderIdx).toBeLessThan(ghostIdx);
        // orphan flagged
        expect(out).toContain('| `ghost` | **no (orphan)** | 1 |');
        // orphan + unused sections present
        expect(out).toContain('## Orphans');
        expect(out).toContain('- `ghost` — referenced by:');
        expect(out).toContain('## Unused configs (WARN)');
        expect(out).toContain('- `user-types/founder.yml` has no consuming skill yet.');
    });
    it('omits the Orphans / Unused sections when both are empty', () => {
        const out = uta._render_report(new Set(['dev']), new Map([['dev', ['x/SKILL.md']]]), new Set(), new Set());
        expect(out).not.toContain('## Orphans');
        expect(out).not.toContain('## Unused configs');
    });
});

describe.runIf(hasPython3())('audit_user_type_axis — golden parity (python3 vs tsx)', () => {
    let reportBak: string | null = null;

    afterEach(() => {
        if (reportBak !== null) {
            fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
            fs.writeFileSync(REPORT_PATH, reportBak, 'utf-8');
            reportBak = null;
        }
    });

    for (const args of [[], ['--quiet']]) {
        it(`identical stdout + exit + report bytes for: ${args.join(' ') || '(default)'}`, () => {
            reportBak = fs.existsSync(REPORT_PATH) ? fs.readFileSync(REPORT_PATH, 'utf-8') : null;

            const py = spawnSync('python3', [PY_SCRIPT, ...args], { encoding: 'utf8', cwd: REPO_ROOT });
            const pyReport = fs.readFileSync(REPORT_PATH, 'utf-8');

            // reset to original before TS run
            if (reportBak !== null) fs.writeFileSync(REPORT_PATH, reportBak, 'utf-8');

            const ts = spawnSync(TSX_BIN, [TS_SCRIPT, ...args], { encoding: 'utf8', cwd: REPO_ROOT });
            const tsReport = fs.readFileSync(REPORT_PATH, 'utf-8');

            expect(ts.status).toBe(py.status);
            expect(ts.stdout).toBe(py.stdout);
            expect(ts.stderr).toBe(py.stderr);
            expect(tsReport).toBe(pyReport);
        });
    }
});
