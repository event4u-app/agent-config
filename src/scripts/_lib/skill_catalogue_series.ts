/**
 * skill_catalogue_series — the SERIES layer over the observation log.
 *
 * `skill_catalogue` answers "what did this one observation measure". This
 * module answers the three questions that need MORE than one record: is a
 * host's series stale, how far is the corpus from the bar it is filling
 * toward, and does the host's delivery diverge from the disk the runtime
 * ranker reads.
 *
 * Split out of `skill_catalogue.ts` when that file crossed the 1,500-line
 * source ceiling by four lines. Extraction rather than a raised baseline is
 * the ratchet's own doctrine — and the seam is a real one rather than a
 * convenient cut: nothing here is imported by `install.ts`, so the
 * deploy-time warning path keeps exactly the surface it had.
 *
 * The two laws of the parent module hold here without restatement, and both
 * are load-bearing in this file specifically:
 *
 *   A ZERO IS NEVER INFERRED FROM SILENCE. A host that publishes no
 *   per-entry list is SKIPPED by the join, never scored 0 — its empty
 *   `bare_names` records that nothing was enumerated, not that nothing was
 *   bare. An unparseable date reads as DUE, never as fresh.
 *
 *   NOTHING IS POOLED ACROSS HOSTS. Cadence is per host and the D-4 headline
 *   is per host, for the reason `formatPerHostVerdicts` states: two hosts
 *   truncate by different mechanisms, so one number over both describes
 *   neither.
 *
 * PRIVACY BY CONSTRUCTION is inherited: every type here holds skill names,
 * integers, host labels and closed enums. None can hold free-form content.
 */

import {
    type HostProjectionRow,
    type ObservationRecord,
    type ObservationSource,
    type ProjectionMode,
    headlineRecordPerHost,
    observationSourceOf,
    truncationModeOf,
} from './skill_catalogue.js';

/* ------------------------------------------------------------------ *
 * The cadence — is an observation due, and how far is the corpus?
 * ------------------------------------------------------------------ */

/**
 * Days after which one host's series is stale and an observation is due.
 *
 * A **stated default, not a measured optimum** — said plainly rather than
 * implying a derivation it does not have. Nothing in the corpus measures how
 * fast a host's truncation behaviour changes; what is known is that it changes
 * at all (the codex drop moved 393 → 401 → 402 → 330 across four readings, the
 * last of them because OUR projection scope changed, not the host).
 *
 * *Revisit-if:* two consecutive rounds a week apart record identical figures on
 * every host (too frequent — widen it), or a host limit is observed to move
 * inside one interval (too slow — narrow it). Either falsifies the number, not
 * the obligation to keep the series current.
 */
export const OBSERVATION_CADENCE_DAYS = 7;

/**
 * The volume and host bars the corpus is filling toward.
 *
 * **Quoted, never invented here.** Both come from the parent blocker's own
 * wording — "≥ 20 observations across ≥ 2 hosts" — recorded in
 * `agents/evidence/investigations/skill-catalogue-codex-truncation.md` § 1 and
 * § 5 and in the blocker that still carries it. This module reports progress
 * against them; it does not get to move them.
 */
export const OBSERVATION_VOLUME_BAR = 20;
export const OBSERVATION_HOST_BAR = 2;

/** Whole days from `fromISO` to `toISO`; negative when `toISO` is earlier. */
function wholeDaysBetween(fromISO: string, toISO: string): number {
    const from = Date.parse(`${fromISO}T00:00:00Z`);
    const to = Date.parse(`${toISO}T00:00:00Z`);
    if (Number.isNaN(from) || Number.isNaN(to)) return Number.NaN;
    return Math.round((to - from) / 86_400_000);
}

/** One host's standing in the series. Counts only; no free-form field. */
export interface CadenceRow {
    host: string;
    /** The source the host's own latest record came from. */
    source: ObservationSource;
    observations: number;
    lastObservedAt: string;
    /** Whole days since that record; `NaN` when its stamp is unparseable. */
    daysSince: number;
    due: boolean;
    /**
     * Observations of this host carrying NO `projection_mode`. Not a defect to
     * backfill — those readings were taken without asking, and relabelling one
     * afterwards would invent a measurement. They are simply not comparable
     * across modes, so the count is published rather than hidden.
     */
    unscoped: number;
}

/**
 * Per-host cadence, never pooled — the same reason `formatPerHostVerdicts`
 * refuses to pool: two hosts truncate by different mechanisms, so "the corpus
 * is fresh" is not a statement either host makes on its own.
 *
 * A host with no record at all cannot appear here: this reads the log, and a
 * host that was never observed has nothing to be stale. The volume bar below
 * is what surfaces that gap.
 */
export function cadenceStatus(
    records: readonly ObservationRecord[],
    todayISO: string,
): CadenceRow[] {
    const byHost = new Map<string, ObservationRecord[]>();
    for (const record of records) {
        const bucket = byHost.get(record.host) ?? [];
        bucket.push(record);
        byHost.set(record.host, bucket);
    }
    const headline = headlineRecordPerHost(records);

    const rows: CadenceRow[] = [];
    for (const host of [...byHost.keys()].sort()) {
        const bucket = byHost.get(host)!;
        const latest = headline.get(host)!;
        const daysSince = wholeDaysBetween(latest.observed_at, todayISO);
        rows.push({
            host,
            source: observationSourceOf(latest),
            observations: bucket.length,
            lastObservedAt: latest.observed_at,
            daysSince,
            // An unparseable stamp reads as DUE, never as fresh: a broken date
            // and a current one must not look alike, which is the same
            // zero-from-silence law the host-event parser follows.
            due: Number.isNaN(daysSince) || daysSince >= OBSERVATION_CADENCE_DAYS,
            unscoped: bucket.filter((r) => r.projection_mode === undefined).length,
        });
    }
    return rows;
}

/**
 * The cadence as an operator report: who is due, and how far the corpus is from
 * the bar it is filling toward.
 *
 * Prints the exact next command per host rather than describing it. The codex
 * side is deterministic and scriptable; the claude side is self-report and only
 * an agent reading its own context can produce it — the asymmetry is stated
 * here because a report that hid it would read as "both are automatable".
 */
export function formatCadenceStatus(
    rows: readonly CadenceRow[],
    todayISO: string,
): string {
    const lines: string[] = [];
    lines.push(`cadence: one observation per host every ${OBSERVATION_CADENCE_DAYS} day(s) · today ${todayISO}`);
    lines.push('');

    if (rows.length === 0) {
        lines.push('no observations recorded yet — every host is due.');
    }

    for (const row of rows) {
        const age = Number.isNaN(row.daysSince)
            ? `stamp unparseable (${row.lastObservedAt})`
            : `${row.daysSince} day(s) ago`;
        lines.push(
            `${row.due ? '⚠️ ' : '✅'} ${row.host}: ${row.observations} observation(s) · ` +
                `latest ${row.lastObservedAt} (${age}) · source ${row.source}`,
        );
        if (row.unscoped > 0) {
            lines.push(
                `     ${row.unscoped} of them carry no projection scope — not comparable across modes, and not backfillable.`,
            );
        }
    }

    const total = rows.reduce((sum, row) => sum + row.observations, 0);
    lines.push('');
    lines.push(
        `volume: ${total}/${OBSERVATION_VOLUME_BAR} observation(s) across ${rows.length}/${OBSERVATION_HOST_BAR} host(s) — ` +
            (total >= OBSERVATION_VOLUME_BAR && rows.length >= OBSERVATION_HOST_BAR
                ? 'both bars met.'
                : 'the bar the parent blocker states, quoted not invented.'),
    );
    return lines.join('\n');
}

/** Whether a round may carry a `--projection-mode`, and why not when it may not. */
export interface ScopeFlagDecision {
    /** The measured mode, or `null` when none may be claimed. */
    mode: ProjectionMode | null;
    /** One line stating what was measured, or why no mode is claimable. */
    reason: string;
}

/**
 * Decide whether a capture round may name a projection mode.
 *
 * Exported and pure BECAUSE it is the load-bearing correction: the cadence
 * output first printed `--projection-mode <scoped|legacy-all>` as a
 * placeholder, and a placeholder invites the operator to pick — on a root
 * matching neither count, either pick is the relabelling
 * `ObservationRecord.projection_mode` forbids. A decision nothing pins is a
 * decision a later edit regresses silently, so both omit-with-a-reason branches
 * are fixtured.
 *
 * `rootExists: false` and `indeterminate` are deliberately distinct reasons.
 * They produce the same output — no flag — from different facts, and collapsing
 * them would report "this install's scope is unmeasurable" for a host that is
 * simply not installed.
 */
export function scopeFlagDecision(
    root: string,
    rootExists: boolean,
    row: HostProjectionRow | null,
): ScopeFlagDecision {
    if (!rootExists || row === null) {
        return {
            mode: null,
            reason: `${root} is not installed here, so the scope of the observed install cannot be measured from this machine.`,
        };
    }
    if (row.matches === 'indeterminate') {
        return {
            mode: null,
            reason:
                `${root} holds ${row.installedSkills} skills, which matches neither projection count — ` +
                'another suite, a plugin, or a stale install all produce that. Recording a mode here would label a reading nobody took.',
        };
    }
    return {
        mode: row.matches,
        reason: `scope measured off ${root} (${row.installedSkills} skills).`,
    };
}

/* ------------------------------------------------------------------ *
 * D-4 — host truth against disk truth: pointable but bare.
 * ------------------------------------------------------------------ */

/** One per-entry observation joined against the ranker's on-disk catalogue. */
export interface PointableBareRow {
    host: string;
    observedAt: string;
    bareTotal: number;
    /** Bare entries the ranker can still name — the D-4 divergence. */
    pointableBare: number;
    /** Bare entries absent from the ranker's catalogue; it cannot name them. */
    unpointableBare: number;
    pointableNames: string[];
    unpointableNames: string[];
}

/**
 * Intersect the bare names of every per-entry observation with the catalogue the
 * runtime ranker reads.
 *
 * The defect this counts (D-4): `skill-route` ranks the on-disk tree, so a skill
 * the host truncated is still rankable and still pointable — and the pointer
 * then names a skill whose description the model never received. That is worse
 * than silence, because the pointer reads as a delivered capability.
 *
 * **Only `per-entry` records are joined, and skipping the others is the point.**
 * A `budget-strip-and-drop` host publishes no per-entry list at all, so its
 * `bare_names` is empty because nothing was enumerated — not because nothing was
 * bare. Emitting a row of 0 for it would be a zero inferred from silence, which
 * this module's header forbids in the one place it would be easiest to do.
 *
 * A row of 0 on a per-entry record IS a legitimate answer: it means every entry
 * the host degraded is also absent from the ranker's tree, so the ranker cannot
 * point at one.
 */
/** What one join pass produced, including what it refused to read. */
export interface PointableBareJoin {
    rows: PointableBareRow[];
    /** Records skipped because their host publishes no per-entry list. */
    skippedNonPerEntry: number;
    /**
     * Per-entry records skipped because `bare_names` was not an array.
     *
     * `readObservationLog` produces records by an unchecked `JSON.parse … as`,
     * and the log is append-only with more than one producer, so a malformed
     * line is a real state. Counting it separately keeps it from disappearing
     * into the same silence as a legitimately empty join — the sibling reducer
     * `knownHostLimits` guards its own field for the same reason.
     */
    skippedMalformed: number;
}

export function joinPointableBare(
    records: readonly ObservationRecord[],
    rankerCatalogueNames: readonly string[],
): PointableBareJoin {
    const rankable = new Set(rankerCatalogueNames);
    const rows: PointableBareRow[] = [];
    let skippedNonPerEntry = 0;
    let skippedMalformed = 0;
    for (const record of records) {
        if (truncationModeOf(record) !== 'per-entry') {
            skippedNonPerEntry += 1;
            continue;
        }
        if (!Array.isArray(record.bare_names)) {
            skippedMalformed += 1;
            continue;
        }
        const pointable = record.bare_names.filter((name) => rankable.has(name));
        const unpointable = record.bare_names.filter((name) => !rankable.has(name));
        rows.push({
            host: record.host,
            observedAt: record.observed_at,
            bareTotal: record.bare_names.length,
            pointableBare: pointable.length,
            unpointableBare: unpointable.length,
            pointableNames: pointable,
            unpointableNames: unpointable,
        });
    }
    return { rows, skippedNonPerEntry, skippedMalformed };
}

/**
 * The latest joined row per host, by `observedAt`.
 *
 * The headline is stated PER HOST and off the latest row, never as one maximum
 * across the corpus. A pooled max lets a superseded observation supply the
 * number while the current one reads 0, with no host or date attached to it —
 * which is the exact failure `_supersedes` was introduced for (two reducers
 * broke a same-date tie in opposite directions and printed two drop counts for
 * one host on one day) and which `formatPerHostVerdicts` refuses on the stated
 * grounds that two hosts truncate by different mechanisms.
 */
export function latestPointableBarePerHost(
    rows: readonly PointableBareRow[],
): Map<string, PointableBareRow> {
    const out = new Map<string, PointableBareRow>();
    for (const row of rows) {
        const held = out.get(row.host);
        if (held === undefined || row.observedAt >= held.observedAt) out.set(row.host, row);
    }
    return out;
}

/** The join as an operator report. Zero is printed as a result, not as absence. */
export function formatPointableBare(
    join: PointableBareJoin,
    catalogueRoot: string,
    catalogueSize: number,
): string {
    const { rows, skippedNonPerEntry, skippedMalformed } = join;
    const lines: string[] = [];
    lines.push(`ranker catalogue: ${catalogueRoot} (${catalogueSize} entries)`);
    lines.push('');

    if (rows.length === 0) {
        lines.push(
            'no per-entry observation to join. This is NOT a count of zero: only a host that',
            'enumerates which entries arrived bare can be joined, and none has been recorded.',
        );
    }

    for (const row of rows) {
        lines.push(
            `${row.host} ${row.observedAt}: ${row.pointableBare} pointable-but-bare of ${row.bareTotal} bare`,
        );
        if (row.pointableBare > 0) {
            lines.push(`   the ranker can name: ${row.pointableNames.join(', ')}`);
        }
        if (row.unpointableBare > 0) {
            lines.push(
                `   bare and NOT in the ranker's catalogue (${row.unpointableBare}): ${row.unpointableNames.join(', ')}`,
            );
        }
    }

    if (skippedNonPerEntry > 0) {
        lines.push('');
        lines.push(
            `skipped ${skippedNonPerEntry} observation(s) whose host publishes no per-entry list —`,
            'their empty `bare_names` records that nothing was enumerated, not that nothing was bare.',
        );
    }
    if (skippedMalformed > 0) {
        lines.push('');
        lines.push(
            `⚠️  skipped ${skippedMalformed} per-entry record(s) carrying no \`bare_names\` array —`,
            'malformed log line(s). Reported rather than absorbed: a skipped record and a joined',
            'record that found nothing must not look alike.',
        );
    }

    lines.push('');
    if (rows.length === 0) {
        lines.push('D-4 divergence: unmeasured.');
        return lines.join('\n');
    }
    lines.push('D-4 divergence, per host, off that host\'s LATEST joined observation:');
    for (const [host, row] of [...latestPointableBarePerHost(rows)].sort((a, b) =>
        a[0].localeCompare(b[0]),
    )) {
        lines.push(
            row.pointableBare > 0
                ? `  ${host} (${row.observedAt}): ${row.pointableBare} skill(s) the ranker may point at while the model never received their description.`
                : `  ${host} (${row.observedAt}): 0 — the ranker points at nothing this host degraded.`,
        );
    }
    return lines.join('\n');
}
