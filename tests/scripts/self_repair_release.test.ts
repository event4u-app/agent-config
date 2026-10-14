/**
 * The egress ladder's outgoing `gh pr create`, scripted through the injectable
 * runner (`ReleaseDeps.runner`) rather than shelled out.
 *
 * F4 of road-to-one-upstream-that-checks-what-leaves: `prArgs` carried no
 * `--draft`, so every upstream finding arrived as a review request against a
 * maintainer who had not asked for one. The flag is one argument and nothing
 * watched it, which is how it was absent for the whole life of the ladder.
 *
 * Both rungs are asserted, not just the one the happy path takes. The two
 * share one `prArgs` array today, so one `--draft` does cover both — but the
 * fork rung reaches it down a different path (fork-ensure, whoami, a second
 * remote, then an extra `--head`), and a later split of that array would be
 * invisible to a test that only drove the direct-push rung. The fork route is
 * the one a contributor without push rights actually takes, which is the one
 * that must not quietly start opening ready-for-review.
 */
import { describe, expect, it } from 'vitest';

import type { DefectRecord } from '../../src/scripts/_lib/self_repair.js';
import type {
    Probe,
    ReleaseDeps,
    ReleasePlan,
    RunResult,
    Runner,
} from '../../src/scripts/self_repair_cli.js';
import { executeRelease } from '../../src/scripts/self_repair_cli.js';

const OK: RunResult = { ok: true, out: '', timedOut: false };

// Typed, not cast. An `as unknown as DefectRecord` would switch off exactly
// the check that tells this fixture when the record shape moves under it —
// a fixture that compiles against a type it does not satisfy is a fixture
// that stops reporting drift.
function record(): DefectRecord {
    return {
        fingerprint: 'abc123def4567890',
        defect_class: 'user-reported',
        source: 'user-reported',
        evidence: 'a sanitized span',
        suggested_surface: 'src/rules/example.md',
        first_seen: '2026-10-14T00:00:00.000Z',
        last_seen: '2026-10-14T00:00:00.000Z',
        occurrences: 1,
        status: 'open',
    };
}

function plan(pushVia: 'upstream' | 'fork'): ReleasePlan {
    return {
        route: 'pull-request',
        pushVia,
        blocked: null,
        patch_denied: null,
        title: 'a title',
        body: 'a body',
    };
}

function probe(canFork: boolean): Probe {
    return {
        agentConfigCheckout: '/some/checkout',
        ghAuthenticated: true,
        canPushUpstream: true,
        canFork,
    };
}

/**
 * A runner that answers every command successfully and records the argv of
 * each `gh pr create`. `git branch --show-current` has to answer a real branch
 * name or the ladder refuses before it ever reaches the forge.
 */
function scriptedRunner(): { runner: Runner; prCalls: string[][] } {
    const prCalls: string[][] = [];
    const runner: Runner = (cmd, args) => {
        if (cmd === 'git' && args[0] === 'branch') {
            return { ok: true, out: 'retro/abc123de\n', timedOut: false };
        }
        if (cmd === 'gh' && args[0] === 'api') {
            return { ok: true, out: 'some-login\n', timedOut: false };
        }
        if (cmd === 'gh' && args[0] === 'pr' && args[1] === 'create') {
            prCalls.push([...args]);
            return { ok: true, out: 'https://example.invalid/pr/1\n', timedOut: false };
        }
        return OK;
    };
    return { runner, prCalls };
}

function deps(runner: Runner): ReleaseDeps {
    return { runner, now: () => '2026-10-14T00:00:00.000Z' };
}

describe('the upstream pull request is a draft', () => {
    it('pr-is-draft — the direct-push rung passes --draft', () => {
        const { runner, prCalls } = scriptedRunner();
        const out = executeRelease(record(), plan('upstream'), probe(false), 'o/r', deps(runner));

        expect(out.published).toBe('pull-request');
        expect(prCalls).toHaveLength(1);
        expect(prCalls[0]).toContain('--draft');
    });

    it('pr-is-draft — the fork rung passes --draft too', () => {
        const { runner, prCalls } = scriptedRunner();
        const out = executeRelease(record(), plan('fork'), probe(true), 'o/r', deps(runner));

        expect(out.published).toBe('pull-request');
        expect(prCalls).toHaveLength(1);
        expect(prCalls[0]).toContain('--draft');
        // The fork rung is the one that adds --head; asserting it here is what
        // makes this a test of the fork path rather than a second copy of the
        // one above.
        expect(prCalls[0]).toContain('--head');
    });

    it('--draft precedes the title, so no value is read as the flag', () => {
        const { runner, prCalls } = scriptedRunner();
        executeRelease(record(), plan('upstream'), probe(false), 'o/r', deps(runner));

        const args = prCalls[0] as string[];
        // The -1 guard is not decoration. Written as `indexOf('--draft') <
        // indexOf('--title')` alone, this case passed with the flag REMOVED —
        // absent is -1, and -1 is less than everything. The sensitivity probe
        // that removes the flag caught it; without this line the case would
        // have shipped as a third assertion that asserts nothing.
        expect(args).toContain('--draft');
        expect(args.indexOf('--draft')).toBeLessThan(args.indexOf('--title'));
        expect(args[args.indexOf('--title') + 1]).toBe('a title');
        expect(args[args.indexOf('--body') + 1]).toBe('a body');
    });
});
