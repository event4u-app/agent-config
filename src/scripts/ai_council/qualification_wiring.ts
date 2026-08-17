/**
 * Where provider qualification meets the CLI (road-to-release-review-p0
 * Phase 3).
 *
 * `qualification.ts` classifies and `probe_store.ts` observes; both are pure of
 * the council's own plumbing. This module is the seam: it turns a resolved
 * transport plus a stored observation into a verdict, decides what that verdict
 * does to attendance, and renders it for the two surfaces that show it.
 *
 * **It exists as its own file because the size ratchet said so, and the ratchet
 * was right.** All of this first landed inside `council_cli.ts`, which was
 * already 4,058 lines — over the 1,500-line ceiling — so 253 lines of wiring
 * scored 253 against `check_source_size_budget`, whose metric is
 * `Σ max(0, lines(f) − CEILING)`. The four new modules the same change added
 * scored zero, being well under. That asymmetry is the gate working: it does
 * not object to new code, it objects to new code in the file that is already
 * too big to read. Extracting here costs one import and leaves the seam
 * testable on its own terms.
 *
 * ## The injection contract
 *
 * `build_members` evaluates qualification ONLY when its caller supplies a
 * `probe_store`. Omission is the safe default here rather than the unsafe one,
 * and the reason is determinism, not timidity: the store lives under
 * `agents/runtime/`, which is gitignored, so a `build_members` that read it
 * implicitly would give a different answer on a machine that had run a council
 * pass than on one that had not — the exact per-machine flakiness the
 * `environment_report` injection point already exists to keep out of that
 * function. Every production entry point supplies it; a unit test supplies a
 * fixture or nothing.
 *
 * The matching out-param, `qualification_out`, is empty when no store was
 * passed. Empty means **not evaluated**, which is a different statement from
 * "every seat qualified" and must never be read as the latter.
 *
 * ## What the status surface consulted, and what it did not
 *
 * Reading the store means `cmd_status` now touches a path under the project
 * root. Its ADR-104 claim — that the project tree is never consulted — is
 * therefore scoped to CONFIG resolution, and the probe path is published
 * beside it rather than folded into a hedge.
 */

import {
    formatQualificationLine,
    isCountableForQuorum,
    qualifyMember,
    type MemberQualification,
} from './qualification.js';
import { probeFor, recordProbes, type ProbeEntry, type ProbeStore } from './probe_store.js';
import type { AbsentReason, CliFailureClass, Transport } from './transport_resolver.js';

/** The slice of a resolved transport the ladder consumes. */
export interface ResolvedSlice {
    readonly available: boolean;
    readonly transport: Transport | null;
    readonly reason: string | null;
    readonly absentReason: AbsentReason | null;
}

/**
 * Qualify one enabled member against the store.
 *
 * Called from the member loop BEFORE any branch decides how the seat is built:
 * the branches differ in construction, not in what would qualify, and a
 * per-branch call is how the `manual` path would silently stop being qualified.
 */
export function qualifySeat(
    name: string,
    resolved: ResolvedSlice,
    modelId: string | null,
    store: ProbeStore,
): MemberQualification {
    return qualifyMember({
        name,
        transport: {
            available: resolved.available,
            transport: resolved.transport,
            reason: resolved.reason,
            absentReason: resolved.absentReason,
        },
        modelId,
        lastProbe: probeFor(store, name),
    });
}

export interface AttendanceGate {
    /** Seats to record absent — already-absent names excluded, so no double count. */
    readonly toRecordAbsent: readonly MemberQualification[];
    /** ONE line for the whole roster, or null when every seat is countable. */
    readonly noticeLine: string | null;
}

/**
 * Which qualified seats may not be counted present, and the one line that says
 * so.
 *
 * Two properties this encodes, both of which were review findings:
 *
 *  - **A seat already recorded absent is excluded**, so it is not subtracted
 *    twice — the caller routes the rest through its own `record_absent`, which
 *    keeps the pre-run event's `total - present == absent.length` invariant.
 *  - **One line, not one per seat.** A fresh machine has no store, so every
 *    seat reads `unknown` and the per-seat form printed the full roster on
 *    every invocation, spend-free previews included.
 */
export function attendanceGate(
    qualifications: readonly MemberQualification[],
    alreadyAbsent: ReadonlySet<string>,
): AttendanceGate {
    const blocked = qualifications.filter(
        (q) => !alreadyAbsent.has(q.name) && !isCountableForQuorum(q.verdict),
    );
    if (blocked.length === 0) {
        return { toRecordAbsent: [], noticeLine: null };
    }
    return {
        toRecordAbsent: blocked,
        noticeLine:
            `[council] ${String(blocked.length)} seat(s) not counted toward attendance — ` +
            `${blocked.map(formatQualificationLine).join(' · ')}`,
    };
}

/**
 * The `QuorumAbsentReason` an unqualified seat is recorded under.
 *
 * `unavailable` for BOTH `unavailable` and `unknown`, deliberately: that enum
 * is closed and carries no `unqualified` member, and minting one would be a
 * contract change on an event other instruments parse — to express a
 * distinction the absence `detail` carries losslessly on the same row.
 */
export function absenceReasonFor(_q: MemberQualification): 'unavailable' {
    return 'unavailable';
}

/** The `qualification` block a status payload publishes. */
export function qualificationJson(
    qualifications: readonly MemberQualification[],
): Record<string, unknown> {
    return Object.fromEntries(
        qualifications.map((q) => [
            q.name,
            {
                verdict: q.verdict,
                decided_by: q.decidedBy,
                countable_for_quorum: isCountableForQuorum(q.verdict),
                checks: q.checks.map((c) => ({ id: c.id, status: c.status, detail: c.detail })),
            },
        ]),
    );
}

/**
 * The human status lines: one per seat, then the advice.
 *
 * TWO warnings, not one. A single "run a pass and it resolves itself" was
 * emitted for every uncountable seat including `unavailable` ones, where it is
 * false — and it sent the operator to re-run instead of to the actual fault.
 */
export function qualificationStatusLines(
    qualifications: readonly MemberQualification[],
): string[] {
    const lines = qualifications.map((q) => `  qualification    ${formatQualificationLine(q)}`);
    const total = String(qualifications.length);
    const unknown = qualifications.filter((q) => q.verdict === 'unknown').length;
    const unavailable = qualifications.filter((q) => q.verdict === 'unavailable').length;
    if (unknown > 0) {
        lines.push(
            `  ⚠️  ${String(unknown)} of ${total} seat(s) have no recorded exchange and read \`unknown\`, so they are`,
            '     not counted toward a quorum. Run a council pass and this resolves itself.',
        );
    }
    if (unavailable > 0) {
        lines.push(
            `  ❌  ${String(unavailable)} of ${total} seat(s) are \`unavailable\` — a pass will NOT fix these.`,
            '     Read the deciding check on each line above and repair that.',
        );
    }
    return lines;
}

/** How many seats a status surface may count toward a quorum. */
export function countableSeats(qualifications: readonly MemberQualification[]): number {
    return qualifications.filter((q) => isCountableForQuorum(q.verdict)).length;
}

/**
 * Per-member observations from one index-aligned round of responses.
 *
 * ONE definition, used by the run path and the debate path both. A second copy
 * is how the two would drift on what counts as an answer — and "non-empty text,
 * not merely the absence of an error" is a distinction this repository already
 * paid for once, when a 290 s timeout returned an empty body with no error set
 * and the banner printed full attendance.
 *
 * Typed structurally rather than against the client classes on purpose: this
 * module has no business importing the transport layer to read two fields, and
 * the looser signature is what lets it be tested without constructing a client.
 */
export function probesFromRound(
    members: readonly { readonly name: string }[],
    responses: readonly ({ readonly error?: unknown; readonly text: string } | undefined)[],
    classify: (raw: string) => CliFailureClass,
    at: string,
): ProbeEntry[] {
    const probes: ProbeEntry[] = [];
    for (let i = 0; i < members.length; i++) {
        const m = members[i] as { readonly name: string };
        const r = responses[i];
        if (r !== undefined && !r.error && r.text.trim() !== '') {
            probes.push({ name: m.name, outcome: 'ok', at });
            continue;
        }
        const raw =
            (r?.error as string | undefined) ??
            (r !== undefined && r.text.trim() === '' ? 'empty response body' : 'no response');
        probes.push({ name: m.name, outcome: classify(String(raw)), at });
    }
    return probes;
}

/** Today, as the store records it. Extracted so a test can pin the date. */
export function observationDate(now: Date = new Date()): string {
    return now.toISOString().slice(0, 10);
}

/**
 * Record one round's observations into the store — the whole side effect, at
 * one call site per path.
 *
 * Unguarded by any success check on purpose: a pass that errored is as
 * informative an observation as one that answered, and `recordProbes` is
 * best-effort by construction, so a write failure cannot break the run.
 */
export function recordRoundObservations(
    root: string,
    members: readonly { readonly name: string }[],
    responses: readonly ({ readonly error?: unknown; readonly text: string } | undefined)[],
    classify: (raw: string) => CliFailureClass,
): void {
    recordProbes(root, probesFromRound(members, responses, classify, observationDate()));
}
