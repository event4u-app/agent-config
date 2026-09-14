/**
 * The five `forge_protection` rows, read from the forge rather than guessed.
 *
 * `road-to-adversarial-verification-and-long-runs` Phase 3.2. ADR-268 § 3 trades
 * the owner's confirmation for a mechanical check, and branch protection is the
 * check it trades for — so a run that cannot say whether protection exists has
 * not established the thing the trade depends on.
 *
 * **Every row carries the API call its value came from, and a row that was not
 * read says so.** That is the whole shape: the step's word is *read, never
 * guessed*, and the only way a reader can tell one from the other is if the
 * provenance travels with the value. A row is `satisfied` / `unsatisfied` only
 * when a named call produced it; otherwise it is `unread`, which is a third
 * state and never a false.
 *
 * **Rulesets, not the classic branch-protection endpoint.** On this repository
 * `repos/<owner>/<repo>/branches/main/protection` returns `404 {"message":"Branch
 * not protected"}` while an active ruleset protects the default branch — so a
 * checker reading the classic endpoint reports "unprotected" for a repository
 * that is protected. The `forge-protection-settings` blocker was re-scoped for
 * exactly this reason on 2026-09-10, and the re-scope forbids treating that 404
 * as absence of protection. No ruleset ID is pinned: rulesets can be replaced or
 * split, and pinning one would break on the first change.
 *
 * Pure. The network lives in the caller, so both polarities are testable offline.
 */

import type { BypassActor, RulesetDetail } from './platform_anchor.js';

/** Whether a row was established, refuted, or never read. */
export type RowState = 'satisfied' | 'unsatisfied' | 'unread';

/** One `forge_protection` row. */
export interface ProtectionRow {
    /** Stable key. Rows are addressed by this, never by position. */
    readonly id: string;
    readonly state: RowState;
    /**
     * The forge API call this value came from — or would come from, when the row
     * is `unread`. Never empty: a value whose provenance is unstated is the
     * guess this block exists to refuse.
     */
    readonly source: string;
    /** One line a human can act on when the row is not satisfied. */
    readonly detail: string;
}

/** The five rows, in the order the blocker's own table lists them. */
export const PROTECTION_ROW_IDS: readonly string[] = [
    'default_branch_protected',
    'required_checks_present',
    'force_push_disabled',
    'auto_merge_available',
    'deploy_via_pipeline_only',
] as const;

/** What a caller must supply for a row to be readable. `null` = not read. */
export interface ForgeReading {
    /** `repos/<repo>/rulesets` + `/rulesets/<id>`, or `null` when unread. */
    readonly rulesets: readonly RulesetDetail[] | null;
    /** The repository's default branch, or `null` when unread. */
    readonly defaultBranch: string | null;
    /** `repos/<repo>` → `allow_auto_merge`, or `null` when unread. */
    readonly allowAutoMerge: boolean | null;
    /**
     * `repos/<repo>/environments` → whether every environment with deployment
     * branch policies restricts them, or `null` when unread.
     *
     * Deliberately a boolean the caller derives rather than a raw payload: what
     * the row asserts is a property of the SET of environments, and handing this
     * module the raw list would put that judgement in two places.
     */
    readonly deployRestricted: boolean | null;
}

const SOURCE = {
    rulesets: 'GET repos/{owner}/{repo}/rulesets + GET .../rulesets/{id}',
    repo: 'GET repos/{owner}/{repo} (allow_auto_merge)',
    environments: 'GET repos/{owner}/{repo}/environments (deployment_branch_policy)',
} as const;

/** `true` when this ruleset is active and targets branches. */
function isActiveBranchRuleset(rs: RulesetDetail): boolean {
    return rs.enforcement === 'active' && rs.target === 'branch';
}

/** `true` when the ruleset's ref conditions reach the default branch. */
function reachesDefaultBranch(rs: RulesetDetail, defaultBranch: string): boolean {
    const include = rs.conditions?.ref_name?.include ?? [];
    return include.some(
        (p) => p === '~DEFAULT_BRANCH' || p === '~ALL' || p === `refs/heads/${defaultBranch}`,
    );
}

function hasRule(rs: RulesetDetail, type: string): boolean {
    return (rs.rules ?? []).some((r) => r.type === type);
}

function requiredContexts(rs: RulesetDetail): string[] {
    for (const r of rs.rules ?? []) {
        if (r.type !== 'required_status_checks') continue;
        const p = r.parameters;
        if (p === null || typeof p !== 'object') continue;
        const list = (p as Record<string, unknown>)['required_status_checks'];
        if (!Array.isArray(list)) continue;
        return list
            .map((e) =>
                e !== null && typeof e === 'object'
                    ? (e as Record<string, unknown>)['context']
                    : null,
            )
            .filter((c): c is string => typeof c === 'string');
    }
    return [];
}

/**
 * Map a forge reading onto the five rows.
 *
 * Never throws and never invents: an input of `null` produces `unread`, which is
 * why the return type has three states rather than two. A gate that reports
 * `false` for something it did not look at is the failure this separation exists
 * to prevent — and it is the failure the `forge-protection-settings` re-scope
 * names, one layer up.
 */
export function forgeProtectionRows(reading: ForgeReading): ProtectionRow[] {
    const rows: ProtectionRow[] = [];
    const rulesets = reading.rulesets;
    const branch = reading.defaultBranch;

    const covering =
        rulesets === null || branch === null
            ? null
            : rulesets.filter((rs) => isActiveBranchRuleset(rs) && reachesDefaultBranch(rs, branch));

    rows.push(
        covering === null
            ? {
                  id: 'default_branch_protected',
                  state: 'unread',
                  source: SOURCE.rulesets,
                  detail: 'the rulesets were not queried',
              }
            : covering.length > 0
              ? {
                    id: 'default_branch_protected',
                    state: 'satisfied',
                    source: SOURCE.rulesets,
                    detail: `${String(covering.length)} active branch ruleset(s) cover the default branch`,
                }
              : {
                    id: 'default_branch_protected',
                    state: 'unsatisfied',
                    source: SOURCE.rulesets,
                    detail:
                        'no active branch ruleset covers the default branch. NOTE: the classic ' +
                        'branches/<b>/protection endpoint 404s on a ruleset-protected repository, ' +
                        'so a 404 there is not evidence for this row.',
                },
    );

    const contexts = covering === null ? null : covering.flatMap(requiredContexts);
    rows.push(
        contexts === null
            ? {
                  id: 'required_checks_present',
                  state: 'unread',
                  source: SOURCE.rulesets,
                  detail: 'the rulesets were not queried',
              }
            : contexts.length > 0
              ? {
                    id: 'required_checks_present',
                    state: 'satisfied',
                    source: SOURCE.rulesets,
                    detail: `${String(contexts.length)} required context(s): ${contexts.join(', ')}`,
                }
              : {
                    id: 'required_checks_present',
                    state: 'unsatisfied',
                    source: SOURCE.rulesets,
                    detail: 'no required status check context is configured',
                },
    );

    const noFastForward = covering === null ? null : covering.some((rs) => hasRule(rs, 'non_fast_forward'));
    rows.push(
        noFastForward === null
            ? {
                  id: 'force_push_disabled',
                  state: 'unread',
                  source: SOURCE.rulesets,
                  detail: 'the rulesets were not queried',
              }
            : {
                  id: 'force_push_disabled',
                  state: noFastForward ? 'satisfied' : 'unsatisfied',
                  source: SOURCE.rulesets,
                  detail: noFastForward
                      ? 'a non_fast_forward rule is active on the default branch'
                      : 'no non_fast_forward rule covers the default branch',
              },
    );

    rows.push(
        reading.allowAutoMerge === null
            ? {
                  id: 'auto_merge_available',
                  state: 'unread',
                  source: SOURCE.repo,
                  detail: 'the repository record was not queried',
              }
            : {
                  id: 'auto_merge_available',
                  state: reading.allowAutoMerge ? 'satisfied' : 'unsatisfied',
                  source: SOURCE.repo,
                  detail: reading.allowAutoMerge
                      ? 'allow_auto_merge is enabled'
                      : 'allow_auto_merge is disabled — merge delivery cannot queue behind checks',
              },
    );

    rows.push(
        reading.deployRestricted === null
            ? {
                  id: 'deploy_via_pipeline_only',
                  state: 'unread',
                  source: SOURCE.environments,
                  detail: 'the environments were not queried',
              }
            : {
                  id: 'deploy_via_pipeline_only',
                  state: reading.deployRestricted ? 'satisfied' : 'unsatisfied',
                  source: SOURCE.environments,
                  detail: reading.deployRestricted
                      ? 'every environment restricts its deployment branches'
                      : 'at least one environment accepts a deployment from any branch',
              },
    );

    return rows;
}

/**
 * The human ACTION lines for rows that are not satisfied.
 *
 * **Not a halt, and the step says so explicitly**: `doctor` LISTS what is
 * missing and the run continues. An `unread` row produces an action too — "go
 * and read it" is a real instruction, and silently omitting it would make an
 * unmeasured row indistinguishable from a satisfied one, which is the same
 * conflation the three-state row type exists to prevent.
 */
export function protectionActions(rows: readonly ProtectionRow[]): string[] {
    return rows
        .filter((r) => r.state !== 'satisfied')
        .map((r) => `${r.id}: ${r.state} — ${r.detail} (source: ${r.source})`);
}

/** Unconditional bypass actors across the covering rulesets, for reporting. */
export function unconditionalBypasses(
    rulesets: readonly RulesetDetail[],
    defaultBranch: string,
): BypassActor[] {
    return rulesets
        .filter((rs) => isActiveBranchRuleset(rs) && reachesDefaultBranch(rs, defaultBranch))
        .flatMap((rs) => (rs.bypass_actors ?? []).filter((a) => a.bypass_mode === 'always'));
}
