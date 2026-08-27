
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';

import {
    ALLOWLIST,
    ALLOWLIST_CAP,
    _cosine,
    _default_skill_root,
    _keyword_vector,
    _pairKey,
    collect,
} from '../../src/scripts/audit_skill_overlap.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'audit_skill_overlap.ts');
const TSX_BIN =
    process.env['TSX_BIN'] ??
    path.join(REPO_ROOT, 'node_modules', '.bin', process.platform === 'win32' ? 'tsx.cmd' : 'tsx');

/**
 * A FLOOR, not an exact count — the corpus legitimately shrinks as skills
 * merge. What must never happen again is the count collapsing toward zero
 * because the container moved: the tool spent its whole life rooted at the
 * pre-ADR-051 source tree and so reported "no overlap" for a 287-skill corpus
 * while reading nothing.
 */
const SCANNED_FLOOR = 200;

const tmpDirs: string[] = [];
function mkTmp(prefix: string): string {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
    tmpDirs.push(d);
    return d;
}
afterAll(() => {
    for (const d of tmpDirs) {
        fs.rmSync(d, { recursive: true, force: true });
    }
});

/** Always writes reports into a temp dir — never the tracked `agents/reports`. */
function runCli(args: string[]): { status: number | null; stdout: string; stderr: string } {
    const argv = args.includes('--out-dir') ? args : [...args, '--out-dir', mkTmp('overlap-out-')];
    const r = spawnSync(TSX_BIN, [TS_SCRIPT, ...argv], { cwd: REPO_ROOT, encoding: 'utf-8' });
    return { status: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
}

describe('audit_skill_overlap — unit helpers', () => {
    it('_keyword_vector counts non-stopword tokens', () => {
        const v = _keyword_vector('router router fires and the for');
        expect(v.get('router')).toBe(2);
        expect(v.get('fires')).toBe(1);
        expect(v.has('and')).toBe(false);
        expect(v.has('the')).toBe(false);
    });
    it('_cosine of identical vectors is 1, disjoint is 0', () => {
        const a = _keyword_vector('alpha beta gamma delta');
        expect(_cosine(a, a)).toBeCloseTo(1.0, 10);
        const b = _keyword_vector('omega sigma kappa lambda');
        expect(_cosine(a, b)).toBe(0.0);
    });
});

describe('audit_skill_overlap — scan scope', () => {
    it('the default root is src/skills, not a legacy container', () => {
        expect(_default_skill_root()).toBe(path.join(REPO_ROOT, 'src', 'skills'));
        expect(_default_skill_root()).not.toContain('.agent-src.uncondensed');
        expect(fs.statSync(_default_skill_root()).isDirectory()).toBe(true);
    });

    it('scans the real corpus above the floor (regression lock on the dead root)', () => {
        expect(collect().length).toBeGreaterThanOrEqual(SCANNED_FLOOR);
    });

    it('the CLI reports a non-zero scanned count on a clean checkout', () => {
        const r = runCli([]);
        expect(r.status, r.stderr).toBe(0);
        const m = /Skill overlap: (\d+) skills/.exec(r.stdout);
        expect(m, r.stdout).not.toBeNull();
        expect(Number((m as RegExpExecArray)[1])).toBeGreaterThanOrEqual(SCANNED_FLOOR);
    });

    it('a non-existent root is a dead-scope FAILURE, not an empty result', () => {
        const missing = path.join(mkTmp('overlap-missing-'), 'does-not-exist');
        expect(fs.existsSync(missing)).toBe(false);
        const r = runCli(['--root', missing]);
        expect(r.status).toBe(3);
        expect(r.stderr).toContain('audit_skill_overlap: scanned 0 skill(s)');
        expect(r.stderr).toContain('the scan scope is dead or the root moved');
    });

    it('an existing but EMPTY root is also a failure (the exact shipped bug)', () => {
        const empty = mkTmp('overlap-empty-');
        expect(fs.readdirSync(empty)).toHaveLength(0);
        const r = runCli(['--root', empty]);
        expect(r.status).toBe(3);
        expect(r.stderr).toContain('scanned 0 skill(s)');
    });

    it('an explicit --root fixture is scanned instead of the default', () => {
        const root = twinFixture(['fixture'], ['fixture']);
        const skills = collect(root);
        expect(skills.map((s) => s.name).sort()).toEqual(['alpha', 'beta']);
        expect(_cosine(skills[0]!.vector, skills[1]!.vector)).toBeCloseTo(1.0, 10);
    });
});

/** Two byte-identical bodies (cosine 1.0) with the given packs — a guaranteed hit. */
function twinFixture(packsA: string[], packsB: string[]): string {
    const root = mkTmp('overlap-twin-');
    for (const [slug, packs] of [
        ['alpha', packsA],
        ['beta', packsB],
    ] as const) {
        fs.mkdirSync(path.join(root, slug));
        const packLines = packs.map((p) => `  - ${p}`).join('\n');
        fs.writeFileSync(
            path.join(root, slug, 'SKILL.md'),
            `---\nname: ${slug}\npacks:\n${packLines}\n---\n\nalpha beta gamma delta epsilon zeta\n`,
            'utf-8',
        );
    }
    return root;
}

describe('audit_skill_overlap — --strict blocking gate', () => {
    it('the real corpus passes strict today (zero same-pack pairs at threshold)', () => {
        const r = runCli(['--strict', '--quiet']);
        expect(r.status, r.stderr).toBe(0);
    });

    it('a synthetic above-threshold SAME-PACK addition fails', () => {
        const r = runCli(['--strict', '--quiet', '--root', twinFixture(['fixture'], ['fixture'])]);
        expect(r.status).toBe(1);
        expect(r.stderr).toContain('same-pack pair(s) at or above');
        expect(r.stderr).toContain('alpha ↔ beta');
        expect(r.stderr).toContain('"pair": "alpha::beta"');
    });

    it('the same pair CROSS-pack does not block — install shape is a different decision', () => {
        const r = runCli(['--strict', '--quiet', '--root', twinFixture(['pack-a'], ['pack-b'])]);
        expect(r.status, r.stderr).toBe(0);
    });

    it('without --strict the same fixture still exits 0 — the flag is the gate', () => {
        const r = runCli(['--quiet', '--root', twinFixture(['fixture'], ['fixture'])]);
        expect(r.status, r.stderr).toBe(0);
    });

    it('a reviewed allowlist entry clears the pair', () => {
        const allow = path.join(mkTmp('overlap-allow-'), 'allow.json');
        fs.writeFileSync(
            allow,
            JSON.stringify({ entries: [{ pair: 'beta::alpha', reason: 'structural twin, reviewed' }] }),
        );
        const r = runCli([
            '--strict',
            '--quiet',
            '--root',
            twinFixture(['fixture'], ['fixture']),
            '--allowlist',
            allow,
        ]);
        expect(r.status, r.stderr).toBe(0);
    });

    it('an entry with no reason is rejected (exit 2), not silently honoured', () => {
        const allow = path.join(mkTmp('overlap-allow-'), 'allow.json');
        fs.writeFileSync(allow, JSON.stringify({ entries: [{ pair: 'alpha::beta', reason: '  ' }] }));
        const r = runCli([
            '--strict',
            '--quiet',
            '--root',
            twinFixture(['fixture'], ['fixture']),
            '--allowlist',
            allow,
        ]);
        expect(r.status).toBe(2);
        expect(r.stderr).toContain('non-empty "reason"');
    });

    it('over-cap allowlist is exit 2 — the threshold is wrong, not the corpus', () => {
        const allow = path.join(mkTmp('overlap-allow-'), 'allow.json');
        const entries = Array.from({ length: ALLOWLIST_CAP + 1 }, (_, i) => ({
            pair: `a${i}::b${i}`,
            reason: 'r',
        }));
        fs.writeFileSync(allow, JSON.stringify({ entries }));
        const r = runCli([
            '--strict',
            '--quiet',
            '--root',
            twinFixture(['fixture'], ['fixture']),
            '--allowlist',
            allow,
        ]);
        expect(r.status).toBe(2);
        expect(r.stderr).toContain(`> ${ALLOWLIST_CAP}`);
    });

    /**
     * This assertion used to read `expect(shipped.entries).toEqual([])`.
     *
     * Empty IS the healthy state, and the allowlist's own comment says so — but
     * pinning zero made the file's first legitimate entry a test failure, which
     * is not the same control. The real control is what the loader already
     * enforces and what a reviewer reads: every entry names a real pair and
     * carries a real reason, and the list stays under the cap. The cap is the
     * re-litigation trigger; the count is not.
     *
     * The entry that forced this correction was decided by council on
     * 2026-08-26 (2/2 convergent, disposition A: add the first entry with a
     * justification), so an assertion of emptiness would have contradicted a
     * recorded decision rather than caught a defect.
     */
    it('every shipped allowlist entry names a real pair and carries a real reason, under the cap', () => {
        const shipped = JSON.parse(fs.readFileSync(ALLOWLIST, 'utf-8')) as {
            entries: Array<{ pair?: unknown; reason?: unknown }>;
        };
        expect(Array.isArray(shipped.entries)).toBe(true);
        expect(shipped.entries.length).toBeLessThanOrEqual(ALLOWLIST_CAP);
        for (const e of shipped.entries) {
            expect(typeof e.pair, JSON.stringify(e)).toBe('string');
            expect(String(e.pair)).toMatch(/^[a-z0-9-]+::[a-z0-9-]+$/);
            // A one-word "structural" is not a reason. The bar is a human
            // having read both skills; the length floor is the cheapest proxy
            // for that and the only one a test can check.
            expect(typeof e.reason, JSON.stringify(e.pair)).toBe('string');
            expect(String(e.reason).length, `reason for ${String(e.pair)}`).toBeGreaterThan(80);
        }
    });

    it('_pairKey is order-independent', () => {
        expect(_pairKey('b', 'a')).toBe(_pairKey('a', 'b'));
    });
});
