/**
 * Recycle-envelope filesystem contract (road-to-token-economy-recycling
 * Phase 2.2/2.3) — the ONE place the producer (`session:recycle`) and the
 * consumer (`handoff_context_hook`) agree on where the envelope lives and
 * when it is stale. A second copy of any of these values is the drift seam
 * Risk 6 warns about.
 */
import * as path from 'node:path';

/** Where `session:recycle` writes the pending envelope (gitignored runtime state). */
export const RECYCLE_ENVELOPE_REL = path.join('agents', 'runtime', 'state', 'recycle-envelope.json');

/**
 * Where the consumer MOVES the envelope on consumption — moved, not copied,
 * so a consumed or rejected envelope can never leak into a later session,
 * while the last one stays inspectable for debugging.
 */
export const RECYCLE_CONSUMED_REL = path.join(
    'agents',
    'runtime',
    'state',
    'recycle-envelope.consumed.json',
);

/** Staleness guard — mirrors the handoff file's 48 h discipline. */
export const RECYCLE_MAX_AGE_HOURS = 48;

/**
 * Producer-side size cap on the serialized envelope. The schema's per-field
 * caps make a transcript-shaped envelope invalid; this cap keeps even a
 * legal envelope inside the `handoff-context` injection budget
 * (`src/config/hook-token-budget.json`: 8192 B for the concern) with room
 * for the wrapper block and a co-pending handoff.
 */
export const RECYCLE_ENVELOPE_MAX_BYTES = 6144;
