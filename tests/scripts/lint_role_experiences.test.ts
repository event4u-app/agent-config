// Tests for src/scripts/lint_role_experiences.ts (py2ts Phase 4 / Wave 4b).
//
// Layer 1: 1:1 port of tests/test_lint_role_experiences.py — the two-tier
//   beta gate (beta/stable require a non-null recruit_session_ref;
//   draft/beta-internal may keep it null; unknown status rejected). Each
//   pytest builds a self-contained role dir under tmp and calls lint_role
//   with an empty known-skills set, asserting on the failures list.
// Layer 2: golden parity on the REAL REPO — python3 vs tsx, byte-identical
//   stdout/stderr/exit (skipped without python3). Includes the
//   --plain-language scan, the linter's real CI invocation.
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import * as lre from '../../src/scripts/lint_role_experiences.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'lint_role_experiences.ts');
const PY_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'lint_role_experiences.py');
const TSX_BIN = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);

function hasPython3(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}

// --- Layer 1: 1:1 port of tests/test_lint_role_experiences.py --------------

const _BODY = `
# Role experience — Test

> Scaffold.

## Three first tasks

1. **Task one** — does a thing.
2. **Task two** — does another.
3. **Task three** — does a third.
`;

let tmp: string;
beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lre-'));
});
afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
});

function makeRole(status: string, ref: string | null): string {
    const role = path.join(tmp, 'testrole');
    fs.mkdirSync(path.join(role, 'prompts'), { recursive: true });
    const refLine = ref === null ? 'null' : ref;
    const fm =
        '---\n' +
        'role: testrole\n' +
        'display_name: Test\n' +
        'tagline: t\n' +
        'recommended_packs: [core]\n' +
        'install_path_hint: x\n' +
        `recruit_session_ref: ${refLine}\n` +
        `status: ${status}\n` +
        '---\n';
    fs.writeFileSync(path.join(role, 'index.md'), fm + _BODY);
    fs.writeFileSync(path.join(role, 'skills.yml'), 'skills: []\n');
    for (let i = 0; i < 5; i++) {
        fs.writeFileSync(
            path.join(role, 'prompts', `p${i}.md`),
            '---\nname: p\nintent: i\ninputs: x\noutput_shape: y\nskill_hint: z\n---\nbody\n',
        );
    }
    return role;
}

function lint(role: string): string[] {
    const failures: string[] = [];
    lre.lint_role(role, new Set<string>(), failures);
    return failures;
}

describe('lint_role_experiences — status coupling (port of pytest)', () => {
    it('beta-internal with null ref passes', () => {
        expect(lint(makeRole('beta-internal', null))).toEqual([]);
    });
    it('draft with null ref passes', () => {
        expect(lint(makeRole('draft', null))).toEqual([]);
    });
    it('beta with null ref fails', () => {
        expect(lint(makeRole('beta', null)).some((f) => f.includes('recruit_session_ref'))).toBe(
            true,
        );
    });
    it('stable with null ref fails', () => {
        expect(lint(makeRole('stable', null)).some((f) => f.includes('recruit_session_ref'))).toBe(
            true,
        );
    });
    it('beta with ref passes', () => {
        expect(lint(makeRole('beta', 'agents/recruit-sessions/01-x.md'))).toEqual([]);
    });
    it('unknown status fails', () => {
        expect(lint(makeRole('gamma', null)).some((f) => f.includes('not in'))).toBe(true);
    });
});

// --- Layer 2: golden parity on the REAL REPO -------------------------------

const py3 = hasPython3();

describe.skipIf(!py3)('lint_role_experiences — golden parity (python3 vs tsx)', () => {
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
    it('--plain-language (real CI invocation) matches byte-for-byte', () =>
        same(['--plain-language']));
});
