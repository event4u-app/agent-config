/**
 * The impact-driven bump rule (ADR-300): `release.ts` numbers a release by the
 * span's `Consumer-Impact:` trailers and the major surfaces its diff touched,
 * and the replay below scores the same rule against the recorded history.
 */
import { CONSUMER_IMPACT_VALUES, IMPACT_RANK, type ConsumerImpact, type ImpactTrailers } from './consumer_impact.js';
import type { MajorSurface } from './major_surface.js';

export type Bump = 'major' | 'minor' | 'patch';

export interface BumpInput {
    readonly impact: ConsumerImpact;
    readonly breaking: boolean;
    readonly has_minor_type: boolean;
    readonly touches_major_surface: boolean;
}

export function impact_bump(input: BumpInput): Bump {
    if (input.impact === 'action' || input.touches_major_surface) return 'major';
    if (input.breaking || input.has_minor_type) return 'minor';
    return 'patch';
}

export interface ImpactRow {
    readonly version: string;
    /** `null` when the last cell is not a value from the enum. */
    readonly impact: ConsumerImpact | null;
}

/** Rows of the by-major table: first cell `**X.0.0**`, last cell the impact. */
export function parse_impact_rows(markdown: string): ImpactRow[] {
    const rows: ImpactRow[] = [];
    for (const line of markdown.split('\n')) {
        const m = /^\| \*\*(\d+\.0\.0)\*\* \|.*\| ([^|]*?) \|\s*$/.exec(line);
        if (m === null) continue;
        const cell = m[2] as string;
        const impact = (CONSUMER_IMPACT_VALUES as readonly string[]).includes(cell) ? (cell as ConsumerImpact) : null;
        rows.push({ version: m[1] as string, impact });
    }
    return rows;
}

/**
 * Every recorded row was cut as a major because it carried a breaking subject,
 * so each replays with `breaking: true`. The surface half of the rule is not
 * scored: the record has no column for it, and inferring one would re-judge
 * history. An unreadable impact replays as `major`, never as a downgrade.
 */
export function replay_majors(rows: readonly ImpactRow[]): Map<string, Bump> {
    const strongest = new Map<string, ConsumerImpact | null>();
    for (const row of rows) {
        const prev = strongest.get(row.version);
        if (prev === undefined) {
            strongest.set(row.version, row.impact);
        } else if (prev !== null && (row.impact === null || IMPACT_RANK[row.impact] > IMPACT_RANK[prev])) {
            strongest.set(row.version, row.impact);
        }
    }
    const out = new Map<string, Bump>();
    for (const [version, impact] of strongest) {
        out.set(
            version,
            impact === null
                ? 'major'
                : impact_bump({ impact, breaking: true, has_minor_type: false, touches_major_surface: false }),
        );
    }
    return out;
}

export interface SpanBumpInput {
    readonly commits: readonly { readonly breaking: boolean; readonly trailers: ImpactTrailers }[];
    readonly has_minor_type: boolean;
    readonly surfaces: ReadonlySet<MajorSurface>;
}

/**
 * The bump for a release span.
 *
 * A breaking commit with no valid trailer stays a major: the trailer binds the
 * bump only where an author declared it, and an absent or invalid declaration
 * says nothing, so it falls back to the punctuation rather than downgrading.
 * A settings-key removal is not a major when the span's strongest declared
 * impact is `automatic` — the migration exception ADR-300 records — and is one
 * in every other case, including a span that declares nothing.
 */
export function span_bump(input: SpanBumpInput): Bump {
    if (input.commits.some((c) => c.breaking && !c.trailers.recorded)) return 'major';
    let impact: ConsumerImpact = 'none';
    for (const c of input.commits) {
        if (c.trailers.recorded && IMPACT_RANK[c.trailers.impact] > IMPACT_RANK[impact]) impact = c.trailers.impact;
    }
    const touches_major_surface = [...input.surfaces].some((s) => s !== 'settings-keys' || impact !== 'automatic');
    return impact_bump({
        impact,
        breaking: input.commits.some((c) => c.breaking),
        has_minor_type: input.has_minor_type,
        touches_major_surface,
    });
}
