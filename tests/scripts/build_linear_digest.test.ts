// Tests for src/scripts/build_linear_digest.ts (py2ts Phase 8 / Wave 8b).
//
// Ports tests/test_build_linear_digest.py 1:1 (pure transforms, end-to-end
// build, strict-missing drift, missing-rule) plus a golden-parity layer that
// builds both python3 and tsx into tmp out-dirs over the REAL rule source and
// asserts byte-identical digest files + console output (skipped without
// python3).
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import * as bld from '../../src/scripts/build_linear_digest.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'build_linear_digest.ts');
const PY_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'build_linear_digest.py');
const TSX_BIN = path.join(REPO_ROOT, 'node_modules', '.bin', process.platform === 'win32' ? 'tsx.cmd' : 'tsx');

function hasPython3(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}

const LINEAR_PER_FIELD_BUDGET = 100_000;

let tmp: string;
beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'linear-digest-'));
});
afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
    // restore the module-level lists in case a test mutated them
    bld._setConfigForTest({ WORKSPACE: bld.WORKSPACE, TEAM: bld.TEAM, PERSONAL: bld.PERSONAL });
});

describe('build_linear_digest — pure transforms', () => {
    it('strip_frontmatter removes the yaml block', () => {
        const out = bld.strip_frontmatter('---\ntype: "always"\nalwaysApply: true\n---\n\n# Heading\nbody\n');
        expect(out.startsWith('# Heading')).toBe(true);
        expect(out).not.toContain('alwaysApply');
    });
    it('demote_h1 only the first heading', () => {
        const out = bld.demote_h1('# Title\n\nbody\n\n# Other H1 should stay\n');
        expect(out.startsWith('## Title')).toBe(true);
        expect(out).toContain('\n# Other H1 should stay');
    });
    it('normalize_links strips internal paths', () => {
        const out = bld.normalize_links('See [scope-control](../rules/scope-control.md) and [docs](docs/x.md).');
        expect(out).toBe('See scope-control and docs.');
    });
    it('normalize_links preserves external urls', () => {
        const out = bld.normalize_links('Read [the spec](https://example.com/spec) and [local](./x.md).');
        expect(out).toContain('[the spec](https://example.com/spec)');
        expect(out).not.toContain('[local](./x.md)');
        expect(out).toContain('local');
    });
    it('strip_section removes named h2', () => {
        const text = '# Title\n\n## Keep this\n\nBody A\n\n## Drop this\n\nBody B\n\n## Keep that\n\nBody C\n';
        const [out, found] = bld.strip_section(text, 'Drop this');
        expect(found).toBe(true);
        expect(out).not.toContain('Body B');
        expect(out).toContain('Body A');
        expect(out).toContain('Body C');
    });
    it('strip_section returns false on unknown title', () => {
        const text = '## Real section\n\nbody\n';
        const [out, found] = bld.strip_section(text, 'Nonexistent');
        expect(found).toBe(false);
        expect(out).toBe(text);
    });
});

describe('build_linear_digest — end-to-end build', () => {
    it('default build emits three files', () => {
        const rc = bld.main(['--out-dir', tmp]);
        expect(rc).toBe(0);
        for (const layer of ['workspace', 'team', 'personal']) {
            const f = path.join(tmp, `${layer}.md`);
            expect(fs.statSync(f).isFile()).toBe(true);
            expect(fs.statSync(f).size).toBeGreaterThan(0);
        }
    });
    it('workspace digest under linear field budget', () => {
        const rc = bld.main(['--out-dir', tmp, '--max-bytes', String(LINEAR_PER_FIELD_BUDGET)]);
        expect(rc).toBe(0);
    });
    it('team and personal far under budget', () => {
        bld.main(['--out-dir', tmp]);
        const teamSize = fs.statSync(path.join(tmp, 'team.md')).size;
        const personalSize = fs.statSync(path.join(tmp, 'personal.md')).size;
        expect(teamSize).toBeLessThan(30_000);
        expect(personalSize).toBeLessThan(5_000);
    });
    it('no internal markdown links survive', () => {
        bld.main(['--out-dir', tmp]);
        const text = fs.readFileSync(path.join(tmp, 'workspace.md'), 'utf-8');
        const leaks = [...text.matchAll(/\[[^\]]+\]\((?!https?:\/\/)[^)]+\)/g)].map((m) => m[0]);
        expect(leaks).toEqual([]);
    });
    it('strict-missing flags drift → exit 4', () => {
        bld._setConfigForTest({
            WORKSPACE: [bld.RuleEntry('ask-when-uncertain', 'degraded', ['NoSuchSectionEverExists'])],
            TEAM: [],
            PERSONAL: [],
        });
        const rc = bld.main(['--out-dir', tmp, '--strict-missing']);
        expect(rc).toBe(4);
    });
    it('missing rule file returns 3', () => {
        bld._setConfigForTest({ WORKSPACE: [bld.RuleEntry('does-not-exist')], TEAM: [], PERSONAL: [] });
        const rc = bld.main(['--out-dir', tmp]);
        expect(rc).toBe(3);
    });
});

describe.runIf(hasPython3())('build_linear_digest — golden parity (python3 vs tsx)', () => {
    it('byte-identical digests + console output over the real rule source', () => {
        const pyd = fs.mkdtempSync(path.join(os.tmpdir(), 'ld-py-'));
        const tsd = fs.mkdtempSync(path.join(os.tmpdir(), 'ld-ts-'));
        try {
            const py = spawnSync('python3', [PY_SCRIPT, '--out-dir', pyd], { encoding: 'utf8', cwd: REPO_ROOT });
            const ts = spawnSync(TSX_BIN, [TS_SCRIPT, '--out-dir', tsd], { encoding: 'utf8', cwd: REPO_ROOT });
            expect(ts.status).toBe(py.status);
            // stdout carries the tmp out-dir path; compare after stripping it.
            expect(ts.stdout.replace(new RegExp(tsd, 'g'), 'OUT')).toBe(py.stdout.replace(new RegExp(pyd, 'g'), 'OUT'));
            expect(ts.stderr).toBe(py.stderr);
            for (const layer of ['workspace', 'team', 'personal']) {
                expect(fs.readFileSync(path.join(tsd, `${layer}.md`), 'utf-8')).toBe(
                    fs.readFileSync(path.join(pyd, `${layer}.md`), 'utf-8'),
                );
            }
        } finally {
            fs.rmSync(pyd, { recursive: true, force: true });
            fs.rmSync(tsd, { recursive: true, force: true });
        }
    });
});
