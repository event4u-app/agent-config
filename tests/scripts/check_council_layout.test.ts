// Tests for src/scripts/check_council_layout.ts (py2ts Phase 4 / Wave 4c).
//
// No pytest suite exists. Focused differential suite over find_violations()
// against a temp `agents/` tree (cwd-relative AGENTS_ROOT), plus golden
// parity on the REAL REPO (skipped without python3).
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import * as mod from '../../src/scripts/check_council_layout.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'check_council_layout.ts');
const PY_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'check_council_layout.py');
const TSX_BIN = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);

function hasPython3(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}

function write(p: string, content = ''): void {
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, content, 'utf-8');
}

describe('check_council_layout — find_violations', () => {
    let tmp: string;
    beforeEach(() => {
        tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cl-'));
    });
    afterEach(() => {
        fs.rmSync(tmp, { recursive: true, force: true });
    });

    it('clean canonical layout has no violations', () => {
        write(path.join(tmp, 'runtime/council/questions/topic.md'));
        write(path.join(tmp, 'runtime/council/responses/topic.json'));
        write(path.join(tmp, 'runtime/council/sessions/2026.json'));
        expect(mod.find_violations(tmp)).toEqual([]);
    });

    it('stray council artefact at agents/ root is flagged', () => {
        write(path.join(tmp, 'council-foo.md'));
        const v = mod.find_violations(tmp);
        expect(v.length).toBe(1);
        expect(v[0]).toContain('council artefact at agents/ root');
    });

    it('council artefact in non-canonical subdir is flagged', () => {
        write(path.join(tmp, 'misc/council-bar.json'));
        const v = mod.find_violations(tmp);
        expect(v.length).toBe(1);
        expect(v[0]).toContain('non-canonical directory');
        expect(v[0]).toContain('agents/misc/');
    });

    it('audits/ and runtime/ top-level subdirs are exempt', () => {
        write(path.join(tmp, 'audits/2026/council-x.md'));
        write(path.join(tmp, 'runtime/scratch/council-y.json'));
        expect(mod.find_violations(tmp)).toEqual([]);
    });

    it('road-to-ai-council.md is not a council artefact (no council- prefix)', () => {
        expect(mod.is_council_artefact('road-to-ai-council.md')).toBe(false);
        expect(mod.is_council_artefact('council-x.md')).toBe(true);
        expect(mod.is_council_artefact('.council-x.md')).toBe(true);
    });
});

const py3 = hasPython3();

describe.skipIf(!py3)('check_council_layout — golden parity (python3 vs tsx)', () => {
    for (const args of [[], ['--quiet']] as const) {
        it(`matches byte-for-byte: ${args.join(' ') || '(no args)'}`, () => {
            const py = spawnSync('python3', [PY_SCRIPT, ...args], { cwd: REPO_ROOT, encoding: 'utf8' });
            const ts = spawnSync(TSX_BIN, [TS_SCRIPT, ...args], { cwd: REPO_ROOT, encoding: 'utf8' });
            expect(ts.stdout).toBe(py.stdout);
            expect(ts.stderr).toBe(py.stderr);
            expect(ts.status).toBe(py.status);
        });
    }
});
