// Tests for src/scripts/lint_command_tiers.ts (py2ts Phase 4 / Wave 4b — VERIFY).
//
// Ported from tests/test_lint_command_tiers.py (clean pass, missing/invalid
// value, empty dir, missing dir, AGENTS.md companions, real-repo pass). The
// cases that pinned the integer `tier:` alias — missing tier, invalid tier,
// tier↔visibility mismatch — were REPLACED when road-to-tier-removal Phase 4
// dropped the alias; `visibility:` is the only key this linter checks now, and
// `test_stray_tier_key_is_not_this_linters_business` pins that boundary.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import * as lct from '../../src/scripts/lint_command_tiers.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const REAL_COMMANDS_DIR = path.join(REPO_ROOT, '.agent-src.uncondensed', 'commands');


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

    // `visibility:` is the only classifier since road-to-tier-removal Phase 4.
    // `tier` survives here as an opt-in fixture knob for exactly one test — the
    // stray-key boundary case — and is omitted everywhere else.
    function writeCmd(
        root: string,
        rel: string,
        opts: {
            visibility?: string | null;
            name?: string | null;
            tier?: string;
        },
    ): string {
        const visibility = opts.visibility === undefined ? 'internal' : opts.visibility;
        const p = path.join(root, rel);
        fs.mkdirSync(path.dirname(p), { recursive: true });
        const lines = ['---'];
        if (opts.name !== undefined && opts.name !== null) {
            lines.push(`name: ${opts.name}`);
        }
        if (opts.tier !== undefined) {
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
        writeCmd(tmp, 'alpha.md', { visibility: 'visible', name: 'alpha' });
        writeCmd(tmp, 'beta.md', { visibility: 'advanced', name: 'beta' });
        writeCmd(tmp, 'nested/gamma.md', { visibility: 'internal', name: 'gamma' });
        const { rc, out } = captureLint(() => lct.lint(tmp));
        expect(rc).toBe(0);
        expect(out).toContain('3 commands');
    });

    it('test_missing_visibility_fails', () => {
        writeCmd(tmp, 'good.md', { visibility: 'visible', name: 'good' });
        writeCmd(tmp, 'bad.md', { visibility: null, name: 'bad' });
        const { rc, err } = captureLint(() => lct.lint(tmp));
        expect(rc).toBe(1);
        expect(err).toContain('1 visibility');
        expect(err).toContain('missing visibility: bad.md');
    });

    it('test_invalid_visibility_fails', () => {
        writeCmd(tmp, 'good.md', { visibility: 'advanced', name: 'good' });
        writeCmd(tmp, 'wrong.md', { visibility: 'hidden', name: 'wrong' });
        writeCmd(tmp, 'alpha.md', { visibility: '2', name: 'alpha' });
        const { rc, err } = captureLint(() => lct.lint(tmp));
        expect(rc).toBe(1);
        // Both bad files are counted and named; the old integer value '2' is a
        // plain invalid visibility now, not a tier that happens to parse.
        expect(err).toContain('2 visibility');
        expect(err).toContain("invalid visibility 'hidden': wrong.md");
        expect(err).toContain("invalid visibility '2': alpha.md");
    });

    it('test_stray_tier_key_is_not_this_linters_business', () => {
        // road-to-tier-removal Phase 4: the tier↔visibility consistency clause
        // is gone. A leftover `tier:` — even one contradicting `visibility:` —
        // is rejected by command.schema.json (`additionalProperties: false`),
        // NOT reconciled here. This linter reads visibility and nothing else.
        writeCmd(tmp, 'stray.md', { visibility: 'internal', name: 'stray', tier: '0' });
        const { rc, err } = captureLint(() => lct.lint(tmp));
        expect(rc).toBe(0);
        expect(err).toBe('');
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
        writeCmd(tmp, 'AGENTS.md', { visibility: null, name: null });
        writeCmd(tmp, 'real.md', { visibility: 'internal', name: 'real' });
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

