/**
 * CLI-contract tests for `src/scripts/lint_skill_originality.ts`
 * (py2ts Phase 4 / Wave 4b — ADR-096).
 *
 * The tsx twin is the source of truth (the python original was deleted in the
 * teardown). Layer 1 asserts the CLI runs deterministically on the real repo;
 * Layer 2 drives a synthetic skill tree through each branch: warn-only with a
 * same-domain would-fail pair printed (exit 0), `--strict` on that pair (exit
 * 1), the cross-domain advisory warn tier, the allowlisted-pair suppression,
 * `--json` file output, the `--quiet` path, the no-skills error (exit 1), the
 * allowlist over-cap (exit 2), and the usage error (exit 2).
 *
 * The script resolves REPO from `parents[2]` of its own location, reads
 * `<REPO>/src/skills`, loads its sibling allowlist, and pulls the shared
 * tokeniser / Jaccard / frontmatter primitives from `skill_overlap` (which
 * imports `./_lib/value_ladder.js`). The fixtures therefore copy the TS twin +
 * skill_overlap.ts + _lib/value_ladder.ts into `<work>/src/scripts` and run there.
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
const TS_SCRIPT = path.join(SCRIPTS, 'lint_skill_originality.ts');
const TSX_BIN = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);

const big = (cwd: string) => ({ maxBuffer: 256 * 1024 * 1024, cwd, encoding: 'utf8' as const });

// --- Layer 1: CLI contract on the real repo --------------------------------

describe('lint_skill_originality — CLI contract (real repo)', () => {
    function stable(args: readonly string[]): void {
        const a = spawnSync(TSX_BIN, [TS_SCRIPT, ...args], big(REPO_ROOT));
        const b = spawnSync(TSX_BIN, [TS_SCRIPT, ...args], big(REPO_ROOT));
        expect(a.status, a.stderr as string).not.toBeNull();
        expect(b.stdout).toBe(a.stdout);
        expect(b.status).toBe(a.status);
    }
    it('default warn-only run is deterministic', () => stable([]));
    it('--quiet is deterministic', () => stable(['--quiet']));
    it('--strict is deterministic', () => stable(['--strict']));

    it('usage error on an unrecognized arg → exit 2', () => {
        expect(spawnSync(TSX_BIN, [TS_SCRIPT, '--bogus'], big(REPO_ROOT)).status).toBe(2);
    });

    it('--json with no value → usage error (exit 2)', () => {
        expect(spawnSync(TSX_BIN, [TS_SCRIPT, '--json'], big(REPO_ROOT)).status).toBe(2);
    });

    it('--json file output is valid JSON', () => {
        const tsOut = path.join(os.tmpdir(), `lso-ts-${process.pid}.json`);
        try {
            spawnSync(TSX_BIN, [TS_SCRIPT, '--json', tsOut, '--quiet'], big(REPO_ROOT));
            expect(() => JSON.parse(fs.readFileSync(tsOut, 'utf-8'))).not.toThrow();
        } finally {
            fs.rmSync(tsOut, { force: true });
        }
    });
});

// --- Layer 2: synthetic skill tree (each branch) ---------------------------

describe('lint_skill_originality — synthetic fixtures', () => {
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

    function runTs(args: readonly string[] = []): ReturnType<typeof spawnSync> {
        return spawnSync(
            TSX_BIN,
            [path.join(scriptsDir, 'lint_skill_originality.ts'), ...args],
            big(work),
        );
    }

    beforeEach(() => {
        work = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'lso-')));
        scriptsDir = path.join(work, 'src', 'scripts');
        skillsDir = path.join(work, 'src', 'skills');
        fs.mkdirSync(path.join(scriptsDir, '_lib'), { recursive: true });
        fs.mkdirSync(skillsDir, { recursive: true });
        // The gate + its shared primitives (skill_overlap + _lib/value_ladder) —
        // the script resolves everything relative to its own location, so the
        // whole import chain must live under <work>/src/scripts.
        for (const [src, dst] of [
            [TS_SCRIPT, 'lint_skill_originality.ts'],
            [path.join(SCRIPTS, 'skill_overlap.ts'), 'skill_overlap.ts'],
        ] as const) {
            fs.copyFileSync(src, path.join(scriptsDir, dst));
        }
        fs.copyFileSync(
            path.join(SCRIPTS, '_lib', 'value_ladder.ts'),
            path.join(scriptsDir, '_lib', 'value_ladder.ts'),
        );
        writeAllowlist([]);
    });

    afterEach(() => {
        fs.rmSync(work, { recursive: true, force: true });
    });

    it('no skills under src/skills → exit 1, error on stderr', () => {
        const ts = runTs([]);
        expect(ts.status).toBe(1);
        expect(ts.stderr as string).toContain('no skills under');
    });

    it('distinct skills (no overlap) → clean, exit 0', () => {
        writeSkill('alpha', { description: 'Manage database migrations and schema versioning safely.' });
        writeSkill('beta', { description: 'Render charts and dashboards from telemetry samples.' });
        const ts = runTs([]);
        expect(ts.status).toBe(0);
        expect(ts.stdout as string).toContain('0 would-fail / 0 warn');
    });

    it('same-domain identical descriptions → would-fail printed, warn-only exit 0', () => {
        const desc = 'Validate authorization policies across tenants and roles thoroughly.';
        writeSkill('authz-one', { description: desc, packs: 'security-base' });
        writeSkill('authz-two', { description: desc, packs: 'security-base' });
        const ts = runTs([]);
        expect(ts.status).toBe(0);
        expect(ts.stdout as string).toContain('[WOULD-FAIL] same-domain');
        expect(ts.stdout as string).toContain('1 would-fail');
    });

    it('same-domain identical descriptions → --strict exits 1 with stderr', () => {
        const desc = 'Validate authorization policies across tenants and roles thoroughly.';
        writeSkill('authz-one', { description: desc, packs: 'security-base' });
        writeSkill('authz-two', { description: desc, packs: 'security-base' });
        const ts = runTs(['--strict']);
        expect(ts.status).toBe(1);
        expect(ts.stdout as string).toContain('[FAIL] same-domain');
        expect(ts.stderr as string).toContain('near-duplicate pair(s)');
    });

    it('allowlisted same-domain pair → suppressed, --strict exit 0', () => {
        const desc = 'Validate authorization policies across tenants and roles thoroughly.';
        writeSkill('authz-one', { description: desc, packs: 'security-base' });
        writeSkill('authz-two', { description: desc, packs: 'security-base' });
        writeAllowlist([{ skill_a: 'authz-one', skill_b: 'authz-two', reason: 'test' }]);
        const ts = runTs(['--strict']);
        expect(ts.status).toBe(0);
        expect(ts.stdout as string).toContain('0 would-fail');
    });

    it('cross-domain overlap → advisory warn tier (exit 0)', () => {
        // Identical descriptions but DISJOINT packs → not same-domain → warn.
        const desc = 'Validate authorization policies across tenants and roles thoroughly.';
        writeSkill('authz-one', { description: desc, packs: 'security-base' });
        writeSkill('authz-two', { description: desc, packs: 'frontend-base' });
        const ts = runTs([]);
        expect(ts.status).toBe(0);
        expect(ts.stdout as string).toContain('[warn]');
        expect(ts.stdout as string).toContain('0 would-fail / 1 warn');
    });

    it('--json file output is valid JSON on the synthetic tree', () => {
        const desc = 'Validate authorization policies across tenants and roles thoroughly.';
        writeSkill('authz-one', { description: desc, packs: 'security-base' });
        writeSkill('authz-two', { description: desc, packs: 'security-base' });
        const tsOut = path.join(work, 'ts.json');
        runTs(['--json', tsOut, '--quiet']);
        expect(() => JSON.parse(fs.readFileSync(tsOut, 'utf-8'))).not.toThrow();
    });

    it('allowlist over the 20-entry cap → exit 2, stderr marker', () => {
        writeSkill('alpha', { description: 'one thing.' });
        writeSkill('beta', { description: 'another thing.' });
        writeAllowlist(
            Array.from({ length: 21 }, (_, i) => ({ skill_a: `a${i}`, skill_b: `b${i}` })),
        );
        const ts = runTs([]);
        expect(ts.status).toBe(2);
        expect(ts.stderr as string).toContain('allowlist-growth');
    });
});
