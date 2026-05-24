/**
 * Weekly aggregate counters. Pre-stitched so the maintainer dashboard
 * never needs to scan raw event keys past the 14-day window.
 *
 * Stored under `funnel:weekly:<iso-week>` with a 24-month TTL. The
 * record is a flat counter map keyed by the dimension being counted —
 * no `session_id`, no timestamps below week granularity.
 */

import { isoWeekOf, weeklyAggregateKey } from './kv-keys.js';
import type { InstallStageEvent, KVNamespace } from './types.js';

const AGGREGATE_TTL_SECONDS = 63_072_000; // 24 months

export interface WeeklyAggregate {
    readonly week: string;
    readonly counters: Record<string, number>;
}

export async function bumpAggregate(
    kv: KVNamespace,
    event: InstallStageEvent,
    now: Date,
): Promise<void> {
    const week = isoWeekOf(now);
    const raw = await kv.get(weeklyAggregateKey(week));
    const existing = parseAggregate(raw, week);
    const counters = { ...existing.counters };

    for (const key of countersFor(event)) {
        counters[key] = (counters[key] ?? 0) + 1;
    }

    await kv.put(
        weeklyAggregateKey(week),
        JSON.stringify({ week, counters }),
        { expirationTtl: AGGREGATE_TTL_SECONDS },
    );
}

function parseAggregate(raw: string | null, week: string): WeeklyAggregate {
    if (raw === null) return { week, counters: {} };
    try {
        const parsed = JSON.parse(raw) as Partial<WeeklyAggregate>;
        if (typeof parsed.counters !== 'object' || parsed.counters === null) {
            return { week, counters: {} };
        }
        return { week, counters: parsed.counters as Record<string, number> };
    } catch {
        return { week, counters: {} };
    }
}

function countersFor(event: InstallStageEvent): readonly string[] {
    const keys: string[] = [
        `stage:${event.stage}`,
        `entry_path:${event.entry_path}`,
        `host_agent_family:${event.host_agent_family}`,
        `os:${event.os}`,
        `node_major:${event.node_major}`,
        `duration_bucket:${event.duration_bucket}`,
        `wizard_used:${event.wizard_used ? 'true' : 'false'}`,
    ];
    if (event.pack_categories !== undefined) {
        for (const cat of event.pack_categories) {
            keys.push(`pack_category:${cat}`);
        }
    }
    if (event.error_class !== undefined) {
        keys.push(`error_class:${event.error_class}`);
    }
    return keys;
}
