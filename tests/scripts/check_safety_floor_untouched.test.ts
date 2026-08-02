// Tests for src/scripts/check_safety_floor_untouched.ts.
//
// HISTORY (2026-07-29 audit, agents/settings/contexts/gates-that-cannot-fail.md):
// this suite used to assert `RULES_DIR_REL === '.agent-src.uncondensed/rules'` —
// i.e. it PINNED the defect. That path stopped existing at ADR-051, so the guard
// compared diffs against paths absent from every commit and reported
// "✅ Safety-floor untouched (4 rules guarded)" no matter what was edited. The
// gate was structurally incapable of failing, and this file made fixing it look
// like a regression.
//
// The replacement asserts BEHAVIOUR in both directions: a changed-file set that
// touches a floor rule must be rejected, one that does not must pass, and the
// guarded paths must resolve on disk.
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';

import { runInProc } from '../_lib/run_in_process.js';
import * as sf from '../../src/scripts/check_safety_floor_untouched.js';

describe('check_safety_floor_untouched — behavioural spec', () => {
    it('guards exactly the four safety-floor rules', () => {
        expect([...sf.SAFETY_FLOOR]).toEqual([
            'non-destructive-by-default.md',
            'commit-policy.md',
            'scope-control.md',
            'verify-before-complete.md',
        ]);
    });

    it('watches the CURRENT authoring root only — no retired container', () => {
        expect(sf.RULES_DIR_REL).toBe('src/rules');
        // The retired source container must not creep back in: a dead path kept
        // alive for an unmeasured scenario is how the original defect survived
        // (and `check_no_new_legacy_path` enforces the same thing repo-wide).
        expect(sf._floor_candidates().every((p) => !p.includes('.agent-src.uncondensed'))).toBe(
            true,
        );
    });

    it('every guarded floor file resolves on disk (the guard is not watching phantoms)', () => {
        // This is the assertion whose absence let the gate die silently: if the
        // rules move again, this fails instead of the guard going quietly green.
        const present = sf.SAFETY_FLOOR.filter((name) =>
            fs.existsSync(path.join(sf.REPO_ROOT, sf.RULES_DIR_REL, name)),
        );
        expect(present).toHaveLength(sf.SAFETY_FLOOR.length);
    });

    it('REJECTS a changed-file set that touches a floor rule', () => {
        const breaches = sf._breaches([
            'README.md',
            'src/rules/commit-policy.md',
            'src/scripts/whatever.ts',
        ]);
        expect(breaches).toEqual(['src/rules/commit-policy.md']);
    });

    it('rejects every guarded floor rule, not just the first', () => {
        expect(sf._breaches(['src/rules/scope-control.md'])).toEqual([
            'src/rules/scope-control.md',
        ]);
        expect(sf._breaches(['src/rules/verify-before-complete.md'])).toEqual([
            'src/rules/verify-before-complete.md',
        ]);
    });

    it('PASSES a changed-file set that touches no floor rule', () => {
        expect(
            sf._breaches(['README.md', 'src/rules/telegraph-speak.md', 'docs/proof.md']),
        ).toEqual([]);
    });

    it('does not confuse a same-named rule outside the guarded roots', () => {
        // A projection copy is not the source of truth and must not trip the gate.
        expect(sf._breaches(['dist/agent-src/rules/commit-policy.md'])).toEqual([]);
    });

    it('regression lock: the guarded set is non-empty', () => {
        // The whole defect class in one line — an empty candidate set means the
        // gate can never fire, which is exactly how it shipped for months.
        expect(sf._floor_candidates().length).toBeGreaterThan(0);
        expect(sf._floor_candidates()).toContain('src/rules/commit-policy.md');
    });
});

// ── Violation test through the REAL entry point ────────────────────────────
//
// Every assertion above calls an exported pure helper. None reaches `main()`,
// so the suite could not tell "blocks a tampered floor rule" from "exits 0
// unconditionally" — the `happy-path-only` class in road-to-gates-that-can-fail
// Phase 3.2, and precisely the shape of the original defect.
//
// The breach is built with git plumbing against a TEMP INDEX: `read-tree` HEAD
// into a scratch index file, swap one blob, `write-tree`, `commit-tree -p HEAD`.
// This creates a dangling commit only — no ref, no working-tree change, no touch
// of the real index — and needs no history beyond HEAD, so it survives the
// shallow `actions/checkout` clone the test job uses. Pinning a historical SHA
// would have made this test unrunnable in CI.
describe('main() — a tampered safety-floor rule is actually blocked', () => {
    const git = (args: string[], env: NodeJS.ProcessEnv = {}): { code: number; out: string } => {
        const p = spawnSync('git', args, {
            cwd: sf.REPO_ROOT,
            encoding: 'utf-8',
            env: { ...process.env, ...env },
        });
        return { code: p.status ?? 1, out: `${p.stdout ?? ''}${p.stderr ?? ''}`.trim() };
    };

    /**
     * A dangling commit whose only delta vs HEAD is a gutted floor rule.
     *
     * Returns the sha, or a `failed:` string naming the step and git's own
     * stderr. A bare `null` was the first shape and it cost a CI round-trip:
     * ubuntu reported only "expected null not to be null", which says a commit
     * was not produced but not which of five plumbing steps refused or why.
     * A helper that cannot explain its own failure is the same shape as a gate
     * that reports success without reading anything.
     */
    const commitWithGuttedFloorRule = (rel: string): string => {
        const idxDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sfidx-'));
        try {
            // Identity via env: `commit-tree` refuses without a committer, and a
            // CI runner may have no global `user.name`/`user.email` —
            // `actions/checkout` does not set one. This writes nothing to the
            // machine's git config.
            const env = {
                GIT_INDEX_FILE: path.join(idxDir, 'index'),
                GIT_AUTHOR_NAME: 'safety-floor canary',
                GIT_AUTHOR_EMAIL: 'canary@example.com',
                GIT_COMMITTER_NAME: 'safety-floor canary',
                GIT_COMMITTER_EMAIL: 'canary@example.com',
            };
            const step = (label: string, args: string[]): string => {
                const r = git(args, env);
                if (r.code !== 0) throw new Error(`${label} failed (exit ${r.code}): ${r.out}`);
                return r.out;
            };

            step('read-tree HEAD', ['read-tree', 'HEAD']);

            const written = spawnSync('git', ['hash-object', '-w', '--stdin'], {
                cwd: sf.REPO_ROOT,
                encoding: 'utf-8',
                input: '# gutted by the canary — every passage removed\n',
                env: { ...process.env, ...env },
            });
            const sha = (written.stdout ?? '').trim();
            if (written.status !== 0 || sha === '') {
                throw new Error(`hash-object failed (exit ${written.status}): ${written.stderr ?? ''}`);
            }

            step('update-index', ['update-index', '--add', '--cacheinfo', `100644,${sha},${rel}`]);
            const tree = step('write-tree', ['write-tree']);
            return step('commit-tree', ['commit-tree', tree, '-p', 'HEAD', '-m', 'canary']);
        } finally {
            fs.rmSync(idxDir, { recursive: true, force: true });
        }
    };

    /** `main()` reads process.argv directly, so drive it the way the shell does. */
    const runMain = (argv: string[]): ReturnType<typeof runInProc> => {
        const saved = process.argv;
        process.argv = ['node', 'check_safety_floor_untouched', ...argv];
        try {
            return runInProc(sf.main, []);
        } finally {
            process.argv = saved;
        }
    };

    it('REJECTS a range in which a floor rule lost its content (exit 1)', () => {
        const rel = `${sf.RULES_DIR_REL}/commit-policy.md`;
        // Throws with the failing plumbing step and git's own stderr if it cannot
        // build the breach, so a CI-only failure names its cause instead of
        // asserting that something was not null.
        const head = commitWithGuttedFloorRule(rel);
        expect(head, 'git plumbing must produce a dangling commit').toMatch(/^[0-9a-f]{7,40}$/);
        const r = runMain(['--baseline', 'HEAD', '--head', head]);
        expect(r.status, `${r.stdout}${r.stderr}`).toBe(1);
        expect(r.stderr).toContain('Substantive change to safety-floor rule(s)');
        expect(r.stderr).toContain(rel);
    });

    it('PASSES a range with no floor-rule change (exit 0) — and says what it guarded', () => {
        const r = runMain(['--baseline', 'HEAD', '--head', 'HEAD']);
        expect(r.status, `${r.stdout}${r.stderr}`).toBe(0);
        expect(r.stdout).toContain('Safety-floor untouched');
        // The RESOLVED count, not the declared one: the shipped defect announced
        // "4 rules guarded" while guarding zero.
        expect(r.stdout).toContain(`${String(sf.SAFETY_FLOOR.length)} rule file(s) guarded`);
    });
});
