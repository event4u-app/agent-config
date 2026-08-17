/**
 * Provider qualification for a council seat (road-to-release-review-p0 Phase 3).
 *
 * The failure this module exists to stop is recorded, not hypothetical: a seat
 * reported as `CONFIGURED` while being entirely dead, and the pass printed a
 * quorum it never reached. `cmd_status` answered from `member.enabled`, which
 * is a boolean in a YAML file — it says the operator wrote the seat down, not
 * that anything on the other end can answer. A boolean cannot express the
 * middle, so this module produces FOUR verdicts and an ordered ladder of the
 * checks that produced them.
 *
 * The four verdicts, and what each one licenses:
 *
 *  - `available`   — every applicable check passed AND a live exchange with the
 *                    provider has been observed within the freshness window.
 *  - `degraded`    — the seat is reachable but impaired (a capped quota, a
 *                    transport that performs no provider call, a transient
 *                    fault). It may answer; its answer may be worth less.
 *  - `unavailable` — a check hard-failed. Nothing will answer.
 *  - `unknown`     — a check could not be evaluated. Most often: nothing has
 *                    ever been observed to work on this seat.
 *
 * **`unknown` is the load-bearing one.** Before this module the tree had no way
 * to say "configured, plausible, and never once demonstrated" — that state read
 * as available, which is precisely how a dead seat passed for a live one. A
 * never-probed seat therefore qualifies as `unknown`, and `unknown` is not
 * countable toward presence.
 *
 * That is deliberately not a permanent tax on the operator. A council run that
 * gets a non-empty answer from a seat IS the observation, so a probe record
 * costs nothing extra and normal use decays `unknown` to `available` on its
 * own. No check in this module performs a provider call, and none may: the
 * module is pure — no filesystem, no environment, no clock beyond an injected
 * `now` — for the same reason `quorum.ts` is. A qualification pass that could
 * spend money would be a qualification pass nobody dares run.
 *
 * HONEST SCOPE — two of the seven rungs have no production caller yet.
 * Neither `build_members` nor `cmd_status` supplies `systemPrompt` or
 * `toolsIsolated`, so `system_prompt_path` and `tool_isolation` always report
 * `skipped` in a real run and can move no verdict. They are specified,
 * implemented and unit-tested; they are not yet WIRED, because nothing in the
 * council config records either fact today. Said plainly (R2 finding 6)
 * rather than left for a reader to discover: a ladder that prints seven rungs
 * while five of them decide anything is a coverage claim, and an unstated one
 * is the kind this repository treats as inflation.
 *
 * HONEST SCOPE: this module decides nothing on its own. It classifies. Whether
 * an `unknown` seat is refused, warned about, or counted is the caller's
 * choice, and the callers that make it are named in the roadmap's Phase 3
 * steps 3 and 4 — `cmd_status` for visibility and the quorum sites for
 * presence.
 */

import type { AbsentReason, CliFailureClass, Transport } from './transport_resolver.js';

/** The four-value verdict. A boolean is what this replaces; do not narrow it back. */
export type QualificationVerdict = 'available' | 'degraded' | 'unavailable' | 'unknown';

/**
 * Per-check outcome.
 *
 * `skipped` and `unknown` are different findings and must not be merged.
 * `skipped` means the check does not apply to this seat (there is no system
 * prompt to validate, so nothing is being left unverified). `unknown` means the
 * check applies and could not be answered — which is the state that must not
 * read as success.
 */
export type CheckStatus = 'pass' | 'degraded' | 'fail' | 'unknown' | 'skipped';

/**
 * The ladder, in the order the roadmap names it. Order is part of the contract:
 * a seat with no binary has nothing to authenticate against, so reporting an
 * auth finding underneath a missing binary would be noise dressed as detail.
 */
export type QualificationCheckId =
    | 'installed'
    | 'authenticated'
    | 'transport_semantics'
    | 'system_prompt_path'
    | 'model_identifier'
    | 'tool_isolation'
    | 'live_probe';

export const QUALIFICATION_LADDER: readonly QualificationCheckId[] = [
    'installed',
    'authenticated',
    'transport_semantics',
    'system_prompt_path',
    'model_identifier',
    'tool_isolation',
    'live_probe',
];

export interface QualificationCheck {
    readonly id: QualificationCheckId;
    readonly status: CheckStatus;
    /** One line, always present — a `pass` explains what was observed, not only what failed. */
    readonly detail: string;
}

/** A recorded observation of a real exchange with the provider. */
export interface ProbeRecord {
    /** ISO-8601 date (`YYYY-MM-DD`) or timestamp. Compared by date only. */
    readonly at: string;
    /** `ok` for a non-empty answer; otherwise the classified failure. */
    readonly outcome: 'ok' | CliFailureClass;
}

/**
 * Everything the ladder needs, gathered by the caller.
 *
 * The transport slice is exactly the shape `resolveMemberTransport` already
 * returns, so a caller passes its result straight through rather than
 * re-deriving anything. Optional fields are genuinely optional: an absent
 * `systemPrompt` means the seat declares none, which is `skipped`, not a gap.
 */
export interface MemberQualificationInput {
    readonly name: string;
    readonly transport: {
        readonly available: boolean;
        readonly transport: Transport | null;
        readonly reason: string | null;
        readonly absentReason: AbsentReason | null;
    };
    /** The model identifier the seat would send. Empty or null is a hard fail. */
    readonly modelId?: string | null;
    /**
     * A declared system-prompt path and whether it resolves. `exists: null`
     * means the caller declined to stat it — that is `unknown`, not `pass`.
     */
    readonly systemPrompt?: { readonly declared: string | null; readonly exists: boolean | null } | null;
    /**
     * Whether the seat runs with the host's tools withheld. `false` is
     * `degraded`, never `fail`: the seat still answers, but a second opinion
     * that can read the same tree is not the independent voice a council is
     * convened for. Absent means the seat makes no tool claim either way.
     */
    readonly toolsIsolated?: boolean | null;
    /** The most recent recorded exchange, or null when nothing was ever observed. */
    readonly lastProbe?: ProbeRecord | null;
    /** How long an `ok` observation stays fresh. Default 30 days. */
    readonly probeMaxAgeDays?: number;
    /** Injected for determinism — never read a clock inside a classifier. */
    readonly now?: Date;
}

export interface MemberQualification {
    readonly name: string;
    readonly verdict: QualificationVerdict;
    readonly checks: readonly QualificationCheck[];
    /** The check that set the verdict, or null when everything passed. */
    readonly decidedBy: QualificationCheckId | null;
}

export const DEFAULT_PROBE_MAX_AGE_DAYS = 30;

/**
 * Verdict severity, worst first.
 *
 * The rule this encodes: **the verdict is the weakest claim the evidence
 * supports.** A seat with one impaired check and one unevaluated check reads
 * `unknown`, not `degraded` — `degraded` asserts reachability, and an
 * unevaluated check means reachability was not established. Ordering `unknown`
 * above `degraded` is the whole anti-over-claim property of this module, so it
 * is not an arbitrary tie-break and must not be reordered for tidiness.
 */
const VERDICT_SEVERITY: Record<QualificationVerdict, number> = {
    unavailable: 3,
    unknown: 2,
    degraded: 1,
    available: 0,
};

const STATUS_TO_VERDICT: Record<Exclude<CheckStatus, 'skipped'>, QualificationVerdict> = {
    fail: 'unavailable',
    unknown: 'unknown',
    degraded: 'degraded',
    pass: 'available',
};

/**
 * Failure classes that mean the seat is alive but impaired, rather than dead.
 *
 * **`other` is deliberately NOT here, and putting it back re-opens the exact
 * defect this module exists to close.** `other` is `classifyCliFailure`'s
 * catch-all, and `_postRunQuorum` routes a member that produced nothing
 * through it — `'empty response body'` and `'no response'` both classify as
 * `other`. Listing it as impaired therefore recorded a seat that was
 * dispatched and returned silence as `degraded`, i.e. countable, i.e. present
 * again on the next pass. That is the over-claim one layer down, and it
 * survived until the R2 review of this branch caught it (finding 1, high).
 * An unclassifiable failure is `unavailable`: the weakest claim the evidence
 * supports, which is this module's whole ordering rule.
 *
 * `quota_exhausted` is the clearest case and the reason this set exists: the
 * cap is one the operator deliberately set, so the seat is working exactly as
 * configured. Treating it as `unavailable` would tell an operator to go fix a
 * provider that has nothing wrong with it. `timeout` and `server_error` are
 * transient by nature — a seat that timed out once yesterday is not a seat
 * that will never answer.
 */
const IMPAIRED_FAILURES: ReadonlySet<CliFailureClass> = new Set([
    'quota_exhausted',
    'timeout',
    'server_error',
]);

function _daysBetween(from: Date, to: Date): number {
    const ms = to.getTime() - from.getTime();
    return ms / 86_400_000;
}

function _installed(input: MemberQualificationInput): QualificationCheck {
    if (input.transport.absentReason === 'no_binary') {
        return { id: 'installed', status: 'fail', detail: input.transport.reason ?? 'no provider binary on PATH' };
    }
    if (input.transport.available) {
        return { id: 'installed', status: 'pass', detail: `transport ${String(input.transport.transport)} resolved` };
    }
    // Unavailable for some reason the resolver could not classify. That is not
    // proof of a missing binary, so it is not a fail on THIS rung — the
    // transport-semantics rung below will catch a null transport.
    return { id: 'installed', status: 'unknown', detail: input.transport.reason ?? 'transport unresolved' };
}

function _authenticated(input: MemberQualificationInput): QualificationCheck {
    if (input.transport.absentReason === 'no_auth') {
        return { id: 'authenticated', status: 'fail', detail: input.transport.reason ?? 'no credential resolved' };
    }
    if (input.transport.available) {
        return { id: 'authenticated', status: 'pass', detail: 'credential resolved by the transport resolver' };
    }
    return { id: 'authenticated', status: 'unknown', detail: 'not evaluated — transport unresolved' };
}

function _transportSemantics(input: MemberQualificationInput): QualificationCheck {
    if (input.transport.transport === null) {
        return {
            id: 'transport_semantics',
            status: 'fail',
            detail: input.transport.reason ?? 'no usable transport',
        };
    }
    if (input.transport.transport === 'manual') {
        // `manual` performs no provider call at all. It is a legitimate
        // configuration and a legitimate seat, but it cannot contribute a
        // model's answer, so counting it as a full voice is the same
        // over-claim in a different costume.
        return {
            id: 'transport_semantics',
            status: 'degraded',
            detail: 'manual transport performs no provider call',
        };
    }
    return { id: 'transport_semantics', status: 'pass', detail: `${input.transport.transport} transport` };
}

function _systemPromptPath(input: MemberQualificationInput): QualificationCheck {
    const sp = input.systemPrompt ?? null;
    if (sp === null || sp.declared === null || sp.declared === '') {
        return { id: 'system_prompt_path', status: 'skipped', detail: 'no system-prompt path declared' };
    }
    if (sp.exists === null) {
        return { id: 'system_prompt_path', status: 'unknown', detail: `declared ${sp.declared}, not checked` };
    }
    return sp.exists
        ? { id: 'system_prompt_path', status: 'pass', detail: `${sp.declared} resolves` }
        : { id: 'system_prompt_path', status: 'fail', detail: `${sp.declared} does not exist` };
}

function _modelIdentifier(input: MemberQualificationInput): QualificationCheck {
    const id = (input.modelId ?? '').trim();
    if (id === '') {
        return { id: 'model_identifier', status: 'fail', detail: 'no model identifier configured' };
    }
    // The recorded codex failure: the transport rejected the model id itself.
    // A static config read can never see this, which is why the probe record
    // is consulted on this rung and not only on the last one.
    // `model_unservable` ONLY. `cli_unsupported` was here and was wrong:
    // `classifyCliFailure` returns it for `parse_failed` — a response the CLI
    // could not parse — which says nothing about the model identifier and
    // would have this rung report "<id> was rejected by the transport" about
    // an id the transport never objected to. That failure still reaches
    // `unavailable`, via the `live_probe` rung where it belongs, so nothing is
    // lost except a wrong reason. (R2 finding 13.)
    if (input.lastProbe?.outcome === 'model_unservable') {
        return {
            id: 'model_identifier',
            status: 'fail',
            detail: `${id} was rejected by the transport on ${input.lastProbe.at}`,
        };
    }
    return { id: 'model_identifier', status: 'pass', detail: id };
}

function _toolIsolation(input: MemberQualificationInput): QualificationCheck {
    if (input.toolsIsolated === undefined || input.toolsIsolated === null) {
        return { id: 'tool_isolation', status: 'skipped', detail: 'no tool-isolation claim' };
    }
    return input.toolsIsolated
        ? { id: 'tool_isolation', status: 'pass', detail: 'host tools withheld' }
        : { id: 'tool_isolation', status: 'degraded', detail: 'seat runs with host tools available' };
}

function _liveProbe(input: MemberQualificationInput): QualificationCheck {
    const probe = input.lastProbe ?? null;
    if (probe === null) {
        return {
            id: 'live_probe',
            status: 'unknown',
            detail: 'no exchange with this provider has ever been recorded',
        };
    }
    if (probe.outcome !== 'ok') {
        const impaired = IMPAIRED_FAILURES.has(probe.outcome);
        return {
            id: 'live_probe',
            status: impaired ? 'degraded' : 'fail',
            detail: `last exchange ${probe.at} — ${probe.outcome}`,
        };
    }
    const maxAge = input.probeMaxAgeDays ?? DEFAULT_PROBE_MAX_AGE_DAYS;
    const at = new Date(probe.at);
    if (Number.isNaN(at.getTime())) {
        return { id: 'live_probe', status: 'unknown', detail: `unparseable probe date ${probe.at}` };
    }
    const age = _daysBetween(at, input.now ?? new Date());
    if (age > maxAge) {
        return {
            id: 'live_probe',
            status: 'unknown',
            detail: `last successful exchange ${probe.at} is older than ${String(maxAge)} days`,
        };
    }
    return { id: 'live_probe', status: 'pass', detail: `successful exchange ${probe.at}` };
}

const CHECK_FNS: Record<QualificationCheckId, (i: MemberQualificationInput) => QualificationCheck> = {
    installed: _installed,
    authenticated: _authenticated,
    transport_semantics: _transportSemantics,
    system_prompt_path: _systemPromptPath,
    model_identifier: _modelIdentifier,
    tool_isolation: _toolIsolation,
    live_probe: _liveProbe,
};

/**
 * Run the ladder and reduce it to one verdict.
 *
 * A `fail` short-circuits: every later rung is reported `skipped` rather than
 * evaluated, because `unavailable` is terminal and a list of consequential
 * findings under a dead seat reads as five problems where there is one. The
 * `skipped` entries are still emitted so the ladder always has the same shape
 * and a reader can see where evaluation stopped.
 */
export function qualifyMember(input: MemberQualificationInput): MemberQualification {
    const checks: QualificationCheck[] = [];
    let verdict: QualificationVerdict = 'available';
    let decidedBy: QualificationCheckId | null = null;
    let halted = false;

    for (const id of QUALIFICATION_LADDER) {
        if (halted) {
            checks.push({ id, status: 'skipped', detail: 'not evaluated — an earlier check failed' });
            continue;
        }
        const check = (CHECK_FNS[id] as (i: MemberQualificationInput) => QualificationCheck)(input);
        checks.push(check);
        if (check.status === 'skipped') {
            continue;
        }
        const candidate = STATUS_TO_VERDICT[check.status];
        if (VERDICT_SEVERITY[candidate] > VERDICT_SEVERITY[verdict]) {
            verdict = candidate;
            decidedBy = id;
        }
        if (check.status === 'fail') {
            halted = true;
        }
    }

    return { name: input.name, verdict, checks, decidedBy };
}

/**
 * May this seat be counted toward presence in a quorum?
 *
 * `available` and `degraded` yes; `unavailable` and `unknown` no. The second
 * half is the repair: a seat nobody has ever seen answer contributes nothing to
 * a k-of-n reading, however confidently the config declares it.
 *
 * Note what this deliberately does NOT do — it does not shrink `n`. Dropping an
 * unqualified seat from the total would LOWER the threshold (`ceil(n/2)`) and
 * make a short pass easier to conclude, which is the opposite of the intent.
 * The roster stays the roster; only attendance is gated.
 */
export function isCountableForQuorum(verdict: QualificationVerdict): boolean {
    return verdict === 'available' || verdict === 'degraded';
}

/**
 * Attendance a set of seats may claim before anything is dispatched.
 *
 * `total` is the configured roster, unchanged, so a shortfall stays visible in
 * the `k/n` line. `countable` is what may be reported present.
 */
export function qualifiedAttendance(quals: readonly MemberQualification[]): {
    readonly total: number;
    readonly countable: number;
    readonly blocked: readonly MemberQualification[];
} {
    const blocked = quals.filter((q) => !isCountableForQuorum(q.verdict));
    return { total: quals.length, countable: quals.length - blocked.length, blocked };
}

/** One line per seat, for a status surface. Stable and greppable in both directions. */
export function formatQualificationLine(q: MemberQualification): string {
    const because = q.decidedBy === null ? '' : ` (${q.decidedBy}: ${_detailFor(q, q.decidedBy)})`;
    return `${q.name}: ${q.verdict}${because}`;
}

function _detailFor(q: MemberQualification, id: QualificationCheckId): string {
    return q.checks.find((c) => c.id === id)?.detail ?? '';
}
