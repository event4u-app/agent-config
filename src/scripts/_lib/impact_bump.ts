/**
 * The impact-driven bump rule, scored against the recorded history.
 *
 * Nothing in `release.ts` calls this: changing how releases are numbered is an
 * owner decision that has not been taken. Until it is, the rule only scores
 * historical rows, so the decision can be made on a measured replay.
 */
import { CONSUMER_IMPACT_VALUES, IMPACT_RANK, type ConsumerImpact } from './consumer_impact.js';

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
