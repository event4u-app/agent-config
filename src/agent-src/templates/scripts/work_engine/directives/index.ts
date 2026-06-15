/**
 * Directive-set bundles consumed by the dispatcher.
 *
 * TypeScript twin of `work_engine/directives/__init__.py` (ADR-096 py2ts
 * Phase 1 — work_engine TOP/integration layer). The `__init__.py` → `index.ts`
 * mapping mirrors the hooks subpackage convention.
 *
 * A *directive set* is a coherent group of step handlers (refine,
 * memory, analyze, plan, implement, test, verify, report) tuned for a
 * particular kind of work — backend coding, UI work, mixed front+back
 * work, and so on. The dispatcher selects exactly one set per cycle
 * (see `dispatcher.select_directive_set`) and walks its eight steps
 * in the canonical order.
 *
 * Each set is a sub-package exposing a single function:
 *
 *     function get_steps(): Mapping<string, Step>
 *
 * The mapping must cover every entry in `dispatcher.STEP_ORDER`;
 * incomplete bundles raise at dispatch time.
 *
 * The schema (`state.KNOWN_DIRECTIVE_SETS`) carries the *external*
 * names `ui`, `ui-trivial`, `mixed`; the directory layout uses
 * underscores (`ui_trivial`) because Python packages cannot contain
 * hyphens. The dispatcher's loader is the single place that translates
 * between the two.
 */

// The Python `__init__` declares `__all__: list[str] = []` — no re-exports.
// This twin is the package marker module; consumers import the per-set
// `index.ts` directly (e.g. `./backend/index.js`).
export {};
