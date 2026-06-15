/**
 * `work_engine.hooks` — cross-cutting lifecycle hooks for the engine.
 *
 * TypeScript twin of `work_engine/hooks/__init__.py` (ADR-200 py2ts —
 * work_engine.hooks subpackage). Public surface:
 *
 * - `HookEvent` — ten lifecycle events, two layers.
 * - `HookContext` — per-event payload.
 * - `HookError` / `HookHalt` — three-tier error contract.
 * - `HookRegistry` — insertion-ordered event → callbacks map.
 * - `HookRunner` — single emit point, owns the error contract.
 */
export {
    ChatHistoryAppendHook,
    ChatHistoryHaltAppendHook,
    DecisionTraceHook,
    DirectiveSetGuardHook,
    HaltSurfaceAuditHook,
    MemoryVisibilityHook,
    StateShapeValidationHook,
    TraceHook,
} from './builtin/index.js';
export { HookContext } from './context.js';
export { HookEvent } from './events.js';
export { HookError, HookHalt } from './exceptions.js';
export { type HookCallback, HookRegistry } from './registry.js';
export { HookRunner } from './runner.js';
