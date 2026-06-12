// Tests for src/scripts/migrate_frontmatter_defaults.ts (py2ts Phase 8 / Wave 8e).
//
// No pytest suite existed. This is a focused differential suite that NEVER
// touches the live repo — artefact_roots is redirected onto a temp fixture
// for both the Python driver (patching m.artefact_roots) and the TS twin
// (agent_src._setRootsForTest):
//   1. APPLY-mode writer parity: every rewritten artefact (top-level default
//      drop, full-block drop, partial-block drop, bool default, untouched
//      advisor persona) is byte-identical; stdout summary + exit code match.
//   2. DRY-RUN delta-report parity: the written `--deltas` markdown is
//      byte-identical. (The stdout `delta report → <relpath>` line is excluded:
//      `Path.relative_to(ROOT)` is an absolute-path artifact, and pointing the
//      deltas file outside ROOT makes the Python twin raise — replicated in TS
//      but not byte-comparable across temp paths.)
// Skipped without python3.
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const SCRIPTS_DIR = path.join(REPO_ROOT, 'src', 'scripts');
const TS_SCRIPT = path.join(SCRIPTS_DIR, 'migrate_frontmatter_defaults.ts');
const AGENT_SRC_TS = path.join(SCRIPTS_DIR, '_lib', 'agent_src.ts');
const TSX_BIN = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);

function hasPython3(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}

const FILES: Record<string, string> = {
    // top-level default (source) + full trust block (all defaults) → drop both
    'skills/alpha/SKILL.md':
        '---\nname: alpha\ndescription: A.\nsource: package\ntrust:\n  level: core\n  confidence: high\nkeep: yes\n---\n\n# alpha\n',
    // partial trust (level non-default, confidence default) + full install block
    'skills/beta/SKILL.md':
        '---\nname: beta\ndescription: B.\ntrust:\n  level: experimental\n  confidence: high\ninstall:\n  default: true\n  removable: false\n---\n\n# beta\n',
    // rule: top-level default lifecycle dropped, source non-default kept
    'rules/r1.md': '---\ndescription: R.\ntype: auto\nlifecycle: active\nsource: external\n---\n\n# r\n',
    // persona direct file migrated
    'personas/p1.md': '---\nname: p1\ndescription: P.\nsource: package\n---\n\n# p1\n',
    // advisor persona must NOT be migrated (non-recursive personas glob)
    'personas/advisors/adv.md': '---\nname: adv\ndescription: ADV.\nsource: package\n---\n\n# adv\n',
};

function buildFixture(root: string): void {
    for (const [rel, content] of Object.entries(FILES)) {
        const full = path.join(root, rel);
        fs.mkdirSync(path.dirname(full), { recursive: true });
        fs.writeFileSync(full, content, 'utf-8');
    }
}

function runPy(root: string, args: 'apply' | 'dry', deltas?: string): { stdout: string; stderr: string; status: number | null } {
    const applyExpr = args === 'apply' ? 'True' : 'False';
    const deltaArg = deltas ? JSON.stringify(deltas) : '"/dev/null"';
    const driver = `import sys, importlib
sys.path.insert(0, ${JSON.stringify(SCRIPTS_DIR)})
from pathlib import Path
m = importlib.import_module("migrate_frontmatter_defaults")
root = Path(sys.argv[1])
m.artefact_roots = lambda: [root]
raise SystemExit(m.run(apply=${applyExpr}, deltas_path=Path(${deltaArg})))
`;
    const r = spawnSync('python3', ['-c', driver, root], { cwd: REPO_ROOT, encoding: 'utf8' });
    return { stdout: r.stdout, stderr: r.stderr, status: r.status };
}

function runTs(root: string, args: 'apply' | 'dry', deltas?: string): { stdout: string; stderr: string; status: number | null } {
    const applyArg = args === 'apply' ? 'true' : 'false';
    const deltaArg = deltas ? JSON.stringify(deltas) : JSON.stringify('/dev/null');
    const driver = `import * as as_ from ${JSON.stringify(AGENT_SRC_TS)};
import { run } from ${JSON.stringify(TS_SCRIPT)};
const nope = process.argv[1] + '__nonexistent__';
as_._setRootsForTest({ LEGACY_SRC: process.argv[1], PACKAGES: nope, SRC_AGENT: nope, SRC_SKILLS: nope, SRC_RULES: nope, SRC: nope });
process.exit(run(${applyArg}, ${deltaArg}));
`;
    const r = spawnSync(TSX_BIN, ['-e', driver, root], { cwd: REPO_ROOT, encoding: 'utf8' });
    return { stdout: r.stdout, stderr: r.stderr, status: r.status };
}

const py3 = hasPython3();

describe.skipIf(!py3)('migrate_frontmatter_defaults — writer golden parity (temp fixtures)', () => {
    let tmp: string;
    beforeEach(() => {
        tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mfd-'));
    });
    afterEach(() => {
        fs.rmSync(tmp, { recursive: true, force: true });
    });

    it('APPLY rewrites + stdout + exit byte-identical', () => {
        const pyRoot = path.join(tmp, 'py');
        const tsRoot = path.join(tmp, 'ts');
        buildFixture(pyRoot);
        buildFixture(tsRoot);
        const p = runPy(pyRoot, 'apply');
        const t = runTs(tsRoot, 'apply');
        expect(t.stdout).toBe(p.stdout);
        expect(t.status).toBe(p.status);
        expect(t.status).toBe(0);
        for (const rel of Object.keys(FILES)) {
            expect(fs.readFileSync(path.join(tsRoot, rel), 'utf-8'), rel).toBe(
                fs.readFileSync(path.join(pyRoot, rel), 'utf-8'),
            );
        }
        // sanity: alpha lost `source` and the whole `trust` block
        const alpha = fs.readFileSync(path.join(tsRoot, 'skills/alpha/SKILL.md'), 'utf-8');
        expect(alpha).not.toContain('source: package');
        expect(alpha).not.toContain('trust:');
        expect(alpha).toContain('keep: yes');
        // advisor persona untouched
        expect(fs.readFileSync(path.join(tsRoot, 'personas/advisors/adv.md'), 'utf-8')).toBe(
            FILES['personas/advisors/adv.md'],
        );
        // beta: confidence dropped from trust, install block dropped, level kept
        const beta = fs.readFileSync(path.join(tsRoot, 'skills/beta/SKILL.md'), 'utf-8');
        expect(beta).toContain('level: experimental');
        expect(beta).not.toContain('confidence: high');
        expect(beta).not.toContain('install:');
    });

    it('DRY-RUN delta report byte-identical', () => {
        const pyRoot = path.join(tmp, 'py');
        const tsRoot = path.join(tmp, 'ts');
        buildFixture(pyRoot);
        buildFixture(tsRoot);
        // Place the deltas file OUTSIDE ROOT (the temp dir) → both impls write the
        // report, then both hit the relative_to/relativeTo path. Python raises
        // (uncaught ValueError → exit 1) after writing; TS replicates the raise.
        // We compare the WRITTEN report file, which is produced before the
        // relpath print on both sides.
        const pyDelta = path.join(tmp, 'py_deltas.md');
        const tsDelta = path.join(tmp, 'ts_deltas.md');
        runPy(pyRoot, 'dry', pyDelta);
        runTs(tsRoot, 'dry', tsDelta);
        expect(fs.existsSync(pyDelta)).toBe(true);
        expect(fs.existsSync(tsDelta)).toBe(true);
        expect(fs.readFileSync(tsDelta, 'utf-8')).toBe(fs.readFileSync(pyDelta, 'utf-8'));
        // dry-run must NOT mutate the source fixtures
        for (const rel of Object.keys(FILES)) {
            expect(fs.readFileSync(path.join(tsRoot, rel), 'utf-8'), rel).toBe(FILES[rel]);
        }
    });
});
