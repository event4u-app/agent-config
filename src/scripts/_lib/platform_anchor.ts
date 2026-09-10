/**
 * The platform anchor: does the forge actually enforce what the ratification
 * mechanism's trust argument says it enforces?
 *
 * `check_kernel_edit_ratified` proves that a diff touching a kernel rule, a
 * governance hook or the ratification mechanism itself carries an independently
 * reviewed artifact. What it cannot prove is that the artifact was reviewed by
 * anyone the repository required — that half lives in repository settings, which
 * no diff contains. `docs/contracts/ratification-artifact.md` told a reader the
 * trust came from the base-revision gate PLUS human review of the pull request,
 * and nothing in the tree established the second limb.
 *
 * This module is the second limb, made checkable. It is deliberately PURE: it
 * evaluates ruleset payloads a caller fetched, so both polarities are testable
 * offline and no test needs a token. The impure half — the `gh api` calls and
 * the fail-closed exit codes — lives in `src/scripts/check_platform_anchor.ts`.
 *
 * Four constraints below are structural, and the code would read as arbitrary
 * without them:
 *
 * 1. **Effective combination, never a ruleset by id.** A repository may carry
 *    several active branch rulesets and an administrator may split one at any
 *    time. Assuming ruleset `17749383` — which is what exists today — or its
 *    name would make this check wrong on the first split. So every applicable
 *    active ruleset is unioned: booleans OR together, the approval count takes
 *    the MAXIMUM, contexts union, and bypass actors accumulate.
 * 2. **A non-negotiable floor in the code.** The expectation lives in
 *    `src/config/platform-anchor.json` so that changing it is a reviewable
 *    governance diff. That alone is not enough: a policy-only edit could set
 *    `minimum_approving_reviews` to 0 and make itself green. `NON_NEGOTIABLE_FLOOR`
 *    below is the floor such an edit cannot cross, and a policy under it is
 *    rejected rather than honoured.
 * 3. **Two distinct negative outcomes.** `noncompliant` means the configuration
 *    was read and violates the policy. `unverifiable` means it could not be
 *    established. Both are failures — a control that passes when it cannot
 *    measure is advisory — but they are different repairs, so they are different
 *    statuses rather than one exit code.
 * 4. **Configured bypass actors, not the caller's own capability.** GitHub
 *    reports `current_user_can_bypass` for the acting identity, which varies by
 *    token and says nothing durable about the repository. The durable fact is
 *    the configured `bypass_actors` list, so that is what is judged.
 *
 * A required status check pins a JOB's reported name, never the steps inside it.
 * `check_kernel_edit_ratified` is a step inside `Sync + Generate Tools
 * Consistency` (`.github/workflows/consistency.yml:811-825`), and that job IS
 * the ruleset's one required context — so the gate is platform-required
 * transitively. It is necessary and not sufficient: a candidate branch may
 * delete the step and the job still reports the same context, green. That is the
 * defect the round-2 ratification review refused the deny-retirement over, and
 * this module does not close it. It asserts the necessary half and says so.
 */

/** A rule inside a ruleset. `parameters` is untyped until the type is known. */
export interface RulesetRule {
    type?: string | undefined;
    parameters?: unknown;
}

/** One entry of a ruleset's bypass list. */
export interface BypassActor {
    actor_type?: string | undefined;
    actor_id?: number | undefined;
    bypass_mode?: string | undefined;
}

/** The ruleset shape this module reads. Extra fields are ignored. */
export interface RulesetDetail {
    id?: number | undefined;
    name?: string | undefined;
    target?: string | undefined;
    enforcement?: string | undefined;
    conditions?:
        | {
              ref_name?:
                  | {
                        include?: string[] | undefined;
                        exclude?: string[] | undefined;
                    }
                  | undefined;
          }
        | undefined;
    rules?: RulesetRule[] | undefined;
    bypass_actors?: BypassActor[] | undefined;
}

/** The committed expectation, as `src/config/platform-anchor.json` carries it. */
export interface AnchorPolicy {
    enforcement: string;
    target: string;
    covers_default_branch: boolean;
    minimum_approving_reviews: number;
    require_last_push_approval: boolean;
    required_review_thread_resolution: boolean;
    block_deletion: boolean;
    block_non_fast_forward: boolean;
    strict_required_status_checks: boolean;
    required_status_check_contexts: string[];
    allow_unconditional_bypass: boolean;
}

/**
 * The floor a policy edit may not cross.
 *
 * openai/codex-default's condition, quoted: *"Reject unknown fields, missing
 * requirements, and policy values weaker than a small non-negotiable floor
 * embedded in the verifier. That last safeguard prevents a policy-only edit from
 * redefining `minimumApprovals` to zero and making itself green."*
 */
export const NON_NEGOTIABLE_FLOOR = {
    minimum_approving_reviews: 1,
    require_last_push_approval: true,
    required_review_thread_resolution: true,
    block_deletion: true,
    block_non_fast_forward: true,
    strict_required_status_checks: true,
    allow_unconditional_bypass: false,
    minimum_required_contexts: 1,
    // The SELECTOR half. The six values above are thresholds a ruleset is
    // measured against; these three decide WHICH rulesets are measured at all,
    // and leaving them unfloored left the whole check reachable through a door
    // the floor did not watch. A blind review probed it against this evaluator:
    // `enforcement: "evaluate"` credited a non-enforcing dry-run ruleset as
    // full protection and returned `compliant` with zero findings, and
    // `covers_default_branch: false` credited a `refs/heads/release`-only
    // ruleset to `main` while `main` carried no ruleset. Neither touched a
    // threshold, so neither was caught.
    enforcement: 'active',
    target: 'branch',
    covers_default_branch: true,
} as const;

/** The upper bound on the approval floor a policy may demand. */
export const MAX_APPROVING_REVIEWS = 100;

export type AnchorStatus = 'compliant' | 'noncompliant' | 'unverifiable';

/** Stable codes, so a test asserts the reason rather than the wording. */
export type AnchorCode =
    | 'policy-missing'
    | 'policy-unparseable'
    | 'policy-missing-field'
    | 'policy-unknown-field'
    | 'policy-repository-mismatch'
    | 'policy-below-floor'
    | 'rulesets-unreadable'
    | 'default-branch-unknown'
    | 'no-applicable-ruleset'
    | 'approvals-below-minimum'
    | 'last-push-approval-missing'
    | 'thread-resolution-missing'
    | 'deletion-not-blocked'
    | 'non-fast-forward-not-blocked'
    | 'status-checks-not-strict'
    | 'required-context-missing'
    | 'unconditional-bypass';

export interface AnchorFinding {
    code: AnchorCode;
    message: string;
}

export interface AnchorReading {
    status: AnchorStatus;
    findings: AnchorFinding[];
    /** Human-readable facts the verdict rests on, for the gate's output. */
    evidence: string[];
}

/** The effective configuration, unioned across every applicable ruleset. */
export interface EffectiveProtection {
    rulesetIds: number[];
    approvingReviews: number;
    requireLastPushApproval: boolean;
    requireThreadResolution: boolean;
    blocksDeletion: boolean;
    blocksNonFastForward: boolean;
    strictStatusChecks: boolean;
    requiredContexts: string[];
    unconditionalBypassActors: BypassActor[];
}

const POLICY_FIELDS: readonly (keyof AnchorPolicy)[] = [
    'enforcement',
    'target',
    'covers_default_branch',
    'minimum_approving_reviews',
    'require_last_push_approval',
    'required_review_thread_resolution',
    'block_deletion',
    'block_non_fast_forward',
    'strict_required_status_checks',
    'required_status_check_contexts',
    'allow_unconditional_bypass',
];

function isObject(v: unknown): v is Record<string, unknown> {
    return v !== null && typeof v === 'object' && !Array.isArray(v);
}

/**
 * Read and validate the committed policy.
 *
 * Returns `null` for the policy on any problem, so a caller cannot accidentally
 * evaluate against a half-read expectation. Missing and unparseable are distinct
 * codes because they are distinct repairs.
 */
export function readAnchorPolicy(text: string | null): {
    policy: AnchorPolicy | null;
    findings: AnchorFinding[];
} {
    if (text === null) {
        return {
            policy: null,
            findings: [
                {
                    code: 'policy-missing',
                    message:
                        'src/config/platform-anchor.json is absent, so the expected platform ' +
                        'configuration is unknown. This check fails closed rather than assuming one.',
                },
            ],
        };
    }
    let parsed: unknown;
    try {
        parsed = JSON.parse(text);
    } catch (e) {
        return {
            policy: null,
            findings: [
                {
                    code: 'policy-unparseable',
                    message: `src/config/platform-anchor.json is not valid JSON: ${String(e)}`,
                },
            ],
        };
    }
    if (!isObject(parsed) || !isObject(parsed['required'])) {
        return {
            policy: null,
            findings: [
                {
                    code: 'policy-missing-field',
                    message: 'src/config/platform-anchor.json carries no `required` object.',
                },
            ],
        };
    }
    const req = parsed['required'];
    const findings: AnchorFinding[] = [];
    for (const field of POLICY_FIELDS) {
        if (!(field in req)) {
            findings.push({
                code: 'policy-missing-field',
                message: `src/config/platform-anchor.json \`required\` is missing \`${field}\`.`,
            });
        }
    }
    // Unknown keys are refused, not ignored. A misspelled or stale key would
    // otherwise sit in the expectation looking authoritative while the field it
    // was meant to set falls back to a default nobody chose — and the council
    // condition quoted above this file's floor says "reject unknown fields" in
    // as many words, so ignoring them documented the code as doing the
    // opposite of what it did.
    for (const key of Object.keys(req)) {
        if (!(POLICY_FIELDS as readonly string[]).includes(key)) {
            findings.push({
                code: 'policy-unknown-field',
                message:
                    `src/config/platform-anchor.json \`required\` carries an unknown key ` +
                    `\`${key}\`. Every key must be one of: ${POLICY_FIELDS.join(', ')}. ` +
                    'Explanatory prose belongs in a sibling `*_note` key outside `required`.',
            });
        }
    }
    if (findings.length > 0) {
        return { policy: null, findings };
    }

    const contexts = req['required_status_check_contexts'];
    if (!Array.isArray(contexts) || contexts.some((c) => typeof c !== 'string')) {
        return {
            policy: null,
            findings: [
                {
                    code: 'policy-missing-field',
                    message:
                        '`required_status_check_contexts` must be an array of strings naming the ' +
                        'CI contexts that must be required checks.',
                },
            ],
        };
    }

    const policy: AnchorPolicy = {
        enforcement: String(req['enforcement']),
        target: String(req['target']),
        covers_default_branch: req['covers_default_branch'] === true,
        minimum_approving_reviews: Number(req['minimum_approving_reviews']),
        require_last_push_approval: req['require_last_push_approval'] === true,
        required_review_thread_resolution: req['required_review_thread_resolution'] === true,
        block_deletion: req['block_deletion'] === true,
        block_non_fast_forward: req['block_non_fast_forward'] === true,
        strict_required_status_checks: req['strict_required_status_checks'] === true,
        required_status_check_contexts: contexts as string[],
        allow_unconditional_bypass: req['allow_unconditional_bypass'] === true,
    };

    const floor = enforceFloor(policy);
    if (floor.length > 0) {
        return { policy: null, findings: floor };
    }
    return { policy, findings: [] };
}

/** The expectation's supported schema version. Bump only with its reader. */
export const SUPPORTED_ANCHOR_SCHEMA = 1;

/**
 * The two top-level fields that say WHICH expectation this is.
 *
 * Both were declared and read by nothing, which a blind review named: the gate
 * could report `compliant` for a fork, or for whatever `--repo` was handed it,
 * while quoting an expectation that names another repository. A verdict that
 * does not know whose settings it measured is not a verdict.
 */
export function checkAnchorIdentity(text: string | null, repo: string): AnchorFinding[] {
    if (text === null) {
        return [];
    }
    let parsed: unknown;
    try {
        parsed = JSON.parse(text);
    } catch {
        return [];
    }
    if (!isObject(parsed)) {
        return [];
    }
    const f: AnchorFinding[] = [];
    const version = parsed['schema_version'];
    if (version !== SUPPORTED_ANCHOR_SCHEMA) {
        f.push({
            code: 'policy-missing-field',
            message:
                `src/config/platform-anchor.json declares \`schema_version\` ` +
                `${JSON.stringify(version)}; this reader supports ${SUPPORTED_ANCHOR_SCHEMA}. ` +
                'A schema bump must land with the reader that understands it.',
        });
    }
    const declared = parsed['repository'];
    if (typeof declared === 'string' && declared !== repo) {
        f.push({
            code: 'policy-repository-mismatch',
            message:
                `src/config/platform-anchor.json states the expectation for \`${declared}\`, ` +
                `but this run measured \`${repo}\`. A pass here would credit one repository's ` +
                "settings to another's expectation — most likely a fork, or a --repo argument " +
                'that does not match the checkout.',
        });
    }
    return f;
}

/**
 * Reject a policy weaker than the floor.
 *
 * This is what stops the expectation file from being the weak link: the file is
 * on the gated-surface list so an edit to it needs its own ratification, and
 * even a ratified edit cannot go below these values without changing this code —
 * which is itself a gated surface.
 */
export function enforceFloor(policy: AnchorPolicy): AnchorFinding[] {
    const f: AnchorFinding[] = [];
    const under = (what: string, got: unknown, floorValue: unknown): void => {
        f.push({
            code: 'policy-below-floor',
            message:
                `src/config/platform-anchor.json sets \`${what}\` to ${JSON.stringify(got)}, ` +
                `below the non-negotiable floor ${JSON.stringify(floorValue)} in ` +
                'src/scripts/_lib/platform_anchor.ts. A policy edit may not lower the floor.',
        });
    };

    // The selectors first, because a weakened selector makes every threshold
    // below it moot — it changes which rulesets are read rather than how they
    // are judged, so a policy can neutralise the check without touching a
    // single floored threshold.
    if (policy.enforcement !== NON_NEGOTIABLE_FLOOR.enforcement) {
        under('enforcement', policy.enforcement, NON_NEGOTIABLE_FLOOR.enforcement);
    }
    if (policy.target !== NON_NEGOTIABLE_FLOOR.target) {
        under('target', policy.target, NON_NEGOTIABLE_FLOOR.target);
    }
    if (!policy.covers_default_branch) {
        under('covers_default_branch', policy.covers_default_branch, true);
    }

    // Non-finite is its own failure, not a comparison. `Number("one")` is NaN
    // and `NaN < 1` is false, so a threshold check alone reads a garbage value
    // as satisfying the floor — and the same NaN then makes the downstream
    // `observed < NaN` comparison false, so the approval rule disappears
    // instead of failing. Both halves were reproduced by a blind review.
    if (
        !Number.isFinite(policy.minimum_approving_reviews) ||
        !Number.isInteger(policy.minimum_approving_reviews) ||
        policy.minimum_approving_reviews > MAX_APPROVING_REVIEWS
    ) {
        f.push({
            code: 'policy-below-floor',
            message:
                'src/config/platform-anchor.json sets `minimum_approving_reviews` to ' +
                `${JSON.stringify(policy.minimum_approving_reviews)}, which is not an integer ` +
                `between ${NON_NEGOTIABLE_FLOOR.minimum_approving_reviews} and ` +
                `${MAX_APPROVING_REVIEWS}. A non-numeric value would compare false against the ` +
                'floor and then make the approval rule unreachable, so it is refused outright.',
        });
    } else if (policy.minimum_approving_reviews < NON_NEGOTIABLE_FLOOR.minimum_approving_reviews) {
        under(
            'minimum_approving_reviews',
            policy.minimum_approving_reviews,
            NON_NEGOTIABLE_FLOOR.minimum_approving_reviews,
        );
    }
    if (!policy.require_last_push_approval) {
        under('require_last_push_approval', false, true);
    }
    if (!policy.required_review_thread_resolution) {
        under('required_review_thread_resolution', false, true);
    }
    if (!policy.block_deletion) {
        under('block_deletion', false, true);
    }
    if (!policy.block_non_fast_forward) {
        under('block_non_fast_forward', false, true);
    }
    if (!policy.strict_required_status_checks) {
        under('strict_required_status_checks', false, true);
    }
    if (policy.allow_unconditional_bypass) {
        under('allow_unconditional_bypass', true, false);
    }
    if (
        policy.required_status_check_contexts.length < NON_NEGOTIABLE_FLOOR.minimum_required_contexts
    ) {
        under(
            'required_status_check_contexts.length',
            policy.required_status_check_contexts.length,
            NON_NEGOTIABLE_FLOOR.minimum_required_contexts,
        );
    }
    return f;
}

/**
 * Match one ruleset ref pattern against a concrete ref.
 *
 * The forge treats these as fnmatch patterns, not literals, and comparing them
 * with `===` was the one fail-OPEN direction in this evaluator: a blind review
 * probed `exclude: ["refs/heads/m*"]` under `include: ["~ALL"]` and the equality
 * form returned "covered" for `main`, crediting a ruleset that in fact excludes
 * it. The mirror error also existed — `include: ["refs/heads/**"]` read as no
 * match at all.
 *
 * `**` crosses `/`; `*` and `?` stay inside one segment. Everything else is
 * escaped, so a pattern with regex metacharacters cannot widen itself.
 */
export function refPatternMatches(pattern: string, ref: string): boolean {
    let re = '';
    for (let i = 0; i < pattern.length; i += 1) {
        const c = pattern[i] ?? '';
        if (c === '*') {
            if (pattern[i + 1] === '*') {
                re += '.*';
                i += 1;
            } else {
                re += '[^/]*';
            }
        } else if (c === '?') {
            re += '[^/]';
        } else {
            re += c.replace(/[.+^${}()|[\]\\]/g, '\\$&');
        }
    }
    try {
        return new RegExp(`^${re}$`).test(ref);
    } catch {
        return false;
    }
}

/**
 * True when a ruleset's ref conditions reach the default branch.
 *
 * An empty `include` is NOT a match: a ruleset that names no ref covers no ref,
 * and reading absence as "everything" would be the fail-open reading again.
 */
export function coversDefaultBranch(rs: RulesetDetail, defaultBranch: string): boolean {
    const include = rs.conditions?.ref_name?.include ?? [];
    const exclude = rs.conditions?.ref_name?.exclude ?? [];
    const full = `refs/heads/${defaultBranch}`;
    const hits = (p: string): boolean =>
        p === '~DEFAULT_BRANCH' ||
        p === '~ALL' ||
        refPatternMatches(p, full) ||
        refPatternMatches(p, defaultBranch);
    if (exclude.some(hits)) {
        return false;
    }
    return include.some(hits);
}

function ruleParams(rs: RulesetDetail, type: string): Record<string, unknown> | null {
    for (const r of rs.rules ?? []) {
        if (r.type === type) {
            return isObject(r.parameters) ? r.parameters : {};
        }
    }
    return null;
}

/**
 * Union every applicable active ruleset into one effective configuration.
 *
 * Booleans OR, the approval count takes the maximum, contexts union: a second
 * ruleset can only ever ADD protection, which is how GitHub evaluates them and
 * is why reading one ruleset by id would understate the real protection as
 * easily as it overstates it.
 */
export function effectiveProtection(
    rulesets: readonly RulesetDetail[],
    defaultBranch: string,
    policy: AnchorPolicy,
): EffectiveProtection {
    const eff: EffectiveProtection = {
        rulesetIds: [],
        approvingReviews: 0,
        requireLastPushApproval: false,
        requireThreadResolution: false,
        blocksDeletion: false,
        blocksNonFastForward: false,
        strictStatusChecks: false,
        requiredContexts: [],
        unconditionalBypassActors: [],
    };
    for (const rs of rulesets) {
        if (rs.enforcement !== policy.enforcement) {
            continue;
        }
        if (rs.target !== policy.target) {
            continue;
        }
        if (policy.covers_default_branch && !coversDefaultBranch(rs, defaultBranch)) {
            continue;
        }
        eff.rulesetIds.push(rs.id ?? -1);

        const pr = ruleParams(rs, 'pull_request');
        if (pr !== null) {
            const n = Number(pr['required_approving_review_count'] ?? 0);
            if (Number.isFinite(n) && n > eff.approvingReviews) {
                eff.approvingReviews = n;
            }
            eff.requireLastPushApproval ||= pr['require_last_push_approval'] === true;
            eff.requireThreadResolution ||= pr['required_review_thread_resolution'] === true;
        }
        eff.blocksDeletion ||= ruleParams(rs, 'deletion') !== null;
        eff.blocksNonFastForward ||= ruleParams(rs, 'non_fast_forward') !== null;

        const sc = ruleParams(rs, 'required_status_checks');
        if (sc !== null) {
            eff.strictStatusChecks ||= sc['strict_required_status_checks_policy'] === true;
            const list = sc['required_status_checks'];
            if (Array.isArray(list)) {
                for (const entry of list) {
                    if (isObject(entry) && typeof entry['context'] === 'string') {
                        if (!eff.requiredContexts.includes(entry['context'])) {
                            eff.requiredContexts.push(entry['context']);
                        }
                    }
                }
            }
        }
        for (const a of rs.bypass_actors ?? []) {
            if (a.bypass_mode === 'always') {
                eff.unconditionalBypassActors.push(a);
            }
        }
    }
    return eff;
}

/**
 * The verdict.
 *
 * `rulesets === null` means the caller could not read them — network, token
 * scope, offline — and yields `unverifiable`, never `compliant`. That is the
 * fail-closed direction both council seats required, and its blast radius is
 * only ever a diff on the gated surface, because the caller runs this check
 * exclusively when `requiresRatification` is true.
 */
export function evaluateAnchor(
    policy: AnchorPolicy,
    rulesets: readonly RulesetDetail[] | null,
    defaultBranch: string | null,
): AnchorReading {
    const findings: AnchorFinding[] = [];
    const evidence: string[] = [];

    if (rulesets === null) {
        return {
            status: 'unverifiable',
            findings: [
                {
                    code: 'rulesets-unreadable',
                    message:
                        'the repository rulesets could not be read (network, credentials, token ' +
                        'scope, or an offline run). The platform anchor is UNVERIFIABLE, which is ' +
                        'a failure and not a pass: a control that succeeds when it cannot measure ' +
                        'is advisory.',
                },
            ],
            evidence,
        };
    }
    if (defaultBranch === null) {
        return {
            status: 'unverifiable',
            findings: [
                {
                    code: 'default-branch-unknown',
                    message:
                        'the default branch could not be resolved, so no ruleset can be matched ' +
                        'against it.',
                },
            ],
            evidence,
        };
    }

    const eff = effectiveProtection(rulesets, defaultBranch, policy);
    evidence.push(
        `default branch: ${defaultBranch} · applicable active ${policy.target} ruleset(s): ` +
            (eff.rulesetIds.length > 0 ? eff.rulesetIds.join(', ') : 'none'),
    );

    if (eff.rulesetIds.length === 0) {
        findings.push({
            code: 'no-applicable-ruleset',
            message:
                `no ruleset with target \`${policy.target}\` and enforcement ` +
                `\`${policy.enforcement}\` covers \`${defaultBranch}\`. Note that classic branch ` +
                'protection is a different API surface and is not read here; if this repository ' +
                'moved back to it, src/config/platform-anchor.json needs correcting rather than ' +
                'this result overriding.',
        });
        return { status: 'noncompliant', findings, evidence };
    }

    evidence.push(
        `approving reviews required: ${eff.approvingReviews} (policy floor ` +
            `${policy.minimum_approving_reviews})`,
    );
    if (eff.approvingReviews < policy.minimum_approving_reviews) {
        findings.push({
            code: 'approvals-below-minimum',
            message:
                `the effective ruleset requires ${eff.approvingReviews} approving review(s); the ` +
                `policy requires at least ${policy.minimum_approving_reviews}. Without this, a ` +
                'ratification artifact is reviewed by nobody the repository insisted on, and the ' +
                "mechanism's independence claim rests on process evidence alone.",
        });
    }
    if (policy.require_last_push_approval && !eff.requireLastPushApproval) {
        findings.push({
            code: 'last-push-approval-missing',
            message:
                '`require_last_push_approval` is off, so an approval can predate the final push ' +
                'and the reviewed diff need not be the merged diff.',
        });
    }
    if (policy.required_review_thread_resolution && !eff.requireThreadResolution) {
        findings.push({
            code: 'thread-resolution-missing',
            message: '`required_review_thread_resolution` is off, so an open objection cannot block a merge.',
        });
    }
    if (policy.block_deletion && !eff.blocksDeletion) {
        findings.push({
            code: 'deletion-not-blocked',
            message: 'the default branch is not protected against deletion.',
        });
    }
    if (policy.block_non_fast_forward && !eff.blocksNonFastForward) {
        findings.push({
            code: 'non-fast-forward-not-blocked',
            message: 'the default branch is not protected against force-pushes (non-fast-forward).',
        });
    }
    if (policy.strict_required_status_checks && !eff.strictStatusChecks) {
        findings.push({
            code: 'status-checks-not-strict',
            message:
                '`strict_required_status_checks_policy` is off, so a stale branch can merge ' +
                'without re-running the required checks against the current base.',
        });
    }
    evidence.push(
        `required status check contexts: ` +
            (eff.requiredContexts.length > 0 ? eff.requiredContexts.join(' · ') : 'none'),
    );
    for (const want of policy.required_status_check_contexts) {
        if (!eff.requiredContexts.includes(want)) {
            findings.push({
                code: 'required-context-missing',
                message:
                    `\`${want}\` is not a required status check. That context is the job which ` +
                    'carries the ratification gate, so without it a branch can merge without the ' +
                    'gate having run at all.',
            });
        }
    }
    if (!policy.allow_unconditional_bypass && eff.unconditionalBypassActors.length > 0) {
        const who = eff.unconditionalBypassActors
            .map((a) => `${a.actor_type ?? '?'}#${a.actor_id ?? '?'}`)
            .join(', ');
        evidence.push(`unconditional bypass actors: ${who}`);
        findings.push({
            code: 'unconditional-bypass',
            message:
                `${who} may bypass every rule above unconditionally (\`bypass_mode: always\`), so ` +
                'each rule is advisory for that actor. Whether repository administrators are ' +
                'inside the threat model is an owner question; until it is answered the mechanism ' +
                'supplies process evidence rather than a platform-enforced guarantee. See ' +
                '`threat_model_note` in src/config/platform-anchor.json.',
        });
    }

    return {
        status: findings.length === 0 ? 'compliant' : 'noncompliant',
        findings,
        evidence,
    };
}
