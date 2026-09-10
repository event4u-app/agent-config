import * as fs from 'node:fs';
import * as path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
    checkAnchorIdentity,
    coversDefaultBranch,
    effectiveProtection,
    enforceFloor,
    evaluateAnchor,
    NEVER_WAIVABLE,
    NON_NEGOTIABLE_FLOOR,
    readAnchorPolicy,
    readWaivers,
    refPatternMatches,
    SUPPORTED_ANCHOR_SCHEMA,
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
        expect(read?.allow_unconditional_bypass).toBe(false);
        expect(read?.strict_required_status_checks).toBe(true);
    });

    it('carries no approval dimension, which is the recorded trust-model decision', () => {
        // The owner ruled on 2026-09-10 that a mandatory approving review is a
        // stop rather than a control on a single-maintainer repository. The
        // dimensions are GONE, not exempted — a dimension outside the trust
        // model is not a waived rule — so a future edit cannot re-add one by
        // flipping an exemption flag, and this asserts both halves.
        const text = fs.readFileSync(path.join(REPO, POLICY_PATH), 'utf8');
        const raw = JSON.parse(text) as { required: Record<string, unknown> };
        expect(Object.keys(raw.required)).not.toContain('minimum_approving_reviews');
        expect(Object.keys(raw.required)).not.toContain('require_last_push_approval');
        expect(Object.keys(NON_NEGOTIABLE_FLOOR)).not.toContain('minimum_approving_reviews');
        expect(Object.keys(NON_NEGOTIABLE_FLOOR)).not.toContain('require_last_push_approval');
        expect(text).toContain('owner_ruling_2026_09_10');
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
        const text = JSON.stringify({
            required: { ...policy(), strict_required_status_checks: false },
        });
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
    });

    it('refuses a weakening of thread-resolution, strict checks and deletion', () => {
        // `required_review_thread_resolution` is back in the floor. It briefly
        // was not, on the implementer's own judgement, which a blind review
        // caught: the change's record says only the owner may authorize a floor
        // reduction, and the ruling names two dimensions and not this one.
        expect(enforceFloor(policy({ required_review_thread_resolution: false }))).toHaveLength(1);
        expect(enforceFloor(policy({ strict_required_status_checks: false }))).toHaveLength(1);
        expect(enforceFloor(policy({ block_deletion: false }))).toHaveLength(1);
    });

    it('has no approval field left for a policy to lower', () => {
        // The NaN hole the blind review probed is closed by DELETION rather
        // than by a guard: with no `minimum_approving_reviews` field there is
        // nothing to pass a non-numeric value to. Recorded here because the
        // guard it replaced was itself a regression test, and losing the test
        // with the code would leave the closure unwitnessed.
        const text = JSON.stringify({
            schema_version: 1,
            required: { ...policy(), minimum_approving_reviews: 'one' },
        });
        const { policy: p, findings } = readAnchorPolicy(text);
        expect(p).toBeNull();
        expect(findings.some((f) => f.code === 'policy-unknown-field')).toBe(true);
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
        // Keyed on the constant rather than a literal, so a schema bump does
        // not red an identity test that is about the repository name.
        const text = JSON.stringify({
            schema_version: SUPPORTED_ANCHOR_SCHEMA,
            repository: 'a/b',
            required: policy(),
        });
        expect(checkAnchorIdentity(text, 'a/b')).toEqual([]);
        const mismatch = checkAnchorIdentity(text, 'someone/fork');
        expect(mismatch.map((f) => f.code)).toContain('policy-repository-mismatch');
    });

    it('refuses a schema version its reader does not support', () => {
        const text = JSON.stringify({
            schema_version: SUPPORTED_ANCHOR_SCHEMA + 1,
            repository: 'a/b',
            required: policy(),
        });
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
        expect(codes).toContain('thread-resolution-missing');
        expect(codes).toContain('deletion-not-blocked');
        expect(codes).toContain('non-fast-forward-not-blocked');
        expect(codes).toContain('status-checks-not-strict');
        expect(codes).toContain('required-context-missing');
    });

    it('reports the approval dimensions as evidence and never as a finding', () => {
        // The load-bearing half of the trust-model decision: a ruleset with
        // zero approvals and no last-push approval is COMPLIANT here, and the
        // report still says what the forge holds. If either ever became a
        // finding again it would be a floor reduction reversed by accident.
        const noApprovals = compliantRuleset({
            rules: [
                { type: 'deletion' },
                { type: 'non_fast_forward' },
                {
                    type: 'pull_request',
                    parameters: {
                        required_approving_review_count: 0,
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
            ],
        });
        const r = evaluateAnchor(policy(), [noApprovals], 'main');
        expect(r.status).toBe('compliant');
        expect(r.findings).toEqual([]);
        expect(r.evidence.join('\n')).toContain('observed, not required here');
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

    it('reports the 2026-09-10 pre-ruling configuration as failing on the bypass alone', () => {
        // The same fixture, re-judged under the trust model the owner then
        // ruled. Kept rather than deleted because it is the configuration that
        // made the anchor a finding, and what changed is the JUDGEMENT, not the
        // measurement: of the three counts it once failed, only the
        // unconditional bypass is still a rule here — and that is the one the
        // owner's change actually fixed and left fixed.
        const r = evaluateAnchor(policy(), [measured2026_09_10()], 'main');
        expect(r.status).toBe('noncompliant');
        expect(r.findings.map((f) => f.code)).toEqual(['unconditional-bypass']);
        // The gate's containing job IS a required context, so this is NOT among
        // the findings — the correction that a required check pins a job name
        // and not its steps.
        expect(r.findings.map((f) => f.code)).not.toContain('required-context-missing');
    });
});

/**
 * The waiver mechanism, both polarities on every rule that governs it.
 *
 * Two council seats warned that a waiver mechanism becomes an exemption
 * registry that hollows out the floor, so the rules that bound it are the ones
 * that most need a failing direction exercised. The invariant every case below
 * serves: a malformed, expired or impermissible waiver must be WORSE than no
 * waiver, never better.
 */
describe('an accepted-risk waiver is bounded, dated and refusable', () => {
    const NOW = new Date('2026-09-10T12:00:00Z');

    function waiver(over: Record<string, unknown> = {}): Record<string, unknown> {
        return {
            id: 'arr-test',
            dimension: 'strict_required_status_checks',
            baseline: true,
            accepted: false,
            failure_mode: 'semantic conflict',
            cost_avoided: 'measured re-run cost',
            frequency_assumption: 'assumption, owner-attested',
            detection_and_repair: 'post-merge, owner repairs',
            residual_protection: 'the required context still passes',
            authority: 'owner',
            decided: '2026-09-10',
            expires: '2026-12-09',
            review_triggers: ['CI under 10 minutes'],
            ...over,
        };
    }

    const withWaivers = (ws: Record<string, unknown>[]): string =>
        JSON.stringify({ schema_version: 1, required: policy(), accepted_risk_reductions: ws });

    /** A forge that satisfies everything except strictness. */
    function notStrict(): RulesetDetail {
        const rs = compliantRuleset();
        rs.rules = (rs.rules ?? []).map((r) =>
            r.type === 'required_status_checks'
                ? {
                      type: 'required_status_checks',
                      parameters: {
                          strict_required_status_checks_policy: false,
                          required_status_checks: [{ context: 'Sync + Generate Tools Consistency' }],
                      },
                  }
                : r,
        );
        return rs;
    }

    it('turns a violated dimension into an accepted risk rather than a finding', () => {
        const { honoured, findings } = readWaivers(withWaivers([waiver()]), NOW);
        expect(findings).toEqual([]);
        const r = evaluateAnchor(policy(), [notStrict()], 'main', honoured);
        expect(r.status).toBe('compliant-with-accepted-risk');
        expect(r.findings).toEqual([]);
        expect(r.evidence.join('\n')).toContain('ACCEPTED RISK');
    });

    it('without the waiver the same forge is a plain failure', () => {
        const r = evaluateAnchor(policy(), [notStrict()], 'main');
        expect(r.status).toBe('noncompliant');
        expect(r.findings.map((f) => f.code)).toEqual(['status-checks-not-strict']);
    });

    it('refuses an incomplete waiver, so the dimension reds normally', () => {
        for (const field of ['failure_mode', 'expires', 'authority', 'review_triggers']) {
            const w = waiver();
            delete w[field];
            const { honoured, findings } = readWaivers(withWaivers([w]), NOW);
            expect(findings[0]?.code).toBe('waiver-incomplete');
            expect(honoured.size).toBe(0);
            expect(evaluateAnchor(policy(), [notStrict()], 'main', honoured).status).toBe(
                'noncompliant',
            );
        }
    });

    it('refuses an expired waiver and an unparseable expiry', () => {
        const expired = readWaivers(withWaivers([waiver({ expires: '2026-09-09' })]), NOW);
        expect(expired.findings[0]?.code).toBe('waiver-expired');
        expect(expired.honoured.size).toBe(0);

        const junk = readWaivers(withWaivers([waiver({ expires: 'soon' })]), NOW);
        expect(junk.findings[0]?.code).toBe('waiver-incomplete');
        expect(junk.honoured.size).toBe(0);
    });

    it('refuses a waiver over any never-waivable dimension', () => {
        for (const dimension of NEVER_WAIVABLE) {
            const { honoured, findings } = readWaivers(withWaivers([waiver({ dimension })]), NOW);
            expect(findings[0]?.code).toBe('waiver-not-permitted');
            expect(honoured.size).toBe(0);
        }
    });

    it('an unconditional bypass stays a failure even with a waiver written for it', () => {
        const { honoured } = readWaivers(
            withWaivers([waiver({ dimension: 'allow_unconditional_bypass' })]),
            NOW,
        );
        const r = evaluateAnchor(
            policy(),
            [
                compliantRuleset({
                    bypass_actors: [{ actor_type: 'RepositoryRole', actor_id: 5, bypass_mode: 'always' }],
                }),
            ],
            'main',
            honoured,
        );
        expect(r.status).toBe('noncompliant');
        expect(r.findings.map((f) => f.code)).toEqual(['unconditional-bypass']);
    });

    it('reports a waiver the forge has made unnecessary', () => {
        const { honoured } = readWaivers(withWaivers([waiver()]), NOW);
        const r = evaluateAnchor(policy(), [compliantRuleset()], 'main', honoured);
        expect(r.status).toBe('noncompliant');
        expect(r.findings.map((f) => f.code)).toEqual(['waiver-unused']);
    });

    it('treats an absent or malformed waiver list as no waivers, never as a pass', () => {
        expect(readWaivers(null, NOW).honoured.size).toBe(0);
        expect(readWaivers('{ not json', NOW).honoured.size).toBe(0);
        const bad = readWaivers(
            JSON.stringify({ required: policy(), accepted_risk_reductions: 'yes' }),
            NOW,
        );
        expect(bad.findings[0]?.code).toBe('waiver-incomplete');
        expect(bad.honoured.size).toBe(0);
    });

    it('the committed waiver is well-formed and covers only a waivable dimension', () => {
        const text = fs.readFileSync(path.join(REPO, POLICY_PATH), 'utf8');
        const { honoured, findings } = readWaivers(text, NOW);
        expect(findings).toEqual([]);
        expect(honoured.has('strict_required_status_checks')).toBe(true);
        for (const d of honoured.keys()) {
            expect(NEVER_WAIVABLE).not.toContain(d);
        }
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

    it('reports a stale waiver rather than passing a platform that outgrew it', () => {
        // Against the COMMITTED expectation, a fully strict forge makes the
        // strictness waiver unnecessary — and an unnecessary waiver is stale
        // record, which this gate reports rather than ignores. Not a pass:
        // the configuration is safer than the file claims, and a reader should
        // learn that from the gate rather than from a surprise later.
        const r = evaluateGate(
            ['src/rules/commit-policy.md'],
            text(),
            source([compliantRuleset()]),
            'event4u-app/agent-config',
        );
        expect(r.exitCode).toBe(1);
        expect(r.lines.join('\n')).toContain('waiver-unused');
    });

    it('passes with an accepted risk against the forge as it actually stands', () => {
        const asItStands = compliantRuleset();
        asItStands.rules = (asItStands.rules ?? []).map((rule) =>
            rule.type === 'required_status_checks'
                ? {
                      type: 'required_status_checks',
                      parameters: {
                          strict_required_status_checks_policy: false,
                          required_status_checks: [{ context: 'Sync + Generate Tools Consistency' }],
                      },
                  }
                : rule,
        );
        const r = evaluateGate(
            ['src/rules/commit-policy.md'],
            text(),
            source([asItStands]),
            'event4u-app/agent-config',
        );
        expect(r.exitCode).toBe(0);
        expect(r.lines.join('\n')).toContain('PASS_WITH_ACCEPTED_RISK');
        expect(r.lines.join('\n')).toContain('Current-base compatibility is NOT guaranteed');
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
