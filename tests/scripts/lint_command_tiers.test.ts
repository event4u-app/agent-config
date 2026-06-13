// Tests for src/scripts/lint_command_tiers.ts (py2ts Phase 4 / Wave 4b — VERIFY).
//
// Ports tests/test_lint_command_tiers.py 1:1 (clean pass, missing tier,
// invalid tier, empty dir, missing dir, AGENTS.md companions, real-repo pass)
// plus a golden-parity layer that runs python3 vs tsx on the REAL REPO
// (skipped without python3).
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import * as lct from '../../src/scripts/lint_command_tiers.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'lint_command_tiers.ts');
const PY_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'lint_command_tiers.py');
const REAL_COMMANDS_DIR = path.join(REPO_ROOT, '.agent-src.uncondensed', 'commands');
const TSX_BIN = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);

function hasPython3(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}

// Capture process.stdout / process.stderr writes (capsys equivalent).
function captureLint(fn: () => number): { rc: number; out: string; err: string } {
    let out = '';
    let err = '';
    const outSpy = vi
        .spyOn(process.stdout, 'write')
        .mockImplementation((chunk: string | Uint8Array): boolean => {
            out += typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8');
            return true;
        });
    const errSpy = vi
        .spyOn(process.stderr, 'write')
        .mockImplementation((chunk: string | Uint8Array): boolean => {
            err += typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8');
            return true;
        });
    try {
        const rc = fn();
        return { rc, out, err };
    } finally {
        outSpy.mockRestore();
        errSpy.mockRestore();
    }
}

describe('lint_command_tiers — ported pytest suite', () => {
    let tmp: string;
    beforeEach(() => {
        tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lct-'));
    });
    afterEach(() => {
        fs.rmSync(tmp, { recursive: true, force: true });
    });

    // ADR-092: commands now require a `visibility:` field consistent with the
    // `tier:` alias. The helper derives it from tier by default so existing
    // call sites stay valid; pass visibility=null to omit it, or a literal to
    // force a (possibly inconsistent) value. The `_DERIVE` sentinel mirrors the
    // Python helper's default.
    const DERIVE = Symbol('derive');
    const TIER_TO_VIS: Record<string, string> = { '0': 'visible', '1': 'advanced', '2': 'internal' };

    function writeCmd(
        root: string,
        rel: string,
        opts: {
            tier: string | null;
            name?: string | null;
            visibility?: string | null | typeof DERIVE;
        },
    ): string {
        let visibility: string | null | typeof DERIVE =
            opts.visibility === undefined ? DERIVE : opts.visibility;
        if (visibility === DERIVE) {
            visibility = TIER_TO_VIS[opts.tier ?? ''] ?? null;
        }
        const p = path.join(root, rel);
        fs.mkdirSync(path.dirname(p), { recursive: true });
        const lines = ['---'];
        if (opts.name !== undefined && opts.name !== null) {
            lines.push(`name: ${opts.name}`);
        }
        if (opts.tier !== null) {
            lines.push(`tier: ${opts.tier}`);
        }
        if (visibility !== null) {
            lines.push(`visibility: ${visibility}`);
        }
        lines.push('description: fixture command', '---', '', '# Fixture', '', 'Body.', '');
        fs.writeFileSync(p, lines.join('\n'), 'utf-8');
        return p;
    }

    it('test_clean_pass', () => {
        writeCmd(tmp, 'alpha.md', { tier: '0', name: 'alpha' });
        writeCmd(tmp, 'beta.md', { tier: '1', name: 'beta' });
        writeCmd(tmp, 'nested/gamma.md', { tier: '2', name: 'gamma' });
        const { rc, out } = captureLint(() => lct.lint(tmp));
        expect(rc).toBe(0);
        expect(out).toContain('3 commands');
    });

    it('test_missing_tier_fails', () => {
        writeCmd(tmp, 'good.md', { tier: '0', name: 'good' });
        writeCmd(tmp, 'bad.md', { tier: null, name: 'bad' });
        const { rc, err } = captureLint(() => lct.lint(tmp));
        expect(rc).toBe(1);
        expect(err).toContain('1 missing');
        expect(err).toContain('bad.md');
    });

    it('test_invalid_tier_fails', () => {
        writeCmd(tmp, 'good.md', { tier: '1', name: 'good' });
        writeCmd(tmp, 'wrong.md', { tier: '3', name: 'wrong' });
        writeCmd(tmp, 'alpha.md', { tier: 'critical', name: 'alpha' });
        const { rc, err } = captureLint(() => lct.lint(tmp));
        expect(rc).toBe(1);
        expect(err).toContain('2 invalid');
        expect(err).toContain('wrong.md');
        expect(err).toContain('alpha.md');
    });

    it('test_missing_visibility_fails', () => {
        // ADR-092: a valid tier but no visibility field must fail.
        writeCmd(tmp, 'good.md', { tier: '0', name: 'good' });
        writeCmd(tmp, 'bad.md', { tier: '2', name: 'bad', visibility: null });
        const { rc, err } = captureLint(() => lct.lint(tmp));
        expect(rc).toBe(1);
        expect(err).toContain('1 visibility');
        expect(err).toContain('missing visibility: bad.md');
    });

    it('test_visibility_tier_mismatch_fails', () => {
        // ADR-092: visibility must agree with the tier alias when both are set.
        writeCmd(tmp, 'good.md', { tier: '0', name: 'good' });
        writeCmd(tmp, 'wrong.md', { tier: '0', name: 'wrong', visibility: 'internal' });
        const { rc, err } = captureLint(() => lct.lint(tmp));
        expect(rc).toBe(1);
        expect(err).toContain('disagrees with tier');
        expect(err).toContain('wrong.md');
    });

    it('test_invalid_visibility_fails', () => {
        writeCmd(tmp, 'good.md', { tier: '1', name: 'good' });
        writeCmd(tmp, 'bad.md', { tier: '1', name: 'bad', visibility: 'hidden' });
        const { rc, err } = captureLint(() => lct.lint(tmp));
        expect(rc).toBe(1);
        expect(err).toContain("invalid visibility 'hidden'");
    });

    it('test_empty_dir_fails', () => {
        fs.mkdirSync(path.join(tmp, 'commands'));
        const { rc, err } = captureLint(() => lct.lint(path.join(tmp, 'commands')));
        expect(rc).toBe(1);
        expect(err).toContain('no commands found');
    });

    it('test_missing_dir_fails', () => {
        const { rc, err } = captureLint(() => lct.lint(path.join(tmp, 'does-not-exist')));
        expect(rc).toBe(1);
        expect(err).toContain('no commands dir');
    });

    it('test_agents_md_companions_ignored', () => {
        writeCmd(tmp, 'AGENTS.md', { tier: null, name: null });
        writeCmd(tmp, 'real.md', { tier: '2', name: 'real' });
        const { rc, out } = captureLint(() => lct.lint(tmp));
        expect(rc).toBe(0);
        expect(out).toContain('1 commands');
    });

    // Mirrors the Python @pytest.mark.skipif(not REAL_COMMANDS_DIR.is_dir()).
    // The legacy .agent-src.uncondensed/ tree is dead post-ADR-051 and absent
    // in CI (Python skips there). Guard additionally on the dir being NON-EMPTY:
    // both impls return rc=1 ("no commands found") on an empty dir, so a stray
    // empty leftover must skip, not fail — this is a real command tree or nothing.
    const realCommandsPopulated =
        fs.existsSync(REAL_COMMANDS_DIR) &&
        fs.readdirSync(REAL_COMMANDS_DIR).some((f) => f.endsWith('.md'));
    it.skipIf(!realCommandsPopulated)('test_real_repo_passes', () => {
        const { rc } = captureLint(() => lct.lint(REAL_COMMANDS_DIR, true));
        expect(rc).toBe(0);
    });
});

// --- Golden parity on the REAL REPO -----------------------------------------

const py3 = hasPython3();

describe.skipIf(!py3)('lint_command_tiers — golden parity (python3 vs tsx)', () => {
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

    it('matches the --quiet run byte-for-byte (real CI invocation)', () => {
        const py = runPy(['--quiet']);
        const ts = runTs(['--quiet']);
        expect(ts.stdout).toBe(py.stdout);
        expect(ts.stderr).toBe(py.stderr);
        expect(ts.status).toBe(py.status);
    });
});
