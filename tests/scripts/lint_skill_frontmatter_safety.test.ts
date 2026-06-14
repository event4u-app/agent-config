// Tests for src/scripts/lint_skill_frontmatter_safety.ts (py2ts Phase 1 — VERIFY).
//
// No pytest suite exists. Golden-parity layer runs python3 vs tsx and asserts
// byte-identical stdout/stderr/exit. Two parity surfaces:
//   1. the REAL repo `src/` tree (clean or non-clean — whatever python3 says),
//   2. a self-contained fixture repo carrying its own _lib + linter so the
//      linter's `ROOT = parents[3]` resolves to the fixture (crafted-hit
//      exit-1 path; default + --json).
//
// Dangerous-frontmatter tokens are assembled from fragments so this test file
// itself is not flagged when the linter scans the real src/ tree.
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

import * as sl from '../../src/scripts/_lib/security_lint.js';
import * as fms from '../../src/scripts/lint_skill_frontmatter_safety.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'lint_skill_frontmatter_safety.ts');
const PY_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'lint_skill_frontmatter_safety.py');
const TSX_BIN = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);

function hasPython3(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}
const py3 = hasPython3();

// Assembled from fragments so the test file's own prose isn't a live grant.
const STAR = '*';
const BASH_WILD = 'Bash(' + STAR + ')';
const BYPASS = 'bypass' + 'Permissions';

// --- Unit spec over exported _scan ------------------------------------------

describe('lint_skill_frontmatter_safety — _scan over a built ScannedFile', () => {
    let tmp: string;
    afterEach(() => {
        if (tmp) fs.rmSync(tmp, { recursive: true, force: true });
    });
    function scanText(body: string): sl.Finding[] {
        tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'fms-unit-'));
        const p = path.join(tmp, 'SKILL.md');
        fs.writeFileSync(p, body, 'utf-8');
        return fms._scan(sl.scan_file(p));
    }

    it('flags permissionMode bypassPermissions as HIGH', () => {
        const hits = scanText(`---\npermissionMode: ${BYPASS}\n---\nbody\n`);
        expect(hits.map((h) => h.message)).toContain(
            'permissionMode: bypassPermissions (consent bypass)',
        );
        expect(hits[0]!.is_fail).toBe(true);
    });

    it('flags a wildcard allowed-tools (Claude hyphen format) as HIGH', () => {
        const hits = scanText(`---\nallowed-tools: [${BASH_WILD}]\n---\nbody\n`);
        expect(hits.map((h) => h.message)).toContain(
            'wildcard / bare-Bash tool grant (over-broad)',
        );
    });

    it('flags automated execution missing the runtime-safety floor as HIGH', () => {
        const hits = scanText(
            '---\nexecution:\n  type: automated\n  handler: none\n---\nbody\n',
        );
        const msgs = hits.map((h) => h.message);
        expect(msgs).toContain('automated execution with handler none/missing (runtime-safety)');
        expect(msgs).toContain(
            'automated execution without safety_mode: strict (runtime-safety)',
        );
        expect(msgs).toContain(
            'automated execution without an explicit allowed_tools declaration',
        );
    });

    it('flags an execution.allowed_tools wildcard grant as HIGH', () => {
        const hits = scanText(
            `---\nexecution:\n  type: assisted\n  handler: shell\n  allowed_tools: [${BASH_WILD}]\n---\nbody\n`,
        );
        expect(hits.map((h) => h.message)).toContain(
            'execution.allowed_tools wildcard (* / Bash(*)) grant',
        );
    });

    it('does not flag a clean frontmatter', () => {
        const hits = scanText('---\nname: ok\ndescription: clean\n---\nbody\n');
        expect(hits).toHaveLength(0);
    });

    it('respects the allow pragma', () => {
        const hits = scanText(
            `---\npermissionMode: ${BYPASS}\n---\n<!-- security-lint: allow dangerous-frontmatter "teaching" -->\n`,
        );
        expect(hits).toHaveLength(0);
    });
});

// --- Golden parity on the REAL repo -----------------------------------------

describe.skipIf(!py3)(
    'lint_skill_frontmatter_safety — golden parity on real src/ (python3 vs tsx)',
    () => {
        function runPy(args: readonly string[]) {
            return spawnSync('python3', [PY_SCRIPT, ...args], { cwd: REPO_ROOT, encoding: 'utf8' });
        }
        function runTs(args: readonly string[]) {
            return spawnSync(TSX_BIN, [TS_SCRIPT, ...args], { cwd: REPO_ROOT, encoding: 'utf8' });
        }
        it('matches the default run byte-for-byte', () => {
            const pe = runPy([]);
            const te = runTs([]);
            expect(te.stdout).toBe(pe.stdout);
            expect(te.stderr).toBe(pe.stderr);
            expect(te.status).toBe(pe.status);
        });
        it('matches the --json run byte-for-byte', () => {
            const pe = runPy(['--json']);
            const te = runTs(['--json']);
            expect(te.stdout).toBe(pe.stdout);
            expect(te.status).toBe(pe.status);
        });
    },
);

// --- Golden parity on a self-contained crafted-hit fixture repo -------------

describe.skipIf(!py3)(
    'lint_skill_frontmatter_safety — golden parity on crafted hits (fixture repo)',
    () => {
        let fixRoot: string;
        afterEach(() => {
            if (fixRoot) fs.rmSync(fixRoot, { recursive: true, force: true });
        });

        function buildFixture(files: Record<string, string>): string {
            const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fms-fix-'));
            const libDst = path.join(root, 'src', 'scripts', '_lib');
            fs.mkdirSync(libDst, { recursive: true });
            const libSrc = path.join(REPO_ROOT, 'src', 'scripts', '_lib');
            fs.copyFileSync(
                path.join(libSrc, 'security_lint.py'),
                path.join(libDst, 'security_lint.py'),
            );
            fs.copyFileSync(
                path.join(libSrc, 'security_lint.ts'),
                path.join(libDst, 'security_lint.ts'),
            );
            const initPy = path.join(libSrc, '__init__.py');
            if (fs.existsSync(initPy)) fs.copyFileSync(initPy, path.join(libDst, '__init__.py'));
            const scrDst = path.join(root, 'src', 'scripts');
            fs.copyFileSync(PY_SCRIPT, path.join(scrDst, 'lint_skill_frontmatter_safety.py'));
            fs.copyFileSync(TS_SCRIPT, path.join(scrDst, 'lint_skill_frontmatter_safety.ts'));
            for (const [rel, body] of Object.entries(files)) {
                const fp = path.join(root, rel);
                fs.mkdirSync(path.dirname(fp), { recursive: true });
                fs.writeFileSync(fp, body, 'utf-8');
            }
            return root;
        }
        function runPyFix(args: readonly string[]) {
            return spawnSync('python3', ['src/scripts/lint_skill_frontmatter_safety.py', ...args], {
                cwd: fixRoot,
                encoding: 'utf8',
            });
        }
        function runTsFix(args: readonly string[]) {
            return spawnSync(TSX_BIN, ['src/scripts/lint_skill_frontmatter_safety.ts', ...args], {
                cwd: fixRoot,
                encoding: 'utf8',
            });
        }

        const HIT_FILES = {
            // automated w/o floor + wildcard exec grant — full weight HIGH.
            'src/skills/danger/SKILL.md':
                '---\n' +
                'name: danger\n' +
                'execution:\n' +
                '  type: automated\n' +
                '  handler: none\n' +
                `  allowed_tools: [${BASH_WILD}]\n` +
                '---\nbody\n',
            // consumer consent-bypass + wildcard hyphen allowed-tools.
            'src/agent-src/commands/bad.md':
                `---\npermissionMode: ${BYPASS}\nallowed-tools: [${STAR}]\n---\nbody\n`,
            // example-path → weight 0.25 (HIGH downgraded to WARN).
            'src/domains/x/docs/ex.md':
                `---\npermissionMode: ${BYPASS}\n---\nbody\n`,
            // clean file, nothing flagged.
            'src/skills/ok/SKILL.md': '---\nname: ok\ndescription: clean\n---\nbody\n',
        };

        it('matches the default crafted-hit run byte-for-byte', () => {
            fixRoot = buildFixture(HIT_FILES);
            const pe = runPyFix([]);
            const te = runTsFix([]);
            expect(te.stdout).toBe(pe.stdout);
            expect(te.stderr).toBe(pe.stderr);
            expect(te.status).toBe(pe.status);
            expect(pe.status).toBe(1);
        });

        it('matches the --json crafted-hit run byte-for-byte', () => {
            fixRoot = buildFixture(HIT_FILES);
            const pe = runPyFix(['--json']);
            const te = runTsFix(['--json']);
            expect(te.stdout).toBe(pe.stdout);
            expect(te.status).toBe(pe.status);
        });
    },
);
