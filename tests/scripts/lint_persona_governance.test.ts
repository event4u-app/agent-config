// Tests for src/scripts/lint_persona_governance.ts (py2ts Phase 4 / Wave 4b).
//
// No tests/test_lint_persona_governance.py exists. This is a focused
// differential suite over the exported pure helpers (parse_frontmatter,
// DOMAIN_MAP, PER_DOMAIN_CAP) plus a golden-parity layer running python3 vs
// tsx on the REAL REPO (the linter's real CI invocation), skipped without
// python3.
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import * as pg from '../../src/scripts/lint_persona_governance.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'lint_persona_governance.ts');
const PY_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'lint_persona_governance.py');
const TSX_BIN = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);

function hasPython3(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}

describe('lint_persona_governance — domain map', () => {
    it('keeps the per-domain cap at 2', () => {
        expect(pg.PER_DOMAIN_CAP).toBe(2);
    });
    it('maps the two ai-video specialists to ai-video', () => {
        expect(pg.DOMAIN_MAP['hollywood-director']).toBe('ai-video');
        expect(pg.DOMAIN_MAP['ai-video-technical-director']).toBe('ai-video');
    });
    it('leaves cross-cutting personas out of the map', () => {
        expect(pg.DOMAIN_MAP['qa']).toBeUndefined();
    });
});

describe('lint_persona_governance.parse_frontmatter', () => {
    let tmp: string;
    beforeEach(() => {
        tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pg-'));
    });
    afterEach(() => {
        fs.rmSync(tmp, { recursive: true, force: true });
    });

    it('parses scalar keys, stripping quotes', () => {
        const p = path.join(tmp, 'persona.md');
        fs.writeFileSync(p, '---\nid: "cmo"\ntier: \'specialist\'\nstatus: active\n---\nbody\n');
        expect(pg.parse_frontmatter(p)).toEqual({ id: 'cmo', tier: 'specialist', status: 'active' });
    });
    it('returns {} when there is no frontmatter', () => {
        const p = path.join(tmp, 'persona.md');
        fs.writeFileSync(p, 'no frontmatter\n');
        expect(pg.parse_frontmatter(p)).toEqual({});
    });
});

// --- Golden parity on the REAL REPO ----------------------------------------

const py3 = hasPython3();

describe.skipIf(!py3)('lint_persona_governance — golden parity (python3 vs tsx)', () => {
    function runPy(args: readonly string[]) {
        return spawnSync('python3', [PY_SCRIPT, ...args], { cwd: REPO_ROOT, encoding: 'utf8' });
    }
    function runTs(args: readonly string[]) {
        return spawnSync(TSX_BIN, [TS_SCRIPT, ...args], { cwd: REPO_ROOT, encoding: 'utf8' });
    }
    function same(args: readonly string[]): void {
        const py = runPy(args);
        const ts = runTs(args);
        expect(ts.stdout).toBe(py.stdout);
        expect(ts.stderr).toBe(py.stderr);
        expect(ts.status).toBe(py.status);
    }

    it('default run matches byte-for-byte', () => same([]));
    it('--quiet (real CI invocation) matches byte-for-byte', () => same(['--quiet']));
});
