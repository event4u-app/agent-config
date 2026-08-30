/**
 * Per-asset effectiveness, aggregated over the audit stream. READ ONLY.
 *
 * The one rule that shapes every type here: **a missing signal counts as
 * `unknown`, never as success.** An asset that appears in the stream and whose
 * outcome cannot be classified contributes to `unknown` and to nothing else. It
 * does not enter a win-rate numerator, and it does not enter the denominator
 * either — because a rate computed over "everything we saw" silently answers a
 * different question from a rate computed over "everything we could classify",
 * and only the second one is about the asset.
 *
 * `win_rate` is therefore `null` — not `0` — when nothing classifiable was seen.
 * Zero is a measurement meaning "it never worked"; null means "we do not know",
 * and rendering the second as the first is the fabrication this module exists to
 * prevent. A reader seeing `0.0` will act; a reader seeing `—` will ask.
 *
 * Nothing in any selection or routing path may import this module. That is step
 * 6.3's constraint and it is checked by a test, not by convention.
 */

import { type BasisTag } from './evidence_basis.js';

/** What kind of asset a row is about. */
export type AssetKind = 'rule' | 'skill';

export interface AssetRow {
    kind: AssetKind;
    id: string;
    /** Outcomes classified as helpful. */
    helpful: number;
    /** Classified, and neither helpful nor harmful. */
    neutral: number;
    /** Classified as harmful. */
    harmful: number;
    /**
     * Appearances that could not be classified. Its OWN share, reported
     * alongside the rest and never folded into any of them.
     */
    unknown: number;
    /** Consecutive most-recent helpful outcomes. */
    streak: number;
    /**
     * `helpful / (helpful + neutral + harmful)`, or `null` when that
     * denominator is zero. Never `0` in the no-data case.
     */
    win_rate: number | null;
    /** How `win_rate` was arrived at. Every derived figure states its basis. */
    win_rate_basis: BasisTag;
}

/** The audit-line shape this module reads. Deliberately narrow. */
export interface AuditLineView {
    outcome?: unknown;
    rules_applied?: unknown;
    skills_applied?: unknown;
}

/** Outcomes that count as helpful, and the ones that count against. */
const HELPFUL = new Set(['success']);
const HARMFUL = new Set(['error']);
const NEUTRAL = new Set(['skipped', 'blocked']);

interface Tally {
    helpful: number;
    neutral: number;
    harmful: number;
    unknown: number;
    /** Most-recent-first classification history, for the streak. */
    recent: ('helpful' | 'other' | 'unknown')[];
}

function emptyTally(): Tally {
    return { helpful: 0, neutral: 0, harmful: 0, unknown: 0, recent: [] };
}

function classifyOutcome(outcome: unknown): 'helpful' | 'neutral' | 'harmful' | 'unknown' {
    if (typeof outcome !== 'string') return 'unknown';
    if (HELPFUL.has(outcome)) return 'helpful';
    if (HARMFUL.has(outcome)) return 'harmful';
    if (NEUTRAL.has(outcome)) return 'neutral';
    return 'unknown';
}

function idsOf(v: unknown): string[] {
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
}

/**
 * Aggregate.
 *
 * The `skills_applied` half deserves a note, because it is where the
 * absent-vs-empty distinction stops being philosophical. A line that OMITS
 * `skills_applied` recorded nothing about skills, so it contributes no skill
 * row at all — it is not evidence that no skill was applied. A line carrying
 * `[]` recorded that none was applied, which is also no row, but for the
 * opposite reason. Neither may invent an `unknown` against a skill nobody
 * named; `unknown` is counted against an asset the line DID name and whose
 * outcome could not be classified.
 */
export function aggregate(lines: readonly AuditLineView[]): AssetRow[] {
    const tallies = new Map<string, { kind: AssetKind; id: string; t: Tally }>();

    const bump = (kind: AssetKind, id: string, cls: ReturnType<typeof classifyOutcome>): void => {
        const key = `${kind}:${id}`;
        let entry = tallies.get(key);
        if (entry === undefined) {
            entry = { kind, id, t: emptyTally() };
            tallies.set(key, entry);
        }
        entry.t[cls] += 1;
        entry.t.recent.unshift(cls === 'helpful' ? 'helpful' : cls === 'unknown' ? 'unknown' : 'other');
    };

    for (const line of lines) {
        const cls = classifyOutcome(line.outcome);
        for (const id of idsOf(line.rules_applied)) bump('rule', id, cls);
        for (const id of idsOf(line.skills_applied)) bump('skill', id, cls);
    }

    const rows: AssetRow[] = [];
    for (const { kind, id, t } of tallies.values()) {
        const classified = t.helpful + t.neutral + t.harmful;
        // `null`, by construction, whenever nothing was classifiable. The
        // ternary is the whole contract of this module.
        const win_rate = classified === 0 ? null : t.helpful / classified;

        let streak = 0;
        for (const r of t.recent) {
            if (r !== 'helpful') break;
            streak += 1;
        }

        rows.push({
            kind,
            id,
            helpful: t.helpful,
            neutral: t.neutral,
            harmful: t.harmful,
            unknown: t.unknown,
            streak,
            win_rate,
            // Not `measured`: the ratio is arithmetic over counted outcomes,
            // never itself observed. The method travels with it so a reader can
            // tell this apart from a figure derived some other way.
            win_rate_basis: 'estimated:ratio-of-classified-audit-outcomes',
        });
    }

    rows.sort((a, b) => (a.kind === b.kind ? a.id.localeCompare(b.id) : a.kind.localeCompare(b.kind)));
    return rows;
}
