/**
 * The standing-payload ceiling, MEASURED at the base ref rather than stored.
 *
 *     ceiling = max(design_ceiling, effective_base + active grant)
 *
 * WHY MEASURED
 * ------------
 * An AI council (2/2 convergent, 2026-09-10, under a written owner delegation)
 * fixed the formula, and the reason for the move is one sentence from that
 * verdict: a measured ceiling **captures every merged reduction
 * automatically**, where a stored one stays at its last hand-written number —
 * so payload a merge removed can be added straight back into the space it
 * freed. That is the defect `ci_delivery.grace_ceiling` had for its whole life.
 *
 * WHY NO PER-PR HEADROOM. Both seats, without qualification: *"Neither a
 * percentage nor a fixed token allowance is safe against a moving base: both
 * authorize cumulative growth."* One seat put the arithmetic on it —
 * 138,413 × 1.05^10 ≈ 225,000 after ten pull requests. `headroom_pct` derives
 * the FIXED design ceiling from `baseline_tokens` and is never re-applied to a
 * moving base. So the ordinary path is ZERO NET GROWTH while the tree is over
 * design, and the design ceiling once it is at or below. 96.8 % of the last
 * 250 merged pull requests already move this payload by zero or less.
 *
 * THE STORED TERM IS GONE — STAGE 2 LANDED 2026-09-11
 * ----------------------------------------------------
 * A second council round (2/2, 2026-09-11) refused to let the stored ceiling be
 * removed in the change that INTRODUCED the measured one, on a structural
 * ground rather than a cautious one. Under prerequisite 3 the gate runs AS IT
 * EXISTS AT THE BASE REF, so — openai, verbatim — *"the new gate cannot safely
 * validate its own introduction: while the implementation PR runs, the
 * authoritative measuring code at the base ref is still the old
 * implementation."*
 *
 * Stage 1 therefore landed the whole mechanism with the stored ceiling retained
 * as an additional `max` term that could only widen the bound. Stage 2 removes
 * it from a base that already carries this code — verified before the removal
 * by running the base-ref copy of the gate against the head tree, which is the
 * precondition the sequencing was about. `ci_delivery` now stores no ceiling at
 * all, so the bound cannot be widened by editing a field. ADR-275 records the
 * formula and its prerequisites; ADR-276 records this removal and the required
 * status check that made it meaningful.
 *
 * THE EXCEPTION PATH, AND WHY THE WATERMARK IS THE LOAD-BEARING FIELD
 * -------------------------------------------------------------------
 * A change whose offsetting reduction is genuinely unsafe takes a recorded,
 * approved, dated grant. Both seats specified the same six properties, and one
 * is easy to lose: *"the exceptional measurement must NEVER become the next
 * base."* Under a base-measured ceiling that is a mechanism, not a note —
 * without it a grant of N tokens raises the measurement, the next pull request
 * measures the raised base, and the grant is permanent one merge later.
 * `effectiveBase` pins the base to the WATERMARK recorded at grant time for as
 * long as the grant is live.
 *
 * SIX CONTRACT RULES, EACH FROM A BLOCKING FINDING OF THE 2026-09-11 ROUND
 * ------------------------------------------------------------------------
 * 1. AT MOST ONE ACTIVE GRANT. openai: overlapping grants are undefined, and
 *    *"'use the highest watermark' is not safe: a later watermark may already
 *    contain earlier exceptional growth, causing that growth to be counted both
 *    in the anchor and in summed grants."* anthropic preferred defined overlap
 *    rules to a ban but called defined semantics blocking either way, so the
 *    ban satisfies both seats and the permissive variant does not.
 * 2. APPROVAL MUST BE AUTHENTICATED, NOT ASSERTED. Both seats' hardest
 *    pushback: `approved_by` in the pull request that requests the grant is
 *    self-asserted data authenticating nothing. A grant therefore carries an
 *    `approval_event` — a reference to a platform event outside the diff — and
 *    a grant whose approval is unverified is REFUSED rather than honoured.
 *    Verification is the CI step's job (it needs the platform); this module
 *    refuses anything it was not told is verified.
 * 3. DELETION CANNOT DISCHARGE DEBT. A removed record is not a repaid one.
 *    Deletion is caught by the base-ref ratchet, which sees a grant that
 *    existed at the base and does not exist at head.
 * 4. `repaid_at` IS A RECORD OF A MEASUREMENT, NOT A CLAIM. Repayment is
 *    established by the payload returning to the watermark. A record claiming
 *    repayment while the measurement says otherwise is refused.
 * 5. CONSUMPTION IS DERIVED. There is no `consumed_tokens` field to edit:
 *    consumption is `measured − watermark`, computed here.
 * 6. EXPIRY IS EVALUATED AT GATE TIME, which is merge time on a required
 *    check. A grant that expires while its pull request sits in review reds
 *    that pull request; the fix is a fresh approved grant, never an edit to the
 *    old one's date, which rule 3's ratchet refuses anyway.
 *
 * WHAT THIS IS NOT, STATED RATHER THAN IMPLIED
 * ---------------------------------------------
 * The ledger is editable by the pull request it governs, like the gate code.
 * The council accepted that for the gate under prerequisite 3 in these terms:
 * *"the mechanism does not prevent the exploit; it makes the exploit auditable
 * … a forensic control, not a preventive one."* Rules 2 and 3 above are what
 * keep the ledger from being weaker than that — an unverified grant buys
 * nothing, and a deleted one is still owed.
 *
 * NO NUMERIC CAP IS ENFORCED, AND THAT IS A FINDING RATHER THAN AN OMISSION.
 * Both seats refused to derive one from the 250-PR delta distribution
 * (p50 0, p90 0, p95 0/+167, max +288): the sample is CENSORED by the very
 * ratchet a cap would relax, so every percentile describes what got through
 * rather than what was attempted. A p95 cap would license the top 5 % of
 * ordinary work to use the break-glass routinely, which makes it not
 * exceptional. The 2026-09-11 round added that the cap must eventually come
 * from actual CONSUMED rather than granted tokens, which rule 5 makes
 * measurable. Until then the approver is the cap.
 */
import * as fs from 'node:fs';

/** Repo-relative path of the break-glass ledger. */
export const EXCEPTIONS_CONFIG_PATH = 'src/config/preamble-payload-exceptions.json';

/**
 * A grant's state at evaluation time. Derived, never stored — a stored status
 * would be a second source of truth that drifts against `expires_at`.
 */
export type ExceptionState = 'active' | 'repaid' | 'expired';

export interface PayloadException {
    id: string;
    granted_tokens: number;
    /** The measured payload immediately BEFORE the grant. The base is pinned here. */
    watermark: number;
    reason: string;
    /**
     * A reference to a platform event that authorised this grant, OUTSIDE the
     * diff requesting it — the council's blocking finding #2. Shape is the CI
     * step's business; this module only requires that one is named and that
     * the caller has verified it.
     */
    approval_event: string;
    /** ISO date. */
    approved_at: string;
    /** ISO date. After it, an unrepaid grant is a hard refusal. */
    expires_at: string;
    /** ISO date once the payload has measurably returned to the watermark. */
    repaid_at: string | null;
}

export interface ExceptionsFile {
    exceptions: PayloadException[];
    /** Schema / parse problems. Non-empty means the file may not be trusted. */
    errors: string[];
}

function isIsoDate(v: unknown): v is string {
    return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
}

/**
 * Read and VALIDATE the ledger. A malformed entry is an error, never a skip.
 *
 * An unreadable or invalid ledger must not silently evaluate as "no
 * exceptions": that reading is permissive in one direction — a corrupted entry
 * stops pinning the base to its watermark — and the caller cannot tell it from
 * an honestly empty file. Callers refuse on `errors`.
 */
export function readExceptions(file: string): ExceptionsFile {
    let raw: unknown;
    try {
        raw = JSON.parse(fs.readFileSync(file, 'utf-8'));
    } catch (err) {
        const e = err as NodeJS.ErrnoException;
        if (e.code === 'ENOENT') return { exceptions: [], errors: [] };
        return { exceptions: [], errors: [`${file} is not readable as JSON: ${(err as Error).message}`] };
    }
    const root = (raw ?? {}) as Record<string, unknown>;
    const list = root['exceptions'];
    if (list === undefined) return { exceptions: [], errors: [] };
    if (!Array.isArray(list)) return { exceptions: [], errors: [`${file}: 'exceptions' must be an array`] };

    const errors: string[] = [];
    const out: PayloadException[] = [];
    const ids = new Set<string>();
    list.forEach((item, i) => {
        const e = (item ?? {}) as Record<string, unknown>;
        const where = `${file}: exceptions[${String(i)}]`;
        const id = e['id'];
        const granted = Number(e['granted_tokens']);
        const watermark = Number(e['watermark']);
        const repaid = e['repaid_at'] ?? null;
        if (typeof id !== 'string' || id.trim() === '') errors.push(`${where}: 'id' must be a non-empty string`);
        else if (ids.has(id)) errors.push(`${where}: duplicate id '${id}' — an id is the record's identity`);
        else ids.add(id);
        if (!Number.isInteger(granted) || granted <= 0) {
            errors.push(`${where}: 'granted_tokens' must be a positive integer`);
        }
        if (!Number.isInteger(watermark) || watermark < 0) {
            errors.push(`${where}: 'watermark' must be a non-negative integer — the payload measured at grant time`);
        }
        for (const k of ['reason', 'approval_event'] as const) {
            if (typeof e[k] !== 'string' || (e[k] as string).trim() === '') {
                errors.push(
                    `${where}: '${k}' must be a non-empty string` +
                        (k === 'approval_event'
                            ? ". An approval recorded only by the diff requesting it authenticates nothing — name the platform event that authorised it."
                            : ''),
                );
            }
        }
        for (const k of ['approved_at', 'expires_at'] as const) {
            if (!isIsoDate(e[k])) errors.push(`${where}: '${k}' must be a YYYY-MM-DD date`);
        }
        if (repaid !== null && !isIsoDate(repaid)) {
            errors.push(`${where}: 'repaid_at' must be a YYYY-MM-DD date or null`);
        }
        if (e['consumed_tokens'] !== undefined) {
            errors.push(
                `${where}: 'consumed_tokens' is not a field. Consumption is DERIVED as measured − watermark; ` +
                    'a stored copy would be an editable assertion about a measurement, which is the shape ' +
                    'this ledger exists to avoid.',
            );
        }
        out.push({
            id: typeof id === 'string' ? id : `<entry ${String(i)}>`,
            granted_tokens: Number.isFinite(granted) ? granted : 0,
            watermark: Number.isFinite(watermark) ? watermark : 0,
            reason: String(e['reason'] ?? ''),
            approval_event: String(e['approval_event'] ?? ''),
            approved_at: String(e['approved_at'] ?? ''),
            expires_at: String(e['expires_at'] ?? ''),
            repaid_at: repaid === null ? null : String(repaid),
        });
    });
    return { exceptions: out, errors };
}

/** `today` as `YYYY-MM-DD`, injectable so the expiry branch is testable. */
export function stateOf(e: PayloadException, today: string): ExceptionState {
    if (e.repaid_at !== null) return 'repaid';
    return e.expires_at < today ? 'expired' : 'active';
}

export interface CeilingReading {
    /** The number the payload is compared against. */
    ceiling: number;
    /** `round(baseline_tokens * (1 + headroom_pct/100))`. The floor of the ceiling. */
    designCeiling: number;
    /** Payload measured at the base ref, or `null` when it could not be read. */
    basePayload: number | null;
    /** The base after watermark pinning, or `null` with `basePayload`. */
    effectiveBase: number | null;
    /** `granted_tokens` of the single active grant, else 0. */
    activeGrants: number;
    activeIds: string[];
    /** Which term set the ceiling — the one thing a reader needs at a glance. */
    boundBy: 'design' | 'base' | 'grant';
    /** True when the ceiling rests on a base reading that was actually taken. */
    verified: boolean;
    ok: boolean;
    violations: string[];
    /** Printed on the passing path too, so a skip cannot pass for a check. */
    note: string | null;
}

export interface CeilingOptions {
    designCeiling: number;
    /** `null` = the base ref could not be measured. */
    basePayload: number | null;
    /** Why it could not be measured. Rendered verbatim. */
    baseNote?: string | null;
    /** The payload measured in THIS tree — needed to corroborate `repaid_at`. */
    headPayload: number;
    exceptions?: readonly PayloadException[];
    exceptionErrors?: readonly string[];
    /**
     * Ids whose `approval_event` the caller VERIFIED against the platform.
     *
     * Absent means nothing was verified, which is the safe default: a grant is
     * honoured only when someone with access to the platform said so.
     */
    verifiedApprovals?: readonly string[];
    /** `YYYY-MM-DD`. Injected so the expiry branch is testable. */
    today: string;
    /**
     * Refuse instead of falling back when the base could not be measured.
     *
     * Advisory is the default and keeps a shallow clone, a first commit and a
     * detached build usable — the same argument `standing_bound_ratchet` makes
     * for its own mode gate, and the same reason the flag is the caller's
     * rather than sniffed from an environment variable here.
     */
    requireBase?: boolean;
}

/**
 * Compute the effective ceiling and say whether it may be trusted.
 *
 * Pure: it takes a base reading rather than producing one, so every branch —
 * expiry, watermark pinning, unverified approval, fail-closed base — is
 * testable without git or a platform.
 */
export function computeCeiling(opts: CeilingOptions): CeilingReading {
    const exceptions = opts.exceptions ?? [];
    const verified = new Set(opts.verifiedApprovals ?? []);
    const violations = [...(opts.exceptionErrors ?? [])];

    const live = exceptions.filter((e) => stateOf(e, opts.today) !== 'repaid');
    const expired = live.filter((e) => stateOf(e, opts.today) === 'expired');
    const candidates = live.filter((e) => stateOf(e, opts.today) === 'active');

    // Rule 1 — at most one active grant. Summing overlapping grants can count
    // exceptional growth twice: in a later watermark that already contains it,
    // and again in the sum.
    if (candidates.length > 1) {
        violations.push(
            `${String(candidates.length)} standing-payload exceptions are active at once ` +
                `(${candidates.map((e) => e.id).join(', ')}). At most one may be. Overlapping grants have no ` +
                'defined composition: a later watermark can already contain an earlier grant\'s growth, so ' +
                'summing counts it twice. Repay or expire one before recording the next.',
        );
    }

    // Rule 2 — an unverified approval buys nothing.
    for (const e of candidates) {
        if (!verified.has(e.id)) {
            violations.push(
                `standing-payload exception '${e.id}' has no VERIFIED approval. It names ` +
                    `'${e.approval_event}', and nothing in this run confirmed that event. An approval recorded ` +
                    'only by the change that requests it is self-asserted data: the same diff can claim the ' +
                    'grant, the approver and the date. The grant is refused until the platform event is ' +
                    'checked. This is not a payload problem — do not shrink the change to clear it.',
            );
        }
    }

    // Rule 6 — expiry is evaluated now, which on a required check is merge time.
    for (const e of expired) {
        violations.push(
            `standing-payload exception '${e.id}' expired on ${e.expires_at} and is not repaid. ` +
                `It granted ${String(e.granted_tokens)} tok over a watermark of ${String(e.watermark)}. ` +
                'Bring the payload back to the watermark and record repaid_at, or obtain a fresh approved ' +
                "grant — editing this one's expiry is refused by the shrink-only ratchet, and an expiry " +
                'that lapsed quietly would renew the grant by inaction.',
        );
    }

    // Rule 4 — `repaid_at` records a measurement; it does not assert one.
    for (const e of exceptions) {
        if (e.repaid_at !== null && opts.headPayload > e.watermark) {
            violations.push(
                `standing-payload exception '${e.id}' is marked repaid on ${e.repaid_at}, but the payload ` +
                    `measures ${String(opts.headPayload)} against its watermark of ${String(e.watermark)} — ` +
                    `${String(opts.headPayload - e.watermark)} tok still outstanding. Repayment is established ` +
                    'by the measurement returning to the watermark; the field records that event and cannot ' +
                    'substitute for it.',
            );
        }
    }

    const activeGrants = candidates.length === 1 ? (candidates[0]?.granted_tokens ?? 0) : 0;
    const activeIds = candidates.map((e) => e.id);

    if (opts.basePayload === null) {
        const why = opts.baseNote ?? 'the base ref could not be measured';
        const fallback = opts.designCeiling;
        if (opts.requireBase === true) {
            violations.push(
                `the standing-payload ceiling could not be measured: ${why}. This run is ENFORCING, so an ` +
                    'unmeasurable base refuses rather than falling back — a base that cannot be read would ' +
                    'otherwise grant an unbounded budget on an infrastructure failure. This is NOT payload ' +
                    'growth: fix the checkout (a full fetch of the base ref) rather than shrinking the change.',
            );
        }
        return {
            ceiling: fallback,
            designCeiling: opts.designCeiling,
            basePayload: null,
            effectiveBase: null,
            activeGrants,
            activeIds,
            boundBy: 'design',
            verified: false,
            ok: violations.length === 0 && opts.requireBase !== true,
            note: `${why}, so the ceiling is NOT a base-measured reading`,
            violations,
        };
    }

    // The watermark pin. Without it a grant raises the measurement, the next
    // pull request measures the raised base, and the grant is permanent.
    const effectiveBase =
        candidates.length === 1
            ? Math.min(opts.basePayload, candidates[0]?.watermark ?? opts.basePayload)
            : opts.basePayload;

    // An unverified or over-subscribed grant contributes ZERO, so a refused
    // grant can never widen the bound it was refused for.
    const honoured = violations.length === 0 ? activeGrants : 0;
    const measuredTerm = effectiveBase + honoured;
    const ceiling = Math.max(opts.designCeiling, measuredTerm);

    let boundBy: CeilingReading['boundBy'] = 'design';
    if (ceiling === measuredTerm && ceiling > opts.designCeiling) boundBy = honoured > 0 ? 'grant' : 'base';

    return {
        ceiling,
        designCeiling: opts.designCeiling,
        basePayload: opts.basePayload,
        effectiveBase,
        activeGrants: honoured,
        activeIds,
        boundBy,
        verified: true,
        ok: violations.length === 0,
        violations,
        note: null,
    };
}

/** The human rendering, printed on BOTH paths — a check that only speaks when
 *  it fails is a check nobody audits until it is already load-bearing. */
export function renderCeiling(c: CeilingReading): string {
    const lines: string[] = [];
    if (!c.verified) {
        lines.push(`  ⚠️  ceiling NOT measured — ${c.note ?? 'no reason recorded'}\n`);
        lines.push(`      falling back to ${String(c.ceiling)} tok (design ${String(c.designCeiling)}).\n`);
    } else {
        const pinned = c.effectiveBase !== c.basePayload;
        const how =
            c.boundBy === 'design'
                ? `the DESIGN ceiling — the measured base (${String(c.basePayload ?? 0)}) is at or below it`
                : `base ${String(c.effectiveBase ?? 0)}` +
                  (pinned ? ` (PINNED to an exception watermark; measured ${String(c.basePayload ?? 0)})` : '') +
                  (c.activeGrants > 0 ? ` + ${String(c.activeGrants)} granted` : '') +
                  ` — zero net growth, design ${String(c.designCeiling)}`;
        lines.push(`  ✅  ceiling ${String(c.ceiling)} tok = ${how}.\n`);
    }
    if (c.activeIds.length > 0) lines.push(`      active exception(s): ${c.activeIds.join(', ')}\n`);
    return lines.join('');
}
