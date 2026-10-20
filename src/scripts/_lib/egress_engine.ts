/**
 * The egress engine as one loadable unit: the rule table, the token grammar,
 * the commit scanner's reading of the table, and what the stage asks the host
 * to do with an event — a replaced tool result or a refused prompt.
 *
 * The dispatcher does not import this statically. `build:hook-chunks` emits it
 * as `dist/hooks/egress_engine.chunk.cjs` beside the dispatch bundle, and
 * `hooks/egress_engine_loader.ts` loads it only when a caller needs detection —
 * the egress stage when its mode is not `off`, the subagent capsule when it
 * validates an envelope. An AI council of two providers chose that shape on
 * 2026-10-18 over a ceiling raise, as it had for the SVG rule set.
 *
 * `ENGINE_SCHEMA` is the handshake. A chunk whose digest matches its sidecar
 * can still be the chunk of another release; the loader refuses one whose
 * schema is not the one it was built against, so a stale chunk is a load
 * failure, never stale rules. Bump it whenever an export below changes shape.
 */
export const ENGINE_SCHEMA = 2;

export { detect, EGRESS_RULES } from './egress_rules.js';
export { EgressRefusedError, replaceValues, TokenScope } from './egress_token.js';
export { scanText } from './secret_detector.js';
export {
    deliveredBodyBytes,
    emitEgress,
    planEgressEmission,
    planStage,
    STAGE_WITHHELD_MARKER,
} from './egress_emission.js';
