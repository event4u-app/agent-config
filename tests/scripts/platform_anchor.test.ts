import * as fs from 'node:fs';
import * as path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
    coversDefaultBranch,
    effectiveProtection,
    enforceFloor,
    evaluateAnchor,
    NON_NEGOTIABLE_FLOOR,
    readAnchorPolicy,
    type AnchorPolicy,
    type RulesetDetail,
} from '../../src/scripts/_lib/platform_anchor.js';
import {
    evaluateGate,
    POLICY_PATH,
    touchesPolicy,
    type AnchorSource,
} from '../../src/scripts/check_platform_anchor.js';
import { ANCHOR_PATHS, classifyPaths, requiresRatification } from '../../src/scripts/check_kernel_edit_ratified.js';

/**
 * Both polarities on every rule, because a gate whose failing direction is
 * never exercised has unknown sensitivity — it can be green because the tree is
 * clean or because the check does nothing, and the two are indistinguishable
 * from a passing suite.
 */

const REPO = path.resolve(__dirname, '..', '..');

function policy(over: Partial<AnchorPolicy> = {}): AnchorPolicy {
    return {
        enforcement: 'active',
        target: 'branch',
        covers_default_branch: true,
        minimum_approving_reviews: 1,
        require_last_push_approval: true,
        required_review_thread_resolution: true,
        block_deletion: true,
        block_non_fast_forward: true,
        strict_required_status_checks: true,
        required_status_check_contexts: ['Sync + Generate Tools Consistency'],
        allow_unconditional_bypass: false,
        ...over,
    };
}

/** A ruleset that satisfies every rule the default policy asks for. */
function compliantRuleset(over: Partial<RulesetDetail> = {}): RulesetDetail {
    return {
        id: 1,
        name: 'main protection',
        target: 'branch',
        enforcement: 'active',
        conditions: { ref_name: { include: ['~DEFAULT_BRANCH'], exclude: [] } },
        rules: [
            { type: 'deletion' },
            { type: 'non_fast_forward' },
            {
                type: 'pull_request',
                parameters: {
                    required_approving_review_count: 1,
                    require_last_push_approval: true,
                    required_review_thread_resolution: true,
                },
            },
            {
                type: 'required_status_checks',
                parameters: {
                    strict_required_status_checks_policy: true,
                    required_status_checks: [{ context: 'Sync + Generate Tools Consistency' }],
                },
            },
        ],
        bypass_actors: [],
        ...over,
    };
}

/**
 * The configuration measured on `event4u-app/agent-config` on 2026-09-10.
 *
 * Pinned as a fixture rather than described in prose: this is the state that
 * made the anchor a finding, and a reader six months from now can see exactly
 * what was true rather than trusting a sentence about it.
 */
function measured2026_09_10(): RulesetDetail {
    return {
        id: 17749383,
        name: 'main protection',
        target: 'branch',
        enforcement: 'active',
        conditions: { ref_name: { include: ['~DEFAULT_BRANCH'], exclude: [] } },
        rules: [
            { type: 'deletion' },
            {
                type: 'pull_request',
                parameters: {
                    required_approving_review_count: 0,
                    dismiss_stale_reviews_on_push: true,
                    require_code_owner_review: false,
                    require_last_push_approval: false,
                    required_review_thread_resolution: true,
                },
            },
            {
                type: 'required_status_checks',
                parameters: {
                    strict_required_status_checks_policy: true,
                    required_status_checks: [{ context: 'Sync + Generate Tools Consistency' }],
                },
            },
            { type: 'non_fast_forward' },
        ],
        bypass_actors: [{ actor_id: 5, actor_type: 'RepositoryRole', bypass_mode: 'always' }],
    };
}

function source(
    rulesets: RulesetDetail[] | null,
    defaultBranch: string | null = 'main',
): AnchorSource {
    return { rulesets: () => rulesets, defaultBranch: () => defaultBranch };
}

describe('the committed expectation', () => {
    it('parses and sits at or above the embedded floor', () => {
        const text = fs.readFileSync(path.join(REPO, POLICY_PATH), 'utf8');
        const { policy: read, findings } = readAnchorPolicy(text);
        expect(findings).toEqual([]);
        expect(read).not.toBeNull();
        expect(read?.minimum_approving_reviews).toBeGreaterThanOrEqual(
            NON_NEGOTIABLE_FLOOR.minimum_approving_reviews,
        );
        expect(read?.allow_unconditional_bypass).toBe(false);
    });

    it('is itself a gated surface, so lowering it needs its own ratification', () => {
        for (const p of ANCHOR_PATHS) {
            expect(requiresRatification(classifyPaths([p]))).toBe(true);
        }
    });
});

describe('reading the expectation refuses a half-read one', () => {
    it('absent is a finding, never an assumed policy', () => {
        const { policy: p, findings } = readAnchorPolicy(null);
        expect(p).toBeNull();
        expect(findings[0]?.code).toBe('policy-missing');
    });

    it('unparseable is its own code', () => {
        const { policy: p, findings } = readAnchorPolicy('{ not json');
        expect(p).toBeNull();
        expect(findings[0]?.code).toBe('policy-unparseable');
    });

    it('a missing field is named rather than defaulted', () => {
        const { policy: p, findings } = readAnchorPolicy(
            JSON.stringify({ required: { enforcement: 'active' } }),
        );
        expect(p).toBeNull();
        expect(findings.some((f) => f.code === 'policy-missing-field')).toBe(true);
    });

    it('a policy under the floor is rejected, not honoured', () => {
        const text = JSON.stringify({ required: { ...policy(), minimum_approving_reviews: 0 } });
        const { policy: p, findings } = readAnchorPolicy(text);
        expect(p).toBeNull();
        expect(findings.some((f) => f.code === 'policy-below-floor')).toBe(true);
    });

    it('the floor rejects each weakening independently', () => {
        expect(enforceFloor(policy({ allow_unconditional_bypass: true }))).toHaveLength(1);
        expect(enforceFloor(policy({ block_non_fast_forward: false }))).toHaveLength(1);
        expect(enforceFloor(policy({ required_status_check_contexts: [] }))).toHaveLength(1);
        expect(enforceFloor(policy())).toEqual([]);
    });
});

describe('ref matching', () => {
    const rs = (include: string[], exclude: string[] = []): RulesetDetail => ({
        conditions: { ref_name: { include, exclude } },
    });

    it('matches the default-branch token, an explicit name and the all token', () => {
        expect(coversDefaultBranch(rs(['~DEFAULT_BRANCH']), 'main')).toBe(true);
        expect(coversDefaultBranch(rs(['refs/heads/main']), 'main')).toBe(true);
        expect(coversDefaultBranch(rs(['~ALL']), 'main')).toBe(true);
    });

    it('does not match an unrelated branch, and an exclude wins', () => {
        expect(coversDefaultBranch(rs(['refs/heads/release']), 'main')).toBe(false);
        expect(coversDefaultBranch(rs(['~ALL'], ['refs/heads/main']), 'main')).toBe(false);
        expect(coversDefaultBranch(rs([]), 'main')).toBe(false);
    });
});

describe('the effective configuration is the union, never one ruleset', () => {
    it('takes the maximum approval count and ORs the booleans across rulesets', () => {
        const weak = compliantRuleset({
            id: 1,
            rules: [
                {
                    type: 'pull_request',
                    parameters: { required_approving_review_count: 0, require_last_push_approval: false },
                },
            ],
        });
        const strong = compliantRuleset({
            id: 2,
            rules: [
                {
                    type: 'pull_request',
                    parameters: { required_approving_review_count: 2, require_last_push_approval: true },
                },
            ],
        });
        const eff = effectiveProtection([weak, strong], 'main', policy());
        expect(eff.rulesetIds).toEqual([1, 2]);
        expect(eff.approvingReviews).toBe(2);
        expect(eff.requireLastPushApproval).toBe(true);
    });

    it('ignores an inactive ruleset and one aimed at another target', () => {
        const evaluated = effectiveProtection(
            [
                compliantRuleset({ id: 1, enforcement: 'evaluate' }),
                compliantRuleset({ id: 2, target: 'tag' }),
            ],
            'main',
            policy(),
        );
        expect(evaluated.rulesetIds).toEqual([]);
    });

    it('accumulates unconditional bypass actors and ignores conditional ones', () => {
        const eff = effectiveProtection(
            [
                compliantRuleset({
                    bypass_actors: [
                        { actor_type: 'RepositoryRole', actor_id: 5, bypass_mode: 'always' },
                        { actor_type: 'Team', actor_id: 9, bypass_mode: 'pull_request' },
                    ],
                }),
            ],
            'main',
            policy(),
        );
        expect(eff.unconditionalBypassActors).toHaveLength(1);
        expect(eff.unconditionalBypassActors[0]?.actor_type).toBe('RepositoryRole');
    });
});

describe('the verdict', () => {
    it('is compliant when every rule is satisfied', () => {
        const r = evaluateAnchor(policy(), [compliantRuleset()], 'main');
        expect(r.status).toBe('compliant');
        expect(r.findings).toEqual([]);
    });

    it('is unverifiable — not compliant — when the rulesets cannot be read', () => {
        const r = evaluateAnchor(policy(), null, 'main');
        expect(r.status).toBe('unverifiable');
        expect(r.findings[0]?.code).toBe('rulesets-unreadable');
    });

    it('is unverifiable when the default branch cannot be resolved', () => {
        const r = evaluateAnchor(policy(), [compliantRuleset()], null);
        expect(r.status).toBe('unverifiable');
        expect(r.findings[0]?.code).toBe('default-branch-unknown');
    });

    it('is noncompliant when nothing covers the default branch', () => {
        const r = evaluateAnchor(policy(), [], 'main');
        expect(r.status).toBe('noncompliant');
        expect(r.findings[0]?.code).toBe('no-applicable-ruleset');
    });

    it('names each violated rule with its own code', () => {
        const bare = compliantRuleset({ rules: [], bypass_actors: [] });
        const codes = evaluateAnchor(policy(), [bare], 'main').findings.map((f) => f.code);
        expect(codes).toContain('approvals-below-minimum');
        expect(codes).toContain('last-push-approval-missing');
        expect(codes).toContain('thread-resolution-missing');
        expect(codes).toContain('deletion-not-blocked');
        expect(codes).toContain('non-fast-forward-not-blocked');
        expect(codes).toContain('status-checks-not-strict');
        expect(codes).toContain('required-context-missing');
    });

    it('fails an unconditional bypass actor', () => {
        const r = evaluateAnchor(
            policy(),
            [
                compliantRuleset({
                    bypass_actors: [{ actor_type: 'RepositoryRole', actor_id: 5, bypass_mode: 'always' }],
                }),
            ],
            'main',
        );
        expect(r.status).toBe('noncompliant');
        expect(r.findings.map((f) => f.code)).toEqual(['unconditional-bypass']);
    });

    it('reports the 2026-09-10 measured configuration as noncompliant on three counts', () => {
        const r = evaluateAnchor(policy(), [measured2026_09_10()], 'main');
        expect(r.status).toBe('noncompliant');
        const codes = r.findings.map((f) => f.code);
        expect(codes).toContain('approvals-below-minimum');
        expect(codes).toContain('last-push-approval-missing');
        expect(codes).toContain('unconditional-bypass');
        // The gate's containing job IS a required context, so this is NOT among
        // the findings — the correction that a required check pins a job name
        // and not its steps.
        expect(codes).not.toContain('required-context-missing');
    });
});

describe('the gate only consults the platform on a gated diff', () => {
    const text = (): string => fs.readFileSync(path.join(REPO, POLICY_PATH), 'utf8');

    it('passes an ordinary diff without reading the forge at all', () => {
        let asked = false;
        const spy: AnchorSource = {
            rulesets: () => {
                asked = true;
                return null;
            },
            defaultBranch: () => 'main',
        };
        const r = evaluateGate(['README.md'], text(), spy, 'o/r');
        expect(r.exitCode).toBe(0);
        expect(asked).toBe(false);
    });

    it('consults it for a kernel rule and passes a compliant platform', () => {
        const r = evaluateGate(
            ['src/rules/commit-policy.md'],
            text(),
            source([compliantRuleset()]),
            'o/r',
        );
        expect(r.exitCode).toBe(0);
    });

    it('fails a kernel rule against the measured platform', () => {
        const r = evaluateGate(
            ['src/rules/commit-policy.md'],
            text(),
            source([measured2026_09_10()]),
            'o/r',
        );
        expect(r.exitCode).toBe(1);
        expect(r.lines.join('\n')).toContain('NONCOMPLIANT');
    });

    it('fails closed when the platform cannot be read', () => {
        const r = evaluateGate(['src/rules/commit-policy.md'], text(), source(null), 'o/r');
        expect(r.exitCode).toBe(1);
        expect(r.lines.join('\n')).toContain('UNVERIFIABLE');
    });

    it('fails when the expectation file is absent', () => {
        const r = evaluateGate(
            ['src/rules/commit-policy.md'],
            null,
            source([compliantRuleset()]),
            'o/r',
        );
        expect(r.exitCode).toBe(1);
        expect(r.lines.join('\n')).toContain('policy-missing');
    });

    it('treats an edit to the expectation itself as gated', () => {
        expect(touchesPolicy([POLICY_PATH])).toBe(true);
        expect(touchesPolicy(['README.md'])).toBe(false);
        const r = evaluateGate([POLICY_PATH], text(), source([measured2026_09_10()]), 'o/r');
        expect(r.exitCode).toBe(1);
    });
});
