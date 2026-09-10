import * as fs from 'node:fs';
import * as path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
    checkAnchorIdentity,
    coversDefaultBranch,
    effectiveProtection,
    enforceFloor,
    evaluateAnchor,
    NON_NEGOTIABLE_FLOOR,
    readAnchorPolicy,
    refPatternMatches,
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

/**
 * Regressions from the blind completion review of 2026-09-10.
 *
 * Every case here was green before the fix, which is the point of keeping them
 * in their own block: the original 25 asserted both polarities on every rule
 * their author knew about, and these are the rules their author did not know
 * about. Two were probed by the reviewer against the shipped evaluator and are
 * reproduced as written.
 */
describe('the floor covers the selectors, not only the thresholds', () => {
    it('refuses a policy that would read non-enforcing rulesets as protection', () => {
        // Probed: `enforcement: "evaluate"` made a dry-run ruleset read as full
        // protection and returned `compliant` with zero findings.
        expect(enforceFloor(policy({ enforcement: 'evaluate' }))).toHaveLength(1);
        expect(enforceFloor(policy({ target: 'tag' }))).toHaveLength(1);
        expect(enforceFloor(policy({ covers_default_branch: false }))).toHaveLength(1);
        expect(enforceFloor(policy({ required_review_thread_resolution: false }))).toHaveLength(1);
    });

    it('refuses a non-numeric approval floor instead of comparing against NaN', () => {
        // `Number("one")` is NaN; `NaN < 1` is false, so a bare threshold
        // comparison read it as satisfying the floor, and the same NaN then
        // made `observed < NaN` false so the approval rule disappeared.
        const text = JSON.stringify({
            schema_version: 1,
            required: { ...policy(), minimum_approving_reviews: 'one' },
        });
        const { policy: p, findings } = readAnchorPolicy(text);
        expect(p).toBeNull();
        expect(findings.some((f) => f.code === 'policy-below-floor')).toBe(true);
    });

    it('refuses a non-integer and an absurd approval floor', () => {
        expect(enforceFloor(policy({ minimum_approving_reviews: 1.5 }))).toHaveLength(1);
        expect(enforceFloor(policy({ minimum_approving_reviews: 10_000 }))).toHaveLength(1);
        expect(enforceFloor(policy({ minimum_approving_reviews: 2 }))).toEqual([]);
    });

    it('refuses an unknown key in `required` rather than ignoring it', () => {
        const text = JSON.stringify({
            schema_version: 1,
            required: { ...policy(), minimum_approvals: 1 },
        });
        const { policy: p, findings } = readAnchorPolicy(text);
        expect(p).toBeNull();
        expect(findings.some((f) => f.code === 'policy-unknown-field')).toBe(true);
    });
});

describe('the expectation knows which repository it describes', () => {
    it('refuses a repository that is not the one the expectation names', () => {
        const text = JSON.stringify({ schema_version: 1, repository: 'a/b', required: policy() });
        expect(checkAnchorIdentity(text, 'a/b')).toEqual([]);
        const mismatch = checkAnchorIdentity(text, 'someone/fork');
        expect(mismatch.map((f) => f.code)).toContain('policy-repository-mismatch');
    });

    it('refuses a schema version its reader does not support', () => {
        const text = JSON.stringify({ schema_version: 2, repository: 'a/b', required: policy() });
        expect(checkAnchorIdentity(text, 'a/b')).toHaveLength(1);
    });

    it('is checked by the gate, so a fork cannot pass on another expectation', () => {
        const text = fs.readFileSync(path.join(REPO, POLICY_PATH), 'utf8');
        const r = evaluateGate(
            ['src/rules/commit-policy.md'],
            text,
            source([compliantRuleset()]),
            'someone/fork',
        );
        expect(r.exitCode).toBe(1);
        expect(r.lines.join('\n')).toContain('policy-repository-mismatch');
    });
});

describe('ref conditions are fnmatch patterns, not literals', () => {
    it('keeps a single star inside one segment and lets a double star cross', () => {
        expect(refPatternMatches('refs/heads/*', 'refs/heads/main')).toBe(true);
        expect(refPatternMatches('refs/heads/*', 'refs/heads/a/b')).toBe(false);
        expect(refPatternMatches('refs/heads/**', 'refs/heads/a/b')).toBe(true);
        expect(refPatternMatches('refs/heads/m?in', 'refs/heads/main')).toBe(true);
        expect(refPatternMatches('refs/heads/m?in', 'refs/heads/mn')).toBe(false);
    });

    it('cannot widen itself through a regex metacharacter', () => {
        expect(refPatternMatches('refs/heads/m.in', 'refs/heads/main')).toBe(false);
        expect(refPatternMatches('refs/heads/m.in', 'refs/heads/m.in')).toBe(true);
    });

    it('honours a glob exclude — the one fail-OPEN direction the review found', () => {
        // Probed: with `===` matching, `exclude: ["refs/heads/m*"]` under
        // `include: ["~ALL"]` reported `main` as covered, crediting a ruleset
        // that in fact excludes it.
        const rs: RulesetDetail = {
            conditions: { ref_name: { include: ['~ALL'], exclude: ['refs/heads/m*'] } },
        };
        expect(coversDefaultBranch(rs, 'main')).toBe(false);
    });

    it('honours a glob include, which the literal form read as no match', () => {
        const rs: RulesetDetail = { conditions: { ref_name: { include: ['refs/heads/**'] } } };
        expect(coversDefaultBranch(rs, 'main')).toBe(true);
    });

    it('treats an empty include as covering nothing', () => {
        expect(coversDefaultBranch({ conditions: { ref_name: { include: [] } } }, 'main')).toBe(
            false,
        );
        expect(coversDefaultBranch({}, 'main')).toBe(false);
    });
});

describe('the gate accounts for each path and spends no wasted call', () => {
    const text = (): string => fs.readFileSync(path.join(REPO, POLICY_PATH), 'utf8');

    it('reports a ledger tally naming what it decided', () => {
        const r = evaluateGate(
            ['src/rules/commit-policy.md', 'README.md'],
            text(),
            source([compliantRuleset()]),
            'event4u-app/agent-config',
        );
        expect(r.lines.join('\n')).toMatch(/ledger: planned 2 .* out_of_scope 1/);
    });

    it('does not ask for the default branch once the ruleset read has failed', () => {
        let branchCalls = 0;
        const spy: AnchorSource = {
            rulesets: () => null,
            defaultBranch: () => {
                branchCalls += 1;
                return 'main';
            },
        };
        const r = evaluateGate(
            ['src/rules/commit-policy.md'],
            text(),
            spy,
            'event4u-app/agent-config',
        );
        expect(r.exitCode).toBe(1);
        expect(branchCalls).toBe(0);
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
        const r = evaluateGate(['README.md'], text(), spy, 'event4u-app/agent-config');
        expect(r.exitCode).toBe(0);
        expect(asked).toBe(false);
    });

    it('consults it for a kernel rule and passes a compliant platform', () => {
        const r = evaluateGate(
            ['src/rules/commit-policy.md'],
            text(),
            source([compliantRuleset()]),
            'event4u-app/agent-config',
        );
        expect(r.exitCode).toBe(0);
    });

    it('fails a kernel rule against the measured platform', () => {
        const r = evaluateGate(
            ['src/rules/commit-policy.md'],
            text(),
            source([measured2026_09_10()]),
            'event4u-app/agent-config',
        );
        expect(r.exitCode).toBe(1);
        expect(r.lines.join('\n')).toContain('NONCOMPLIANT');
    });

    it('fails closed when the platform cannot be read', () => {
        const r = evaluateGate(['src/rules/commit-policy.md'], text(), source(null), 'event4u-app/agent-config');
        expect(r.exitCode).toBe(1);
        expect(r.lines.join('\n')).toContain('UNVERIFIABLE');
    });

    it('fails when the expectation file is absent', () => {
        const r = evaluateGate(
            ['src/rules/commit-policy.md'],
            null,
            source([compliantRuleset()]),
            'event4u-app/agent-config',
        );
        expect(r.exitCode).toBe(1);
        expect(r.lines.join('\n')).toContain('policy-missing');
    });

    it('treats an edit to the expectation itself as gated', () => {
        expect(touchesPolicy([POLICY_PATH])).toBe(true);
        expect(touchesPolicy(['README.md'])).toBe(false);
        const r = evaluateGate([POLICY_PATH], text(), source([measured2026_09_10()]), 'event4u-app/agent-config');
        expect(r.exitCode).toBe(1);
    });
});
