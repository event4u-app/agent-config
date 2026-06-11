// Tests for src/scripts/lint_roadmap_complexity.ts (py2ts Phase 4 / Wave 4b).
//
// No pytest suite exists for this module. This is a focused differential
// suite over the public helpers (frontmatter slice, complexity tag,
// per-roadmap lint of lightweight caps + plate detection) plus a
// golden-parity layer that runs python3 vs tsx on the REAL REPO,
// byte-identical stdout + stderr + exit (skipped without python3).
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import * as mod from '../../src/scripts/lint_roadmap_complexity.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'lint_roadmap_complexity.ts');
const PY_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'lint_roadmap_complexity.py');
const TSX_BIN = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);

function hasPython3(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}

describe('lint_roadmap_complexity — behavioural spec', () => {
    let tmp: string;
    beforeEach(() => {
        tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lrc-'));
    });
    afterEach(() => {
        fs.rmSync(tmp, { recursive: true, force: true });
    });

    function write(content: string): string {
        const p = path.join(tmp, 'road.md');
        fs.writeFileSync(p, content, 'utf-8');
        return p;
    }

    it('_frontmatter extracts the leading --- block', () => {
        expect(mod._frontmatter('---\ncomplexity: lightweight\n---\nbody\n')).toBe(
            'complexity: lightweight',
        );
        expect(mod._frontmatter('no frontmatter\n')).toBe('');
    });

    it('_read_complexity reads the tag', () => {
        expect(mod._read_complexity('complexity: structural')).toBe('structural');
        expect(mod._read_complexity('complexity: lightweight')).toBe('lightweight');
        expect(mod._read_complexity('other: x')).toBeNull();
    });

    it('flags a missing complexity tag', () => {
        const p = write('---\nname: x\n---\nbody\n');
        expect(mod.lint_roadmap(p, 0)).toEqual([
            "missing 'complexity:' frontmatter (must declare 'lightweight' or 'structural')",
        ]);
    });

    it('lightweight: flags exceeding the phase cap', () => {
        const phases = Array.from({ length: 7 }, (_, i) => `## Phase ${i + 1}\n\nx\n`).join('');
        const p = write(`---\ncomplexity: lightweight\n---\n${phases}`);
        const problems = mod.lint_roadmap(p, 0);
        expect(problems.some((x) => x.includes('lightweight phase cap exceeded: 7 phases'))).toBe(
            true,
        );
    });

    it('lightweight: flags a Council Round block', () => {
        const p = write('---\ncomplexity: lightweight\n---\n## Council Round 1\n\nx\n');
        const problems = mod.lint_roadmap(p, 0);
        expect(problems.some((x) => x.includes("contains '## Council Round N'"))).toBe(true);
    });

    it('structural: no caps, but plate framing flagged when horizon_weeks=0', () => {
        const p = write('---\ncomplexity: structural\n---\n## Horizon\n\nwork\n');
        const problems = mod.lint_roadmap(p, 0);
        expect(problems.some((x) => x.includes('plate/horizon convention detected'))).toBe(true);
    });

    it('structural: plate framing allowed when horizon_weeks>0', () => {
        const p = write('---\ncomplexity: structural\n---\n## Horizon\n\nwork\n');
        expect(mod.lint_roadmap(p, 4)).toEqual([]);
    });
});

// --- Golden parity on the REAL REPO -----------------------------------------

const py3 = hasPython3();

describe.skipIf(!py3)('lint_roadmap_complexity — golden parity (python3 vs tsx)', () => {
    function runPy(args: readonly string[]) {
        return spawnSync('python3', [PY_SCRIPT, ...args], { cwd: REPO_ROOT, encoding: 'utf8' });
    }
    function runTs(args: readonly string[]) {
        return spawnSync(TSX_BIN, [TS_SCRIPT, ...args], { cwd: REPO_ROOT, encoding: 'utf8' });
    }

    it('matches the default (no-flag) run byte-for-byte', () => {
        const py = runPy([]);
        const ts = runTs([]);
        expect(ts.stdout).toBe(py.stdout);
        expect(ts.stderr).toBe(py.stderr);
        expect(ts.status).toBe(py.status);
    });

    it('matches --quiet byte-for-byte (real CI invocation)', () => {
        const py = runPy(['--quiet']);
        const ts = runTs(['--quiet']);
        expect(ts.stdout).toBe(py.stdout);
        expect(ts.stderr).toBe(py.stderr);
        expect(ts.status).toBe(py.status);
    });
});
