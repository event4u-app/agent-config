/**
 * Concrete observability hooks shipped with the engine.
 *
 * TypeScript twin of `work_engine/hooks/builtin/__init__.py` (ADR-200 py2ts —
 * work_engine.hooks.builtin subpackage). Phase 4 hooks: low-risk, default-off,
 * observe-only. Each hook exposes a `register(registry)` method so the
 * registry stays the single source of truth for event → callback wiring.
 */
export { ChatHistoryAppendHook } from './chat_history_append.js';
export { ChatHistoryHaltAppendHook } from './chat_history_halt_append.js';
export { DecisionGateHook, build_decision_gate_hook } from './decision_gate.js';
export { DecisionTraceHook } from './decision_trace.js';
export { DirectiveSetGuardHook } from './directive_set_guard.js';
export { HaltSurfaceAuditHook } from './halt_surface_audit.js';
export { MemoryVisibilityHook } from './memory_visibility.js';
export { StateShapeValidationHook } from './state_shape_validation.js';
export { TraceHook } from './trace.js';
