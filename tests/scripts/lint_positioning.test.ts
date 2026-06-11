// Tests for src/scripts/lint_positioning.ts (py2ts Phase 4 / Wave 4b — VERIFY).
//
// No pytest suite exists. Coverage: constants + _topic_present spot-checks, and
// a golden-parity layer (python3 vs tsx on the REAL REPO across default +
// --quiet) asserting byte-identical stdout/stderr/exit. Skipped without python3.
// CI invocation is `lint_positioning --quiet`.
import { spawnSync } from 'node:child_process';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import * as mod from '../../src/scripts/lint_positioning.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'lint_positioning.ts');
const PY_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'lint_positioning.py');
const TSX_BIN = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);

function hasPython3(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}

describe('lint_positioning — constants + _topic_present', () => {
    it('DESCRIPTION_MAX is 200', () => {
        expect(mod.DESCRIPTION_MAX).toBe(200);
    });

    it('_topic_present matches a hyphen→space paraphrase', () => {
        const [present, needle] = mod._topic_present('ai agent os is here', 'ai-agent-os', {});
        expect(present).toBe(true);
        expect(needle).toBe('ai agent os');
    });

    it('_topic_present honours the equivalents map', () => {
        const [present, needle] = mod._topic_present('we ship an agent operating system', 'ai-agent-os', {
            'ai-agent-os': ['agent operating system'],
        });
        expect(present).toBe(true);
        expect(needle).toBe('agent operating system');
    });

    it('_topic_present returns false + null when absent', () => {
        const [present, needle] = mod._topic_present('nothing relevant', 'blockchain', {});
        expect(present).toBe(false);
        expect(needle).toBeNull();
    });
});

const py3 = hasPython3();

describe.skipIf(!py3)('lint_positioning — golden parity (python3 vs tsx)', () => {
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
