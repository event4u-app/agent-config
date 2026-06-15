/**
 * Golden-parity tests for `src/scripts/lint_skill_originality.ts`
 * (py2ts Phase 4 / Wave 4b — NEW PORT, ADR-096).
 *
 * The Python original (`lint_skill_originality.py`) and the TS twin produce
 * byte-identical stdout/stderr and the same exit code across: warn-only with a
 * same-domain would-fail pair printed (exit 0), `--strict` on that same pair
 * (exit 1), the cross-domain advisory warn tier, the allowlisted-pair
 * suppression, `--json` file output (byte-identical), the `--quiet` path, the
 * no-skills error (exit 1), the allowlist over-cap (exit 2), and the usage
 * error (exit 2).
 *
 * Each script resolves REPO from `parents[2]` of its own location, reads
 * `<REPO>/src/skills`, loads its sibling allowlist, and pulls the shared
 * tokeniser / Jaccard / frontmatter primitives from `skill_overlap` (the .py
 * via sys.path; the .ts twin via `./skill_overlap.js`, which itself imports
 * `./_lib/value_ladder.js`). The fixtures therefore copy lint_skill_originality
 * + skill_overlap + _lib/value_ladder (both runtimes) into `<work>/src/scripts`
 * and run there. The `--help` prose is intentionally NOT byte-compared.
 *
 * Skips when python3 is unavailable.
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..', '..');
const SCRIPTS = path.join(REPO_ROOT, 'src', 'scripts');
const PY_SCRIPT = path.join(SCRIPTS, 'lint_skill_originality.py');
const TS_SCRIPT = path.join(SCRIPTS, 'lint_skill_originality.ts');
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

const big = (cwd: string) => ({ maxBuffer: 256 * 1024 * 1024, cwd, encoding: 'utf8' as const });

// --- Layer 1: golden parity on the real repo -------------------------------

describe.skipIf(!py3)('lint_skill_originality — golden parity (real repo)', () => {
    function same(args: readonly string[]): void {
        const py = spawnSync('python3', [PY_SCRIPT, ...args], big(REPO_ROOT));
        const ts = spawnSync(TSX_BIN, [TS_SCRIPT, ...args], big(REPO_ROOT));
        expect(ts.stdout).toBe(py.stdout);
        expect(ts.stderr).toBe(py.stderr);
        expect(ts.status).toBe(py.status);
    }
    it('default warn-only run matches byte-for-byte', () => same([]));
    it('--quiet matches byte-for-byte', () => same(['--quiet']));
    it('--strict matches byte-for-byte', () => same(['--strict']));

    it('usage error on an unrecognized arg matches byte-for-byte (exit 2)', () => {
        const py = spawnSync('python3', [PY_SCRIPT, '--bogus'], big(REPO_ROOT));
        const ts = spawnSync(TSX_BIN, [TS_SCRIPT, '--bogus'], big(REPO_ROOT));
        expect(ts.stdout).toBe(py.stdout);
        expect(ts.stderr).toBe(py.stderr);
        expect(ts.status).toBe(2);
        expect(py.status).toBe(2);
    });

    it('--json with no value → usage error (exit 2), byte-identical', () => {
        const py = spawnSync('python3', [PY_SCRIPT, '--json'], big(REPO_ROOT));
        const ts = spawnSync(TSX_BIN, [TS_SCRIPT, '--json'], big(REPO_ROOT));
        expect(ts.stdout).toBe(py.stdout);
        expect(ts.stderr).toBe(py.stderr);
        expect(ts.status).toBe(2);
        expect(py.status).toBe(2);
    });

    it('--json file output is byte-identical', () => {
        const pyOut = path.join(os.tmpdir(), `lso-py-${process.pid}.json`);
        const tsOut = path.join(os.tmpdir(), `lso-ts-${process.pid}.json`);
        try {
            spawnSync('python3', [PY_SCRIPT, '--json', pyOut, '--quiet'], big(REPO_ROOT));
            spawnSync(TSX_BIN, [TS_SCRIPT, '--json', tsOut, '--quiet'], big(REPO_ROOT));
            expect(fs.readFileSync(tsOut, 'utf-8')).toBe(fs.readFileSync(pyOut, 'utf-8'));
        } finally {
            fs.rmSync(pyOut, { force: true });
            fs.rmSync(tsOut, { force: true });
        }
    });
});

// --- Layer 2: synthetic skill tree (each branch) ---------------------------

describe.skipIf(!py3)('lint_skill_originality — golden parity (synthetic)', () => {
    let work: string;
    let scriptsDir: string;
    let skillsDir: string;

    function writeSkill(slug: string, fm: Record<string, string>): void {
        const dir = path.join(skillsDir, slug);
        fs.mkdirSync(dir, { recursive: true });
        const front = Object.entries(fm)
            .map(([k, v]) => `${k}: ${v}`)
            .join('\n');
        fs.writeFileSync(
            path.join(dir, 'SKILL.md'),
            `---\n${front}\n---\n\nBody for ${slug}.\n`,
            'utf-8',
        );
    }

    function writeAllowlist(pairs: Array<{ skill_a: string; skill_b: string; reason?: string }>): void {
        fs.writeFileSync(
            path.join(scriptsDir, 'lint_skill_originality_allowlist.json'),
            JSON.stringify({ pairs }) + '\n',
            'utf-8',
        );
    }

    function runPy(args: readonly string[] = []): ReturnType<typeof spawnSync> {
        return spawnSync(
            'python3',
            [path.join(scriptsDir, 'lint_skill_originality.py'), ...args],
            big(work),
        );
    }
    function runTs(args: readonly string[] = []): ReturnType<typeof spawnSync> {
        return spawnSync(
            TSX_BIN,
            [path.join(scriptsDir, 'lint_skill_originality.ts'), ...args],
            big(work),
        );
    }
    function expectSame(args: readonly string[] = []): ReturnType<typeof spawnSync> {
        const py = runPy(args);
        const ts = runTs(args);
        expect(ts.stdout).toBe(py.stdout);
        expect(ts.stderr).toBe(py.stderr);
        expect(ts.status).toBe(py.status);
        return ts;
    }

    beforeEach(() => {
        work = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'lso-')));
        scriptsDir = path.join(work, 'src', 'scripts');
        skillsDir = path.join(work, 'src', 'skills');
        fs.mkdirSync(path.join(scriptsDir, '_lib'), { recursive: true });
        fs.mkdirSync(skillsDir, { recursive: true });
        // The gate + its shared primitives (skill_overlap + _lib/value_ladder),
        // both runtimes — the scripts resolve everything relative to their own
        // location, so the whole import chain must live under <work>/src/scripts.
        for (const [src, dst] of [
            [PY_SCRIPT, 'lint_skill_originality.py'],
            [TS_SCRIPT, 'lint_skill_originality.ts'],
            [path.join(SCRIPTS, 'skill_overlap.py'), 'skill_overlap.py'],
            [path.join(SCRIPTS, 'skill_overlap.ts'), 'skill_overlap.ts'],
        ] as const) {
            fs.copyFileSync(src, path.join(scriptsDir, dst));
        }
        fs.copyFileSync(
            path.join(SCRIPTS, '_lib', 'value_ladder.py'),
            path.join(scriptsDir, '_lib', 'value_ladder.py'),
        );
        fs.copyFileSync(
            path.join(SCRIPTS, '_lib', 'value_ladder.ts'),
            path.join(scriptsDir, '_lib', 'value_ladder.ts'),
        );
        writeAllowlist([]);
    });

    afterEach(() => {
        fs.rmSync(work, { recursive: true, force: true });
    });

    it('no skills under src/skills → exit 1, byte-identical error', () => {
        const ts = expectSame([]);
        expect(ts.status).toBe(1);
        expect((ts.stderr as string)).toContain('no skills under');
    });

    it('distinct skills (no overlap) → clean, exit 0', () => {
        writeSkill('alpha', { description: 'Manage database migrations and schema versioning safely.' });
        writeSkill('beta', { description: 'Render charts and dashboards from telemetry samples.' });
        const ts = expectSame([]);
        expect(ts.status).toBe(0);
        expect((ts.stdout as string)).toContain('0 would-fail / 0 warn');
    });

    it('same-domain identical descriptions → would-fail printed, warn-only exit 0', () => {
        const desc = 'Validate authorization policies across tenants and roles thoroughly.';
        writeSkill('authz-one', { description: desc, packs: 'security-base' });
        writeSkill('authz-two', { description: desc, packs: 'security-base' });
        const ts = expectSame([]);
        expect(ts.status).toBe(0);
        expect((ts.stdout as string)).toContain('[WOULD-FAIL] same-domain');
        expect((ts.stdout as string)).toContain('1 would-fail');
    });

    it('same-domain identical descriptions → --strict exits 1 with stderr', () => {
        const desc = 'Validate authorization policies across tenants and roles thoroughly.';
        writeSkill('authz-one', { description: desc, packs: 'security-base' });
        writeSkill('authz-two', { description: desc, packs: 'security-base' });
        const ts = expectSame(['--strict']);
        expect(ts.status).toBe(1);
        expect((ts.stdout as string)).toContain('[FAIL] same-domain');
        expect((ts.stderr as string)).toContain('near-duplicate pair(s)');
    });

    it('allowlisted same-domain pair → suppressed, --strict exit 0', () => {
        const desc = 'Validate authorization policies across tenants and roles thoroughly.';
        writeSkill('authz-one', { description: desc, packs: 'security-base' });
        writeSkill('authz-two', { description: desc, packs: 'security-base' });
        writeAllowlist([{ skill_a: 'authz-one', skill_b: 'authz-two', reason: 'test' }]);
        const ts = expectSame(['--strict']);
        expect(ts.status).toBe(0);
        expect((ts.stdout as string)).toContain('0 would-fail');
    });

    it('cross-domain overlap → advisory warn tier (exit 0)', () => {
        // Identical descriptions but DISJOINT packs → not same-domain → warn.
        const desc = 'Validate authorization policies across tenants and roles thoroughly.';
        writeSkill('authz-one', { description: desc, packs: 'security-base' });
        writeSkill('authz-two', { description: desc, packs: 'frontend-base' });
        const ts = expectSame([]);
        expect(ts.status).toBe(0);
        expect((ts.stdout as string)).toContain('[warn]');
        expect((ts.stdout as string)).toContain('0 would-fail / 1 warn');
    });

    it('--json file output is byte-identical on the synthetic tree', () => {
        const desc = 'Validate authorization policies across tenants and roles thoroughly.';
        writeSkill('authz-one', { description: desc, packs: 'security-base' });
        writeSkill('authz-two', { description: desc, packs: 'security-base' });
        const pyOut = path.join(work, 'py.json');
        const tsOut = path.join(work, 'ts.json');
        const py = runPy(['--json', pyOut, '--quiet']);
        const ts = runTs(['--json', tsOut, '--quiet']);
        expect(ts.status).toBe(py.status);
        expect(fs.readFileSync(tsOut, 'utf-8')).toBe(fs.readFileSync(pyOut, 'utf-8'));
    });

    it('allowlist over the 20-entry cap → exit 2, byte-identical stderr', () => {
        writeSkill('alpha', { description: 'one thing.' });
        writeSkill('beta', { description: 'another thing.' });
        writeAllowlist(
            Array.from({ length: 21 }, (_, i) => ({ skill_a: `a${i}`, skill_b: `b${i}` })),
        );
        const ts = expectSame([]);
        expect(ts.status).toBe(2);
        expect((ts.stderr as string)).toContain('allowlist-growth');
    });
});
