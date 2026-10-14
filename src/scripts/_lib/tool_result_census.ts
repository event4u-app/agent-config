/**
 * Reader for `agents/runtime/state/tool-result-census.jsonl`
 * (`road-to-bytes-the-model-actually-receives` step 1.3).
 *
 * The census holds two line shapes. Lines written before the two-field schema
 * carry `{ts, tool, bytes}`; lines from 2026-09-30 on carry
 * `{ts, tool, raw_bytes, delivered_bytes, measurable}`. The census is
 * append-only, so both shapes stay in the file for good.
 *
 * A legacy `bytes` counted the same thing `raw_bytes` counts — the host's hook
 * envelope. It says nothing about what was delivered, so a legacy line reads
 * as `delivered_bytes: null`. Reading it as equal would invent a figure for
 * every line written before the second field existed.
 *
 * Neither shape counts what reached the model; that is
 * `tool-model-visible-bytes`, read from transcripts (`cc_transcript.ts`).
 */

export type CensusShape = 'legacy' | 'two-field';

export interface CensusReading {
    ts: string;
    tool: string | null;
    /** Hook-envelope bytes, or `null` when the line recorded none. */
    raw_bytes: number | null;
    /** Hook-envelope bytes after any rewrite; `null` when unknown — always so for a legacy line. */
    delivered_bytes: number | null;
    shape: CensusShape;
}

function numOrNull(v: unknown): number | null {
    return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

/** One census line, or `null` for a blank, unparseable or shapeless line. */
export function readCensusLine(line: string): CensusReading | null {
    if (line.trim() === '') return null;
    let parsed: unknown;
    try {
        parsed = JSON.parse(line);
    } catch {
        return null;
    }
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return null;
    const rec = parsed as Record<string, unknown>;
    const ts = typeof rec['ts'] === 'string' ? rec['ts'] : null;
    if (ts === null) return null;
    const tool = typeof rec['tool'] === 'string' ? rec['tool'] : null;
    if ('raw_bytes' in rec || 'delivered_bytes' in rec) {
        return {
            ts,
            tool,
            raw_bytes: numOrNull(rec['raw_bytes']),
            delivered_bytes: numOrNull(rec['delivered_bytes']),
            shape: 'two-field',
        };
    }
    if ('bytes' in rec) {
        return { ts, tool, raw_bytes: numOrNull(rec['bytes']), delivered_bytes: null, shape: 'legacy' };
    }
    return null;
}
