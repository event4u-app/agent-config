/**
 * The twelve fixtures the AI council named for `cascade-default-inclusion-policy`
 * (2026-09-03, `anthropic/claude-sonnet-4-5` + `openai/codex-default`).
 *
 * Fixtures 7, 8 and 9 were called non-negotiable and each carries a SENSITIVITY
 * probe in its comment — the exact edit that must turn it red. 8 and 9 are the
 * two negative directions (omitting the default ref, and adding it
 * unconditionally); 7 proves the trust boundary rather than documenting it.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
    InvalidBranchConvergencePolicy,
    MissingBranchConvergencePolicy,
    POLICY_PATH,
    UnresolvableTargetSha,
    loadPolicyAtSha,
    parseBranchConvergencePolicy,
} from '../../src/scripts/_lib/branch_convergence.js';
import {
    MAX_BASE_ATTEMPTS,
    UnresolvableBase,
    autoResolveGenerated,
    integrateWithPinnedBase,
    integrationOrder,
    parseSymrefDefault,
    renderBaseSummary,
    resolveBase,
    type BaseDeps,
    type RegenOps,
} from '../../src/scripts/sync_pr_branch.js';

const TARGET_SHA = 'a'.repeat(40);
const HEAD_SHA = 'b'.repeat(40);
const DEFAULT_SHA = 'c'.repeat(40);

const POLICY_EXCLUDE = `branchConvergence:\n  enabled: true\n  targets:\n    release/1.x:\n      defaultBranch: exclude\n`;
const POLICY_INCLUDE = `branchConvergence:\n  enabled: true\n  targets:\n    release/1.x:\n      defaultBranch: include\n`;
const POLICY_DISABLED = `branchConvergence:\n  enabled: false\n  targets:\n    release/1.x:\n      defaultBranch: include\n`;

/**
 * A deps set whose git answers are fixed data.
 *
 * `readAtSha` is keyed by SHA on purpose: a test can put one policy at the PR
 * HEAD and a different one at the target, which is the only way fixture 7 can
 * fail if the boundary is broken.
 */
function deps(over: Partial<BaseDeps> & { readonly atSha?: Record<string, string> } = {}): BaseDeps {
    const atSha = over.atSha ?? {};
    return {
        currentBranch: over.currentBranch ?? ((): string => 'feat/x'),
        prBase: over.prBase ?? ((): string | null => 'release/1.x'),
        defaultBranch: over.defaultBranch ?? ((): string | null => 'origin/main'),
        remoteSha:
            over.remoteSha ??
            ((ref: string): string | null =>
                ref === 'origin/main' ? DEFAULT_SHA : ref === 'origin/release/1.x' ? TARGET_SHA : null),
        readAtSha: over.readAtSha ?? ((sha: string, p: string): string | null => (p === POLICY_PATH ? (atSha[sha] ?? null) : null)),
    };
}

describe('branch-convergence — the twelve council fixtures', () => {
    it('F1 — a default-branch target returns only the default ref, not-required', () => {
        const r = resolveBase(
            '/nowhere',
            null,
            deps({ prBase: (): string | null => 'main', remoteSha: (ref: string): string | null => (ref === 'origin/main' ? DEFAULT_SHA : null) }),
        );
        expect(r.entries).toEqual([{ ref: 'origin/main', reason: 'pull-request-target' }]);
        expect(r.policyStatus).toBe('not-required');
    });

    it('F2 — a non-default target with no entry throws the typed error, not a partial set', () => {
        // No policy file at the target SHA at all.
        expect(() => resolveBase('/nowhere', null, deps({ atSha: {} }))).toThrow(MissingBranchConvergencePolicy);
        // A policy that exists but names a different target is the same answer:
        // an absent entry must not manufacture repository intent.
        const other = `branchConvergence:\n  enabled: true\n  targets:\n    release/2.x:\n      defaultBranch: include\n`;
        expect(() => resolveBase('/nowhere', null, deps({ atSha: { [TARGET_SHA]: other } }))).toThrow(
            MissingBranchConvergencePolicy,
        );
        try {
            resolveBase('/nowhere', null, deps({ atSha: {} }));
        } catch (e) {
            expect((e as MissingBranchConvergencePolicy).target).toBe('release/1.x');
            expect(String(e)).toContain('MissingBranchConvergencePolicy(target="release/1.x")');
        }
    });

    it('F3 / F9 — exclude returns ONLY the target, and fails if legacy logic adds the default', () => {
        // SENSITIVITY (F9): append the default ref unconditionally in
        // `resolveBase`'s non-default branch — this assertion must go red.
        const r = resolveBase('/nowhere', null, deps({ atSha: { [TARGET_SHA]: POLICY_EXCLUDE } }));
        expect(r.entries).toEqual([{ ref: 'origin/release/1.x', reason: 'pull-request-target' }]);
        expect(r.entries).toHaveLength(1);
        expect(r.entries.map((e) => e.ref)).not.toContain('origin/main');
        expect(r.policyStatus).toBe('applied');
    });

    it('F4 / F8 — include returns target then default, and fails if the default is omitted', () => {
        // SENSITIVITY (F8): delete the `include` push of the default entry —
        // both the length and the reason-code assertion must go red.
        const r = resolveBase('/nowhere', null, deps({ atSha: { [TARGET_SHA]: POLICY_INCLUDE } }));
        expect(r.entries).toEqual([
            { ref: 'origin/release/1.x', reason: 'pull-request-target' },
            { ref: 'origin/main', reason: 'branch-convergence-policy:include-default' },
        ]);
        expect(r.entries).toHaveLength(2);
        expect(r.policyStatus).toBe('applied');
    });

    it('F5 — the kill switch returns the target only, policyStatus disabled', () => {
        const r = resolveBase('/nowhere', null, deps({ atSha: { [TARGET_SHA]: POLICY_DISABLED } }));
        expect(r.entries).toEqual([{ ref: 'origin/release/1.x', reason: 'pull-request-target' }]);
        expect(r.policyStatus).toBe('disabled');
    });

    it('F6 — the gate renders disabled as BYPASSED, never as passed', () => {
        // stderr is discarded by callers, so the word has to be in the verdict
        // the gate prints on stdout.
        const disabled = renderBaseSummary({
            entries: [{ ref: 'origin/release/1.x', reason: 'pull-request-target' }],
            policyStatus: 'disabled',
        });
        expect(disabled).toContain('BYPASSED');
        expect(disabled).not.toMatch(/\bpassed\b/i);
        expect(disabled).not.toContain('✅');
        const applied = renderBaseSummary({
            entries: [{ ref: 'origin/release/1.x', reason: 'pull-request-target' }],
            policyStatus: 'applied',
        });
        expect(applied).not.toContain('BYPASSED');
    });

    it('F7 — a policy in the PR head does NOT override the target-SHA policy', () => {
        // The trust boundary, proven rather than documented: HEAD says include,
        // the target says exclude, and the target wins.
        //
        // SENSITIVITY: make `resolveBase` read at `HEAD_SHA` (or read the working
        // tree) instead of the resolved target SHA — this must go red.
        const r = resolveBase(
            '/nowhere',
            null,
            deps({ atSha: { [TARGET_SHA]: POLICY_EXCLUDE, [HEAD_SHA]: POLICY_INCLUDE, [DEFAULT_SHA]: POLICY_INCLUDE } }),
        );
        expect(r.entries).toHaveLength(1);
        expect(r.entries[0]?.ref).toBe('origin/release/1.x');

        // …and the reader is never ASKED for any SHA but the target's.
        const asked: string[] = [];
        resolveBase(
            '/nowhere',
            null,
            deps({
                atSha: {},
                readAtSha: (sha: string, p: string): string | null => {
                    asked.push(sha);
                    return p === POLICY_PATH && sha === TARGET_SHA ? POLICY_EXCLUDE : null;
                },
            }),
        );
        expect(asked).toEqual([TARGET_SHA]);
        expect(asked).not.toContain(HEAD_SHA);
    });

    it('F10 — invalid or unknown policy values fail schema validation', () => {
        const bad = [
            'branchConvergence:\n  enabled: yes-please\n  targets: {}\n',
            'branchConvergence:\n  enabled: true\n  targets:\n    release/1.x:\n      defaultBranch: maybe\n',
            'branchConvergence:\n  enabled: true\n  targets:\n    release/1.x:\n      defaultBranch: include\n      threshold: 5\n',
            'branchConvergence:\n  enabled: true\n  targets: {}\n  fallback: include\n',
            'branchConvergence:\n  enabled: true\n  targets: [release/1.x]\n',
        ];
        for (const t of bad) {
            expect(() => parseBranchConvergencePolicy(t)).toThrow(InvalidBranchConvergencePolicy);
        }
        // A duplicate target key is a parse failure, never a silent last-wins.
        const dup =
            'branchConvergence:\n  enabled: true\n  targets:\n    release/1.x:\n      defaultBranch: include\n    release/1.x:\n      defaultBranch: exclude\n';
        expect(() => parseBranchConvergencePolicy(dup)).toThrow(InvalidBranchConvergencePolicy);
        // A document with no section at all is absent, not invalid.
        expect(parseBranchConvergencePolicy('other: 1\n')).toBeNull();
        // A SHA that is not a commit id never reaches the reader.
        expect(() => loadPolicyAtSha('not-a-sha', () => POLICY_EXCLUDE)).toThrow(InvalidBranchConvergencePolicy);
    });

    it('F11 — an unresolvable target SHA fails closed', () => {
        expect(() =>
            resolveBase('/nowhere', null, deps({ atSha: {}, remoteSha: (): string | null => null })),
        ).toThrow(UnresolvableTargetSha);
        // Fails closed means it does NOT silently degrade to the target alone.
        expect(() =>
            resolveBase('/nowhere', null, deps({ atSha: { [TARGET_SHA]: POLICY_EXCLUDE }, remoteSha: (ref: string): string | null => (ref === 'origin/release/1.x' ? null : DEFAULT_SHA) })),
        ).toThrow(UnresolvableTargetSha);
    });

    it('F12 — target/default identity does not produce duplicate entries', () => {
        // Same SHA under two different names: a release line pointing at the
        // same commit as the default is one ref, not two.
        const r = resolveBase(
            '/nowhere',
            null,
            deps({
                atSha: { [DEFAULT_SHA]: POLICY_INCLUDE },
                remoteSha: (): string | null => DEFAULT_SHA,
            }),
        );
        expect(r.entries).toHaveLength(1);
        expect(r.policyStatus).toBe('not-required');
        // And by ref name, when the PR base IS the default branch name.
        const same = resolveBase('/nowhere', null, deps({ prBase: (): string | null => 'main' }));
        expect(same.entries).toHaveLength(1);
    });
});

describe('branch-convergence — roadmap steps 1.2 and 1.3', () => {
    it('1.2 — every entry carries its own resolution reason from a closed set', () => {
        const r = resolveBase('/nowhere', null, deps({ atSha: { [TARGET_SHA]: POLICY_INCLUDE } }));
        for (const e of r.entries) {
            expect(typeof e.reason).toBe('string');
            expect(['pull-request-target', 'explicit-base-override', 'repository-default-branch', 'branch-convergence-policy:include-default']).toContain(e.reason);
        }
        // The two reasons differ — a set that loses its provenance is worse
        // than the scalar it replaces.
        expect(new Set(r.entries.map((e) => e.reason)).size).toBe(2);
        // …and an explicit override keeps its own reason.
        const o = resolveBase('/nowhere', 'origin/main', deps());
        expect(o.entries).toEqual([{ ref: 'origin/main', reason: 'explicit-base-override' }]);
    });

    it('1.3 — integration runs the DEFAULT first, and the output records the order', () => {
        // The result type is target-first (council § 4, fixture 4); the
        // INTEGRATION order is default-first (roadmap 1.3) so the broad conflict
        // surfaces before the narrow one. Both are stated, neither is inferred.
        const r = resolveBase('/nowhere', null, deps({ atSha: { [TARGET_SHA]: POLICY_INCLUDE } }));
        expect(integrationOrder(r)).toEqual(['origin/main', 'origin/release/1.x']);
        const summary = renderBaseSummary(r);
        expect(summary.indexOf('origin/main')).toBeLessThan(summary.indexOf('origin/release/1.x'));
    });

    it('an unresolvable base is its own error, distinct from a missing policy', () => {
        expect(() =>
            resolveBase('/nowhere', null, deps({ prBase: (): string | null => null, defaultBranch: (): string | null => null })),
        ).toThrow(UnresolvableBase);
    });
});

/**
 * The three cases that lived in `sync_pr_branch.test.ts` § base resolution
 * before `resolveBase` returned a set. Same intent, injected inputs.
 */
describe('branch-convergence — base resolution, carried over', () => {
    it('an explicit --base wins over any probe', () => {
        const r = resolveBase('/nowhere', 'origin/release/9.9.9', deps({ remoteSha: (): string | null => DEFAULT_SHA }));
        expect(r.entries[0]?.ref).toBe('origin/release/9.9.9');
        expect(r.entries[0]?.reason).toBe('explicit-base-override');
    });

    it('a blank --base is not an override', () => {
        // Otherwise `--base ""` would pin the base to the empty string and every
        // rev-list against it would read as "already current".
        const r = resolveBase('/nowhere', '   ', deps({ prBase: (): string | null => 'main' }));
        expect(r.entries[0]?.ref).not.toBe('   ');
        expect(r.entries[0]?.ref).toBe('origin/main');
    });

    it('names HOW each base was resolved, so a wrong base is visible', () => {
        const r = resolveBase('/nowhere', null, deps({ atSha: { [TARGET_SHA]: POLICY_INCLUDE } }));
        const summary = renderBaseSummary(r);
        for (const e of r.entries) {
            expect(summary).toContain(e.ref);
        }
        expect(summary).toContain('the open PR base');
        expect(summary).toContain('branch-convergence policy');
    });
});

/** Phase 3 — auto-resolve exactly one conflict class. */
describe('branch-convergence — Phase 3 generated auto-resolution', () => {
    const ok = { ok: true, err: '' };
    function regenOps(over: Partial<RegenOps> = {}): RegenOps {
        return {
            regenerate: over.regenerate ?? ((): { ok: boolean; err: string } => ok),
            dirty: over.dirty ?? ((): string[] => []),
            stage: over.stage ?? ((): boolean => true),
        };
    }

    it('3.1 — a GENERATED-only set resolves by regeneration, byte-identity asserted', () => {
        let runs = 0;
        const r = autoResolveGenerated(
            { generated: ['dist/router.json'], remeasured: [], authored: [] },
            regenOps({
                regenerate: (): { ok: boolean; err: string } => {
                    runs++;
                    return ok;
                },
            }),
        );
        expect(r.resolved).toBe(true);
        // Twice: once to resolve, once to prove the result reproduces exactly.
        expect(runs).toBe(2);
    });

    it('3.1 — a path that does not reproduce exactly is refused, never overwritten', () => {
        // Risk-register row 2: a partly hand-edited "generated" path.
        const r = autoResolveGenerated(
            { generated: ['dist/router.json'], remeasured: [], authored: [] },
            regenOps({ dirty: (): string[] => ['dist/router.json'] }),
        );
        expect(r.resolved).toBe(false);
        expect(r.message).toContain('not byte-identical');
        expect(r.message).toContain('dist/router.json');
    });

    it('3.2 — REMEASURED and AUTHORED are never auto-resolved, alone or mixed in', () => {
        for (const split of [
            { generated: [], remeasured: ['src/config/gate-violation-baselines.json'], authored: [] },
            { generated: [], remeasured: [], authored: ['src/scripts/x.ts'] },
            { generated: ['dist/router.json'], remeasured: [], authored: ['src/scripts/x.ts'] },
            { generated: ['dist/router.json'], remeasured: ['src/config/gate-violation-baselines.json'], authored: [] },
        ]) {
            const r = autoResolveGenerated(split, regenOps());
            expect(r.resolved).toBe(false);
        }
        // The test fails if either class is ever auto-resolved: one regenerate
        // call would already mean the tree was touched.
        let runs = 0;
        autoResolveGenerated(
            { generated: ['dist/router.json'], remeasured: [], authored: ['src/scripts/x.ts'] },
            regenOps({
                regenerate: (): { ok: boolean; err: string } => {
                    runs++;
                    return ok;
                },
            }),
        );
        expect(runs).toBe(0);
    });

    it('a failed regeneration refuses rather than claiming a resolution', () => {
        const r = autoResolveGenerated(
            { generated: ['dist/router.json'], remeasured: [], authored: [] },
            regenOps({ regenerate: (): { ok: boolean; err: string } => ({ ok: false, err: 'task consistency: exit 1' }) }),
        );
        expect(r.resolved).toBe(false);
        expect(r.message).toContain('regeneration failed');
    });
});

/** Phase 4 — bound the race that is already recorded (PR #1391). */
describe('branch-convergence — Phase 4 pinned base and bounded retry', () => {
    it('4.1 — a base that moves between integration and push is retried, then reported with OIDs', () => {
        const seq = ['1'.repeat(40), '2'.repeat(40), '3'.repeat(40), '4'.repeat(40), '5'.repeat(40), '6'.repeat(40)];
        let k = 0;
        const out = integrateWithPinnedBase(['origin/main'], {
            remoteSha: (): string | null => seq[k++] ?? null,
            merge: (): { ok: boolean; conflicted: string[] } => ({ ok: true, conflicted: [] }),
        });
        expect(out.ok).toBe(false);
        expect(out.attempts).toHaveLength(MAX_BASE_ATTEMPTS);
        // The OIDs of each attempt are IN the output — that is what makes a
        // genuinely moving base distinguishable from a slow run.
        for (const a of out.attempts) {
            expect(out.message).toContain(a.before ?? 'unreachable');
            expect(out.message).toContain(a.after ?? 'unreachable');
        }
        expect(out.message).toContain('stopping rather than looping');
    });

    it('4.1 — a base that holds still integrates on the first attempt', () => {
        const out = integrateWithPinnedBase(['origin/main'], {
            remoteSha: (): string | null => 'f'.repeat(40),
            merge: (): { ok: boolean; conflicted: string[] } => ({ ok: true, conflicted: [] }),
        });
        expect(out.ok).toBe(true);
        expect(out.attempts).toHaveLength(1);
    });

    it('4.1 — a conflict stops immediately; the retry ceiling is for a MOVING base only', () => {
        const out = integrateWithPinnedBase(['origin/main'], {
            remoteSha: (): string | null => 'f'.repeat(40),
            merge: (): { ok: boolean; conflicted: string[] } => ({ ok: false, conflicted: ['dist/router.json'] }),
        });
        expect(out.ok).toBe(false);
        expect(out.conflicted).toEqual(['dist/router.json']);
        expect(out.attempts).toHaveLength(1);
    });

    it('4.2 — the ceiling is three, and no state leaves the run', () => {
        expect(MAX_BASE_ATTEMPTS).toBe(3);
        // Two calls with identical inputs produce identical outputs: nothing was
        // carried over. A queue or a rerere cache would make the second differ.
        const ops = {
            remoteSha: (): string | null => 'f'.repeat(40),
            merge: (): { ok: boolean; conflicted: string[] } => ({ ok: true, conflicted: [] }),
        };
        expect(integrateWithPinnedBase(['origin/main'], ops)).toEqual(integrateWithPinnedBase(['origin/main'], ops));
    });
});

/**
 * Regression for the defect the step-2.1 dry run surfaced on 2026-09-03.
 *
 * `sync_pr_branch` read the default branch from `refs/remotes/origin/HEAD`
 * only. That ref is unset in some checkouts — it was unset in the worktree this
 * roadmap was executed in — so the module refused with "no open PR and no
 * origin/HEAD" while `check_branch_freshness` resolved `origin/main` from the
 * server symref and passed, in the SAME documented sequence, three lines apart.
 */
describe('branch-convergence — the default branch the server reports', () => {
    it('parses the symref git actually prints', () => {
        const real = 'ref: refs/heads/main\tHEAD\n2b3d2b3474e6520ef696466aff583a76381f002c\tHEAD\n';
        expect(parseSymrefDefault(real)).toBe('origin/main');
    });

    it('handles a non-main default and ignores everything that is not a symref line', () => {
        expect(parseSymrefDefault('ref: refs/heads/trunk\tHEAD\n')).toBe('origin/trunk');
        expect(parseSymrefDefault('2b3d2b3\tHEAD\n')).toBeNull();
        expect(parseSymrefDefault('')).toBeNull();
        // A symref pointing outside refs/heads/ is not a default branch.
        expect(parseSymrefDefault('ref: refs/tags/v1\tHEAD\n')).toBeNull();
        expect(parseSymrefDefault('ref: refs/heads/\tHEAD\n')).toBeNull();
    });
});

/** Phase 2 — give the documented sequence a caller, and keep the hook refusing. */
describe('branch-convergence — Phase 2 the sequence has a runner', () => {
    const dev = fs.readFileSync(path.resolve('taskfiles/dev.yml'), 'utf8');
    const hook = fs.readFileSync(path.resolve('src/scripts/install-hooks.sh'), 'utf8');

    it('2.1 — one invocable target performs the full documented sequence', () => {
        expect(dev).toContain('push-ready:');
        // Scan the task's `cmds:` block only. The `desc:` above it narrates the
        // same six steps, so a whole-file scan matches the prose and proves
        // nothing about what actually runs.
        const block = dev.slice(dev.indexOf('push-ready:'));
        const cmds = block.slice(block.indexOf('\n    cmds:'));
        // The six steps of `src/domains/git/pr/create/command.md` § 1b-ii, in
        // order. A target that runs five of them is not the documented sequence.
        const steps = ['1 fetch', '2 integrate the base set', '3 regenerate', '4 verify', '5 re-check freshness', '6 push'];
        let at = -1;
        for (const s of steps) {
            const next = cmds.indexOf(s);
            expect(next, `step missing from task push-ready: ${s}`).toBeGreaterThan(-1);
            expect(next, `step out of order: ${s}`).toBeGreaterThan(at);
            at = next;
        }
        // A dry run exists and is read-only on the two probing steps.
        expect(dev).toContain('DRY=1');
        expect(cmds).toContain('--dry-run');
        expect(cmds).toContain('sync_pr_branch');
        expect(cmds).toContain('check_branch_freshness');
    });

    it('2.2 — the hook says it refuses, and adds no merge of its own', () => {
        expect(hook).toContain('THIS HOOK REFUSES. IT NEVER MERGES');
        expect(hook).toContain('task push-ready');
        // The whole point of the sentence: the next contributor must not turn
        // the refusal into a mutation. `merge-base` is a read-only query and is
        // the only permitted occurrence of the word.
        const mutating = hook
            .split('\n')
            .filter((l) => /\bgit\s+(merge|rebase|pull)\b/.test(l) && !/merge-base/.test(l) && !l.trim().startsWith('#'));
        expect(mutating).toEqual([]);
    });
});
