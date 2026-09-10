/**
 * The platform anchor: does the forge actually enforce what the ratification
 * mechanism's trust argument says it enforces?
 *
 * `check_kernel_edit_ratified` proves that a diff touching a kernel rule, a
 * governance hook or the ratification mechanism itself carries a reviewed
 * artifact. What no diff can contain is what the forge itself requires, and
 * that is what this module reads.
 *
 * It does NOT establish that the artifact was reviewed by anyone the repository
 * insisted on: by owner ruling of 2026-09-10 this repository requires no
 * approving review, because one maintainer is active and a mandatory approval
 * would be a stop rather than a control. So what this module checks is branch
 * integrity plus the presence of the required context that carries the gate —
 * see `docs/contracts/ratification-artifact.md` for what a green anchor is and
 * is not evidence of, which is the shorter list than it once was.
 *
 * It is deliberately PURE: it evaluates ruleset payloads a caller fetched, so
 * both polarities are testable offline and no test needs a token. The impure
 * half — the `gh api` calls and the fail-closed exit codes — lives in
 * `src/scripts/check_platform_anchor.ts`.
 *
 * Five constraints below are structural, and the code would read as arbitrary
 * without them:
 *
 * 1. **Effective combination, never a ruleset by id.** A repository may carry
 *    several active branch rulesets and an administrator may split one at any
 *    time. Assuming ruleset `17749383` — which is what exists today — or its
 *    name would make this check wrong on the first split. So every applicable
 *    active ruleset is unioned: booleans OR together, the approval count takes
 *    the MAXIMUM, contexts union, and bypass actors accumulate.
 * 2. **A non-negotiable floor in the code, in two tiers.** The expectation lives
 *    in `src/config/platform-anchor.json` so that changing it is a reviewable
 *    governance diff. That alone is not enough: a policy-only edit could lower a
 *    threshold and make itself green, so `NON_NEGOTIABLE_FLOOR` below is what
 *    such an edit cannot cross. `NEVER_WAIVABLE` is the harder tier inside it —
 *    the dimensions no waiver may reach at all.
 * 3. **Two distinct negative outcomes, and one qualified positive.**
 *    `noncompliant` means the configuration was read and violates the policy;
 *    `unverifiable` means it could not be established, and both are failures
 *    because a control that passes when it cannot measure is advisory. They stay
 *    separate statuses because they are different repairs.
 *    `compliant-with-accepted-risk` is the third: every hard dimension present,
 *    and at least one baseline expectation covered by a complete, unexpired,
 *    owner-authorised waiver. It is neither a pass nor a failure, and the caller
 *    must not print it as a plain pass.
 * 4. **Configured bypass actors, not the caller's own capability.** GitHub
 *    reports `current_user_can_bypass` for the acting identity, which varies by
 *    token and says nothing durable about the repository. The durable fact is
 *    the configured `bypass_actors` list, so that is what is judged.
 * 5. **A malformed waiver is worse than no waiver.** An incomplete, expired or
 *    impermissible waiver is refused, and the dimension it named is then judged
 *    normally. The opposite direction — a badly written waiver skipping a check
 *    — is how a waiver mechanism becomes an exemption registry.
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
    // `minimum_approving_reviews` and `require_last_push_approval` are NOT here,
    // and their absence is a recorded trust-model decision rather than an
    // oversight or a convenience. This repository has one active maintainer;
    // the others hold write access and are rarely available. A mandatory
    // approving review is therefore not a control here, it is a stop — and a
    // floor nothing can satisfy makes red mean "the repository chose a
    // different model" instead of "the platform violates its policy", which is
    // the reading that gets a gate deleted or wired `continue-on-error`.
    //
    // The boundary this does NOT cross, stated because the mechanism cannot
    // check it: a floor reduction is legitimate only where the operating model
    // CANNOT satisfy the floor — no second human exists — never where waiting
    // is merely inconvenient.
    //
    // `required_review_thread_resolution` IS here, and it was briefly not.
    // Removing it was the implementer's own judgement — approval-adjacent,
    // near-vacuous once no review is required — and a blind review caught that
    // the same change's record says only the owner may authorize a floor
    // reduction while the ruling names two dimensions and not this one. It also
    // left the check policy-lowerable: one boolean flip in the expectation
    // deleted it while the anchor still read compliant. Restored, and the forge
    // has it true, so restoring costs nothing and removes an unauthorized
    // reduction rather than adding a requirement.
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

/**
 * A dimension the owner has deliberately left unsatisfied, on record.
 *
 * The third state exists because the first two were both wrong for a real case.
 * Deleting a dimension the repository still considers the safer configuration
 * erases the difference between "never expected" and "expected and knowingly
 * waived"; leaving it enforced-and-red makes the gate say the configuration
 * violates its policy when the policy is what chose it. openai: *"If
 * noncompliance does not fail the gate, that dimension is not enforced for the
 * duration of the waiver. It remains a baseline expectation subject to an
 * active exception."* This type is that exception, made checkable.
 *
 * Every field is required, and a waiver missing any of them is not honoured —
 * an incomplete waiver is an undocumented deviation wearing a record's clothes.
 * `expires` is the load-bearing one: without it a waiver outlives the cost
 * premise that justified it, and the premise here is a CI duration, which is
 * not a constant.
 */
export interface AcceptedRiskWaiver {
    dimension: string;
    baseline: boolean;
    accepted: boolean;
    /** What can go wrong, in concrete terms rather than as a category. */
    failure_mode: string;
    /** What the waiver buys, with the measurement it rests on. */
    cost_avoided: string;
    /** Explicitly an assumption unless incident data supports it. */
    frequency_assumption: string;
    /** How a breakage is noticed and by whom, and how it gets repaired. */
    detection_and_repair: string;
    /** What still protects the surface, and what that protection does NOT cover. */
    residual_protection: string;
    authority: string;
    decided: string;
    /** ISO date. A waiver past it is not honoured, renewal is a fresh decision. */
    expires: string;
    review_triggers: string[];
    id: string;
}

/**
 * Dimensions no waiver may reach, whatever it documents.
 *
 * Both seats warned that a waiver mechanism becomes an exemption registry that
 * hollows out the floor, and this is the answer: eligibility is bounded by a
 * committed list rather than by the quality of the prose in the waiver. These
 * six are the ones whose absence makes every other assertion meaningless — a
 * ruleset that is not active, does not cover the branch, or lets an actor
 * bypass it unconditionally cannot be traded against a CI-duration saving.
 */
export const NEVER_WAIVABLE: readonly string[] = [
    'enforcement',
    'target',
    'covers_default_branch',
    'allow_unconditional_bypass',
    'block_deletion',
    'block_non_fast_forward',
];

export type AnchorStatus =
    | 'compliant'
    | 'compliant-with-accepted-risk'
    | 'noncompliant'
    | 'unverifiable';

/** Stable codes, so a test asserts the reason rather than the wording. */
export type AnchorCode =
    | 'policy-missing'
    | 'policy-unparseable'
    | 'policy-missing-field'
    | 'policy-unknown-field'
    | 'policy-repository-mismatch'
    | 'waiver-incomplete'
    | 'waiver-expired'
    | 'waiver-not-permitted'
    | 'waiver-unused'
    | 'policy-below-floor'
    | 'rulesets-unreadable'
    | 'default-branch-unknown'
    | 'no-applicable-ruleset'
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
export const SUPPORTED_ANCHOR_SCHEMA = 2;

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

const WAIVER_FIELDS: readonly (keyof AcceptedRiskWaiver)[] = [
    'dimension',
    'baseline',
    'accepted',
    'failure_mode',
    'cost_avoided',
    'frequency_assumption',
    'detection_and_repair',
    'residual_protection',
    'authority',
    'decided',
    'expires',
    'review_triggers',
    'id',
];

export interface WaiverReading {
    /** Keyed by dimension. Only complete, permitted, unexpired waivers appear. */
    honoured: Map<string, AcceptedRiskWaiver>;
    findings: AnchorFinding[];
}

/**
 * Read the waivers, refusing every one that is not fully in order.
 *
 * A refused waiver does NOT silently become a pass: it is absent from
 * `honoured`, so the dimension it meant to cover is judged normally and reds.
 * That direction matters — a malformed waiver has to be worse than no waiver,
 * never better, or writing one badly becomes a way to skip a check.
 */
export function readWaivers(text: string | null, now: Date): WaiverReading {
    const honoured = new Map<string, AcceptedRiskWaiver>();
    const findings: AnchorFinding[] = [];
    if (text === null) {
        return { honoured, findings };
    }
    let parsed: unknown;
    try {
        parsed = JSON.parse(text);
    } catch {
        return { honoured, findings };
    }
    if (!isObject(parsed) || parsed['accepted_risk_reductions'] === undefined) {
        return { honoured, findings };
    }
    const list = parsed['accepted_risk_reductions'];
    if (!Array.isArray(list)) {
        findings.push({
            code: 'waiver-incomplete',
            message: '`accepted_risk_reductions` must be an array of waiver objects.',
        });
        return { honoured, findings };
    }

    for (const entry of list) {
        if (!isObject(entry)) {
            findings.push({
                code: 'waiver-incomplete',
                message: 'a waiver entry is not an object.',
            });
            continue;
        }
        const id = typeof entry['id'] === 'string' ? entry['id'] : '<no id>';
        const missing = WAIVER_FIELDS.filter((f) => !(f in entry));
        if (missing.length > 0) {
            findings.push({
                code: 'waiver-incomplete',
                message:
                    `waiver \`${id}\` is missing ${missing.join(', ')}. An incomplete waiver is an ` +
                    'undocumented deviation, so it is refused rather than honoured and the ' +
                    'dimension it names is judged normally.',
            });
            continue;
        }
        const dimension = String(entry['dimension']);
        if (NEVER_WAIVABLE.includes(dimension)) {
            findings.push({
                code: 'waiver-not-permitted',
                message:
                    `waiver \`${id}\` names \`${dimension}\`, which no waiver may reach. A ruleset ` +
                    'that is not active, does not cover the branch, or lets an actor bypass it ' +
                    'unconditionally makes every other assertion here meaningless, and that is ' +
                    'not tradeable against an operational saving.',
            });
            continue;
        }
        const expires = new Date(String(entry['expires']));
        if (Number.isNaN(expires.getTime())) {
            findings.push({
                code: 'waiver-incomplete',
                message: `waiver \`${id}\` has an unparseable \`expires\`; it must be an ISO date.`,
            });
            continue;
        }
        if (expires.getTime() <= now.getTime()) {
            findings.push({
                code: 'waiver-expired',
                message:
                    `waiver \`${id}\` expired on ${String(entry['expires'])}. Renewal is a fresh ` +
                    'decision with refreshed measurements rather than an extension — the premise ' +
                    'it rests on is a cost, and a cost is not a constant.',
            });
            continue;
        }
        honoured.set(dimension, entry as unknown as AcceptedRiskWaiver);
    }
    return { honoured, findings };
}

/**
 * The verdict.
 *
 * `rulesets === null` means the caller could not read them — network, token
 * scope, offline — and yields `unverifiable`, never `compliant`. That is the
 * fail-closed direction both council seats required, and its blast radius is
 * only ever a diff on the gated surface, because the caller runs this check
 * exclusively when `requiresRatification` is true.
 *
 * A dimension covered by an honoured waiver does not become a finding; it is
 * reported as a known accepted risk and the status becomes
 * `compliant-with-accepted-risk`, which is neither a pass nor a failure. An
 * unused waiver is itself reported: a waiver for a dimension the forge now
 * satisfies is stale record, and stale records are how a reader learns to
 * distrust the whole file.
 */
export function evaluateAnchor(
    policy: AnchorPolicy,
    rulesets: readonly RulesetDetail[] | null,
    defaultBranch: string | null,
    waivers: ReadonlyMap<string, AcceptedRiskWaiver> = new Map(),
): AnchorReading {
    const findings: AnchorFinding[] = [];
    const evidence: string[] = [];
    const accepted: string[] = [];
    const used = new Set<string>();

    /**
     * Record a violated dimension as a finding, or as an accepted risk.
     *
     * The waiver check happens HERE rather than at the end, so a waived
     * dimension never enters the findings list at all — filtering findings
     * afterwards would leave the two states one refactor apart.
     */
    const violated = (dimension: string, finding: AnchorFinding): void => {
        const w = waivers.get(dimension);
        if (w === undefined) {
            findings.push(finding);
            return;
        }
        used.add(dimension);
        accepted.push(
            `${dimension}: baseline ${String(w.baseline)}, accepted ${String(w.accepted)} — ` +
                `${w.id}, ${w.authority} ${w.decided}, expires ${w.expires}. ` +
                `Residual: ${w.residual_protection}`,
        );
    };

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

    // Observed and reported, never judged. The two approval dimensions left the
    // enforced set with the trust-model decision above, and deleting the
    // MEASUREMENT with the requirement would have been the wrong half to drop:
    // a reader still wants to see what the forge actually says, and a number
    // that is reported without being a threshold cannot quietly become one.
    evidence.push(
        `approving reviews required: ${eff.approvingReviews} · last-push approval: ` +
            `${eff.requireLastPushApproval} — observed, not required here (see NON_NEGOTIABLE_FLOOR)`,
    );
    if (policy.required_review_thread_resolution && !eff.requireThreadResolution) {
        violated('required_review_thread_resolution', {
            code: 'thread-resolution-missing',
            message: '`required_review_thread_resolution` is off, so an open objection cannot block a merge.',
        });
    }
    if (policy.block_deletion && !eff.blocksDeletion) {
        violated('block_deletion', {
            code: 'deletion-not-blocked',
            message: 'the default branch is not protected against deletion.',
        });
    }
    if (policy.block_non_fast_forward && !eff.blocksNonFastForward) {
        violated('block_non_fast_forward', {
            code: 'non-fast-forward-not-blocked',
            message: 'the default branch is not protected against force-pushes (non-fast-forward).',
        });
    }
    if (policy.strict_required_status_checks && !eff.strictStatusChecks) {
        violated('strict_required_status_checks', {
            code: 'status-checks-not-strict',
            message:
                '`strict_required_status_checks_policy` is off, so a branch may merge on checks ' +
                'that passed against a base it has not caught up with. The staleness is not ' +
                'bounded to one commit: any number of merges may have landed since, so two ' +
                'independently green branches can compose into a broken base.',
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
                'each rule is advisory for that actor. The owner ruled on 2026-09-10 that ' +
                'administrators are the root of trust here, and that ruling REMOVED the approval ' +
                'dimensions rather than this one: an unconditional bypass actor is still a ' +
                'failure and no waiver may reach it. See `owner_ruling_2026_09_10` in ' +
                'src/config/platform-anchor.json.',
        });
    }

    // A waiver nobody needed is stale record, and stale records teach a reader
    // to distrust the file they sit in. Reported rather than ignored, and
    // deliberately NOT a failure: the configuration is safer than the waiver
    // assumed, which is the good direction to be wrong in.
    for (const [dimension, w] of waivers) {
        if (!used.has(dimension)) {
            findings.push({
                code: 'waiver-unused',
                message:
                    `waiver \`${w.id}\` covers \`${dimension}\`, which the forge now satisfies. ` +
                    'The waiver is stale and should be removed — the risk it accepted is not ' +
                    'being taken.',
            });
        }
    }

    for (const a of accepted) {
        evidence.push(`ACCEPTED RISK — ${a}`);
    }

    if (findings.length > 0) {
        return { status: 'noncompliant', findings, evidence };
    }
    return {
        status: accepted.length > 0 ? 'compliant-with-accepted-risk' : 'compliant',
        findings,
        evidence,
    };
}
