/**
 * The five `forge_protection` rows — `road-to-adversarial-verification-and-long-runs`
 * Phase 3.2.
 *
 * The load-bearing property is the THREE-state row: a value only exists when a
 * named call produced it, and a row nobody read is `unread` rather than a quiet
 * `false`. Every case below drives a direction the mapper could plausibly have
 * got wrong; the fixture in the last block is the live shape of this repository's
 * own ruleset, so a mapper that stops understanding a real payload reds here.
 */

import { describe, expect, it } from 'vitest';

import {
    PROTECTION_ROW_IDS,
    deployRestrictedFrom,
    forgeProtectionRows,
    protectionActions,
    unconditionalBypasses,
    type EnvironmentPolicy,
    type ForgeReading,
} from '../../src/scripts/_lib/forge_protection.js';
import type { RulesetDetail } from '../../src/scripts/_lib/platform_anchor.js';

const UNREAD: ForgeReading = {
    rulesets: null,
    defaultBranch: null,
    allowAutoMerge: null,
    deployRestricted: null,
};

/** The live shape of this repository's ruleset, read 2026-09-13. */
const LIVE_RULESET: RulesetDetail = {
    id: 17749383,
    name: 'main protection',
    target: 'branch',
    enforcement: 'active',
    conditions: { ref_name: { include: ['~DEFAULT_BRANCH'] } },
    rules: [
        { type: 'deletion' },
        { type: 'pull_request', parameters: { required_approving_review_count: 0 } },
        {
            type: 'required_status_checks',
            parameters: {
                strict_required_status_checks_policy: true,
                required_status_checks: [
                    { context: 'Sync + Generate Tools Consistency' },
                    { context: 'Standing payload delta + budget gate' },
                ],
            },
        },
        { type: 'non_fast_forward' },
    ],
};

describe('the three-state row', () => {
    it('an unread forge yields five unread rows, never five false ones', () => {
        const rows = forgeProtectionRows(UNREAD);
        expect(rows.map((r) => r.id)).toEqual(PROTECTION_ROW_IDS);
        expect(rows.every((r) => r.state === 'unread')).toBe(true);
    });

    it('every row names its API call even when unread — that is the whole point', () => {
        for (const row of forgeProtectionRows(UNREAD)) {
            expect(row.source).not.toBe('');
            expect(row.source).toMatch(/^GET repos\//);
        }
    });

    it('an unread row still produces a human ACTION', () => {
        // Omitting it would make "nobody looked" indistinguishable from
        // "satisfied", which is the conflation the third state exists to stop.
        expect(protectionActions(forgeProtectionRows(UNREAD))).toHaveLength(5);
    });
});

describe('against the live ruleset shape', () => {
    const live = (over: Partial<ForgeReading> = {}): ForgeReading => ({
        rulesets: [LIVE_RULESET],
        defaultBranch: 'main',
        allowAutoMerge: false,
        deployRestricted: false,
        ...over,
    });
    const byId = (r: ForgeReading, id: string): string =>
        forgeProtectionRows(r).find((x) => x.id === id)?.state ?? 'missing';

    it('reads protection, required checks and force-push as satisfied', () => {
        const r = live();
        expect(byId(r, 'default_branch_protected')).toBe('satisfied');
        expect(byId(r, 'required_checks_present')).toBe('satisfied');
        expect(byId(r, 'force_push_disabled')).toBe('satisfied');
    });

    it('reads auto-merge and deploy restriction as unsatisfied — the current state', () => {
        const r = live();
        expect(byId(r, 'auto_merge_available')).toBe('unsatisfied');
        expect(byId(r, 'deploy_via_pipeline_only')).toBe('unsatisfied');
    });

    it('a DISABLED ruleset protects nothing', () => {
        const disabled = { ...LIVE_RULESET, enforcement: 'disabled' };
        expect(byId(live({ rulesets: [disabled] }), 'default_branch_protected')).toBe(
            'unsatisfied',
        );
    });

    it('a ruleset that does not reach the default branch protects nothing', () => {
        const elsewhere = {
            ...LIVE_RULESET,
            conditions: { ref_name: { include: ['refs/heads/release/*'] } },
        };
        expect(byId(live({ rulesets: [elsewhere] }), 'default_branch_protected')).toBe(
            'unsatisfied',
        );
    });

    it('an explicit default-branch ref and ~ALL both count as reaching it', () => {
        for (const include of [['refs/heads/main'], ['~ALL']]) {
            const rs = { ...LIVE_RULESET, conditions: { ref_name: { include } } };
            expect(byId(live({ rulesets: [rs] }), 'default_branch_protected')).toBe('satisfied');
        }
    });

    it('removing non_fast_forward flips ONLY the force-push row', () => {
        const noFf = {
            ...LIVE_RULESET,
            rules: (LIVE_RULESET.rules ?? []).filter((x) => x.type !== 'non_fast_forward'),
        };
        const r = live({ rulesets: [noFf] });
        expect(byId(r, 'force_push_disabled')).toBe('unsatisfied');
        expect(byId(r, 'default_branch_protected')).toBe('satisfied');
        expect(byId(r, 'required_checks_present')).toBe('satisfied');
    });

    it('an empty required-checks list is unsatisfied, not unread', () => {
        const noChecks = {
            ...LIVE_RULESET,
            rules: (LIVE_RULESET.rules ?? []).filter(
                (x) => x.type !== 'required_status_checks',
            ),
        };
        expect(byId(live({ rulesets: [noChecks] }), 'required_checks_present')).toBe(
            'unsatisfied',
        );
    });

    it('the detail on an unprotected default branch warns about the classic-404 trap', () => {
        const rows = forgeProtectionRows(live({ rulesets: [] }));
        const row = rows.find((r) => r.id === 'default_branch_protected');
        expect(row?.detail).toMatch(/404s on a ruleset-protected repository/);
    });

    it('a partial reading mixes states rather than collapsing to one', () => {
        const r = live({ allowAutoMerge: null });
        expect(byId(r, 'force_push_disabled')).toBe('satisfied');
        expect(byId(r, 'auto_merge_available')).toBe('unread');
    });
});

describe('unconditionalBypasses', () => {
    it('reports only always-mode actors on a covering ruleset', () => {
        const rs: RulesetDetail = {
            ...LIVE_RULESET,
            bypass_actors: [
                { actor_type: 'RepositoryRole', actor_id: 5, bypass_mode: 'always' },
                { actor_type: 'Team', actor_id: 9, bypass_mode: 'pull_request' },
            ],
        };
        expect(unconditionalBypasses([rs], 'main').map((a) => a.actor_id)).toEqual([5]);
    });

    it('ignores a ruleset that does not cover the default branch', () => {
        const rs: RulesetDetail = {
            ...LIVE_RULESET,
            conditions: { ref_name: { include: ['refs/heads/other'] } },
            bypass_actors: [{ actor_type: 'RepositoryRole', bypass_mode: 'always' }],
        };
        expect(unconditionalBypasses([rs], 'main')).toHaveLength(0);
    });
});

describe('deployRestrictedFrom', () => {
    /**
     * The live shape of this repository's only environment, read 2026-09-30.
     * `protected_branches` is false and `custom_branch_policies` is true with a
     * single policy, `main` — the exact payload that was written up as
     * unrestricted on 2026-09-13 by consulting only the first flag.
     */
    const LIVE_PAGES: EnvironmentPolicy = {
        name: 'github-pages',
        deployment_branch_policy: { protected_branches: false, custom_branch_policies: true },
    };

    it('counts a custom branch policy as restricted — the 2026-09-13 misreading', () => {
        expect(deployRestrictedFrom([LIVE_PAGES])).toBe(true);
    });

    it('counts protected_branches as restricted', () => {
        expect(
            deployRestrictedFrom([
                {
                    name: 'prod',
                    deployment_branch_policy: {
                        protected_branches: true,
                        custom_branch_policies: false,
                    },
                },
            ]),
        ).toBe(true);
    });

    it('refutes the row for a null policy — GitHub encodes "any branch" that way', () => {
        expect(deployRestrictedFrom([{ name: 'staging', deployment_branch_policy: null }])).toBe(
            false,
        );
    });

    it('refutes the row when both mechanisms are off', () => {
        expect(
            deployRestrictedFrom([
                {
                    name: 'staging',
                    deployment_branch_policy: {
                        protected_branches: false,
                        custom_branch_policies: false,
                    },
                },
            ]),
        ).toBe(false);
    });

    it('is a property of the SET — one unrestricted environment refutes it', () => {
        expect(
            deployRestrictedFrom([LIVE_PAGES, { name: 'scratch', deployment_branch_policy: null }]),
        ).toBe(false);
    });

    it('treats an absent flag as not-set rather than truthy', () => {
        expect(deployRestrictedFrom([{ name: 'e', deployment_branch_policy: {} }])).toBe(false);
    });

    it('returns null for an empty set — a failed fetch is not a satisfied row', () => {
        // R2 finding 1: `true` here collapsed "confirmed zero environments" into
        // "the fetch came back empty", which is the quiet false-positive the
        // three-state row exists to prevent. `null` maps to `unread`.
        expect(deployRestrictedFrom([])).toBeNull();
    });

    it('an empty set reaches the row as unread, never as satisfied', () => {
        const rows = forgeProtectionRows({
            rulesets: null,
            defaultBranch: null,
            allowAutoMerge: null,
            deployRestricted: deployRestrictedFrom([]),
        });
        expect(rows.find((r) => r.id === 'deploy_via_pipeline_only')?.state).toBe('unread');
    });

    it('a wildcard custom policy restricts nothing, whatever the flag says', () => {
        // R2 finding 2: the flag cannot distinguish a policy pinned to `main`
        // from one whose pattern is `*`; the names come from a second call.
        expect(deployRestrictedFrom([LIVE_PAGES], { 'github-pages': ['*'] })).toBe(false);
        expect(deployRestrictedFrom([LIVE_PAGES], { 'github-pages': ['**'] })).toBe(false);
    });

    it('named patterns that are not wildcards stay restricted', () => {
        expect(deployRestrictedFrom([LIVE_PAGES], { 'github-pages': ['main'] })).toBe(true);
    });

    it('an empty pattern list is not a restriction', () => {
        expect(deployRestrictedFrom([LIVE_PAGES], { 'github-pages': [] })).toBe(false);
    });

    it('patterns supplied for a different environment do not silently apply', () => {
        // Keyed by name: an unrelated entry leaves this environment on the
        // flag-only path rather than borrowing another environment's patterns.
        expect(deployRestrictedFrom([LIVE_PAGES], { other: ['*'] })).toBe(true);
    });

    it('a protected_branches environment ignores patterns entirely', () => {
        expect(
            deployRestrictedFrom(
                [
                    {
                        name: 'prod',
                        deployment_branch_policy: {
                            protected_branches: true,
                            custom_branch_policies: false,
                        },
                    },
                ],
                { prod: ['*'] },
            ),
        ).toBe(true);
    });

    it('feeds the row: the live environment makes deploy_via_pipeline_only satisfied', () => {
        const rows = forgeProtectionRows({
            rulesets: null,
            defaultBranch: null,
            allowAutoMerge: null,
            deployRestricted: deployRestrictedFrom([LIVE_PAGES]),
        });
        const row = rows.find((r) => r.id === 'deploy_via_pipeline_only');
        expect(row?.state).toBe('satisfied');
    });
});
