// Tests for src/scripts/check_public_links.ts (py2ts Phase 4 / Wave 4c).
//
// No pytest suite exists for this module, so this is a focused differential
// suite over the public behaviour (read_stability, scan_file, resolve)
// plus a golden-parity layer that runs python3 vs tsx on the REAL REPO
// (skipped without python3).
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import * as cpl from '../../src/scripts/check_public_links.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'check_public_links.ts');
const PY_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'check_public_links.py');
const TSX_BIN = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);

function hasPython3(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}

function write(p: string, content: string): void {
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, content, 'utf-8');
}

describe('check_public_links — behavioural spec', () => {
    let tmp: string;
    beforeEach(() => {
        tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cpl-'));
    });
    afterEach(() => {
        fs.rmSync(tmp, { recursive: true, force: true });
    });

    it('read_stability extracts the frontmatter level', () => {
        const p = path.join(tmp, 'c.md');
        write(p, '---\nstability: beta\nfoo: bar\n---\n\nbody\n');
        expect(cpl.read_stability(p)).toBe('beta');
    });

    it('read_stability returns null with no frontmatter', () => {
        const p = path.join(tmp, 'c.md');
        write(p, 'no frontmatter here\n');
        expect(cpl.read_stability(p)).toBeNull();
    });

    it('read_stability returns null when stability key absent', () => {
        const p = path.join(tmp, 'c.md');
        write(p, '---\nfoo: bar\n---\n\nbody\n');
        expect(cpl.read_stability(p)).toBeNull();
    });

    it('read_stability returns null for a missing file', () => {
        expect(cpl.read_stability(path.join(tmp, 'nope.md'))).toBeNull();
    });

    it('resolve drops external / anchor-only hrefs', () => {
        expect(cpl.resolve('README.md', 'https://example.com')).toBeNull();
        expect(cpl.resolve('README.md', 'mailto:x@y.z')).toBeNull();
        expect(cpl.resolve('README.md', '#section')).toBeNull();
    });

    it('resolve strips a trailing anchor from a real link', () => {
        // README.md is at repo root → docs/contracts/foo.md resolves cleanly.
        expect(cpl.resolve('README.md', 'docs/contracts/foo.md#x')).toBe('docs/contracts/foo.md');
    });

    it('resolve treats a leading-slash href as repo-relative', () => {
        expect(cpl.resolve('README.md', '/docs/contracts/foo.md')).toBe('docs/contracts/foo.md');
    });
});

// --- Golden parity on the REAL REPO -----------------------------------------

const py3 = hasPython3();

describe.skipIf(!py3)('check_public_links — golden parity (python3 vs tsx)', () => {
    function runPy(args: readonly string[]) {
        return spawnSync('python3', [PY_SCRIPT, ...args], { cwd: REPO_ROOT, encoding: 'utf8' });
    }
    function runTs(args: readonly string[]) {
        return spawnSync(TSX_BIN, [TS_SCRIPT, ...args], { cwd: REPO_ROOT, encoding: 'utf8' });
    }

    for (const args of [[], ['--list'], ['--json'], ['--strict']] as const) {
        it(`matches byte-for-byte: ${args.join(' ') || '(no args)'}`, () => {
            const py = runPy(args);
            const ts = runTs(args);
            expect(ts.stdout).toBe(py.stdout);
            expect(ts.stderr).toBe(py.stderr);
            expect(ts.status).toBe(py.status);
        });
    }
});
