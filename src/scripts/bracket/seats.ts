/**
 * Free seats by content class (road-to-a-loss-that-can-be-appealed Phase 2).
 *
 * ADR-257: an unpaid route may propose and score, never decide. So a free route
 * may compete and may sit on an appeal jury, but never carries a match verdict
 * and never plays the card. Project content never reaches a free route without
 * proof the weights are local (`free_route.ts` content ceiling).
 */
import type { ContentClass } from '../ai_council/content_ceiling.js';
import { MAX_JURY_SEATS } from './engine.js';

export interface SeatAllowance {
    /** Competitor lines a free route may fill. */
    readonly freeCompetitors: number;
    /** Appeal-jury seats a free route may fill; at least one seat stays paid. */
    readonly freeJurySeats: number;
    /** `free` = external free routes, `local` = proven self-hosted weights only. */
    readonly kind: 'free' | 'local' | 'none';
    readonly planLine: string;
}

export function freeSeatAllowance(n: number, content: ContentClass, localProven: boolean): SeatAllowance {
    if (content === 'public-artifact') {
        const free = Math.floor(n / 2);
        return {
            freeCompetitors: free,
            freeJurySeats: MAX_JURY_SEATS - 1,
            kind: 'free',
            planLine: `free seats: up to ${free} of ${n} lines and ${MAX_JURY_SEATS - 1} of ${MAX_JURY_SEATS} jury seats (content is a public artifact; ≥ 2 families required)`,
        };
    }
    if (localProven) {
        return {
            freeCompetitors: Math.floor(n / 2),
            freeJurySeats: MAX_JURY_SEATS - 1,
            kind: 'local',
            planLine: `free seats: local models only (project content, local weights proven); ≥ 1 paid seat stays on the jury`,
        };
    }
    return {
        freeCompetitors: 0,
        freeJurySeats: 0,
        kind: 'none',
        planLine: 'free seats: 0 — content is project content and no local model is proven',
    };
}
